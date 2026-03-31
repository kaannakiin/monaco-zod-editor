# @zod-monaco/core

## 3.0.0

### Major Changes

- **BREAKING: dot-notation ve `_meta` nested metadata formatı kaldırıldı.**

  `metadata.fields` artık yalnızca `FieldMetadataEntry[]` flat listesi kabul ediyor. Eski dot-notation record formatı ve `_meta` tree formatı artık çalışmıyor.

  ```ts
  // Önce — dot-notation record
  metadata: { fields: { "Children.Content": { title: "Content" } } }

  // Şimdi — segment array entry list
  metadata: {
    fields: [{ path: ["Children", "Content"], title: "Content" }]
  }
  ```

  **BREAKING: segment-array path modeli zorunlu hale geldi.**

  Tüm public path girdileri artık `readonly string[]` segment array formatında olmalı. Dot-notation string path desteği kaldırıldı.

  **Yeni `refinements` API eklendi.**

  `describeSchema()` artık `refinements` seçeneğini kabul ediyor. Enum refinements JSON Schema'ya inject edilir ve `descriptor.validate()` tarafından da runtime'da kontrol edilir.

  ```ts
  // Önce — dynamic enum için schema factory rebuild
  const descriptor = describeSchema(buildSchema(loopSources), { metadata });

  // Şimdi — sabit schema, runtime injection
  const descriptor = describeSchema(schema, {
    metadata,
    refinements: [{ path: ["Children", "Loop", "source"], enum: loopSources }],
  });
  ```

  **Yeni export'lar:** `SchemaPath`, `EnumRefinement`, `SuggestionRefinement`, `FieldMetadataEntry`, `applyEnumRefinements`, `matchesSchemaPath`

## 2.2.0

### Minor Changes

- 6845165: Add type-safe field metadata paths with `DeepPaths<T>` — full IDE autocomplete for `describeSchema` metadata fields up to 10 levels deep. Also adds optional nested object format with `_meta` sentinel as an alternative to flat dot-notation keys.

### Patch Changes

- 6845165: Fix hover resolution for allOf/intersection types and render default values in hover tooltips.

## 1.0.0

### Major Changes

- added-theme
