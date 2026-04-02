import type { ZodIssue, FieldPath } from "@zod-monaco/core";

export interface ValidationResult {
  valid: boolean;
  issues: ZodIssue[];
  parseError?: string;
}

export interface ReadOnlyViolationDetail {
  /** The field path that was violated */
  path: FieldPath;
  /** What kind of edit triggered the violation */
  operation: "type" | "paste" | "delete" | "replace";
}

export interface FeatureToggles {
  /** Enable/disable hover tooltips from JSON Schema. Default: true */
  hover?: boolean;
  /** Enable/disable JSON Schema structural validation + completions. Default: true */
  validation?: boolean;
  /** Enable/disable auto-completions from JSON Schema. Default: true */
  completions?: boolean;
  /** Enable/disable Zod runtime validation markers. Default: true */
  diagnostics?: boolean;
}
