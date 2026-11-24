import { SyntaxNode } from "@lezer/common";
import { findChild, findChildren, findDescendants } from "./tree-utils.js";
import { CompilationUnit, TypeInfo } from "./unit.js";

// resolving type information out of an AST is hard, so we'll focus on basic name resolution for now
// i.e. no member references
// this will probably need to be rewritten later to support that

/**
 * Basic type reference information.
 */
export interface TypeReference {
    name: string;
}

/**
 * Local type reference within the same compilation unit.
 */
export interface LocalTypeReference extends TypeReference {
    node: SyntaxNode;
}

/**
 * External type reference from another compilation unit.
 */
export interface ExternalTypeReference extends TypeReference {
    qualifiedName: string;
    packageName: string | null;
    moduleName: string | null;
}

/**
 * Common information returned by resolvers operating on source declarations or references.
 */
export interface Resolved {
    name: string;
    category: "type" | "declaration";
}

/**
 * Resolved type information.
 *
 * Includes whether the type is declared locally, imported, or a built-in type.
 */
export interface ResolvedType extends Resolved {
    category: "type";
    kind: "declared" | "imported" | "builtin";
    name: string;
    qualifiedName?: string;
    declaration?: SyntaxNode;

    ref: LocalTypeReference;
}

const BUILTIN_TYPES = new Set(["byte", "short", "int", "long", "char", "float", "double", "boolean", "void"]);
const ALLOWED_PARENTS = new Set([
    "TypeName",
    "ScopedTypeName",
    "PrimitiveType",
    "void",
    "Identifier",
    "ScopedIdentifier",
    "Definition",
    "FieldAccess",
]);

// the limit here is kinda hacking around cases where we don't want the entire fully qualified name
// the AST is a bit awkward to work with in this regard
const getTypeName = (node: SyntaxNode, source: string, limit: number = node.to): string | null => {
    switch (node.name) {
        case "TypeName":
        case "ScopedTypeName": {
            if (node.parent && ALLOWED_PARENTS.has(node.parent.type.name)) {
                return getTypeName(node.parent, source, limit);
            }

            return source.slice(node.from, Math.min(limit, node.to));
        }
        case "PrimitiveType":
        case "void": {
            return source.slice(node.from, node.to);
        }
        case "Identifier":
        case "ScopedIdentifier": {
            if (node.parent) {
                if (ALLOWED_PARENTS.has(node.parent.type.name)) {
                    return getTypeName(node.parent, source);
                } else if (
                    node.parent.name !== "MarkerAnnotation" &&
                    node.parent.name !== "Annotation" &&
                    node.parent.name !== "AnnotationTypeDeclaration"
                ) {
                    // TODO: class literals are a bit broken in the AST, work around that here
                    // only allow getting Identifier-based type names from annotations
                    return null;
                }
            }

            return source.slice(node.from, node.to);
        }
        case "Definition": {
            if (
                !node.parent ||
                (node.parent.name !== "EnumDeclaration" &&
                    node.parent.name !== "ClassDeclaration" &&
                    node.parent.name !== "ConstructorDeclaration" &&
                    node.parent.name !== "InterfaceDeclaration" &&
                    node.parent.name !== "LocalVariableDeclaration" &&
                    node.parent.name !== "RecordDeclaration")
            ) {
                // only allow getting Definition-based type names from these declarations
                return null;
            }

            return source.slice(node.from, node.to);
        }
        case "FieldAccess": {
            if (node.parent?.name === "FieldAccess") {
                // pointing at a field, we can't resolve that
                return null;
            }

            // pointing at an inner class access or a different expression, we can't resolve that
            return node.firstChild?.name === "Identifier"
                ? source.slice(node.firstChild.from, node.firstChild.to)
                : null;
        }
    }

    return null;
};

const resolveInUnit = (typeName: string, unit: CompilationUnit): TypeInfo | null => {
    for (const cls of unit.types) {
        if (
            cls.name === typeName ||
            cls.qualifiedName === typeName ||
            (unit.packageName ? `${unit.packageName}.` : "") + cls.qualifiedName === typeName
        ) {
            return cls;
        }
    }

    return null;
};

