import {
  createZodEditorController,
  type BreadcrumbSegment,
  type CreateZodEditorControllerOptions,
  type MonacoDisposable,
  type ValidationResult,
  type ZodEditorController,
  type ZodIssue,
} from "@zod-monaco/monaco";

export * from "@zod-monaco/monaco";

export interface ZodMonacoAngularController extends MonacoDisposable {
  mount: ZodEditorController["mount"];
  getEditor: ZodEditorController["getEditor"];
  readValue(): string;
  writeValue(value: string): void;
  registerOnChange(listener: (value: string) => void): MonacoDisposable;
  registerOnTouched(listener: () => void): MonacoDisposable;
  markAsTouched(): void;
  onValidationChange(
    listener: (result: ValidationResult) => void,
  ): MonacoDisposable;
  onCursorPathChange(
    listener: (segments: BreadcrumbSegment[]) => void,
  ): MonacoDisposable;
  revealIssue(issue: ZodIssue): void;
  revealPath(path: PropertyKey[]): void;
}

export type CreateZodMonacoAngularControllerOptions =
  CreateZodEditorControllerOptions;

export function createZodMonacoAngularController(
  options: CreateZodMonacoAngularControllerOptions,
): ZodMonacoAngularController {
  const controller = createZodEditorController(options);
  const touchedListeners = new Set<() => void>();

  return {
    mount: (element) => controller.mount(element),
    getEditor: () => controller.getEditor(),
    readValue: () => controller.getValue(),
    writeValue: (value) => controller.setValue(value),
    registerOnChange(listener) {
      return controller.onChange((value) => {
        listener(value);
      });
    },
    registerOnTouched(listener) {
      touchedListeners.add(listener);

      return {
        dispose() {
          touchedListeners.delete(listener);
        },
      };
    },
    markAsTouched() {
      for (const listener of touchedListeners) {
        listener();
      }
    },
    onValidationChange(listener) {
      return controller.onValidationChange(listener);
    },
    onCursorPathChange(listener) {
      return controller.onCursorPathChange(listener);
    },
    revealIssue(issue) {
      controller.revealIssue(issue);
    },
    revealPath(path) {
      controller.revealPath(path);
    },
    dispose() {
      touchedListeners.clear();
      controller.dispose();
    },
  };
}
