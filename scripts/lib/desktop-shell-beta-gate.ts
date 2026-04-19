import fs from "node:fs/promises";
import path from "node:path";

export type DesktopShellBetaPlatform = "windows" | "macos";
export type DesktopShellBetaMode = "local" | "remote";
export type DesktopShellBetaReleaseHandoffTarget = "controlled_beta" | "release_handoff";
export type DesktopShellBetaReleaseHandoffStatus =
  | "blocked"
  | "ready_for_controlled_beta"
  | "ready_for_release_handoff";

export type DesktopShellBetaTrialInput = {
  platform: DesktopShellBetaPlatform;
  installSource: string;
  mode: DesktopShellBetaMode;
  sessionKey?: string | null;
  shellAction?: string | null;
  shellResultAction?: string | null;
};

export type DesktopShellBetaTrialResult = {
  generatedAt: string;
  input: DesktopShellBetaTrialInput;
  gateReached: boolean;
  hostPathPassed: boolean;
  shellPathPassed: boolean;
  installerPathPassed: boolean;
  governanceReachable: boolean;
  exactTargetParityPassed: boolean;
  repairRelaunchPassed: boolean;
  notes: string[];
  checks: Record<string, boolean>;
};

export type DesktopShellBetaGateVerdict = {
  generatedAt: string;
  platforms: DesktopShellBetaPlatform[];
  gateReached: boolean;
  hostPathPassed: boolean;
  shellPathPassed: boolean;
  installerPathPassed: boolean;
  governanceReachable: boolean;
  exactTargetParityPassed: boolean;
  repairRelaunchPassed: boolean;
  notes: string[];
  results: DesktopShellBetaTrialResult[];
};

export type DesktopShellBetaReleaseHandoffVerdict = {
  generatedAt: string;
  target: DesktopShellBetaReleaseHandoffTarget;
  status: DesktopShellBetaReleaseHandoffStatus;
  gateReached: boolean;
  notes: string[];
  gateReportPath: string;
  requiredArtifacts: string[];
};

export type DesktopShellBetaReleaseReference = {
  status: DesktopShellBetaReleaseHandoffStatus;
  target: DesktopShellBetaReleaseHandoffTarget;
  gateReached: boolean;
  artifactRunId: string | null;
  artifactWorkflowName: string | null;
  artifactConclusion: string | null;
  selectionMode: "explicit_run_id" | "tag_sha_binding" | "sha_fallback_binding" | "none";
  bindingReleaseTag: string | null;
  bindingExpectedSha: string | null;
  bindingMatched: boolean;
  notes: string[];
};

export type DesktopShellBetaReleaseBinding = {
  generatedAt: string;
  releaseTag: string | null;
  expectedSha: string | null;
  handoffTarget: DesktopShellBetaReleaseHandoffTarget;
  betaGateRunId: string | null;
  betaGateWorkflowName: string | null;
  releaseHandoffStatus: DesktopShellBetaReleaseHandoffStatus;
  gateReached: boolean;
  notes: string[];
};

export type DesktopShellBetaReleaseBindingMatch = {
  selectionMode: "tag_sha_binding" | "sha_fallback_binding" | "none";
  bindingMatched: boolean;
  releaseTag: string | null;
  expectedSha: string | null;
  runId: string | null;
  workflowName: string | null;
  status: DesktopShellBetaReleaseHandoffStatus;
  gateReached: boolean;
  notes: string[];
};

export const DEFAULT_BETA_ARTIFACT_DIR = path.join("artifacts", "beta");

export function resolveBetaArtifactDir(artifactDir: string | undefined): string {
  const normalized = artifactDir?.trim();
  return normalized ? normalized : DEFAULT_BETA_ARTIFACT_DIR;
}

export function resolvePlatformTrialReportPaths(
  platform: DesktopShellBetaPlatform,
  artifactDir: string | undefined,
): { json: string; markdown: string } {
  const baseDir = resolveBetaArtifactDir(artifactDir);
  return {
    json: path.join(baseDir, `${platform}-shell-beta.json`),
    markdown: path.join(baseDir, `${platform}-shell-beta.md`),
  };
}

export function resolveGateReportPaths(
  artifactDir: string | undefined,
): { json: string; markdown: string } {
  const baseDir = resolveBetaArtifactDir(artifactDir);
  return {
    json: path.join(baseDir, "desktop-shell-beta-gate.json"),
    markdown: path.join(baseDir, "desktop-shell-beta-gate.md"),
  };
}

export function resolveReleaseHandoffReportPaths(
  artifactDir: string | undefined,
): { json: string; markdown: string } {
  const baseDir = resolveBetaArtifactDir(artifactDir);
  return {
    json: path.join(baseDir, "desktop-shell-beta-release-handoff.json"),
    markdown: path.join(baseDir, "desktop-shell-beta-release-handoff.md"),
  };
}

export function resolveReleaseBindingReportPaths(
  artifactDir: string | undefined,
): { json: string; markdown: string } {
  const baseDir = resolveBetaArtifactDir(artifactDir);
  return {
    json: path.join(baseDir, "desktop-shell-beta-release-binding.json"),
    markdown: path.join(baseDir, "desktop-shell-beta-release-binding.md"),
  };
}

