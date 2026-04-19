import fs from "node:fs/promises";
import process from "node:process";
import {
  aggregateDesktopShellBetaGate,
  renderGateMarkdown,
  resolveGateReportPaths,
  resolvePlatformTrialReportPaths,
  type DesktopShellBetaTrialResult,
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

async function readResult(filePath: string | undefined): Promise<DesktopShellBetaTrialResult | null> {
  if (!filePath?.trim()) {
    return null;
  }
  return JSON.parse(await fs.readFile(filePath, "utf8")) as DesktopShellBetaTrialResult;
}

async function main() {
  const artifactDir = readOption("--artifact-dir")?.trim() || process.env.BETA_ARTIFACT_DIR;
  const macReportPath =
    readOption("--mac-report")?.trim() || resolvePlatformTrialReportPaths("macos", artifactDir).json;
  const windowsReportPath =
    readOption("--windows-report")?.trim() || resolvePlatformTrialReportPaths("windows", artifactDir).json;
  const defaultReports = resolveGateReportPaths(artifactDir);
  const macReport = await readResult(macReportPath);
  const windowsReport = await readResult(windowsReportPath);
  const reportJson = readOption("--report-json")?.trim() || process.env.REPORT_JSON || defaultReports.json;
  const reportMd = readOption("--report-md")?.trim() || process.env.REPORT_MD || defaultReports.markdown;

  const results = [windowsReport, macReport].filter(Boolean) as DesktopShellBetaTrialResult[];
  if (results.length === 0) {
    throw new Error("At least one platform report is required.");
  }

  const verdict = aggregateDesktopShellBetaGate(results);
  await writeJsonReport(reportJson, verdict);
  await writeMarkdownReport(reportMd, renderGateMarkdown(verdict));
  process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
}

main().catch((error) => {
  console.error(`[verify-desktop-shell-beta-gate] ${String(error)}`);
  process.exitCode = 1;
});
