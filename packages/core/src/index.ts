export { describeSchema } from "./describe-schema.js";
export { resolveFieldMetadata } from "./resolve-field-metadata.js";
export { resolveJsonSchemaMetadata, resolveJsonSchemaNode } from "./resolve-json-schema-metadata.js";
export type {
  SchemaDescriptor,
  SchemaMetadata,
  FieldMetadata,
  ResolvedMetadata,
} from "./types.js";

// Example schemas for demos and testing
export { treeNodeDescriptor, treeNodeDefaultValue } from "./examples/tree-node.js";

// Re-export Zod types so consumers don't need to import zod separately
export type {
  ZodError,
  ZodSafeParseResult,
  ZodSafeParseSuccess,
  ZodSafeParseError,
} from "zod";
export type { $ZodIssue as ZodIssue } from "zod/v4/core";