export function parseBooleanFlag(value: string | undefined, defaultValue = false): boolean {
  if (!value?.trim()) {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "y";
}

export async function writeJsonReport(filePath: string | undefined, payload: unknown): Promise<void> {
  if (!filePath?.trim()) {
    return;
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function writeMarkdownReport(filePath: string | undefined, body: string): Promise<void> {
  if (!filePath?.trim()) {
    return;
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${body.trimEnd()}\n`, "utf8");
}

export function renderTrialMarkdown(result: DesktopShellBetaTrialResult): string {
  const lines = [
    `# ${result.input.platform} desktop shell beta trial`,
    "",
    `- generated at: ${result.generatedAt}`,
    `- install source: ${result.input.installSource}`,
    `- mode: ${result.input.mode}`,
    `- gate reached: ${yesNo(result.gateReached)}`,
    `- host path passed: ${yesNo(result.hostPathPassed)}`,
    `- shell path passed: ${yesNo(result.shellPathPassed)}`,
    `- installer path passed: ${yesNo(result.installerPathPassed)}`,
    `- governance reachable: ${yesNo(result.governanceReachable)}`,
    `- exact target parity passed: ${yesNo(result.exactTargetParityPassed)}`,
    `- repair / relaunch passed: ${yesNo(result.repairRelaunchPassed)}`,
    "",
    "## Checks",
    "",
    ...Object.entries(result.checks).map(([key, value]) => `- ${key}: ${yesNo(value)}`),
    "",
    "## Notes",
    "",
    ...(result.notes.length ? result.notes.map((note) => `- ${note}`) : ["- none"]),
  ];
  return lines.join("\n");
}

export function renderGateMarkdown(verdict: DesktopShellBetaGateVerdict): string {
  const lines = [
    "# Desktop Shell Beta Gate",
    "",
    `- generated at: ${verdict.generatedAt}`,
    `- platforms: ${verdict.platforms.join(", ") || "none"}`,
    `- gate reached: ${yesNo(verdict.gateReached)}`,
    `- host path passed: ${yesNo(verdict.hostPathPassed)}`,
    `- shell path passed: ${yesNo(verdict.shellPathPassed)}`,
    `- installer path passed: ${yesNo(verdict.installerPathPassed)}`,
    `- governance reachable: ${yesNo(verdict.governanceReachable)}`,
    `- exact target parity passed: ${yesNo(verdict.exactTargetParityPassed)}`,
    `- repair / relaunch passed: ${yesNo(verdict.repairRelaunchPassed)}`,
    "",
    "## Notes",
    "",
    ...(verdict.notes.length ? verdict.notes.map((note) => `- ${note}`) : ["- none"]),
    "",
    "## Per-platform Results",
    "",
    ...verdict.results.flatMap((result) => [
      `### ${result.input.platform}`,
      "",
      `- install source: ${result.input.installSource}`,
      `- mode: ${result.input.mode}`,
      `- gate reached: ${yesNo(result.gateReached)}`,
      `- host path passed: ${yesNo(result.hostPathPassed)}`,
      `- shell path passed: ${yesNo(result.shellPathPassed)}`,
      `- installer path passed: ${yesNo(result.installerPathPassed)}`,
      `- governance reachable: ${yesNo(result.governanceReachable)}`,
      `- exact target parity passed: ${yesNo(result.exactTargetParityPassed)}`,
      `- repair / relaunch passed: ${yesNo(result.repairRelaunchPassed)}`,
      ...(result.notes.length ? ["", ...result.notes.map((note) => `- ${note}`)] : []),
      "",
    ]),
  ];
  return lines.join("\n");
}

export function renderReleaseHandoffMarkdown(
  verdict: DesktopShellBetaReleaseHandoffVerdict,
): string {
  const lines = [
    "# Desktop Shell Beta Release Handoff",
    "",
    `- generated at: ${verdict.generatedAt}`,
    `- target: ${verdict.target}`,
    `- status: ${verdict.status}`,
    `- gate reached: ${yesNo(verdict.gateReached)}`,
    `- gate report path: ${verdict.gateReportPath}`,
    "",
    "## Required Artifacts",
    "",
    ...verdict.requiredArtifacts.map((artifactPath) => `- ${artifactPath}`),
    "",
    "## Notes",
    "",
    ...(verdict.notes.length ? verdict.notes.map((note) => `- ${note}`) : ["- none"]),
  ];
  return lines.join("\n");
}

export function renderReleaseBindingMarkdown(
  binding: DesktopShellBetaReleaseBinding,
): string {
  const lines = [
    "# Desktop Shell Beta Release Binding",
    "",
    `- generated at: ${binding.generatedAt}`,
    `- release tag: ${binding.releaseTag ?? "none"}`,
    `- expected sha: ${binding.expectedSha ?? "none"}`,
    `- handoff target: ${binding.handoffTarget}`,
    `- beta gate run id: ${binding.betaGateRunId ?? "none"}`,
    `- beta gate workflow name: ${binding.betaGateWorkflowName ?? "unknown"}`,
    `- release handoff status: ${binding.releaseHandoffStatus}`,
    `- gate reached: ${yesNo(binding.gateReached)}`,
    "",
    "## Notes",
    "",
    ...(binding.notes.length ? binding.notes.map((note) => `- ${note}`) : ["- none"]),
  ];
  return lines.join("\n");
}

export function renderReleaseReferenceMarkdown(
  reference: DesktopShellBetaReleaseReference,
): string {
  const lines = [
    "# Desktop Shell Beta Release Reference",
    "",
    `- target: ${reference.target}`,
    `- status: ${reference.status}`,
    `- gate reached: ${yesNo(reference.gateReached)}`,
    `- artifact run id: ${reference.artifactRunId ?? "none"}`,
    `- artifact workflow name: ${reference.artifactWorkflowName ?? "unknown"}`,
    `- artifact conclusion: ${reference.artifactConclusion ?? "unknown"}`,
    `- selection mode: ${reference.selectionMode}`,
    `- binding release tag: ${reference.bindingReleaseTag ?? "none"}`,
    `- binding expected sha: ${reference.bindingExpectedSha ?? "none"}`,
    `- binding matched: ${yesNo(reference.bindingMatched)}`,
    "",
    "## Notes",
    "",
    ...(reference.notes.length ? reference.notes.map((note) => `- ${note}`) : ["- none"]),
  ];
  return lines.join("\n");
}

export function aggregateDesktopShellBetaGate(
  results: DesktopShellBetaTrialResult[],
): DesktopShellBetaGateVerdict {
  const generatedAt = new Date().toISOString();
  const platforms = results.map((result) => result.input.platform);
  const notes = [...results.flatMap((result) => result.notes)];
  const hasWindows = platforms.includes("windows");
  const hasMac = platforms.includes("macos");
  if (!hasWindows || !hasMac) {
    notes.push("Dual-platform beta gate requires both windows and macos trial results.");
  }
  const gateReached =
    hasWindows
    && hasMac
    && results.every((result) => result.gateReached);
  return {
    generatedAt,
    platforms,
    gateReached,
    hostPathPassed: results.length > 0 && results.every((result) => result.hostPathPassed),
    shellPathPassed: results.length > 0 && results.every((result) => result.shellPathPassed),
    installerPathPassed: results.length > 0 && results.every((result) => result.installerPathPassed),
    governanceReachable: results.length > 0 && results.every((result) => result.governanceReachable),
    exactTargetParityPassed:
      results.length > 0 && results.every((result) => result.exactTargetParityPassed),
    repairRelaunchPassed: results.length > 0 && results.every((result) => result.repairRelaunchPassed),
    notes,
    results,
  };
}

export function buildDesktopShellBetaReleaseHandoffVerdict(args: {
  gate: DesktopShellBetaGateVerdict;
  gateReportPath: string;
  target: DesktopShellBetaReleaseHandoffTarget;
  requiredArtifacts?: string[];
}): DesktopShellBetaReleaseHandoffVerdict {
  const requiredArtifacts = args.requiredArtifacts ?? [
    path.join(DEFAULT_BETA_ARTIFACT_DIR, "windows-shell-beta.json"),
    path.join(DEFAULT_BETA_ARTIFACT_DIR, "macos-shell-beta.json"),
    path.join(DEFAULT_BETA_ARTIFACT_DIR, "desktop-shell-beta-gate.json"),
  ];
  const notes = [...args.gate.notes];
  if (!args.gate.gateReached) {
    notes.push("Dual-platform beta gate is still blocked, so release handoff remains blocked.");
  }
  const status: DesktopShellBetaReleaseHandoffStatus = args.gate.gateReached
    ? (args.target === "release_handoff" ? "ready_for_release_handoff" : "ready_for_controlled_beta")
    : "blocked";
  return {
    generatedAt: new Date().toISOString(),
    target: args.target,
    status,
    gateReached: args.gate.gateReached,
    notes,
    gateReportPath: args.gateReportPath,
    requiredArtifacts,
  };
}

export function buildDesktopShellBetaReleaseBinding(args: {
  handoff: DesktopShellBetaReleaseHandoffVerdict;
  releaseTag?: string | null;
  expectedSha?: string | null;
  betaGateRunId?: string | null;
  betaGateWorkflowName?: string | null;
}): DesktopShellBetaReleaseBinding {
  return {
    generatedAt: new Date().toISOString(),
    releaseTag: args.releaseTag?.trim() || null,
    expectedSha: args.expectedSha?.trim() || null,
    handoffTarget: args.handoff.target,
    betaGateRunId: args.betaGateRunId?.trim() || null,
    betaGateWorkflowName: args.betaGateWorkflowName?.trim() || null,
    releaseHandoffStatus: args.handoff.status,
    gateReached: args.handoff.gateReached,
    notes: [...args.handoff.notes],
  };
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}
