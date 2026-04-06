import type { FieldMetadata } from "./types.js";
import type { FieldContext, FieldPath } from "./field-context-types.js";
import {
  resolveJsonSchemaNode,
  resolveJsonSchemaMetadata,
} from "./resolve-json-schema-metadata.js";
import { toJsonPointer } from "./path-utils.js";

/**
 * Caches resolved JSON Schema nodes and metadata by path.
 * Immutable per JSON Schema — create a new instance when the schema changes.
 */
export class SchemaCache {
  #nodeCache = new Map<string, Record<string, unknown> | null>();
  #metadataCache = new Map<string, FieldMetadata | undefined>();
  #contextCache = new Map<string, FieldContext>();
  #jsonSchema: Record<string, unknown>;

  constructor(jsonSchema: Record<string, unknown>) {
    this.#jsonSchema = jsonSchema;
  }

  resolveNode(path: string[]): Record<string, unknown> | null {
    const key = toJsonPointer(path);
    if (this.#nodeCache.has(key)) {
      return this.#nodeCache.get(key)!;
    }
    const result = resolveJsonSchemaNode(this.#jsonSchema, path);
    this.#nodeCache.set(key, result);
    return result;
  }

  resolveMetadata(path: string[]): FieldMetadata | undefined {
    const key = toJsonPointer(path);
    if (this.#metadataCache.has(key)) {
      return this.#metadataCache.get(key);
    }
    const result = resolveJsonSchemaMetadata(this.#jsonSchema, path);
    this.#metadataCache.set(key, result);
    return result;
  }

  /**
   * Caches the result of resolveFieldContext() for a given path.
   * Returns cached result if available, otherwise calls the resolver and caches it.
   */
  resolveContext(
    path: FieldPath,
    resolver: () => FieldContext,
  ): FieldContext {
    const key = toJsonPointer(path);
    const cached = this.#contextCache.get(key);
    if (cached) return cached;
    const result = resolver();
    this.#contextCache.set(key, result);
    return result;
  }
}
