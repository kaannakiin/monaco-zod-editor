# zod-monaco Roadmap

## North Star

Build a Monaco experience where the user edits JSON and Zod v4 provides the
schema source of truth behind the scenes for:

- JSON Schema generation
- structural validation
- runtime validation
- metadata-driven hover and completions

## Product Rules

- Monaco is JSON-only.
- Zod v4 is the only schema engine target.
- Monaco should use its built-in JSON language service.
- Metadata/examples should be passed separately from the base schema in the
  first implementation wave.
- Backward compatibility with removed legacy helpers is not required.

## Current Baseline

- `@zod-monaco/core` implements the Zod v4 → JSON Schema bridge with metadata support.
- `@zod-monaco/monaco` mounts Monaco via CDN AMD loader with hover, completions, and runtime validation wired.
- Framework wrappers (React, Angular, Vue) are thin controller adapters around the core controller.
- `apps/web` runs a real JSON editor demo backed by the `treeNodeDescriptor` fixture.

## Non-Goals

- Editing Zod code inside Monaco
- Adding a custom Monaco language
- Rebuilding deleted legacy intelligence helpers
- Shipping a fake demo before the runtime path is real

## Suggested Delivery Order

1. P0: Core contract and fixtures
2. P1: Monaco JSON MVP
3. P2: Runtime validation
4. P3: Metadata UX
5. P4: Productivity features
6. P5: Productization

## P0: Core Contract and Fixtures

**Goal:** lock the schema-first direction before adding runtime behavior.

### Tasks

- [x] Define the `@zod-monaco/core` public contract around direct Zod v4 schema input
- [x] Define the separate metadata/examples input shape
- [x] List the minimum supported metadata fields for v1
- [x] Create representative fixture schemas
- [x] Create representative fixture JSON documents
- [ ] Add unit tests for contract normalization and fixtures

### Suggested Metadata Fields

- `title`
- `description`
- `examples`
- `placeholder`
- `enumLabels`
- `emptyStateHint`

### Exit Criteria

- The team agrees on the first public input shape
- Fixtures cover simple objects, nested objects, arrays, enums, unions, and refinements
- `@zod-monaco/core` has tests ready for real implementation work

## P1: Monaco JSON MVP

**Goal:** get Monaco's JSON layer working from a Zod-derived schema.

### Tasks

- [x] Implement Zod v4 -> JSON Schema conversion in `@zod-monaco/core`
- [x] Decide model URI and schema registration strategy
- [x] Wire generated JSON Schema into Monaco JSON diagnostics
- [x] Preserve controller lifecycle, value sync, and cleanup in `@zod-monaco/monaco`
- [x] Keep React wrapper aligned with the controller shell
- [x] Replace the status page with a real but minimal JSON editor demo

### Exit Criteria

- Passing a Zod v4 schema results in Monaco JSON completions and structural validation
- The demo edits JSON, not schema code
- Core conversion logic and Monaco wiring are both covered by tests

## P2: Runtime Validation

**Goal:** add the Zod-specific value beyond structural JSON validation.

### Tasks

- [x] Parse editor content safely before runtime validation
- [x] Run `safeParse` against the current JSON value
- [x] Map `ZodError.issues[].path` back to Monaco ranges
- [x] Merge Monaco JSON markers and Zod runtime markers
- [x] Add validation trigger modes: debounced change, blur, manual
- [x] Expose validation results to wrapper consumers
- [ ] Add tests for nested path mapping and marker merging

### Exit Criteria

- Business-rule failures show up in the editor even when JSON structure is valid
- Nested errors point to the correct field or nearest useful range
- Consumers can react to validation results without scraping editor state

## P3: Metadata UX

**Goal:** turn validation into a guided authoring experience.

### Tasks

- [x] Surface metadata in hover content
- [x] Show examples and defaults in hover where available
- [x] Enrich completions with enum values, labels, and default suggestions
- [x] Distinguish required vs optional fields in the UX
- [x] Add an issue summary panel with click-to-focus behavior
- [ ] Add tests for hover rendering and completion enrichment

### Exit Criteria

- Hover gives useful context without opening external docs
- Required keys and allowed values are obvious while editing
- Error navigation works from both markers and summary UI

## P4: Productivity Features

**Goal:** make the editor feel like a workflow tool, not just a validator.

### Tasks

- [ ] Add code actions for missing required fields
- [ ] Add code actions for removing unknown keys
- [ ] Add code actions for applying defaults
- [ ] Add example JSON generation from schema + metadata
- [x] Add jump-to-error and reveal-path commands
- [ ] Add tests for code actions and generated example validity

### Exit Criteria

- A user can repair common problems without manual trial and error
- Empty documents can be bootstrapped from schema information
- Generated examples pass the intended schema shape rules

## P5: Productization

**Goal:** prepare the library for sustained use and publishing.

### Tasks

- [ ] Profile large-document performance
- [ ] Add debounce and worker strategy where needed
- [x] Revisit Vue and Angular wrappers after React stabilizes
- [ ] Write package-level docs and usage examples
- [ ] Add release checklist and versioning notes
- [ ] Define compatibility expectations for Monaco and Zod versions

### Exit Criteria

- Large JSON documents remain responsive
- Wrapper parity decisions are explicit
- The repo is publish-ready and the docs match the shipped behavior

## Roadmap-Level Success Criteria

- The repo never implies that Monaco is for editing Zod code directly.
- Every package description points to the same JSON-first architecture.
- The shipped API stays schema-first and Zod v4 only.
- A future implementation pass can start from the current package shells
  without removing more legacy behavior first.

## Testing Backlog

- [ ] Core unit tests for schema conversion
- [ ] Core unit tests for metadata normalization
- [ ] Core unit tests for runtime validation result shaping
- [ ] Monaco integration tests for controller mount/dispose/value sync
- [ ] Monaco integration tests for marker application
- [ ] React tests for controlled and uncontrolled usage
- [ ] Demo smoke test once the real editor exists

## Nice-to-Have Later

- [ ] Multi-schema switching
- [ ] Parsed output preview
- [ ] Read-only validated view mode
- [ ] Discriminator-aware UX for complex unions
