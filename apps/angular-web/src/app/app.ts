import { Component, ChangeDetectionStrategy } from "@angular/core";
import { EditorComponent } from "./editor";

@Component({
  selector: "app-root",
  imports: [EditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <h1>zod-monaco — Angular</h1>
      <app-editor />
    </main>
  `,
  styles: `
    main {
      max-width: 960px;
      margin: 0 auto;
      padding: 24px;
      font-family: system-ui, -apple-system, sans-serif;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      color: #f4f7fb;
      margin-bottom: 16px;
    }
  `,
})
export class App {}
