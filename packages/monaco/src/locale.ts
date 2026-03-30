export interface ZodMonacoLocale {
  required: string;
  optional: string;
  examples: string;
  placeholder: string;
  enumValues: string;
  defaultValue: string;
}

export const locales = {
  en: {
    required: "Required",
    optional: "Optional",
    examples: "Examples",
    placeholder: "Placeholder",
    enumValues: "Enum values",
    defaultValue: "Default",
  },
  tr: {
    required: "Zorunlu",
    optional: "İsteğe bağlı",
    examples: "Örnekler",
    placeholder: "Yer tutucu",
    enumValues: "Enum değerleri",
    defaultValue: "Varsayılan",
  },
} satisfies Record<string, ZodMonacoLocale>;

export const defaultLocale: ZodMonacoLocale = locales.en;
