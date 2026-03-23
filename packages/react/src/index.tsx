import {
  type CSSProperties,
  type HTMLAttributes,
  useEffect,
  useRef,
} from "react";
import {
  createZodEditorController,
  type BreadcrumbSegment,
  type MonacoApi,
  type MonacoEditorChangeEvent,
  type MonacoStandaloneEditorLike,
  type ZodEditorController,
  type FeatureToggles,
  type ValidationResult,
} from "@zod-monaco/monaco";
import type { SchemaDescriptor } from "@zod-monaco/core";

export * from "@zod-monaco/monaco";

export interface ZodMonacoEditorProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "defaultValue" | "onChange"
> {
  monaco: MonacoApi;
  descriptor?: SchemaDescriptor;
  features?: FeatureToggles;
  value?: string;
  defaultValue?: string;
  editorOptions?: Record<string, unknown>;
  validationDelay?: number;
  style?: CSSProperties;
  onChange?: (value: string, event: MonacoEditorChangeEvent) => void;
  onValidationChange?: (result: ValidationResult) => void;
  onCursorPathChange?: (segments: BreadcrumbSegment[]) => void;
  onMount?: (
    editor: MonacoStandaloneEditorLike,
    controller: ZodEditorController,
  ) => void;
}

export function ZodMonacoEditor({
  className,
  defaultValue,
  descriptor,
  editorOptions,
  features,
  monaco,
  onChange,
  onValidationChange,
  onCursorPathChange,
  onMount,
  style,
  validationDelay,
  value,
  ...props
}: ZodMonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ZodEditorController | null>(null);
  const initialValueRef = useRef(value ?? defaultValue);
  const onChangeRef = useRef(onChange);
  const onValidationChangeRef = useRef(onValidationChange);
  const onCursorPathChangeRef = useRef(onCursorPathChange);
  const onMountRef = useRef(onMount);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onValidationChangeRef.current = onValidationChange;
  }, [onValidationChange]);

  useEffect(() => {
    onCursorPathChangeRef.current = onCursorPathChange;
  }, [onCursorPathChange]);

  useEffect(() => {
    onMountRef.current = onMount;
  }, [onMount]);

  // Mount/remount controller
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const controller = createZodEditorController({
      descriptor,
      editorOptions,
      features,
      monaco,
      validationDelay,
      value: initialValueRef.current,
    });
    const editor = controller.mount(containerRef.current);
    const changeSubscription = controller.onChange((nextValue, event) => {
      onChangeRef.current?.(nextValue, event);
    });
    const validationSubscription = controller.onValidationChange((result) => {
      onValidationChangeRef.current?.(result);
    });
    const cursorPathSubscription = controller.onCursorPathChange((segments) => {
      onCursorPathChangeRef.current?.(segments);
    });

    controllerRef.current = controller;
    onMountRef.current?.(editor, controller);

    return () => {
      changeSubscription.dispose();
      validationSubscription.dispose();
      cursorPathSubscription.dispose();
      controller.dispose();
      controllerRef.current = null;
    };
  }, [editorOptions, monaco, features, validationDelay]);

  // Sync controlled value
  useEffect(() => {
    if (value === undefined) {
      return;
    }

    controllerRef.current?.setValue(value);
  }, [value]);

  // Sync descriptor changes without remount
  useEffect(() => {
    controllerRef.current?.setDescriptor(descriptor ?? null);
  }, [descriptor]);

  return (
    <div
      {...props}
      className={className}
      ref={containerRef}
      style={{ minHeight: 320, ...style }}
    />
  );
}
