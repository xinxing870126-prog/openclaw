import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  parseBooleanFlag,
  renderTrialMarkdown,
  resolveBetaArtifactDir,
  resolvePlatformTrialReportPaths,
  type DesktopShellBetaMode,
  type DesktopShellBetaTrialResult,
  writeJsonReport,
  writeMarkdownReport,
} from "./lib/desktop-shell-beta-gate.js";

type WindowsMsiInstallVerification = {
  install?: { msiexec?: { code?: number | null } };
  repair?: { msiexec?: { code?: number | null } };
  uninstall?: {
    msiexec?: { code?: number | null };
    installedProduct?: {
      manifest?: unknown | null;
      installRoot?: string | null;
      bootstrapStatus?: {
        gatewayInstalled?: boolean;
        companionInstalled?: boolean;
      };
    };
  };
};

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function normalizeMode(value: string | undefined): DesktopShellBetaMode {
  return value?.trim().toLowerCase() === "remote" ? "remote" : "local";
}

function uninstallResidualStateCleared(payload: WindowsMsiInstallVerification): boolean {
  const installedProduct = payload.uninstall?.installedProduct;
  if (!installedProduct) {
    return false;
  }
  return (
    installedProduct.manifest == null
    && !installedProduct.installRoot
    && installedProduct.bootstrapStatus?.gatewayInstalled !== true
    && installedProduct.bootstrapStatus?.companionInstalled !== true
  );
}

async function main() {
  const artifactDir = readOption("--artifact-dir")?.trim() || process.env.BETA_ARTIFACT_DIR;
  const defaultArtifactDir = resolveBetaArtifactDir(artifactDir);
  const installReportPath =
    readOption("--install-report")?.trim()
    || process.env.INSTALL_REPORT
    || path.join(defaultArtifactDir, "windows-msi-install-verification.json");
  const installSource = readOption("--install-source")?.trim() || "msi";
  const mode = normalizeMode(readOption("--mode"));
  const sessionKey = readOption("--session-key")?.trim() || null;
  const shellAction = readOption("--shell-action")?.trim() || null;
  const shellResultAction = readOption("--shell-result-action")?.trim() || null;
  const defaultReports = resolvePlatformTrialReportPaths("windows", artifactDir);
  const reportJson = readOption("--report-json")?.trim() || process.env.REPORT_JSON || defaultReports.json;
  const reportMd = readOption("--report-md")?.trim() || process.env.REPORT_MD || defaultReports.markdown;

  const payload = JSON.parse(await fs.readFile(installReportPath, "utf8")) as WindowsMsiInstallVerification;
  const installPassed = payload.install?.msiexec?.code === 0;
  const repairInstallPassed = payload.repair?.msiexec?.code === 0;
  const uninstallPassed =
    payload.uninstall?.msiexec?.code === 0 || uninstallResidualStateCleared(payload);

  const firstOpenPassed = parseBooleanFlag(readOption("--first-open-passed"));
  const hostStatusVisible = parseBooleanFlag(readOption("--host-status-visible"));
  const desktopHealthReachable = parseBooleanFlag(readOption("--desktop-health-reachable"));
  const governanceReachable = parseBooleanFlag(readOption("--governance-reachable"));
  const localActionResolvePassed = parseBooleanFlag(readOption("--local-action-resolve-passed"));
  const exactTargetParityPassed = parseBooleanFlag(readOption("--exact-target-parity-passed"));
  const repairRelaunchPassed = parseBooleanFlag(readOption("--repair-relaunch-passed"));

  const installerPathPassed = installPassed && repairInstallPassed && uninstallPassed && firstOpenPassed;
  const hostPathPassed = hostStatusVisible && repairRelaunchPassed;
  const shellPathPassed =
    firstOpenPassed
    && desktopHealthReachable
    && localActionResolvePassed
    && exactTargetParityPassed;
  const gateReached =
    installerPathPassed
    && hostPathPassed
    && shellPathPassed
    && governanceReachable;

  const notes: string[] = [];
  if (!installPassed) {
    notes.push("Windows MSI install verification did not pass.");
  }
  if (!repairInstallPassed) {
    notes.push("Windows MSI repair verification did not pass.");
  }
  if (!uninstallPassed) {
    notes.push("Windows MSI uninstall verification did not pass.");
  }
  if (!firstOpenPassed) {
    notes.push("Windows shell first-open verification still needs explicit confirmation.");
  }
  if (!hostStatusVisible) {
    notes.push("Windows host status / health visibility still needs explicit confirmation.");
  }
  if (!desktopHealthReachable) {
    notes.push("Windows desktop health / settings reachability still needs explicit confirmation.");
  }
  if (!localActionResolvePassed) {
    notes.push("Windows local action request / resolve walkthrough still needs explicit confirmation.");
  }
  if (!exactTargetParityPassed) {
    notes.push("Windows exact pending/result target parity still needs explicit confirmation.");
  }
  if (!repairRelaunchPassed) {
    notes.push("Windows repair / relaunch walkthrough still needs explicit confirmation.");
  }
  if (!governanceReachable) {
    notes.push("Windows governance/operator reachability still needs explicit confirmation.");
  }

  const result: DesktopShellBetaTrialResult = {
    generatedAt: new Date().toISOString(),
    input: {
      platform: "windows",
      installSource,
      mode,
      sessionKey,
      shellAction,
      shellResultAction,
    },
    gateReached,
    hostPathPassed,
    shellPathPassed,
    installerPathPassed,
    governanceReachable,
    exactTargetParityPassed,
    repairRelaunchPassed,
    notes,
    checks: {
      installPassed,
      repairInstallPassed,
      uninstallPassed,
      firstOpenPassed,
      hostStatusVisible,
      desktopHealthReachable,
      localActionResolvePassed,
      exactTargetParityPassed,
      repairRelaunchPassed,
      governanceReachable,
    },
  };

  await writeJsonReport(reportJson, result);
  await writeMarkdownReport(reportMd, renderTrialMarkdown(result));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  console.error(`[verify-windows-shell-beta] ${String(error)}`);
  process.exitCode = 1;
});
