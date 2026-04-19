import fs from "node:fs/promises";
import process from "node:process";
import {
  buildDesktopShellBetaReleaseBinding,
  renderReleaseBindingMarkdown,
  resolveReleaseBindingReportPaths,
  type DesktopShellBetaReleaseHandoffVerdict,
  writeJsonReport,
  writeMarkdownReport,
} from "./lib/desktop-shell-beta-gate.js";

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function main() {
  const artifactDir = readOption("--artifact-dir")?.trim() || process.env.BETA_ARTIFACT_DIR;
  const defaultReports = resolveReleaseBindingReportPaths(artifactDir);
  const handoffJsonPath =
    readOption("--handoff-json")?.trim()
    || process.env.HANDOFF_JSON
    || (artifactDir ? `${artifactDir}/desktop-shell-beta-release-handoff.json` : "");
  if (!handoffJsonPath) {
    throw new Error("Missing --handoff-json or BETA_ARTIFACT_DIR for release binding generation.");
  }
  const reportJson = readOption("--report-json")?.trim() || process.env.REPORT_JSON || defaultReports.json;
  const reportMd = readOption("--report-md")?.trim() || process.env.REPORT_MD || defaultReports.markdown;
  const releaseTag = readOption("--release-tag")?.trim() || process.env.RELEASE_TAG || null;
  const expectedSha = readOption("--expected-sha")?.trim() || process.env.EXPECTED_SHA || null;
  const betaGateRunId = readOption("--beta-gate-run-id")?.trim() || process.env.GITHUB_RUN_ID || null;
  const betaGateWorkflowName =
    readOption("--beta-gate-workflow-name")?.trim()
    || process.env.GITHUB_WORKFLOW
    || "Desktop Shell Beta Gate";

  const handoff = JSON.parse(await fs.readFile(handoffJsonPath, "utf8")) as DesktopShellBetaReleaseHandoffVerdict;
  const binding = buildDesktopShellBetaReleaseBinding({
    handoff,
    releaseTag,
    expectedSha,
    betaGateRunId,
    betaGateWorkflowName,
  });

  await writeJsonReport(reportJson, binding);
  await writeMarkdownReport(reportMd, renderReleaseBindingMarkdown(binding));
  process.stdout.write(`${JSON.stringify(binding, null, 2)}\n`);
}

main().catch((error) => {
  console.error(`[verify-desktop-shell-beta-release-binding] ${String(error)}`);
  process.exitCode = 1;
});
