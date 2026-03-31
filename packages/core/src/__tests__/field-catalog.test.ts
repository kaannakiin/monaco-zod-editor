import { describe, test, expect } from "vitest";
import { buildFieldCatalog } from "../field-catalog.js";
import { treeNodeDescriptor } from "../examples/tree-node.js";

const descriptor = treeNodeDescriptor;

function findField(fields: ReturnType<typeof buildFieldCatalog>["fields"], ...path: (string | number)[]) {
  return fields.find((f) =>
    f.path.length === path.length &&
    f.path.every((seg, i) => seg === path[i])
  );
}

describe("buildFieldCatalog", () => {
  describe("basic structure", () => {
    test("root entry is the schema root", () => {
      const { root } = buildFieldCatalog(descriptor);
      expect(root.path).toEqual([]);
      expect(root.pointer).toBe("");
      expect(root.typeInfo.type).toBe("object");
    });

    test("flat fields list contains top-level scalar fields", () => {
      const { fields } = buildFieldCatalog(descriptor);
      const keys = fields.map((f) => f.path[0]);
      expect(keys).toContain("id");
      expect(keys).toContain("label");
      expect(keys).toContain("nodeType");
      expect(keys).toContain("priority");
    });

    test("nested fields are included", () => {
      const { fields } = buildFieldCatalog(descriptor);
      const createdAt = findField(fields, "metadata", "createdAt");
      expect(createdAt).toBeDefined();
      expect(createdAt!.typeInfo.type).toBe("string");
    });

    test("JSON Pointer is correct for nested field", () => {
      const { fields } = buildFieldCatalog(descriptor);
      const email = findField(fields, "metadata", "owner", "email");
      expect(email).toBeDefined();
      expect(email!.pointer).toBe("/metadata/owner/email");
    });
  });

  describe("union branch grouping", () => {
    test("content field has branches array", () => {
      const { fields } = buildFieldCatalog(descriptor);
      const content = findField(fields, "content");
      expect(content).toBeDefined();
      expect(Array.isArray(content!.branches)).toBe(true);
      expect(content!.branches!.length).toBe(3);
    });

    test("branches are NOT in flat fields list", () => {
      const { fields } = buildFieldCatalog(descriptor);
      // body, sizeBytes, target — branch-specific fields must not appear at top level
      const body = findField(fields, "content", "body");
      const sizeBytes = findField(fields, "content", "sizeBytes");
      expect(body).toBeUndefined();
      expect(sizeBytes).toBeUndefined();
    });

    test("each branch has its own fields", () => {
      const { fields } = buildFieldCatalog(descriptor);
      const content = findField(fields, "content");
      const branches = content!.branches!;

      const allBranchProps = branches.flatMap((b) => b.fields.map((f) => f.path.at(-1)));
      expect(allBranchProps).toContain("body");
      expect(allBranchProps).toContain("sizeBytes");
      expect(allBranchProps).toContain("target");
    });

    test("discriminator key detected on content branches", () => {
      const { fields } = buildFieldCatalog(descriptor);
      const content = findField(fields, "content");
      const branches = content!.branches!;
      // All branches should have discriminatorKey = "kind"
      expect(branches.every((b) => b.discriminatorKey === "kind")).toBe(true);
      // discriminatorValue should match "text", "binary", "link"
      const values = branches.map((b) => b.discriminatorValue).sort();
      expect(values).toEqual(["binary", "link", "text"]);
    });
  });

  describe("nullable fields (anyOf with null)", () => {
    test("metadata.owner is in flat list (nullable object, not true union)", () => {
      const { fields } = buildFieldCatalog(descriptor);
      const owner = findField(fields, "metadata", "owner");
      expect(owner).toBeDefined();
      // Should NOT have branches (nullable is not a true union)
      expect(owner!.branches).toBeUndefined();
    });

    test("metadata.owner.name is enumerated under nullable owner", () => {
      const { fields } = buildFieldCatalog(descriptor);
      const ownerName = findField(fields, "metadata", "owner", "name");
      expect(ownerName).toBeDefined();
    });

    test("priority is in flat list (nullable integer)", () => {
      const { fields } = buildFieldCatalog(descriptor);
      const priority = findField(fields, "priority");
      expect(priority).toBeDefined();
      expect(priority!.branches).toBeUndefined();
    });
  });

  describe("array wildcard entries", () => {
    test("children array emits a wildcard entry", () => {
      const { fields } = buildFieldCatalog(descriptor);
      const wildcards = fields.filter((f) => f.pointer === null && f.pathPattern?.startsWith("/children"));
      expect(wildcards.length).toBeGreaterThan(0);
    });

    test("wildcard entry has pointer: null and pathPattern", () => {
      const { fields } = buildFieldCatalog(descriptor);
      const wc = fields.find((f) => f.pointer === null && f.pathPattern === "/children/*");
      expect(wc).toBeDefined();
      expect(wc!.pathPattern).toBe("/children/*");
    });
  });

  describe("recursive schema — bounded unroll", () => {
    test("children item fields are enumerated once (1 unroll)", () => {
      const { fields } = buildFieldCatalog(descriptor, { recursionUnrollDepth: 1 });
      // children[0].id should exist
      const childId = findField(fields, "children", 0, "id");
      expect(childId).toBeDefined();
    });

    test("second recursion level is cut with recursive: true", () => {
      const { fields } = buildFieldCatalog(descriptor, { recursionUnrollDepth: 1 });
      // The children wildcard entry inside the first unroll should be marked recursive
      const deepChildren = fields.filter(
        (f) => f.recursive === true && f.pathPattern?.includes("children"),
      );
      expect(deepChildren.length).toBeGreaterThan(0);
    });

    test("recursionUnrollDepth: 0 cuts immediately", () => {
      const { fields } = buildFieldCatalog(descriptor, { recursionUnrollDepth: 0 });
      // children item fields should NOT be enumerated
      const childId = findField(fields, "children", 0, "id");
      expect(childId).toBeUndefined();
    });
  });

  describe("focusPath subtree filter", () => {
    test("only enumerates fields under focusPath", () => {
      const { fields } = buildFieldCatalog(descriptor, {
        focusPath: ["metadata"],
      });
      // Should have createdAt, permissions, owner (and owner children)
      const paths = fields.map((f) => f.path[0]);
      // All entries should start under metadata context
      // (they are relative to the metadata object within the schema walk)
      expect(fields.length).toBeGreaterThan(0);
      // id, label, etc. should NOT appear
      expect(findField(fields, "id")).toBeUndefined();
      expect(findField(fields, "label")).toBeUndefined();
    });

    test("focusPath root entry is the focused node", () => {
      const { root } = buildFieldCatalog(descriptor, {
        focusPath: ["metadata"],
      });
      expect(root.path).toEqual(["metadata"]);
      expect(root.pointer).toBe("/metadata");
      expect(root.typeInfo.type).toBe("object");
    });
  });

  describe("currentValue overlay", () => {
    test("currentValue is set on matching entries", () => {
      const currentValue = {
        id: "abc-123",
        label: "src",
        nodeType: "folder",
        metadata: { createdAt: "2026-01-01T00:00:00Z", permissions: ["read"], owner: null },
        attributes: {},
        content: { kind: "text", body: "", encoding: "utf-8" },
        tags: ["root"],
        priority: 5,
        children: [],
      };

      const { fields } = buildFieldCatalog(descriptor, { currentValue });
      const id = findField(fields, "id");
      expect(id!.currentValue).toBe("abc-123");

      const priority = findField(fields, "priority");
      expect(priority!.currentValue).toBe(5);
    });

    test("currentValue undefined for missing paths", () => {
      const { fields } = buildFieldCatalog(descriptor, { currentValue: {} });
      const id = findField(fields, "id");
      expect(id!.currentValue).toBeUndefined();
    });
  });

  describe("required flag", () => {
    test("required top-level fields are marked required", () => {
      const { fields } = buildFieldCatalog(descriptor);
      const id = findField(fields, "id");
      const label = findField(fields, "label");
      expect(id!.required).toBe(true);
      expect(label!.required).toBe(true);
    });

    test("metadata.owner.name is required within owner", () => {
      const { fields } = buildFieldCatalog(descriptor);
      const ownerName = findField(fields, "metadata", "owner", "name");
      expect(ownerName!.required).toBe(true);
    });
  });

  describe("metadata on entries", () => {
    test("id has explicit title from metadata.fields", () => {
      const { fields } = buildFieldCatalog(descriptor);
      const id = findField(fields, "id");
      expect(id!.title).toBe("Node ID");
    });

    test("metadata.createdAt has description from JSON Schema", () => {
      const { fields } = buildFieldCatalog(descriptor);
      const createdAt = findField(fields, "metadata", "createdAt");
      expect(createdAt!.description).toBe("ISO 8601 creation timestamp");
    });

    test("refinement enum labels are reflected in catalog entry", () => {
      // treeNodeDescriptor has a refinement on nodeType with labels
      const { fields } = buildFieldCatalog(descriptor);
      const nodeType = findField(fields, "nodeType");
      expect(nodeType!.enumLabels).toEqual({
        folder: "Folder (container)",
        file: "File (leaf with content)",
        symlink: "Symbolic Link (pointer)",
      });
    });
  });
});
