import { z } from "zod";

export const hoverAuditStageOrder = [
  "describeSchema",
  "resolveJsonSchemaNode",
  "resolveFieldContext",
  "resolvePathAtOffset",
  "formatFieldMetadataHover",
  "createZodHoverProvider",
  "attachZodToEditor",
];

function coveredStages() {
  return Object.fromEntries(
    hoverAuditStageOrder.map((stage) => [stage, "covered"]),
  );
}

function withStageStatus(overrides) {
  return {
    ...coveredStages(),
    ...overrides,
  };
}

export const hoverAuditExcludedSurfaces = [
  {
    family: "transform",
    status: "missing",
    note: "Excluded in phase one because transform output is not reflected in JSON Schema-backed hover.",
  },
  {
    family: "pipe",
    status: "missing",
    note: "Excluded in phase one because pipe composition does not currently change hover metadata rendering.",
  },
  {
    family: "codec",
    status: "missing",
    note: "Excluded in phase one because codec directionality is outside the current JSON-only hover surface.",
  },
  {
    family: "brand",
    status: "missing",
    note: "Excluded in phase one because brands are type-level only and do not currently enrich hover output.",
  },
  {
    family: "readonly",
    status: "missing",
    note: "Excluded in phase one because readonly is not surfaced in JSON Schema metadata or hover copy.",
  },
  {
    family: "promise",
    status: "missing",
    note: "Excluded in phase one because promise schemas are not part of the Monaco JSON authoring path.",
  },
  {
    family: "file",
    status: "missing",
    note: "Excluded in phase one because file schemas are outside the current JSON document UX.",
  },
];

