import {
  createZodEditorController,
  type CreateZodEditorControllerOptions,
  type MonacoDisposable,
  type ValidationResult,
  type ZodEditorController,
  type ZodIssue,
} from "@zod-monaco/monaco";

export * from "@zod-monaco/monaco";

export interface ZodMonacoVueController extends MonacoDisposable {
  mount: ZodEditorController["mount"];
  getEditor: ZodEditorController["getEditor"];
  getModelValue(): string;
  setModelValue(value: string): void;
  onModelValueChange(listener: (value: string) => void): MonacoDisposable;
  onValidationChange(listener: (result: ValidationResult) => void): MonacoDisposable;
  revealIssue(issue: ZodIssue): void;
}

export type CreateZodMonacoVueControllerOptions =
  CreateZodEditorControllerOptions;

export function createZodMonacoVueController(
  options: CreateZodMonacoVueControllerOptions,
): ZodMonacoVueController {
  const controller = createZodEditorController(options);

  return {
    mount: (element) => controller.mount(element),
    getEditor: () => controller.getEditor(),
    getModelValue: () => controller.getValue(),
    setModelValue: (value) => controller.setValue(value),
    onModelValueChange(listener) {
      return controller.onChange((value) => {
        listener(value);
      });
    },
    onValidationChange(listener) {
      return controller.onValidationChange(listener);
    },
    revealIssue(issue) {
      controller.revealIssue(issue);
    },
    dispose() {
      controller.dispose();
    },
  };
}
