import { SyntaxNode } from "@lezer/common";

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
 * Common information returned by source and declaration resolution.
 */
export interface Resolved {
    name: string;
    category: "type" | "declaration";
    ref: LocalTypeReference;
    declaration?: SyntaxNode;
}

/**
 * Resolved type information.
 *
 * Includes whether the type is declared locally, imported, or a built-in type.
 */
export interface ResolvedType extends Resolved {
    category: "type";
    kind: "declared" | "imported" | "builtin";
    qualifiedName?: string;
}
