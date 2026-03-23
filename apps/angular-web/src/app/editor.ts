import {
  ChangeDetectorRef,
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  viewChild,
  signal,
} from '@angular/core';
import { treeNodeDescriptor, treeNodeDefaultValue } from '@zod-monaco/core';
import {
  createZodMonacoAngularController,
  loadMonaco,
  type BreadcrumbSegment,
  type MonacoDisposable,
  type ValidationResult,
  type ZodIssue,
  type ZodMonacoAngularController,
} from '@zod-monaco/angular';

@Component({
  selector: 'app-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!loaded()) {
      <div class="loading">Loading editor...</div>
    }
    @if (breadcrumbs().length > 0) {
      <nav class="breadcrumb-bar" aria-label="JSON path">
        @for (segment of breadcrumbs(); track $index) {
          @if ($index > 0) {
            <span class="breadcrumb-separator" aria-hidden="true">›</span>
          }
          <button
            type="button"
            class="breadcrumb-segment"
            [class.breadcrumb-active]="$last"
            (mousedown)="$event.preventDefault()"
            (click)="revealPath(segment.path)"
            [attr.aria-current]="$last ? 'location' : null"
          >
            {{ segment.label }}
          </button>
        }
      </nav>
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
              <span class="issue-path">{{ issue.path.join(' › ') || 'root' }}</span>
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
    .breadcrumb-bar {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      background: rgba(30, 30, 30, 0.8);
      border-radius: 12px 12px 0 0;
      font-size: 13px;
      min-height: 32px;
      overflow-x: auto;
    }
    .breadcrumb-segment {
      background: none;
      border: none;
      color: rgba(244, 247, 251, 0.6);
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 3px;
      font-family: inherit;
      font-size: inherit;
      white-space: nowrap;
    }
    .breadcrumb-segment:hover {
      background: rgba(244, 247, 251, 0.1);
      color: #f4f7fb;
    }
    .breadcrumb-active {
      color: #f4f7fb;
      font-weight: 600;
    }
    .breadcrumb-separator {
      color: rgba(244, 247, 251, 0.3);
    }
    .editor-container {
      height: 80vh;
      border-radius: 0 0 12px 12px;
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
  readonly #cdr = inject(ChangeDetectorRef);
  readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  readonly loaded = signal(false);
  readonly issues = signal<ZodIssue[]>([]);
  readonly breadcrumbs = signal<BreadcrumbSegment[]>([]);

  #controller: ZodMonacoAngularController | null = null;
  #validationSubscription: MonacoDisposable | null = null;
  #cursorPathSubscription: MonacoDisposable | null = null;

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
        theme: 'vs-dark',
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        padding: { top: 16 },
      },
    });

    this.#controller.mount(this.container().nativeElement);
    this.loaded.set(true);
    this.#cdr.markForCheck();

    this.#validationSubscription = this.#controller.onValidationChange(
      (result: ValidationResult) => {
        this.issues.set(result.issues);
        this.#cdr.markForCheck();
      },
    );

    this.#cursorPathSubscription = this.#controller.onCursorPathChange((segments) => {
      this.breadcrumbs.set(segments);
      this.#cdr.markForCheck();
    });
  }

  revealIssue(issue: ZodIssue): void {
    this.#controller?.revealIssue(issue);
  }

  revealPath(path: PropertyKey[]): void {
    this.#controller?.revealPath(path);
  }

  ngOnDestroy(): void {
    this.#cursorPathSubscription?.dispose();
    this.#cursorPathSubscription = null;
    this.#validationSubscription?.dispose();
    this.#validationSubscription = null;
    this.#controller?.dispose();
    this.#controller = null;
  }
}
