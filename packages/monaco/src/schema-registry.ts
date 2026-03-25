import type { MonacoApi, MonacoDisposable } from "./monaco-types.js";

export interface SchemaEntry {
  uri: string;
  fileMatch: string[];
  schema: Record<string, unknown>;
}

export interface SchemaRegistration extends MonacoDisposable {
  /** Replace this registration's schema in-place and flush. */
  update(entry: SchemaEntry): void;
}

export interface ZodSchemaRegistry extends MonacoDisposable {
  register(entry: SchemaEntry): SchemaRegistration;
}

class DefaultSchemaRegistry implements ZodSchemaRegistry {
  readonly #monaco: MonacoApi;
  readonly #entries = new Map<string, SchemaEntry>();

  constructor(monaco: MonacoApi) {
    this.#monaco = monaco;
  }

  register(entry: SchemaEntry): SchemaRegistration {
    this.#entries.set(entry.uri, entry);
    this.#flush();

    let disposed = false;

    return {
      update: (updated: SchemaEntry) => {
        if (disposed) return;
        if (updated.uri !== entry.uri) {
          this.#entries.delete(entry.uri);
        }
        entry = updated;
        this.#entries.set(entry.uri, entry);
        this.#flush();
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        this.#entries.delete(entry.uri);
        this.#flush();
      },
    };
  }

  dispose(): void {
    this.#entries.clear();
    this.#flush();
    registries.delete(this.#monaco);
  }

  #flush(): void {
    if (this.#entries.size === 0) {
      this.#monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: false,
        schemas: [],
      });
      return;
    }

    this.#monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      enableSchemaRequest: false,
      schemas: [...this.#entries.values()],
    });
  }
}

const registries = new WeakMap<MonacoApi, ZodSchemaRegistry>();

export function getSchemaRegistry(monaco: MonacoApi): ZodSchemaRegistry {
  let registry = registries.get(monaco);
  if (!registry) {
    registry = new DefaultSchemaRegistry(monaco);
    registries.set(monaco, registry);
  }
  return registry;
}
