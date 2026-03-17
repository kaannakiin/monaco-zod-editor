# zod-monaco Architecture

## Current Shape

- `@zod-monaco/core`: placeholder package for the future Zod v4 bridge
- `@zod-monaco/monaco`: minimal controller that mounts Monaco in JSON mode
- `@zod-monaco/react`: React wrapper around the controller
- `@zod-monaco/vue`: Vue-flavored controller wrapper
- `@zod-monaco/angular`: Angular-flavored controller wrapper
- `apps/web`: repo-status page, not a runtime feature demo

## Target Shape

- `core` will own Zod v4 schema input, JSON Schema generation, metadata
  normalization, and runtime validation.
- `monaco` will stay a thin adapter that configures Monaco JSON services and
  translates validation results into editor markers.
- Framework packages will stay thin and should not duplicate validation logic.

## Design Constraints

- JSON is the only editing surface.
- No custom Monaco language should be added.
- Metadata should travel separately from the base schema during the first
  implementation pass.
- Compatibility with removed legacy helpers is not a goal.
