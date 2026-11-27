import { getTypeName } from "./ast-utils.js";
import { ExternalTypeReference, LocalTypeReference, ResolvedType } from "./types.js";
import { CompilationUnit, TypeInfo } from "./unit.js";

const BUILTIN_TYPES = new Set(["byte", "short", "int", "long", "char", "float", "double", "boolean", "void"]);

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
