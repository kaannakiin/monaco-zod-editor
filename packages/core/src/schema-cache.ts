import type { FieldMetadata } from "./types.js";
import {
  resolveJsonSchemaNode,
  resolveJsonSchemaMetadata,
} from "./resolve-json-schema-metadata.js";

/**
 * Caches resolved JSON Schema nodes and metadata by path.
 * Immutable per JSON Schema — create a new instance when the schema changes.
 */
export class SchemaCache {
  #nodeCache = new Map<string, Record<string, unknown> | null>();
  #metadataCache = new Map<string, FieldMetadata | undefined>();
  #jsonSchema: Record<string, unknown>;

  constructor(jsonSchema: Record<string, unknown>) {
    this.#jsonSchema = jsonSchema;
  }

  resolveNode(path: string[]): Record<string, unknown> | null {
    const key = path.join("\0");
    if (this.#nodeCache.has(key)) {
      return this.#nodeCache.get(key)!;
    }
    const result = resolveJsonSchemaNode(this.#jsonSchema, path);
    this.#nodeCache.set(key, result);
    return result;
  }

  resolveMetadata(path: string[]): FieldMetadata | undefined {
    const key = path.join("\0");
    if (this.#metadataCache.has(key)) {
      return this.#metadataCache.get(key);
    }
    const result = resolveJsonSchemaMetadata(this.#jsonSchema, path);
    this.#metadataCache.set(key, result);
    return result;
  }
}