const resolveImported = (
    typeRef: LocalTypeReference,
    unit: CompilationUnit,
    externalRefs: ExternalTypeReference[]
): ResolvedType => {
    // type imports
    for (const imp of unit.imports) {
        if (
            imp.kind === "type" &&
            (imp.importedName === typeRef.name || imp.importedName.endsWith(`.${typeRef.name}`))
        ) {
            return {
                category: "type",
                kind: "imported",
                name: typeRef.name,
                qualifiedName: imp.importedName,
                ref: typeRef,
            };
        }
    }

    // wildcard imports
    for (const imp of unit.imports) {
        if (imp.kind === "wildcard") {
            const matchingExternal = externalRefs.find(
                (ext) => `${imp.importedName}.${typeRef.name}` === ext.qualifiedName
            );
            if (matchingExternal) {
                return {
                    category: "type",
                    kind: "imported",
                    name: typeRef.name,
                    qualifiedName: matchingExternal.qualifiedName,
                    ref: typeRef,
                };
            }
        }
    }

    // module imports
    for (const imp of unit.imports) {
        if (imp.kind === "module") {
            const matchingExternal = externalRefs.find(
                (ext) =>
                    ext.moduleName === imp.importedName &&
                    (ext.name === typeRef.name || ext.qualifiedName.endsWith(`.${typeRef.name}`))
            );
            if (matchingExternal) {
                return {
                    category: "type",
                    kind: "imported",
                    name: typeRef.name,
                    qualifiedName: matchingExternal.qualifiedName,
                    ref: typeRef,
                };
            }
        }
    }

    // same-package classes
    let matchingExternal = externalRefs.find(
        (ext) => ext.packageName === (unit.packageName ?? "") && ext.name === typeRef.name
    );
    if (!matchingExternal) {
        // implicit import of java.lang.*
        matchingExternal = externalRefs.find((ext) => ext.packageName === "java.lang" && ext.name === typeRef.name);
    }

    if (matchingExternal) {
        return {
            category: "type",
            kind: "imported",
            name: typeRef.name,
            qualifiedName: matchingExternal.qualifiedName,
            ref: typeRef,
        };
    }

    // returning unresolved types would contain false positives for references that aren't actually types
    // we don't have enough info to do ambiguity resolution here, so just return nothing
    return null;
};

/**
 * Resolves a local type reference to its complete type information.
 *
 * @param typeRef - The local type reference to resolve
 * @param unit - The compilation unit containing the reference
 * @param externalRefs - Optional array of external type references for resolving wildcard imports and same-package classes.
 *                       Each external reference should include the type name, qualified name, and package name.
 *                       This enables resolution of types from wildcard imports (e.g., import java.util.*) and
 *                       types in the same package that aren't explicitly imported.
 * @returns ResolvedType containing complete type information
 */
export const resolveTypeReference = (
    typeRef: LocalTypeReference,
    unit: CompilationUnit,
    externalRefs: ExternalTypeReference[] = []
): ResolvedType | null => {
    const typeName = typeRef.name;

    if (BUILTIN_TYPES.has(typeName)) {
        return {
            category: "type",
            kind: "builtin",
            name: typeName,
            ref: typeRef,
        };
    }

    // find exact match in external refs - fully qualified name?
    const externalMatch = externalRefs.find((ext) => ext.qualifiedName === typeName);
    if (externalMatch) {
        return {
            category: "type",
            kind: "imported",
            name: typeName,
            qualifiedName: externalMatch.qualifiedName,
            ref: typeRef,
        };
    }

    const localResolved = resolveInUnit(typeName, unit);
    if (localResolved) {
        return {
            category: "type",
            kind: "declared",
            name: typeName.includes(".") ? typeName : localResolved.qualifiedName,
            qualifiedName: (unit.packageName ? `${unit.packageName}.` : "") + localResolved.qualifiedName,
            declaration: localResolved.node,
            ref: typeRef,
        };
    }

    const importedResolved = resolveImported(typeRef, unit, externalRefs);
    if (importedResolved) {
        return importedResolved;
    }

    return null;
};

/**
 * Type reference resolver for a compilation unit.
 *
 * Provides methods to resolve type references at specific offsets.
 */
export interface TypeReferenceResolver {
    /** The compilation unit being analyzed. */
    unit: CompilationUnit;

    /**
     * Resolves complete type information of the reference at the given offset.
     *
     * Returns null if no type reference is found at that position.
     *
     * @param offset - The offset in the source code
     * @param side - Optional side to resolve on (-1 = left, 0 = exact, 1 = right)
     * @returns ResolvedType or null
     */
    resolveAt(offset: number, side?: -1 | 0 | 1): ResolvedType | null;

