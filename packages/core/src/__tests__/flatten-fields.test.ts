import { describe, test, expect } from "vitest";
import { normalizeFieldsInput } from "../flatten-fields.js";

describe("normalizeFieldsInput", () => {
  describe("flat format passthrough", () => {
    test("returns flat record unchanged", () => {
      const fields = {
        name: { title: "Name" },
        "address.street": { title: "Street" },
      };
      expect(normalizeFieldsInput(fields)).toEqual(fields);
    });

    test("handles empty object", () => {
      expect(normalizeFieldsInput({})).toEqual({});
    });
  });

  describe("nested format flattening", () => {
    test("flattens single level with _meta", () => {
      const fields = {
        Root: {
          _meta: { title: "Root Element" },
          Type: { title: "Root Type" },
          Name: { title: "Root Name" },
        },
      };
      expect(normalizeFieldsInput(fields)).toEqual({
        Root: { title: "Root Element" },
        "Root.Type": { title: "Root Type" },
        "Root.Name": { title: "Root Name" },
      });
    });

    test("flattens deeply nested structures", () => {
      const fields = {
        Root: {
          _meta: { title: "Root" },
          Resources: {
            _meta: { title: "Resources" },
            Name: { title: "Resource Name" },
          },
        },
      };
      expect(normalizeFieldsInput(fields)).toEqual({
        Root: { title: "Root" },
        "Root.Resources": { title: "Resources" },
        "Root.Resources.Name": { title: "Resource Name" },
      });
    });

    test("handles nested nodes without _meta", () => {
      const fields = {
        address: {
          street: { title: "Street" },
          city: { title: "City" },
        },
      };
      expect(normalizeFieldsInput(fields)).toEqual({
        "address.street": { title: "Street" },
        "address.city": { title: "City" },
      });
    });

    test("handles mixed _meta and children", () => {
      const fields = {
        Children: {
          _meta: { title: "Children", description: "All UI elements" },
          GridSettings: {
            _meta: { title: "Grid Position" },
            Row: { title: "Row Index", description: "Grid row index" },
            Column: { title: "Column Index" },
          },
          Type: { title: "Element Type" },
        },
      };
      expect(normalizeFieldsInput(fields)).toEqual({
        Children: { title: "Children", description: "All UI elements" },
        "Children.GridSettings": { title: "Grid Position" },
        "Children.GridSettings.Row": {
          title: "Row Index",
          description: "Grid row index",
        },
        "Children.GridSettings.Column": { title: "Column Index" },
        "Children.Type": { title: "Element Type" },
      });
    });

    test("ignores _meta at root level (no prefix)", () => {
      const fields = {
        _meta: { title: "Should be ignored" },
        name: { title: "Name" },
      };
      // _meta at root has no prefix, so it is skipped
      expect(normalizeFieldsInput(fields)).toEqual({
        name: { title: "Name" },
      });
    });

    test("preserves all FieldMetadata properties", () => {
      const fields = {
        node: {
          _meta: {
            title: "Node",
            description: "A tree node",
            examples: [{ id: "1" }],
            placeholder: "Enter node",
            enumLabels: { a: "Label A" },
            emptyStateHint: "Add a node",
          },
        },
      };
      expect(normalizeFieldsInput(fields)).toEqual({
        node: {
          title: "Node",
          description: "A tree node",
          examples: [{ id: "1" }],
          placeholder: "Enter node",
          enumLabels: { a: "Label A" },
          emptyStateHint: "Add a node",
        },
      });
    });
  });
});