export const hoverAuditCases = [
  {
    id: "uuid-required",
    label: "Required UUID field with explicit metadata",
    families: ["object.required", "string.uuid", "metadata.explicit"],
    createSchema: () =>
      z.object({
        nodeId: z.uuid().describe("Globally unique node identifier"),
      }),
    metadata: {
      fields: {
        nodeId: {
          title: "Node ID",
          examples: ["550e8400-e29b-41d4-a716-446655440000"],
          placeholder: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
        },
      },
    },
    sample: {
      nodeId: "550e8400-e29b-41d4-a716-446655440000",
    },
    hover: {
      path: ["nodeId"],
      keyText: '"nodeId"',
    },
    expectations: {
      jsonSchemaNode: {
        type: "string",
        format: "uuid",
        required: true,
      },
      fieldContext: {
        type: "string",
        format: "uuid",
        required: true,
        metadata: {
          title: "Node ID",
          description: "Globally unique node identifier",
          examples: ["550e8400-e29b-41d4-a716-446655440000"],
          placeholder: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
        },
      },
      hoverMarkdown: {
        includes: [
          "**Node ID**",
          "**Required**",
          "Globally unique node identifier",
          '**Examples:** `"550e8400-e29b-41d4-a716-446655440000"`',
          "**Placeholder:** xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
        ],
      },
    },
    stageStatus: coveredStages(),
  },
  {
    id: "optional-regex",
    label: "Optional regex-constrained string with fallback description",
    families: [
      "object.optional",
      "string.regex",
      "string.length",
      "metadata.precedence",
    ],
    createSchema: () =>
      z.object({
        nickname: z
          .string()
          .min(3)
          .max(12)
          .regex(/^[a-z]{3,12}$/)
          .optional()
          .describe("Lowercase public handle"),
      }),
    metadata: {
      fields: {
        nickname: {
          title: "Nickname",
          placeholder: "e.g. codex",
        },
      },
    },
    sample: {
      nickname: "codex",
    },
    hover: {
      path: ["nickname"],
      keyText: '"nickname"',
    },
    expectations: {
      jsonSchemaNode: {
        type: "string",
        minLength: 3,
        maxLength: 12,
        pattern: "^[a-z]{3,12}$",
        required: false,
      },
      fieldContext: {
        type: "string",
        minLength: 3,
        maxLength: 12,
        pattern: "^[a-z]{3,12}$",
        required: false,
        metadata: {
          title: "Nickname",
          description: "Lowercase public handle",
          placeholder: "e.g. codex",
        },
      },
      hoverMarkdown: {
        includes: [
          "**Nickname**",
          "*Optional*",
          "Lowercase public handle",
          "**Placeholder:** e.g. codex",
        ],
      },
    },
    stageStatus: coveredStages(),
  },
  {
    id: "nullish-owner",
    label: "Nullish object metadata with empty-state hint",
    families: ["nullish", "nullable", "metadata.emptyStateHint"],
    createSchema: () =>
      z.object({
        owner: z
          .object({
            email: z.email().describe("Owner email address"),
          })
          .nullish(),
      }),
    metadata: {
      fields: {
        owner: {
          title: "Owner",
          emptyStateHint: "Leave empty when unassigned.",
        },
        "owner.email": {
          title: "Owner Email",
          placeholder: "owner@example.com",
        },
      },
    },
    sample: {
      owner: {
        email: "owner@example.com",
      },
    },
    hover: {
      path: ["owner"],
      keyText: '"owner"',
    },
    expectations: {
      jsonSchemaNode: {
        type: "object",
        required: false,
      },
      fieldContext: {
        type: "object",
        nullable: true,
        required: false,
        properties: ["email"],
        metadata: {
          title: "Owner",
          emptyStateHint: "Leave empty when unassigned.",
        },
      },
      hoverMarkdown: {
        includes: ["**Owner**", "*Optional*", "*Leave empty when unassigned.*"],
      },
    },
    stageStatus: coveredStages(),
  },
  {
    id: "default-theme",
    label: "Defaulted string field with roadmap drift",
    families: ["default", "metadata.explicit"],
    note: "Zod v4 emits JSON Schema defaults here, but hover rendering still ignores default values even though the roadmap promises them.",
    createSchema: () =>
      z.object({
        theme: z.string().default("system").describe("Theme preference"),
      }),
    metadata: {
      fields: {
        theme: {
          title: "Theme",
        },
      },
    },
    sample: {
      theme: "dark",
    },
    hover: {
      path: ["theme"],
      keyText: '"theme"',
    },
    expectations: {
      jsonSchemaNode: {
        type: "string",
        default: "system",
        required: true,
      },
      fieldContext: {
        type: "string",
        required: true,
        metadata: {
          title: "Theme",
          description: "Theme preference",
        },
      },
      hoverMarkdown: {
        includes: [
          "**Theme**",
          "**Required**",
          "Theme preference",
          '**Default:** `"system"`',
        ],
      },
    },
    stageStatus: coveredStages(),
  },
  {
    id: "enum-status",
    label: "Enum with labels and examples",
    families: ["enum", "metadata.enumLabels", "locale"],
    createSchema: () =>
      z.object({
        status: z.enum(["draft", "published"]).describe("Publishing state"),
      }),
    metadata: {
      fields: {
        status: {
          title: "Status",
          examples: ["draft"],
          enumLabels: {
            draft: "Draft version",
            published: "Live content",
          },
        },
      },
    },
    sample: {
      status: "published",
    },
    hover: {
      path: ["status"],
      keyText: '"status"',
    },
    expectations: {
      jsonSchemaNode: {
        type: "string",
        enum: ["draft", "published"],
        required: true,
      },
      fieldContext: {
        type: "string",
        enum: ["draft", "published"],
        required: true,
        metadata: {
          title: "Status",
          description: "Publishing state",
          examples: ["draft"],
          enumLabels: {
            draft: "Draft version",
            published: "Live content",
          },
        },
      },
      hoverMarkdown: {
        includes: [
          "**Status**",
          "**Required**",
          "Publishing state",
          '**Examples:** `"draft"`',
          "**Enum values:** Draft version (`draft`), Live content (`published`)",
        ],
      },
      localeMarkdown: {
        tr: [
          "**Status**",
          "**Zorunlu**",
          "**Örnekler:**",
          "**Enum değerleri:**",
        ],
      },
    },
    stageStatus: coveredStages(),
  },
  {
    id: "integer-bounds",
    label: "Integer bounds with fallback description",
    families: ["number.integer", "number.bounds", "metadata.precedence"],
    createSchema: () =>
      z.object({
        score: z.number().int().min(1).max(9).describe("Score from 1 to 9"),
      }),
    metadata: {
      fields: {
        score: {
          title: "Score",
          examples: [1, 5, 9],
        },
      },
    },
    sample: {
      score: 7,
    },
    hover: {
      path: ["score"],
      keyText: '"score"',
    },
    expectations: {
      jsonSchemaNode: {
        type: "integer",
        minimum: 1,
        maximum: 9,
        required: true,
      },
      fieldContext: {
        type: "integer",
        minimum: 1,
        maximum: 9,
        required: true,
        metadata: {
          title: "Score",
          description: "Score from 1 to 9",
          examples: [1, 5, 9],
        },
      },
      hoverMarkdown: {
        includes: [
          "**Score**",
          "**Required**",
          "Score from 1 to 9",
          "**Examples:** `1`, `5`, `9`",
        ],
      },
    },
    stageStatus: coveredStages(),
  },
  {
    id: "tuple-rest",
    label: "Tuple rest item resolved from numeric path",
    families: ["tuple", "array.rest", "array.numeric-path"],
    createSchema: () =>
      z.object({
        sequence: z
          .tuple([
            z.string().describe("Lead label"),
            z.number().describe("Lead score"),
          ])
          .rest(z.boolean().describe("Trailing toggle")),
      }),
    metadata: {
      fields: {
        sequence: {
          title: "Sequence",
        },
      },
    },
    sample: {
      sequence: ["alpha", 2, true, false],
    },
    hover: {
      path: ["sequence", 2],
    },
    expectations: {
      jsonSchemaNode: {
        type: "boolean",
      },
      fieldContext: {
        type: "boolean",
        required: false,
        metadata: {
          description: "Trailing toggle",
        },
      },
      hoverMarkdown: {
        includes: ["Trailing toggle"],
        excludes: ["Required", "Optional"],
      },
    },
    stageStatus: coveredStages(),
  },
  {
    id: "record-flag",
    label: "Record additionalProperties path resolution",
    families: ["record", "additionalProperties"],
    createSchema: () =>
      z.object({
        attributes: z.record(
          z.string(),
          z.boolean().describe("Feature flag value"),
        ),
      }),
    metadata: {
      fields: {
        attributes: {
          title: "Attributes",
          description: "Dynamic boolean flags.",
        },
      },
    },
    sample: {
      attributes: {
        beta: true,
      },
    },
    hover: {
      path: ["attributes", "beta"],
      keyText: '"beta"',
    },
    expectations: {
      jsonSchemaNode: {
        type: "boolean",
        required: false,
      },
      fieldContext: {
        type: "boolean",
        required: false,
        metadata: {
          description: "Feature flag value",
        },
      },
      hoverMarkdown: {
        includes: ["Feature flag value"],
        excludes: ["Required", "Optional"],
      },
    },
    stageStatus: coveredStages(),
  },
  {
    id: "discriminated-union-body",
    label: "Discriminated union branch selection",
    families: ["union.discriminated", "literal"],
    createSchema: () =>
      z.object({
        content: z.discriminatedUnion("kind", [
          z.object({
            kind: z.literal("text"),
            body: z.string().min(1).describe("Text body"),
          }),
          z.object({
            kind: z.literal("image"),
            src: z.string().describe("Image source"),
          }),
        ]),
      }),
    metadata: {
      fields: {
        "content.body": {
          title: "Content Body",
        },
      },
    },
    sample: {
      content: {
        kind: "text",
        body: "Hello world",
      },
    },
    hover: {
      path: ["content", "body"],
      keyText: '"body"',
    },
    expectations: {
      jsonSchemaNode: {
        type: "string",
        minLength: 1,
        required: true,
      },
      fieldContext: {
        type: "string",
        minLength: 1,
        required: true,
        metadata: {
          title: "Content Body",
          description: "Text body",
        },
      },
      hoverMarkdown: {
        includes: ["**Content Body**", "**Required**", "Text body"],
      },
    },
    stageStatus: coveredStages(),
  },
  {
    id: "intersection-limit",
    label: "Intersection allOf property resolution",
    families: ["intersection", "allOf"],
    note: "JSON Schema node traversal resolves allOf branches today, but resolveFieldContext does not yet recover typed constraints or required state from the merged branch.",
    createSchema: () =>
      z.object({
        filters: z
          .object({
            tag: z.string().describe("Filter by tag"),
          })
          .and(
            z.object({
              limit: z
                .number()
                .int()
                .min(1)
                .max(50)
                .describe("Maximum results"),
            }),
          ),
      }),
    metadata: {
      fields: {
        "filters.limit": {
          title: "Limit",
        },
      },
    },
    sample: {
      filters: {
        tag: "news",
        limit: 10,
      },
    },
    hover: {
      path: ["filters", "limit"],
      keyText: '"limit"',
    },
    expectations: {
      jsonSchemaNode: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        required: true,
      },
      fieldContext: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        required: true,
        metadata: {
          title: "Limit",
          description: "Maximum results",
        },
      },
      hoverMarkdown: {
        includes: ["**Limit**", "**Required**", "Maximum results"],
      },
    },
    stageStatus: coveredStages(),
  },
  {
    id: "recursive-child-label",
    label: "Recursive child field resolved through $ref",
    families: ["recursion", "$ref"],
    createSchema: () => {
      const TreeNode = z.lazy(() =>
        z.object({
          label: z.string().min(1).describe("Child label"),
          children: z.array(TreeNode),
        }),
      );

      return z.object({
        tree: TreeNode,
      });
    },
    sample: {
      tree: {
        label: "root",
        children: [
          {
            label: "leaf",
            children: [],
          },
        ],
      },
    },
    hover: {
      path: ["tree", "children", 0, "label"],
    },
    expectations: {
      jsonSchemaNode: {
        type: "string",
        minLength: 1,
        required: true,
      },
      fieldContext: {
        type: "string",
        minLength: 1,
        required: true,
        metadata: {
          description: "Child label",
        },
      },
      hoverMarkdown: {
        includes: ["**Required**", "Child label"],
      },
    },
    stageStatus: coveredStages(),
  },
];

export function buildHoverAuditDescriptor(auditCase, describeSchema) {
  return describeSchema(auditCase.createSchema(), {
    metadata: auditCase.metadata,
  });
}

export function createHoverAuditText(auditCase) {
  return JSON.stringify(auditCase.sample, null, 2);
}

export function findHoverAuditCase(caseId) {
  return hoverAuditCases.find((auditCase) => auditCase.id === caseId) ?? null;
}
