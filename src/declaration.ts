import { SyntaxNode } from "@lezer/common";
import { getTypeName } from "./ast-utils.js";
import { findChild, findChildren, findDescendants } from "./tree-utils.js";
import { ExternalTypeReference, LocalTypeReference, Resolved } from "./types.js";
import { CompilationUnit } from "./unit.js";

export type DeclarationKind = "field" | "constant" | "method" | "constructor" | "staticInitializer";

/**
 * JVM-style information for a field or method declaration.
 */
export interface ResolvedDeclaration extends Resolved {
    category: "declaration";
    kind: DeclarationKind;
    descriptor: string;
    owner: string;
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

const createLocalReference = (source: string, node: SyntaxNode): LocalTypeReference => ({
    name: source.slice(node.from, node.to),
    node,
});

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

        const matchesName = imp.importedName === name || imp.importedName.endsWith(`.${name}`);
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
        (type) => type.name === name || type.qualifiedName === name || type.qualifiedName.endsWith(`.${name}`)
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
                ref: createLocalReference(source, definition),
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
        const staticNode = findChild(declaration, (node) => node.name === "static") ?? declaration;
        return {
            category: "declaration",
            kind: "staticInitializer",
            name: "<clinit>",
            descriptor: "()V",
            owner,
            ref: createLocalReference(unit.source, staticNode),
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
            ref: createLocalReference(unit.source, definition),
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
            ref: createLocalReference(unit.source, definition),
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
        ref: createLocalReference(unit.source, definition),
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
        const containing = fields.find((field) => field.ref.node.from <= offset && offset <= field.ref.node.to);
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
 * Creates a resolver for field, constant, method, constructor, and initializer declarations.
 *
 * A declaration is resolved only when `offset` points to its name (or to `static` for a static
 * initializer). Descriptors use JVM format. Supply external type references to resolve imported
 * types in declaration descriptors.
 *
 * @param unit - The compilation unit to analyze
 * @param refs - Optional external types used to resolve declaration descriptor names
 * @returns A resolver for declarations in `unit`
 *
 * @example
 * ```typescript
 * const resolver = createDeclarationResolver(unit, [
 *   {
 *     name: "String",
 *     qualifiedName: "java.lang.String",
 *     packageName: "java.lang",
 *     moduleName: null,
 *   },
 * ]);
 * const declaration = resolver.resolveAt(source.indexOf("name") + 1);
 * ```
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
