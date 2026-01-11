import { SyntaxNode } from "@lezer/common";

export const getChildren = (node: SyntaxNode): SyntaxNode[] => {
    const children: SyntaxNode[] = [];
    let child = node.firstChild;
    while (child) {
        children.push(child);
        child = child.nextSibling;
    }
    return children;
};

export const findChild = (node: SyntaxNode, predicate: (child: SyntaxNode) => boolean): SyntaxNode | null => {
    let child = node.firstChild;
    while (child) {
        if (predicate(child)) {
            return child;
        }
        child = child.nextSibling;
    }
    return null;
};

export const findChildren = (node: SyntaxNode, predicate: (child: SyntaxNode) => boolean): SyntaxNode[] => {
    const result: SyntaxNode[] = [];
    let child = node.firstChild;
    while (child) {
        if (predicate(child)) {
            result.push(child);
        }
        child = child.nextSibling;
    }
    return result;
};

export const findDescendant = (node: SyntaxNode, predicate: (node: SyntaxNode) => boolean): SyntaxNode | null => {
    if (predicate(node)) {
        return node;
    }

    let child = node.firstChild;
    while (child) {
        const found = findDescendant(child, predicate);
        if (found) {
            return found;
        }
        child = child.nextSibling;
    }

    return null;
};

export const findDescendants = (node: SyntaxNode, predicate: (node: SyntaxNode) => boolean): SyntaxNode[] => {
    const result: SyntaxNode[] = [];

    if (predicate(node)) {
        result.push(node);
    }

    let child = node.firstChild;
    while (child) {
        result.push(...findDescendants(child, predicate));
        child = child.nextSibling;
    }

    return result;
};
