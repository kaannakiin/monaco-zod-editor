# Feature Landscape

**Domain:** Zod v4 backed JSON editing in Monaco
**Researched:** 2026-03-13
**Confidence:** High

## Core Features

- Zod v4 schema input as the single source of truth
- JSON Schema generation from the schema
- Monaco JSON diagnostics and completions driven by that schema
- Runtime validation layered on top of Monaco's structural checks
- Separate metadata/examples input for hover and richer UX

## Must-Haves

| Feature | Why It Matters | Priority |
|---------|----------------|----------|
| Zod v4 to JSON Schema | Required to drive Monaco JSON services | High |
| Monaco JSON diagnostics wiring | Delivers completions and structural validation | High |
| Runtime Zod validation | Catches rules JSON Schema cannot express | High |
| JSON path to marker mapping | Makes runtime errors usable inside the editor | High |
| React wrapper on top of the schema-first core | Fastest way to validate the API design | High |

## Valuable Follow-Ups

| Feature | Value | Priority |
|---------|-------|----------|
| Metadata-aware hover | Turns schema docs and examples into editor help | Medium |
| Validation timing controls | Supports forms, configs, and manual flows | Medium |
| Parsed output callbacks | Lets consumers use validated data directly | Medium |
| Vue and Angular parity | Expands wrapper coverage after React stabilizes | Medium |

## Things To Avoid

- Any new custom Monaco language
- Any editor flow where the user types Zod code directly
- Fake demo behavior that suggests runtime validation already exists
- Compatibility work for deleted legacy helpers
