import { SyntaxNode } from "@lezer/common";
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
}

/**
 * Resolved type information.
 *
 * Includes whether the type is declared locally, imported, a built-in type, or unresolved.
 */
export interface ResolvedType {
    kind: "declared" | "imported" | "builtin" | "unresolved";
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
const getTypeName = (node: SyntaxNode, source: string): string | null => {
    switch (node.name) {
        case "TypeName":
        case "ScopedTypeName": {
            if (node.parent && ALLOWED_PARENTS.has(node.parent.type.name)) {
                return getTypeName(node.parent, source);
            }

            return source.slice(node.from, node.to);
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
                    // only allow getting Identifier-based type names from annotations
                    return null;
                }
            }

            return source.slice(node.from, node.to);
        }
        case "Definition": {
            if (
                node.parent.name !== "EnumDeclaration" &&
                node.parent.name !== "ClassDeclaration" &&
                node.parent.name !== "ConstructorDeclaration" &&
                node.parent.name !== "InterfaceDeclaration" &&
                node.parent.name !== "LocalVariableDeclaration"
            ) {
                // only allow getting Definition-based type names from these declarations
                return null;
            }

            return source.slice(node.from, node.to);
        }
        case "FieldAccess": {
            if (node.parent?.name === "FieldAccess" || node.firstChild.name !== "Identifier") {
                // pointing at a field, inner class access or a different expression, we can't resolve that
                return null;
            }

            return source.slice(node.firstChild.from, node.firstChild.to);
        }
    }

    return null;
};

const collectAllTypeReferences = (
    node: SyntaxNode,
    source: string,
    refs: LocalTypeReference[] = []
): LocalTypeReference[] => {
    const name = getTypeName(node, source);
    if (name) {
        const existing = refs.find((r) => r.node === node);
        if (!existing) {
            refs.push({
                name,
                node,
            });
        }
    } else {
        // enter node, as we didn't find a type reference here
        let child = node.firstChild;
        while (child) {
            collectAllTypeReferences(child, source, refs);
            child = child.nextSibling;
        }
    }

    return refs;
};

const resolveInUnit = (typeName: string, unit: CompilationUnit): TypeInfo | null => {
    for (const cls of unit.types) {
        if (cls.name === typeName || cls.qualifiedName === typeName) {
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
    const parts = typeRef.name.split(".");
    const firstPart = parts[0];

    for (const imp of unit.imports) {
        if (!imp.isWildcard) {
            const importParts = imp.importedName.split(".");
            const importedClass = importParts[importParts.length - 1];
            if (importedClass === firstPart) {
                return {
                    kind: "imported",
                    name: typeRef.name,
                    qualifiedName: imp.importedName,
                    ref: typeRef,
                };
            }
        }
    }

    for (const imp of unit.imports) {
        if (imp.isWildcard) {
            const packageName = imp.importedName;
            const matchingExternal = externalRefs.find(
                (ext) => ext.packageName === packageName && ext.name === firstPart
            );
            if (matchingExternal) {
                return {
                    kind: "imported",
                    name: typeRef.name,
                    qualifiedName: matchingExternal.qualifiedName,
                    ref: typeRef,
                };
            }
        }
    }

    const matchingExternal = externalRefs.find(
        (ext) => ext.packageName === (unit.packageName ?? "") && ext.name === firstPart
    );
    if (matchingExternal) {
        return {
            kind: "imported",
            name: typeRef.name,
            qualifiedName: matchingExternal.qualifiedName,
            ref: typeRef,
        };
    }

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
): ResolvedType => {
    const typeName = typeRef.name;

    if (BUILTIN_TYPES.has(typeName)) {
        return {
            kind: "builtin",
            name: typeName,
            ref: typeRef,
        };
    }

    const localResolved = resolveInUnit(typeName, unit);
    if (localResolved) {
        return {
            kind: "declared",
            name: localResolved.qualifiedName,
            qualifiedName: (unit.packageName ? `${unit.packageName}.` : "") + localResolved.qualifiedName,
            declaration: localResolved.node,
            ref: typeRef,
        };
    }

    const importedResolved = resolveImported(typeRef, unit, externalRefs);
    if (importedResolved) {
        return importedResolved;
    }

    return {
        kind: "unresolved",
        name: typeName,
        ref: typeRef,
    };
};

/**
 * Type reference resolver for a compilation unit.
 *
 * Provides methods to resolve type references at specific offsets,
 * as well as resolving all type references in the unit.
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

    /**
     * Resolves all type references in the compilation unit.
     *
     * @returns An array of resolved type information for all references.
     */
    resolveAll(): ResolvedType[];
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

        resolveAll() {
            const allRefs = collectAllTypeReferences(unit.tree.topNode, unit.source);
            return allRefs.map((ref) => resolveTypeReference(ref, unit, refs));
        },
    };
};
