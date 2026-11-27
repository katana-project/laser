import { SyntaxNode } from "@lezer/common";

const TYPE_NAME_PARENTS = new Set([
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
export const getTypeName = (node: SyntaxNode, source: string, limit: number = node.to): string | null => {
    switch (node.name) {
        case "TypeName":
        case "ScopedTypeName": {
            if (node.parent && TYPE_NAME_PARENTS.has(node.parent.type.name)) {
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
                if (node.parent && TYPE_NAME_PARENTS.has(node.parent.type.name)) {
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
