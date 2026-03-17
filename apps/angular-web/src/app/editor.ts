import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  OnDestroy,
  afterNextRender,
  viewChild,
  signal,
} from "@angular/core";
import {
  treeNodeDescriptor,
  treeNodeDefaultValue,
} from "@zod-monaco/core";
import {
  createZodMonacoAngularController,
  loadMonaco,
  type MonacoDisposable,
  type ValidationResult,
  type ZodIssue,
  type ZodMonacoAngularController,
} from "@zod-monaco/angular";

@Component({
  selector: "app-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!loaded()) {
      <div class="loading">Loading editor...</div>
    }
    <div #container class="editor-container"></div>
    @if (loaded() && issues().length > 0) {
      <ul class="issue-list" role="list" aria-label="Validation errors">
        @for (issue of issues(); track $index) {
          <li>
            <button
              type="button"
              class="issue-item"
              (mousedown)="$event.preventDefault()"
              (click)="revealIssue(issue)"
            >
              <span class="issue-path">{{ issue.path.join(" › ") || "root" }}</span>
              <span class="issue-message">{{ issue.message }}</span>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .editor-container {
      height: 80vh;
      border-radius: 12px;
      overflow: hidden;
    }
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 80vh;
      color: rgba(244, 247, 251, 0.5);
      font-size: 14px;
    }
    .issue-list {
      list-style: none;
      margin: 12px 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .issue-item {
      width: 100%;
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 6px;
      cursor: pointer;
      text-align: left;
      font-size: 13px;
      color: #f4f7fb;
    }
    .issue-item:hover {
      background: rgba(239, 68, 68, 0.2);
    }
    .issue-path {
      font-weight: 600;
      color: #f87171;
      white-space: nowrap;
    }
    .issue-message {
      color: rgba(244, 247, 251, 0.7);
    }
  `,
})
export class EditorComponent implements OnDestroy {
  readonly container = viewChild.required<ElementRef<HTMLDivElement>>("container");
  readonly loaded = signal(false);
  readonly issues = signal<ZodIssue[]>([]);

  #controller: ZodMonacoAngularController | null = null;
  #validationSubscription: MonacoDisposable | null = null;

  constructor() {
    afterNextRender(() => {
      this.#initEditor();
    });
  }

  async #initEditor(): Promise<void> {
    const monaco = await loadMonaco();

    this.#controller = createZodMonacoAngularController({
      monaco,
      descriptor: treeNodeDescriptor,
      value: treeNodeDefaultValue,
      editorOptions: {
        theme: "vs-dark",
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        padding: { top: 16 },
      },
    });

    this.#controller.mount(this.container().nativeElement);

    this.#validationSubscription = this.#controller.onValidationChange(
      (result: ValidationResult) => {
        this.issues.set(result.issues);
      },
    );

    this.loaded.set(true);
  }

  revealIssue(issue: ZodIssue): void {
    this.#controller?.revealIssue(issue);
  }

  ngOnDestroy(): void {
    this.#validationSubscription?.dispose();
    this.#validationSubscription = null;
    this.#controller?.dispose();
    this.#controller = null;
  }
}
