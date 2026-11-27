import { createDeclarationResolver } from "./declaration.js";
import { createTypeReferenceResolver } from "./type-reference.js";
import { ExternalTypeReference, Resolved } from "./types.js";
import { CompilationUnit } from "./unit.js";

/**
 * A resolver that returns either resolved type or declaration information.
 */
export interface CompositeResolver {
    unit: CompilationUnit;
    resolveAt(offset: number, side?: -1 | 0 | 1): Resolved | null;
}

/**
 * Creates a resolver that resolves either declarations or type references at an offset.
 *
 * Declaration names are checked first; if no declaration name is present at the offset, the
 * resolver attempts to resolve a type reference. External type references are passed to both
 * underlying resolvers.
 *
 * @param unit - The compilation unit to analyze
 * @param refs - Optional external types used to resolve imported types and declaration descriptors
 * @returns A resolver for declarations and type references in `unit`
 *
 * @example
 * ```typescript
 * const resolver = createCompositeResolver(unit, externalTypes);
 * const resolved = resolver.resolveAt(offset);
 *
 * if (resolved?.category === "declaration") {
 *   console.log(resolved.name, resolved.ref.node);
 * } else if (resolved?.category === "type") {
 *   console.log(resolved.name, resolved.kind);
 * }
 * ```
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
