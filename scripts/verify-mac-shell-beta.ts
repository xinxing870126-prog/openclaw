import process from "node:process";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  parseBooleanFlag,
  renderTrialMarkdown,
  resolvePlatformTrialReportPaths,
  type DesktopShellBetaMode,
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

function normalizeInstallSource(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? "app";
  return normalized === "dmg" ? "dmg" : "app";
}

function normalizeMode(value: string | undefined): DesktopShellBetaMode {
  return value?.trim().toLowerCase() === "remote" ? "remote" : "local";
}

function readOptionalBoolean(name: string, envName: string): boolean | undefined {
  const rawValue = readOption(name) ?? process.env[envName];
  if (rawValue == null || rawValue.trim() === "") {
    return undefined;
  }
  return parseBooleanFlag(rawValue);
}

function openUrl(url: string): boolean {
  const result = spawnSync("open", [url], { stdio: "ignore" });
  return result.status === 0;
}

function openApp(appPath: string): boolean {
  const trimmed = appPath.trim();
  if (!trimmed) {
    return false;
  }
  const args =
    trimmed.endsWith(".app") || existsSync(trimmed)
      ? [trimmed]
      : ["-a", trimmed];
  const result = spawnSync("open", args, { stdio: "ignore" });
  return result.status === 0;
}