    /**
     * Resolves the local type reference at the given offset.
     *
     * Returns null if no type reference is found at that position.
     *
     * @param offset - The offset in the source code
     * @param side - Optional side to resolve on (-1 = left, 0 = exact, 1 = right)
     * @returns LocalTypeReference or null
     */
    resolveReferenceAt(offset: number, side?: -1 | 0 | 1): LocalTypeReference | null;
}

/**
 * Creates a type reference resolver for a compilation unit.
 *
 * @param unit - The compilation unit to analyze
 * @param refs - Optional array of external type references for resolving wildcard imports and same-package classes.
 *               Each external reference should include the type name, qualified name, and package name.
 *               This enables resolution of types from wildcard imports (e.g., import java.util.*) and
 *               types in the same package that aren't explicitly imported.
 *
 * @example
 * ```typescript
 * const externalRefs = [
 *   { name: "List", qualifiedName: "java.util.List", packageName: "java.util" },
 *   { name: "HashMap", qualifiedName: "java.util.HashMap", packageName: "java.util" },
 *   { name: "OtherClass", qualifiedName: "com.example.OtherClass", packageName: "com.example" }
 * ];
 * const resolver = createTypeReferenceResolver(unit, externalRefs);
 * ```
 */
export const createTypeReferenceResolver = (
    unit: CompilationUnit,
    refs: ExternalTypeReference[] = []
): TypeReferenceResolver => {
    return {
        unit,
        resolveAt(offset: number, side?: -1 | 0 | 1) {
            const typeRef = this.resolveReferenceAt(offset, side);
            if (!typeRef) return null;

            return resolveTypeReference(typeRef, unit, refs);
        },

        resolveReferenceAt(offset: number, side?: -1 | 0 | 1) {
            const node = unit.tree.resolveInner(offset, side);
            const name = getTypeName(node, unit.source);
            if (name) {
                return {
                    name,
                    node,
                };
            }

            return null;
        },
    };
};

export type DeclarationKind = "field" | "constant" | "method" | "constructor" | "staticInitializer";

/**
 * JVM-style information for a field or method declaration.
 */
export interface ResolvedDeclaration extends Resolved {
    category: "declaration";
    kind: DeclarationKind;
    name: string;
    descriptor: string;
    owner: string;
    node: SyntaxNode;
    declaration: SyntaxNode;
}

export interface DeclarationResolver {
    unit: CompilationUnit;
    resolveAt(offset: number, side?: -1 | 0 | 1): ResolvedDeclaration | null;
}

const DECLARATION_NAMES = new Set([
    "FieldDeclaration",
    "ConstantDeclaration",
    "EnumConstant",
    "MethodDeclaration",
    "ConstructorDeclaration",
    "CompactConstructorDeclaration",
    "StaticInitializer",
]);

const findDeclarationAncestor = (node: SyntaxNode): SyntaxNode | null => {
    let current: SyntaxNode | null = node;
    while (current) {
        if (DECLARATION_NAMES.has(current.name)) return current;
        current = current.parent;
    }
    return null;
};

const findOwnerNode = (declaration: SyntaxNode): SyntaxNode | null => {
    let current = declaration.parent;
    while (current) {
        if (
            current.name === "ClassDeclaration" ||
            current.name === "InterfaceDeclaration" ||
            current.name === "EnumDeclaration" ||
            current.name === "AnnotationTypeDeclaration" ||
            current.name === "RecordDeclaration" ||
            current.name === "ModuleDeclaration"
        ) {
            return current;
        }
        current = current.parent;
    }
    return null;
};

const primitiveDescriptors: Record<string, string> = {
    byte: "B",
    char: "C",
    double: "D",
    float: "F",
    int: "I",
    long: "J",
    short: "S",
    boolean: "Z",
    void: "V",
};

const TYPE_NODE_NAMES = new Set(["PrimitiveType", "void", "TypeName", "ScopedTypeName", "GenericType", "ArrayType"]);

const isTypeNode = (node: SyntaxNode): boolean => TYPE_NODE_NAMES.has(node.name);

const findDirectTypeNode = (node: SyntaxNode): SyntaxNode | null => {
    let child = node.firstChild;
    while (child) {
        if (isTypeNode(child)) return child;
        child = child.nextSibling;
    }
    return null;
};

