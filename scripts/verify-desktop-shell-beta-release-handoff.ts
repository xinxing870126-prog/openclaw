import fs from "node:fs/promises";
import process from "node:process";
import {
  buildDesktopShellBetaReleaseHandoffVerdict,
  renderReleaseHandoffMarkdown,
  resolveGateReportPaths,
  resolveReleaseHandoffReportPaths,
  type DesktopShellBetaGateVerdict,
  type DesktopShellBetaReleaseHandoffTarget,
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

function normalizeTarget(value: string | undefined): DesktopShellBetaReleaseHandoffTarget {
  return value?.trim().toLowerCase() === "release_handoff"
    ? "release_handoff"
    : "controlled_beta";
}

async function main() {
  const artifactDir = readOption("--artifact-dir")?.trim() || process.env.BETA_ARTIFACT_DIR;
  const defaultGateReports = resolveGateReportPaths(artifactDir);
  const defaultReleaseReports = resolveReleaseHandoffReportPaths(artifactDir);
  const gateReportPath = readOption("--gate-report")?.trim() || defaultGateReports.json;
  const reportJson = readOption("--report-json")?.trim() || process.env.REPORT_JSON || defaultReleaseReports.json;
  const reportMd = readOption("--report-md")?.trim() || process.env.REPORT_MD || defaultReleaseReports.markdown;
  const target = normalizeTarget(readOption("--target")?.trim() || process.env.HANDOFF_TARGET);

  const gate = JSON.parse(await fs.readFile(gateReportPath, "utf8")) as DesktopShellBetaGateVerdict;
  const verdict = buildDesktopShellBetaReleaseHandoffVerdict({
    gate,
    gateReportPath,
    target,
  });

  await writeJsonReport(reportJson, verdict);
  await writeMarkdownReport(reportMd, renderReleaseHandoffMarkdown(verdict));
  process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
}

main().catch((error) => {
  console.error(`[verify-desktop-shell-beta-release-handoff] ${String(error)}`);
  process.exitCode = 1;
});
