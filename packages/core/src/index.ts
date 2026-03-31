export { describeSchema } from "./describe-schema.js";
export { resolveFieldMetadata } from "./resolve-field-metadata.js";
export {
  resolveJsonSchemaMetadata,
  resolveJsonSchemaNode,
} from "./resolve-json-schema-metadata.js";
export { SchemaCache } from "./schema-cache.js";
export type {
  SchemaDescriptor,
  SchemaMetadata,
  FieldMetadata,
  FieldMetadataEntry,
  ResolvedMetadata,
  SchemaPath,
  EnumRefinement,
  SuggestionRefinement,
} from "./types.js";
export { applyEnumRefinements } from "./apply-refinements.js";

export { resolveFieldContext } from "./resolve-field-context.js";
export type {
  FieldSegment,
  FieldPath,
  FieldTypeInfo,
  UnionBranchSummary,
  FieldContext,
} from "./field-context-types.js";
export {
  toJsonPointer,
  fromJsonPointer,
  toInternalPath,
  matchesSchemaPath,
} from "./path-utils.js";

export { buildFieldCatalog } from "./field-catalog.js";
export type {
  FieldCatalogEntry,
  FieldCatalog,
  CatalogOptions,
  CatalogBranch,
} from "./field-catalog.js";

export { computeJsonDiff } from "./json-diff.js";
export type { FieldDiff, DiffAction } from "./json-diff.js";

export {
  treeNodeDescriptor,
  treeNodeDefaultValue,
} from "./examples/tree-node.js";

export type {
  ZodError,
  ZodSafeParseResult,
  ZodSafeParseSuccess,
  ZodSafeParseError,
} from "zod";
export type { $ZodIssue as ZodIssue } from "zod/v4/core";
