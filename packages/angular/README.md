# @zod-monaco/angular

Angular adapter for Zod-powered Monaco JSON editor. Provides a controller factory with `ControlValueAccessor`-compatible methods for Angular forms integration.

## Installation

```bash
npm install @zod-monaco/angular @zod-monaco/core zod
```

## Usage

```ts
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { loadMonaco, createZodMonacoAngularController } from "@zod-monaco/angular";
import { describeSchema } from "@zod-monaco/core";
import { z } from "zod";

@Component({
  selector: "app-editor",
  template: `<div #editorContainer style="height: 400px"></div>`,
})
export class EditorComponent implements OnInit, OnDestroy {
  @ViewChild("editorContainer", { static: true }) container!: ElementRef;

  private controller?: ReturnType<typeof createZodMonacoAngularController>;

  async ngOnInit() {
    const monaco = await loadMonaco();
    const descriptor = describeSchema(
      z.object({ name: z.string(), age: z.number() }),
    );

    this.controller = createZodMonacoAngularController({ monaco, descriptor });
    this.controller.mount(this.container.nativeElement);
    this.controller.registerOnChange((value) => console.log(value));
  }

  ngOnDestroy() {
    this.controller?.dispose();
  }
}
```

## API

### `createZodMonacoAngularController(options)`

Returns a `ZodMonacoAngularController` with `ControlValueAccessor`-compatible methods:

- `mount(element)` — mount editor to DOM
- `readValue()` / `writeValue(value)` — read/write content
- `registerOnChange(listener)` — subscribe to changes
- `registerOnTouched(listener)` — subscribe to touch events
- `markAsTouched()` — trigger touched listeners
- `onValidationChange(listener)` — subscribe to validation results
- `revealIssue(issue)` — navigate to a Zod issue
- `dispose()` — cleanup

## Note

Monaco is loaded from CDN. See `@zod-monaco/monaco` for details.

## License

MIT
