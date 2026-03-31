import { z } from "zod";
import { describeSchema } from "../describe-schema.js";

type TreeNode = {
  id: string;
  label: string;
  nodeType: "folder" | "file" | "symlink";
  metadata: {
    createdAt: string;
    permissions: ("read" | "write" | "execute")[];
    owner: { name: string; email: string } | null;
  };
  attributes: Record<string, string | number | boolean>;
  content:
    | { kind: "text"; body: string; encoding: "utf-8" | "ascii" | "base64" }
    | { kind: "binary"; sizeBytes: number; checksum: string }
    | { kind: "link"; target: string };
  tags: [string, ...string[]];
  priority: number | null;
  children: TreeNode[];
};

const treeNodeSchema: z.ZodType<TreeNode> = z.object({
  id: z.uuid(),
  label: z.string().min(1).max(255),
  nodeType: z.enum(["folder", "file", "symlink"]),
  metadata: z
    .object({
      createdAt: z.iso.datetime().describe("ISO 8601 creation timestamp"),
      permissions: z
        .array(z.enum(["read", "write", "execute"]))
        .min(1)
        .describe("At least one permission required"),
      owner: z
        .object({
          name: z.string().describe("Owner's display name"),
          email: z.email().describe("Owner's email address"),
        })
        .nullable(),
    })
    .describe("Timestamps, permission sets, and ownership info"),
  attributes: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean()]),
  ),
  content: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("text"),
      body: z.string().describe("Text content body"),
      encoding: z.enum(["utf-8", "ascii", "base64"]),
    }),
    z.object({
      kind: z.literal("binary"),
      sizeBytes: z.number().int().nonnegative().describe("File size in bytes"),
      checksum: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .describe("SHA-256 hex checksum"),
    }),
    z.object({
      kind: z.literal("link"),
      target: z.string().min(1).describe("Symlink target path"),
    }),
  ]),
  tags: z.tuple([z.string()]).rest(z.string()),
  priority: z.number().int().min(0).max(10).nullable(),
  children: z.lazy(() => z.array(treeNodeSchema)),
});

export const treeNodeDescriptor = describeSchema(treeNodeSchema, {
  metadata: {
    title: "Tree Node",
    description:
      "Recursive file-system-like tree. Each node can be a folder, file, or symlink with nested children.",
    fields: [
      {
        path: ["id"],
        title: "Node ID",
        examples: ["550e8400-e29b-41d4-a716-446655440000"],
        placeholder: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      },
      { path: ["label"], title: "Label", placeholder: "e.g. src" },
      {
        path: ["nodeType"],
        title: "Node Type",
        enumLabels: {
          folder: "Folder (container)",
          file: "File (leaf with content)",
          symlink: "Symbolic Link (pointer)",
        },
      },
      {
        path: ["attributes"],
        title: "Attributes",
        description: "Free-form key-value pairs.",
        examples: [{ hidden: true, size: 4096, mime: "text/plain" }],
        emptyStateHint: "Add custom attributes to extend node data.",
      },
      {
        path: ["content"],
        title: "Content",
        description: 'Discriminated union on "kind": text, binary, or link.',
      },
      {
        path: ["tags"],
        title: "Tags",
        examples: [["important"], ["draft", "needs-review", "v2"]],
      },
      { path: ["priority"], title: "Priority", examples: [0, 5, 10, null] },
      {
        path: ["children"],
        title: "Children",
        emptyStateHint: "Add child nodes to build the tree structure.",
      },
      {
        path: ["metadata", "createdAt"],
        placeholder: "e.g. 2026-03-13T10:30:00Z",
      },
      {
        path: ["metadata", "owner"],
        emptyStateHint: "Set to null if no owner is assigned.",
      },
    ],
  },
  refinements: [
    {
      path: ["nodeType"],
      enum: ["folder", "file", "symlink"],
      labels: {
        folder: "Folder (container)",
        file: "File (leaf with content)",
        symlink: "Symbolic Link (pointer)",
      },
    },
  ],
});

export const treeNodeDefaultValue = JSON.stringify(
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    label: "src",
    nodeType: "folder",
    metadata: {
      createdAt: "2026-03-13T10:30:00Z",
      permissions: ["read", "write", "execute"],
      owner: { name: "Kaan Akin", email: "kaan@example.com" },
    },
    attributes: { hidden: false, description: "Source root" },
    content: { kind: "text", body: "", encoding: "utf-8" },
    tags: ["root", "source"],
    priority: 0,
    children: [
      {
        id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        label: "index.ts",
        nodeType: "file",
        metadata: {
          createdAt: "2026-03-13T11:00:00Z",
          permissions: ["read", "write"],
          owner: null,
        },
        attributes: { mime: "text/typescript", lines: 42 },
        content: {
          kind: "text",
          body: 'export * from "./lib";',
          encoding: "utf-8",
        },
        tags: ["entry-point"],
        priority: 5,
        children: [],
      },
      {
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        label: "logo.png",
        nodeType: "file",
        metadata: {
          createdAt: "2026-03-13T11:15:00Z",
          permissions: ["read"],
          owner: { name: "Design Team", email: "design@example.com" },
        },
        attributes: { mime: "image/png" },
        content: {
          kind: "binary",
          sizeBytes: 24576,
          checksum:
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
        tags: ["asset", "branding"],
        priority: null,
        children: [],
      },
    ],
  },
  null,
  2,
);
