export interface ZodMonacoLocale {
  required: string;
  optional: string;
  examples: string;
  placeholder: string;
  enumValues: string;
  defaultValue: string;
  readOnly: string;
}

export const locales = {
  en: {
    required: "Required",
    optional: "Optional",
    examples: "Examples",
    placeholder: "Placeholder",
    enumValues: "Enum values",
    defaultValue: "Default",
    readOnly: "Read-only",
  },
  tr: {
    required: "Zorunlu",
    optional: "İsteğe bağlı",
    examples: "Örnekler",
    placeholder: "Yer tutucu",
    enumValues: "Enum değerleri",
    defaultValue: "Varsayılan",
    readOnly: "Salt okunur",
  },
} satisfies Record<string, ZodMonacoLocale>;

export const defaultLocale: ZodMonacoLocale = locales.en;
