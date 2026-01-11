import { SyntaxNode } from "@lezer/common";
import { CompilationUnit, TypeInfo } from "./unit.js";

// resolving type information out of an AST is hard, so we'll focus on basic name resolution for now
// i.e. no member references
// this will probably need to be rewritten later to support that

export interface TypeReference {
    name: string;
    node: SyntaxNode;
}

export interface ResolvedType {
    kind: "declared" | "imported" | "builtin" | "unresolved";
    name: string;
    qualifiedName?: string;
    declaration?: SyntaxNode;

    ref: TypeReference;
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

const collectAllTypeReferences = (node: SyntaxNode, source: string, refs: TypeReference[] = []): TypeReference[] => {
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

const resolveImported = (typeRef: TypeReference, unit: CompilationUnit): ResolvedType => {
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

    return null;
};

export const resolveTypeReference = (typeRef: TypeReference, unit: CompilationUnit): ResolvedType => {
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
            name: localResolved.name,
            qualifiedName: localResolved.qualifiedName,
            declaration: localResolved.node,
            ref: typeRef,
        };
    }

    const importedResolved = resolveImported(typeRef, unit);
    if (importedResolved) {
        return importedResolved;
    }

    if (unit.packageName) {
        const qualifiedName = `${unit.packageName}.${typeName}`;
        const resolved = resolveInUnit(qualifiedName, unit);
        if (resolved) {
            return {
                kind: "imported",
                name: resolved.name,
                qualifiedName: resolved.qualifiedName,
                declaration: resolved.node,
                ref: typeRef,
            };
        }
    }

    return {
        kind: "unresolved",
        name: typeName,
        ref: typeRef,
    };
};

// TODO: CompilationUnit should probably expand wildcard imports from a supplied classpath and add same-package classes as well

export interface TypeReferenceResolver {
    unit: CompilationUnit;

    resolveAt(offset: number, side?: -1 | 0 | 1): ResolvedType | null;
    resolveReferenceAt(offset: number, side?: -1 | 0 | 1): TypeReference | null;
    resolveAll(): ResolvedType[];
}

export const createTypeReferenceResolver = (unit: CompilationUnit): TypeReferenceResolver => {
    return {
        unit,
        resolveAt(offset: number, side?: -1 | 0 | 1) {
            const typeRef = this.resolveReferenceAt(offset, side);
            if (!typeRef) return null;

            return resolveTypeReference(typeRef, unit);
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
            const refs = collectAllTypeReferences(unit.tree.topNode, unit.source);
            return refs.map((ref) => resolveTypeReference(ref, unit));
        },
    };
};
