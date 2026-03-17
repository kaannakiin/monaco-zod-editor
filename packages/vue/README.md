# @zod-monaco/vue

Vue adapter for Zod-powered Monaco JSON editor. Provides a Vue-idiomatic controller factory with `v-model` compatible naming conventions.

## Installation

```bash
npm install @zod-monaco/vue @zod-monaco/core zod
```

## Usage

```vue
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { loadMonaco, createZodMonacoVueController } from "@zod-monaco/vue";
import { describeSchema } from "@zod-monaco/core";
import { z } from "zod";

const editorRef = ref<HTMLElement>();
const descriptor = describeSchema(
  z.object({ name: z.string(), age: z.number() }),
);

let controller: ReturnType<typeof createZodMonacoVueController>;

onMounted(async () => {
  const monaco = await loadMonaco();
  controller = createZodMonacoVueController({ monaco, descriptor });
  controller.mount(editorRef.value!);
  controller.onModelValueChange((value) => console.log(value));
});

onBeforeUnmount(() => controller?.dispose());
</script>

<template>
  <div ref="editorRef" style="height: 400px" />
</template>
```

## API

### `createZodMonacoVueController(options)`

Returns a `ZodMonacoVueController` with Vue naming conventions:

- `mount(element)` — mount editor to DOM
- `getModelValue()` / `setModelValue(value)` — read/write content
- `onModelValueChange(listener)` — subscribe to changes
- `onValidationChange(listener)` — subscribe to validation results
- `revealIssue(issue)` — navigate to a Zod issue
- `dispose()` — cleanup

## Note

Monaco is loaded from CDN. See `@zod-monaco/monaco` for details.

## License

MIT
