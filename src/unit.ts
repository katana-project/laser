import { SyntaxNode, Tree } from "@lezer/common";
import { findChild } from "./tree-utils.js";

/**
 * Represents an import statement in a Java source file.
 */
export interface ImportInfo {
    importedName: string;
    isStatic: boolean;
    isWildcard: boolean;
    node: SyntaxNode;
}

/**
 * Represents a type declaration (class, interface, enum, annotation, module) in a Java source file.
 */
export interface TypeInfo {
    kind: "class" | "interface" | "enum" | "annotation" | "module";
    name: string;
    qualifiedName: string; // without package prefix, includes enclosing types
    node: SyntaxNode;
    typeParameters: string[];
}

/**
 * Represents a parsed Java compilation unit (source file).
 */
export interface CompilationUnit {
    tree: Tree;
    source: string;

    packageName: string | null;
    imports: ImportInfo[];
    types: TypeInfo[];
}

const extractTypeParameters = (node: SyntaxNode, source: string): string[] => {
    const typeParamsNode = findChild(node, (c) => c.name === "TypeParameters");
    if (!typeParamsNode) {
        return [];
    }

    const params: string[] = [];
    let child = typeParamsNode.firstChild;
    while (child) {
        if (child.name === "TypeParameter") {
            const def = findChild(child, (c) => c.name === "Definition");
            if (def) {
                params.push(source.slice(def.from, def.to));
            }
        }
        child = child.nextSibling;
    }
    return params;
};

/**
 * Parses a Java compilation unit from a syntax tree and source code.
 *
 * This expects a `@lezer/java` parsed tree.
 *
 * @param tree - The syntax tree of the Java source file.
 * @param source - The source code of the Java file.
 * @returns The parsed compilation unit information.
 */
export const parseUnit = (tree: Tree, source: string): CompilationUnit => {
    const unit: CompilationUnit = {
        tree,
        source,
        packageName: null,
        imports: [],
        types: [],
    };

    const processNode = (node: SyntaxNode, qualifiedPrefix: string) => {
        if (node.name === "PackageDeclaration") {
            const nameNode = findChild(node, (c) => c.name === "Identifier" || c.name === "ScopedIdentifier");
            if (nameNode) {
                unit.packageName = source.slice(nameNode.from, nameNode.to);
            }
        } else if (node.name === "ImportDeclaration") {
            const isStatic = !!findChild(node, (c) => c.name === "static");
            const isWildcard = !!findChild(node, (c) => c.name === "Asterisk");
            const nameNode = findChild(node, (c) => c.name === "Identifier" || c.name === "ScopedIdentifier");
            if (nameNode) {
                const importedName = source.slice(nameNode.from, nameNode.to);
                if (importedName) {
                    unit.imports.push({
                        importedName,
                        isStatic,
                        isWildcard,
                        node,
                    });
                }
            }
        } else if (
            node.name === "ClassDeclaration" ||
            node.name === "InterfaceDeclaration" ||
            node.name === "EnumDeclaration" ||
            node.name === "AnnotationTypeDeclaration" ||
            node.name === "ModuleDeclaration"
        ) {
            const defNode = findChild(node, (c) => c.name === "Definition" || c.name === "Identifier");
            if (defNode) {
                const name = source.slice(defNode.from, defNode.to);
                const qualifiedName = qualifiedPrefix ? `${qualifiedPrefix}.${name}` : name;
                const typeParameters = extractTypeParameters(node, source);
                unit.types.push({
                    kind:
                        node.name === "ClassDeclaration"
                            ? "class"
                            : node.name === "InterfaceDeclaration"
                              ? "interface"
                              : node.name === "EnumDeclaration"
                                ? "enum"
                                : node.name === "AnnotationTypeDeclaration"
                                  ? "annotation"
                                  : "module",
                    name,
                    qualifiedName,
                    node,
                    typeParameters,
                });

                const classBody = findChild(
                    node,
                    (c) =>
                        c.name === "ClassBody" ||
                        c.name === "InterfaceBody" ||
                        c.name === "AnnotationTypeBody" ||
                        c.name === "ModuleBody" ||
                        c.name === "EnumBody"
                );
                if (classBody) {
                    let child = classBody.firstChild;
                    while (child) {
                        processNode(child, qualifiedName);
                        child = child.nextSibling;
                    }
                }
            }
        } else {
            let child = node.firstChild;
            while (child) {
                processNode(child, qualifiedPrefix);
                child = child.nextSibling;
            }
        }
    };

    processNode(tree.topNode, "");

    return unit;
};
