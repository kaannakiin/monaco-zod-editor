import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  hoverAuditCases,
  hoverAuditExcludedSurfaces,
  hoverAuditStageOrder,
} from "../packages/core/test-support/hover-audit-manifest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const reportDir = path.join("/tmp", "zod-monaco-hover-audit");
const reportJsonPath = path.join(reportDir, "hover-audit-report.json");
const reportMarkdownPath = path.join(reportDir, "hover-audit-report.md");

const severityOrder = {
  covered: 0,
  partial: 1,
  "doc-drift": 2,
  missing: 3,
};

function runCommand(label, args) {
  const result = spawnSync("pnpm", args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit code ${result.status ?? "unknown"}`,
    );
  }
}

function worstStatus(statuses) {
  return [...statuses].sort(
    (left, right) => severityOrder[right] - severityOrder[left],
  )[0];
}

function unique(values) {
  return [...new Set(values)];
}

function summarizeStageCoverage() {
  return Object.fromEntries(
    hoverAuditStageOrder.map((stage) => {
      const counts = {
        covered: 0,
        partial: 0,
        "doc-drift": 0,
        missing: 0,
      };

      for (const auditCase of hoverAuditCases) {
        const status = auditCase.stageStatus[stage];
        counts[status] += 1;
      }

      return [stage, counts];
    }),
  );
}

function summarizeCases() {
  return hoverAuditCases.map((auditCase) => {
    const statuses = Object.values(auditCase.stageStatus);
    const overallStatus = worstStatus(statuses);
    const nonCoveredStages = hoverAuditStageOrder.filter(
      (stage) => auditCase.stageStatus[stage] !== "covered",
    );

    return {
      id: auditCase.id,
      label: auditCase.label,
      families: auditCase.families,
      overallStatus,
      nonCoveredStages,
      stageStatus: auditCase.stageStatus,
      note: auditCase.note ?? null,
    };
  });
}

function summarizeFamilies(caseSummaries) {
  const familyMap = new Map();

  for (const summary of caseSummaries) {
    for (const family of summary.families) {
      const current = familyMap.get(family);
      if (
        !current ||
        severityOrder[summary.overallStatus] > severityOrder[current.status]
      ) {
        familyMap.set(family, {
          family,
          status: summary.overallStatus,
          cases: [summary.id],
        });
        continue;
      }

      current.cases.push(summary.id);
    }
  }

  for (const exclusion of hoverAuditExcludedSurfaces) {
    familyMap.set(exclusion.family, {
      family: exclusion.family,
      status: exclusion.status,
      cases: [],
      note: exclusion.note,
    });
  }

  return [...familyMap.values()].sort((left, right) =>
    left.family.localeCompare(right.family),
  );
}

async function buildFindings(caseSummaries) {
  const roadmap = await readFile(path.join(repoRoot, "ROADMAP.md"), "utf8");
  const hoverSource = await readFile(
    path.join(repoRoot, "packages/monaco/src/hover.ts"),
    "utf8",
  );

  const findings = [];

  if (
    roadmap.includes("Show examples and defaults in hover where available") &&
    !hoverSource.includes("default")
  ) {
    findings.push({
      kind: "doc-drift",
      source: "ROADMAP.md",
      title: "Hover defaults remain undocumented in code",
      note: "The roadmap promises default values in hover, but the hover formatter does not read JSON Schema defaults today.",
    });
  }

  for (const summary of caseSummaries) {
    if (summary.overallStatus === "covered") continue;

    findings.push({
      kind: summary.overallStatus,
      source: summary.id,
      title: summary.label,
      note:
        summary.note ??
        `Non-covered stages: ${summary.nonCoveredStages.join(", ") || "n/a"}.`,
    });
  }

  return findings;
}

function buildMarkdown(report) {
  const summaryLines = [
    "# Hover Audit Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Audit cases: ${report.summary.caseCount}`,
    `- Fully covered cases: ${report.summary.coveredCases}`,
    `- Partial cases: ${report.summary.partialCases}`,
    `- Doc-drift cases: ${report.summary.docDriftCases}`,
    `- Excluded backlog surfaces: ${report.summary.excludedSurfaces}`,
    "",
    "## Case Status",
    "",
    "| Case | Overall | Non-covered stages | Families |",
    "| --- | --- | --- | --- |",
    ...report.cases.map((summary) => {
      const stages =
        summary.nonCoveredStages.length > 0
          ? summary.nonCoveredStages.join(", ")
          : "covered";
      return `| ${summary.id} | ${summary.overallStatus} | ${stages} | ${summary.families.join(", ")} |`;
    }),
    "",
    "## Stage Coverage",
    "",
    "| Stage | Covered | Partial | Doc-drift | Missing |",
    "| --- | --- | --- | --- | --- |",
    ...hoverAuditStageOrder.map((stage) => {
      const counts = report.stageCoverage[stage];
      return `| ${stage} | ${counts.covered} | ${counts.partial} | ${counts["doc-drift"]} | ${counts.missing} |`;
    }),
    "",
    "## Findings",
    "",
  ];

  if (report.findings.length === 0) {
    summaryLines.push("- No non-covered findings.");
  } else {
    for (const finding of report.findings) {
      summaryLines.push(
        `- [${finding.kind}] ${finding.title}: ${finding.note}`,
      );
    }
  }

  summaryLines.push("", "## Excluded Backlog", "");
  for (const exclusion of report.exclusions) {
    summaryLines.push(`- ${exclusion.family}: ${exclusion.note}`);
  }

  return `${summaryLines.join("\n")}\n`;
}

async function main() {
  runCommand("core hover audit tests", [
    "--filter",
    "@zod-monaco/core",
    "test:hover-audit",
  ]);
  runCommand("monaco hover audit tests", [
    "--filter",
    "@zod-monaco/monaco",
    "test:hover-audit",
  ]);

  const caseSummaries = summarizeCases();
  const findings = await buildFindings(caseSummaries);
  const familySummaries = summarizeFamilies(caseSummaries);
  const stageCoverage = summarizeStageCoverage();
  const overallStatuses = caseSummaries.map((summary) => summary.overallStatus);

  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    summary: {
      caseCount: hoverAuditCases.length,
      coveredCases: overallStatuses.filter((status) => status === "covered")
        .length,
      partialCases: overallStatuses.filter((status) => status === "partial")
        .length,
      docDriftCases: overallStatuses.filter((status) => status === "doc-drift")
        .length,
      excludedSurfaces: hoverAuditExcludedSurfaces.length,
      familyCount: unique(familySummaries.map((item) => item.family)).length,
    },
    stageCoverage,
    cases: caseSummaries,
    families: familySummaries,
    findings,
    exclusions: hoverAuditExcludedSurfaces,
  };

  await mkdir(reportDir, { recursive: true });
  await writeFile(reportJsonPath, JSON.stringify(report, null, 2));
  await writeFile(reportMarkdownPath, buildMarkdown(report));

  process.stdout.write(
    [
      `[hover-audit] JSON report: ${reportJsonPath}`,
      `[hover-audit] Markdown report: ${reportMarkdownPath}`,
      `[hover-audit] Covered cases: ${report.summary.coveredCases}/${report.summary.caseCount}`,
      `[hover-audit] Partial cases: ${report.summary.partialCases}, doc-drift cases: ${report.summary.docDriftCases}`,
    ].join("\n") + "\n",
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
