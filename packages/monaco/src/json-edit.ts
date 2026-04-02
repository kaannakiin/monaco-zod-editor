import type { FieldPath, SchemaDescriptor } from "@zod-monaco/core";
import {
  computeJsonDiff,
  toJsonPointer,
  isFieldReadOnly,
  diffPathCoversReadOnlyDescendant,
} from "@zod-monaco/core";
import type { FieldDiff } from "@zod-monaco/core";
import type { MonacoStandaloneEditorLike } from "./monaco-types.js";

/** A field that a programmatic edit would modify but is read-only. */
export interface ReadOnlyViolation {
  path: FieldPath;
  /** RFC 6901 JSON Pointer for the field. */
  pointer: string;
}

/** A typed validation issue with FieldPath + RFC 6901 pointer. */
export interface ValidationIssue {
  path: FieldPath;
  /** RFC 6901 JSON Pointer for the field. */
  pointer: string;
  message: string;
}

/**
 * The result of `prepareJsonEdit` — read-only until `commit()` is called.
 *
 * Workflow:
 * 1. `prepareJsonEdit(editor, descriptor, aiValue)` — does NOT touch the editor.
 * 2. Inspect `valid`, `validationIssues`, `diff`, `newText` for review UI.
 * 3. If `stale` is true, the editor was modified during review — re-prepare.
 * 4. Call `commit()` to write to the editor.
 *    - Throws if `valid === false` (use `{ force: true }` to override).
 *    - Throws if `stale === true`.
 */
export interface PreparedEdit {
  /** Formatted JSON text of the proposed value. */
  newText: string;
  /** Whether `newValue` passes Zod validation. */
  valid: boolean;
  /** Typed validation issues — empty when `valid` is true. */
  validationIssues: ValidationIssue[];
  /** Structural diff between the current editor content and `newValue`. */
  diff: FieldDiff[];
  /** Read-only violations — fields that would be modified but are locked. */
  readOnlyViolations: ReadOnlyViolation[];
  /**
   * True when the editor content has changed since `prepareJsonEdit` was called.
   * A stale prepared edit must NOT be committed — call `prepareJsonEdit` again.
   */
  readonly stale: boolean;
  /**
   * Writes `newText` to the editor.
   *
   * @throws When `valid === false` and `force` is not `true`.
   * @throws When `stale === true` (editor was modified during review).
   */
  commit(options?: { force?: boolean }): void;
}

/**
 * Prepares a JSON edit without touching the editor.
 *
 * - Validates `newValue` against the schema.
 * - Computes a structural diff vs the current editor content.
 * - Returns a `PreparedEdit` with a `commit()` closure that writes to the editor.
 *
 * The editor is NOT modified until `commit()` is called.
 */
export function prepareJsonEdit(
  editor: MonacoStandaloneEditorLike,
  descriptor: SchemaDescriptor,
  newValue: unknown,
): PreparedEdit {
  const newText = JSON.stringify(newValue, null, 2);

  const zodResult = descriptor.validate(newValue);
  const valid = zodResult.success;
  const validationIssues: ValidationIssue[] = [];

  if (!zodResult.success) {
    for (const issue of zodResult.error.issues) {
      const issuePath = issue.path as Array<string | number>;
      const fp: FieldPath = issuePath;
      validationIssues.push({
        path: fp,
        pointer: toJsonPointer(fp),
        message: issue.message,
      });
    }
  }

  const oldText = editor.getValue();
  let oldValue: unknown;
  try {
    oldValue = JSON.parse(oldText);
  } catch {
    oldValue = undefined;
  }

  const diff = computeJsonDiff(oldValue, newValue);

  const readOnlyViolations: ReadOnlyViolation[] = [];
  for (const d of diff) {
    if (
      isFieldReadOnly(descriptor.metadata, d.path) ||
      (descriptor.metadata.readOnlyPaths &&
        diffPathCoversReadOnlyDescendant(
          d.path,
          descriptor.metadata.readOnlyPaths,
        ))
    ) {
      readOnlyViolations.push({ path: d.path, pointer: toJsonPointer(d.path) });
    }
  }

  const model = editor.getModel();
  const snapshotVersion = model?.getVersionId() ?? -1;

  return {
    newText,
    valid,
    validationIssues,
    diff,
    readOnlyViolations,

    get stale(): boolean {
      const currentVersion = editor.getModel()?.getVersionId() ?? -1;
      return currentVersion !== snapshotVersion;
    },

    commit(options?: { force?: boolean }): void {
      if (readOnlyViolations.length > 0) {
        throw new Error(
          `Cannot commit: ${readOnlyViolations.length} read-only field(s) would be modified.`,
        );
      }

      if (!valid && !options?.force) {
        throw new Error(
          "Cannot commit an invalid edit. Use { force: true } to override.",
        );
      }

      const currentModel = editor.getModel();
      if (!currentModel) {
        throw new Error("Editor model is not available.");
      }

      const currentVersion = currentModel.getVersionId();
      if (currentVersion !== snapshotVersion) {
        throw new Error(
          "Editor content changed since prepareJsonEdit was called. Call prepareJsonEdit again.",
        );
      }

      const fullRange = currentModel.getFullModelRange();
      editor.executeEdits("json-edit", [
        { range: fullRange, text: newText, forceMoveMarkers: true },
      ]);
    },
  };
}
