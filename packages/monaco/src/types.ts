import type { ZodIssue } from "@zod-monaco/core";

export interface ValidationResult {
  valid: boolean;
  issues: ZodIssue[];
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