async function main() {
  const artifactDir = readOption("--artifact-dir")?.trim() || process.env.BETA_ARTIFACT_DIR;
  const appPath = readOption("--app-path")?.trim() || process.env.APP_PATH || "";
  const installSource = normalizeInstallSource(readOption("--install-source") ?? process.env.INSTALL_SOURCE);
  const mode = normalizeMode(readOption("--mode") ?? process.env.MODE);
  const sessionKey = readOption("--session-key")?.trim() || process.env.SESSION_KEY || null;
  const shellAction = readOption("--shell-action")?.trim() || process.env.PENDING_ACTION_ID || null;
  const shellResultAction = readOption("--shell-result-action")?.trim() || process.env.RESULT_ACTION_ID || null;
  const defaultReports = resolvePlatformTrialReportPaths("macos", artifactDir);
  const reportJson = readOption("--report-json")?.trim() || process.env.REPORT_JSON || defaultReports.json;
  const reportMd = readOption("--report-md")?.trim() || process.env.REPORT_MD || defaultReports.markdown;

  const hostSummaryConsistentOverride = readOptionalBoolean(
    "--host-summary-consistent",
    "HOST_SUMMARY_CONSISTENT",
  );
  const repairRelaunchPassedOverride = readOptionalBoolean(
    "--repair-relaunch-passed",
    "REPAIR_RELAUNCH_PASSED",
  );
  const governanceReachableOverride = readOptionalBoolean(
    "--governance-reachable",
    "GOVERNANCE_REACHABLE",
  );
  const removeReinstallPassedOverride = readOptionalBoolean(
    "--remove-reinstall-passed",
    "REMOVE_REINSTALL_PASSED",
  );
  const localActionResolvePassedOverride = readOptionalBoolean(
    "--local-action-resolve-passed",
    "LOCAL_ACTION_RESOLVE_PASSED",
  );
  const relaunchPassedOverride = readOptionalBoolean(
    "--relaunch-passed",
    "RELAUNCH_PASSED",
  );
  const coldStartOverride = readOptionalBoolean("--cold-start-passed", "COLD_START_PASSED");
  const dashboardEntryOverride = readOptionalBoolean("--dashboard-entry-passed", "DASHBOARD_ENTRY_PASSED");
  const desktopHealthOverride = readOptionalBoolean(
    "--desktop-health-passed",
    "DESKTOP_HEALTH_PASSED",
  );
  const pendingReopenOverride = readOptionalBoolean(
    "--pending-reopen-passed",
    "PENDING_REOPEN_PASSED",
  );
  const resultReopenOverride = readOptionalBoolean(
    "--result-reopen-passed",
    "RESULT_REOPEN_PASSED",
  );

  const notes: string[] = [];
  const coldStartPassed = coldStartOverride ?? (Boolean(appPath) && openApp(appPath));
  if (!coldStartPassed) {
    notes.push("Cold-start app verification did not complete successfully.");
  }

  const dashboardEntryPassed = dashboardEntryOverride ?? openUrl("openclaw://dashboard");
  if (!dashboardEntryPassed) {
    notes.push("Shared dashboard shell entry did not open successfully.");
  }

  const desktopHealthPassed =
    desktopHealthOverride ?? openUrl("openclaw://dashboard?panel=settings");
  if (!desktopHealthPassed) {
    notes.push("Desktop health target did not open successfully.");
  }

  const pendingReopenPassed = pendingReopenOverride ?? (
    sessionKey && shellAction
      ? openUrl(
        `openclaw://dashboard?panel=sessions&sessionKey=${encodeURIComponent(sessionKey)}&shellFocus=pendingAction&shellAction=${encodeURIComponent(shellAction)}`,
      )
      : false
  );
  if (!pendingReopenPassed) {
    notes.push(
      sessionKey && shellAction
        ? "Exact pending-action reopen did not complete successfully."
        : "Exact pending-action reopen was not verified because sessionKey or shellAction was missing.",
    );
  }

  const resultReopenPassed = resultReopenOverride ?? (
    sessionKey && shellResultAction
      ? openUrl(
        `openclaw://dashboard?panel=sessions&sessionKey=${encodeURIComponent(sessionKey)}&shellFocus=timeline&shellResultAction=${encodeURIComponent(shellResultAction)}`,
      )
      : false
  );
  if (!resultReopenPassed) {
    notes.push(
      sessionKey && shellResultAction
        ? "Exact latest-result reopen did not complete successfully."
        : "Exact latest-result reopen was not verified because sessionKey or shellResultAction was missing.",
    );
  }

  const hostSummaryConsistent = hostSummaryConsistentOverride ?? false;
  const repairRelaunchPassed = repairRelaunchPassedOverride ?? false;
  const governanceReachable = governanceReachableOverride ?? false;
  const removeReinstallPassed = removeReinstallPassedOverride ?? false;
  const localActionResolvePassed = localActionResolvePassedOverride ?? false;
  const relaunchPassed = relaunchPassedOverride ?? false;

  const exactTargetParityPassed = pendingReopenPassed && resultReopenPassed;
  const hostPathPassed = hostSummaryConsistent && repairRelaunchPassed && relaunchPassed;
  const shellPathPassed =
    dashboardEntryPassed
    && desktopHealthPassed
    && localActionResolvePassed
    && exactTargetParityPassed;
  const installerPathPassed = coldStartPassed && removeReinstallPassed;
  const gateReached =
    hostPathPassed
    && shellPathPassed
    && installerPathPassed
    && governanceReachable;

  if (hostSummaryConsistentOverride == null) {
    notes.push("Menu bar and shared shell host summary parity still needs explicit confirmation.");
  } else if (!hostSummaryConsistent) {
    notes.push("Menu bar host summary does not match the shared shell desktop integration posture in the current runtime state.");
  }
  if (repairRelaunchPassedOverride == null) {
    notes.push("Repair / relaunch path still needs explicit confirmation.");
  } else if (!repairRelaunchPassed) {
    notes.push("Repair / relaunch path was exercised but did not complete cleanly.");
  }
  if (relaunchPassedOverride == null) {
    notes.push("Relaunch restore path still needs explicit confirmation.");
  } else if (!relaunchPassed) {
    notes.push("Relaunch restore path was exercised but did not recover the expected shell entry.");
  }
  if (removeReinstallPassedOverride == null) {
    notes.push("Remove / reinstall verification still needs explicit confirmation.");
  } else if (!removeReinstallPassed) {
    notes.push("Remove / reinstall path was exercised but stale state still blocked shell entry.");
  }
  if (localActionResolvePassedOverride == null) {
    notes.push("Local action request / resolve walkthrough still needs explicit confirmation.");
  } else if (!localActionResolvePassed) {
    notes.push("Local action request / resolve walkthrough did not complete cleanly.");
  }
  if (governanceReachableOverride == null) {
    notes.push("Governance/operator reachability still needs explicit confirmation.");
  } else if (!governanceReachable) {
    notes.push("Governance/operator surface remained unreachable during the macOS walkthrough.");
  }
  if (coldStartOverride != null) {
    notes.push("Cold-start verification was operator-confirmed instead of auto-opened.");
  }
  if (dashboardEntryOverride != null || desktopHealthOverride != null) {
    notes.push("Shared shell entry / desktop health checks used operator-confirmed overrides.");
  }
  if (pendingReopenOverride != null || resultReopenOverride != null) {
    notes.push("Exact target parity checks used operator-confirmed overrides.");
  }
  if (
    hostSummaryConsistentOverride != null
    || repairRelaunchPassedOverride != null
    || relaunchPassedOverride != null
    || removeReinstallPassedOverride != null
    || localActionResolvePassedOverride != null
    || governanceReachableOverride != null
  ) {
    notes.push("Host/operator checks include operator-confirmed walkthrough results from this trial pass.");
  }

  const result: DesktopShellBetaTrialResult = {
    generatedAt: new Date().toISOString(),
    input: {
      platform: "macos",
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
      coldStartPassed,
      dashboardEntryPassed,
      desktopHealthPassed,
      pendingReopenPassed,
      resultReopenPassed,
      hostSummaryConsistent,
      repairRelaunchPassed,
      relaunchPassed,
      removeReinstallPassed,
      localActionResolvePassed,
      governanceReachable,
    },
  };

  await writeJsonReport(reportJson, result);
  await writeMarkdownReport(reportMd, renderTrialMarkdown(result));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  console.error(`[verify-mac-shell-beta] ${String(error)}`);
  process.exitCode = 1;
});