const findDefinition = (node: SyntaxNode): SyntaxNode | null => findChild(node, (child) => child.name === "Definition");

const findDescendantDefinition = (node: SyntaxNode): SyntaxNode | null =>
    findDescendants(node, (child) => child.name === "Definition")[0] ?? null;

const getOwnerName = (unit: CompilationUnit, ownerNode: SyntaxNode): string => {
    const type = unit.types.find(
        (candidate) =>
            candidate.node.from === ownerNode.from &&
            candidate.node.to === ownerNode.to &&
            candidate.node.name === ownerNode.name
    );
    if (!type) return "";

    const packagePrefix = unit.packageName ? `${unit.packageName.replace(/\./g, "/")}/` : "";
    return packagePrefix + type.qualifiedName.replace(/\./g, "$").replace(/\//g, "/");
};

const findTypeParameterBound = (name: string, context: SyntaxNode | null, source: string): SyntaxNode | null => {
    let current = context;
    while (current) {
        for (const parameter of findDescendants(current, (node) => node.name === "TypeParameter")) {
            const definition = findDefinition(parameter);
            if (!definition || source.slice(definition.from, definition.to) !== name) continue;

            const typeBound = findChild(parameter, (node) => node.name === "TypeBound");
            if (typeBound) {
                const bound = findChild(typeBound, (node) => isTypeNode(node));
                if (bound) return bound;
            }
        }
        current = current.parent;
    }
    return null;
};

const getUnqualifiedDescriptorName = (
    unit: CompilationUnit,
    name: string,
    externalRefs: ExternalTypeReference[],
    context: SyntaxNode | null = null,
    visited: Set<string> = new Set()
): string => {
    for (const imp of unit.imports) {
        if (imp.kind !== "type") continue;

        const matchesName =
            imp.importedName === name ||
            imp.importedName.endsWith(`.${name}`);
        if (!matchesName) continue;

        const matchingExternal = externalRefs.find(
            (external) =>
                external.qualifiedName === imp.importedName ||
                external.qualifiedName.replace(/\$/g, ".") === imp.importedName
        );
        if (matchingExternal) {
            return matchingExternal.qualifiedName.replace(/\./g, "/");
        }

        return imp.importedName.replace(/\./g, "/");
    }

    const exactExternal = externalRefs.find((external) => external.qualifiedName === name);
    if (exactExternal) {
        return exactExternal.qualifiedName.replace(/\./g, "/");
    }

    const qualifiedOrNestedExternal = externalRefs.find(
        (external) =>
            external.qualifiedName.endsWith(`.${name}`) ||
            external.name === name ||
            external.name === name.split(".")[name.split(".").length - 1]
    );
    if (qualifiedOrNestedExternal) {
        return qualifiedOrNestedExternal.qualifiedName.replace(/\./g, "/");
    }

    const javaLangExternal = externalRefs.find(
        (external) => external.packageName === "java.lang" && external.name === name
    );
    if (javaLangExternal) {
        return javaLangExternal.qualifiedName.replace(/\./g, "/");
    }

    const local = unit.types.find(
        (type) =>
            type.name === name ||
            type.qualifiedName === name ||
            type.qualifiedName.endsWith(`.${name}`)
    );
    if (local) {
        return getOwnerName(unit, local.node);
    }

    if (!visited.has(name)) {
        const bound = findTypeParameterBound(name, context, unit.source);
        if (bound) {
            const nextVisited = new Set(visited);
            nextVisited.add(name);
            return getDescriptorType(bound, unit, unit.source, externalRefs, context, nextVisited).replace(
                /^L|;$/g,
                ""
            );
        }
    }

    if (context) {
        if (name.includes(".") || name.includes("/")) {
            return name.replace(/\./g, "/");
        }
        return "java/lang/Object";
    }

    return name.replace(/\./g, "/");
};

const getDescriptorType = (
    node: SyntaxNode | null,
    unit: CompilationUnit,
    source: string,
    externalRefs: ExternalTypeReference[],
    context: SyntaxNode | null = null,
    visited: Set<string> = new Set()
): string => {
    if (!node) return "V";

    if (node.name === "ArrayType") {
        let dimensions = 0;
        let child = node.firstChild;
        while (child) {
            if (child.name === "Dimension") dimensions++;
            child = child.nextSibling;
        }
        const base = node.firstChild;
        return "[".repeat(dimensions) + getDescriptorType(base, unit, source, externalRefs, context, visited);
    }

    if (node.name === "SpreadParameter") {
        const type = node.firstChild;
        return "[" + getDescriptorType(type, unit, source, externalRefs, context, visited);
    }

    if (node.name === "GenericType") {
        const base =
            node.firstChild?.name === "TypeName" || node.firstChild?.name === "ScopedTypeName" ? node.firstChild : null;
        return getDescriptorType(base, unit, source, externalRefs, context, visited);
    }

    if (
        node.name === "TypeName" ||
        node.name === "ScopedTypeName" ||
        node.name === "PrimitiveType" ||
        node.name === "void"
    ) {
        const name = getTypeName(node, source) ?? source.slice(node.from, node.to);
        if (primitiveDescriptors[name]) return primitiveDescriptors[name];
        const genericIndex = name.indexOf("<");
        const unqualifiedName = genericIndex >= 0 ? name.slice(0, genericIndex) : name;
        return `L${getUnqualifiedDescriptorName(unit, unqualifiedName, externalRefs, context, visited)};`;
    }

    let child = node.firstChild;
    while (child) {
        const descriptor = getDescriptorType(child, unit, source, externalRefs, context, visited);
        if (descriptor !== "V") return descriptor;
        child = child.nextSibling;
    }
    return "V";
};

const getFieldNameAndType = (
    declaration: SyntaxNode,
    unit: CompilationUnit,
    source: string,
    externalRefs: ExternalTypeReference[]
): ResolvedDeclaration[] => {
    const typeNode = findDirectTypeNode(declaration);

    const ownerNode = findOwnerNode(declaration);
    const owner = ownerNode ? getOwnerName(unit, ownerNode) : "";
    const descriptor = getDescriptorType(typeNode, unit, source, externalRefs, declaration);
    const result: ResolvedDeclaration[] = [];

    for (const variable of findChildren(declaration, (node) => node.name === "VariableDeclarator")) {
        const definition = findDefinition(variable);
        if (definition) {
            result.push({
                category: "declaration",
                kind: "field",
                name: source.slice(definition.from, definition.to),
                descriptor,
                owner,
                node: definition,
                declaration,
            });
        }
    }
    return result;
};

const getParameterType = (parameter: SyntaxNode): SyntaxNode | null => {
    return parameter.name === "SpreadParameter" ? parameter : findDirectTypeNode(parameter);
};

const resolveDeclarationInfo = (
    declaration: SyntaxNode,
    unit: CompilationUnit,
    externalRefs: ExternalTypeReference[]
): ResolvedDeclaration | null => {
    const ownerNode = findOwnerNode(declaration);
    const owner = ownerNode ? getOwnerName(unit, ownerNode) : "";

    if (declaration.name === "StaticInitializer") {
        return {
            category: "declaration",
            kind: "staticInitializer",
            name: "<clinit>",
            descriptor: "()V",
            owner,
            node: declaration,
            declaration,
        };
    }

    if (declaration.name === "ConstantDeclaration") {
        const typeNode = findDirectTypeNode(declaration);
        const variable = findChild(declaration, (node) => node.name === "VariableDeclarator");
        const definition = variable ? findDefinition(variable) : null;
        if (!definition) return null;

        return {
            category: "declaration",
            kind: "constant",
            name: unit.source.slice(definition.from, definition.to),
            descriptor: getDescriptorType(typeNode, unit, unit.source, externalRefs, declaration),
            owner,
            node: definition,
            declaration,
        };
    }

    if (declaration.name === "EnumConstant") {
        const definition = findDescendantDefinition(declaration);
        if (!definition) return null;

        return {
            category: "declaration",
            kind: "constant",
            name: unit.source.slice(definition.from, definition.to),
            descriptor: declaration.name === "EnumConstant" && owner ? `L${owner};` : "V",
            owner,
            node: definition,
            declaration,
        };
    }

    if (declaration.name === "FieldDeclaration") {
        return getFieldNameAndType(declaration, unit, unit.source, externalRefs)[0] ?? null;
    }

    const definition = findDefinition(declaration);
    if (!definition) return null;

    const isConstructor =
        declaration.name === "ConstructorDeclaration" || declaration.name === "CompactConstructorDeclaration";

    const name = isConstructor ? "<init>" : unit.source.slice(definition.from, definition.to);

    const parameters = findChild(declaration, (node) => node.name === "FormalParameters");

    const parameterDescriptors: string[] = [];
    if (declaration.name === "CompactConstructorDeclaration" && ownerNode) {
        const recordHeader = findChild(ownerNode, (node) => node.name === "RecordHeader");
        if (recordHeader) {
            for (const component of findChildren(recordHeader, (node) => node.name === "RecordComponent")) {
                const typeNode = findDirectTypeNode(component);
                parameterDescriptors.push(getDescriptorType(typeNode, unit, unit.source, externalRefs, declaration));
            }
        }
    } else if (parameters) {
        let parameter = parameters.firstChild;
        while (parameter) {
            if (parameter.name === "FormalParameter" || parameter.name === "SpreadParameter") {
                const typeNode = parameter.name === "SpreadParameter" ? parameter : getParameterType(parameter);
                parameterDescriptors.push(getDescriptorType(typeNode, unit, unit.source, externalRefs, declaration));
            }
            parameter = parameter.nextSibling;
        }
    }

    let returnDescriptor = "V";
    if (declaration.name === "MethodDeclaration") {
        const returnType = findDirectTypeNode(declaration);
        returnDescriptor = getDescriptorType(returnType, unit, unit.source, externalRefs, declaration);
    }

    return {
        category: "declaration",
        kind: isConstructor ? "constructor" : "method",
        name,
        descriptor: `(${parameterDescriptors.join("")})${returnDescriptor}`,
        owner,
        node: definition,
        declaration,
    };
};

const declarationAtNode = (
    unit: CompilationUnit,
    offset: number,
    side: -1 | 0 | 1,
    externalRefs: ExternalTypeReference[]
): ResolvedDeclaration | null => {
    const resolvedNode = unit.tree.resolveInner(offset, side);
    const declaration = findDeclarationAncestor(resolvedNode);
    if (!declaration) return null;

    const isNameOffset = (nameNode: SyntaxNode | null): boolean =>
        nameNode !== null && nameNode.from <= offset && offset <= nameNode.to;

    if (declaration.name === "FieldDeclaration") {
        const fields = getFieldNameAndType(declaration, unit, unit.source, externalRefs);
        const containing = fields.find((field) => field.node.from <= offset && offset <= field.node.to);
        return containing ?? null;
    }

    if (declaration.name === "StaticInitializer") {
        const staticNode = findChild(declaration, (node) => node.name === "static");
        return isNameOffset(staticNode) ? resolveDeclarationInfo(declaration, unit, externalRefs) : null;
    }

    if (declaration.name === "EnumConstant" || declaration.name === "ConstantDeclaration") {
        const definition =
            declaration.name === "EnumConstant"
                ? findDescendantDefinition(declaration)
                : findDefinition(findChild(declaration, (node) => node.name === "VariableDeclarator") ?? declaration);
        return isNameOffset(definition) ? resolveDeclarationInfo(declaration, unit, externalRefs) : null;
    }

    const definition = findDefinition(declaration);
    if (!isNameOffset(definition)) return null;

    return resolveDeclarationInfo(declaration, unit, externalRefs);
};

/**
 * Creates a resolver for field and method declarations in a compilation unit.
 */
export const createDeclarationResolver = (
    unit: CompilationUnit,
    refs: ExternalTypeReference[] = []
): DeclarationResolver => {
    return {
        unit,
        resolveAt(offset, side = 0) {
            return declarationAtNode(unit, offset, side, refs);
        },
    };
};

/**
 * A resolver that returns either resolved type or declaration information.
 */
export interface CompositeResolver {
    unit: CompilationUnit;
    resolveAt(offset: number, side?: -1 | 0 | 1): Resolved | null;
}

/**
 * Creates a composite resolver that checks declarations before type references.
 */
export const createCompositeResolver = (
    unit: CompilationUnit,
    refs: ExternalTypeReference[] = []
): CompositeResolver => {
    const declarationResolver = createDeclarationResolver(unit, refs);
    const typeResolver = createTypeReferenceResolver(unit, refs);

    return {
        unit,
        resolveAt(offset, side = 0) {
            return declarationResolver.resolveAt(offset, side) ?? typeResolver.resolveAt(offset, side);
        },
    };
};
