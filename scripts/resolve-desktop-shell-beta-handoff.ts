import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  type DesktopShellBetaReleaseBinding,
  type DesktopShellBetaReleaseBindingMatch,
  renderReleaseReferenceMarkdown,
  type DesktopShellBetaReleaseHandoffTarget,
  type DesktopShellBetaReleaseHandoffVerdict,
  type DesktopShellBetaReleaseReference,
  writeJsonReport,
  writeMarkdownReport,
} from "./lib/desktop-shell-beta-gate.js";

type GitHubRunMetadata = {
  id?: number;
  name?: string | null;
  conclusion?: string | null;
  head_sha?: string | null;
  created_at?: string | null;
};

type GitHubArtifactList = {
  artifacts?: Array<{
    id?: number;
    name?: string | null;
    expired?: boolean;
  }>;
};

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function normalizeTarget(value: string | undefined): DesktopShellBetaReleaseHandoffTarget {
  return value?.trim().toLowerCase() === "release_handoff" ? "release_handoff" : "controlled_beta";
}

function buildBlockedReference(args: {
  target: DesktopShellBetaReleaseHandoffTarget;
  runId?: string | null;
  workflowName?: string | null;
  conclusion?: string | null;
  selectionMode?: DesktopShellBetaReleaseReference["selectionMode"];
  bindingReleaseTag?: string | null;
  bindingExpectedSha?: string | null;
  bindingMatched?: boolean;
  notes: string[];
}): DesktopShellBetaReleaseReference {
  return {
    status: "blocked",
    target: args.target,
    gateReached: false,
    artifactRunId: args.runId?.trim() || null,
    artifactWorkflowName: args.workflowName?.trim() || null,
    artifactConclusion: args.conclusion?.trim() || null,
    selectionMode: args.selectionMode ?? "none",
    bindingReleaseTag: args.bindingReleaseTag?.trim() || null,
    bindingExpectedSha: args.bindingExpectedSha?.trim() || null,
    bindingMatched: args.bindingMatched ?? false,
    notes: args.notes,
  };
}

async function findFileRecursive(rootDir: string, fileName: string): Promise<string | null> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isFile() && entry.name === fileName) {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const nested = await findFileRecursive(fullPath, fileName);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function runGhJson(args: string[]): unknown {
  const stdout = execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(stdout);
}

function normalizeNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function parseBindingFile(filePath: string): Promise<DesktopShellBetaReleaseBinding | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as DesktopShellBetaReleaseBinding;
  } catch {
    return null;
  }
}

async function readBindingFromRun(args: {
  repo: string;
  runId: string;
  workflowName: string | null;
  conclusion: string | null;
}): Promise<
  | (DesktopShellBetaReleaseBinding & {
      artifactRunId: string;
      artifactWorkflowName: string | null;
      artifactConclusion: string | null;
    })
  | null
> {
  const artifactName = "desktop-shell-beta-release-binding";
  const artifactFileName = "desktop-shell-beta-release-binding.json";
  let artifactList: GitHubArtifactList;
  try {
    artifactList = runGhJson([
      "api",
      `repos/${args.repo}/actions/runs/${args.runId}/artifacts`,
    ]) as GitHubArtifactList;
  } catch {
    return null;
  }

  const artifact = (artifactList.artifacts ?? []).find(
    (candidate) => candidate.name === artifactName && candidate.expired !== true,
  );
  if (!artifact?.id) {
    return null;
  }

  const downloadDir = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-shell-beta-binding-"));
  try {
    execFileSync(
      "gh",
      [
        "run",
        "download",
        args.runId,
        "--repo",
        args.repo,
        "--name",
        artifactName,
        "--dir",
        downloadDir,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch {
    return null;
  }

  const artifactFilePath = await findFileRecursive(downloadDir, artifactFileName);
  if (!artifactFilePath) {
    return null;
  }
  const binding = await parseBindingFile(artifactFilePath);
  if (!binding) {
    return null;
  }
  return {
    ...binding,
    artifactRunId: args.runId,
    artifactWorkflowName: args.workflowName,
    artifactConclusion: args.conclusion,
  };
}

async function discoverBindingMatch(args: {
  repo: string;
  target: DesktopShellBetaReleaseHandoffTarget;
  releaseTag?: string | null;
  expectedSha?: string | null;
  bindingJsonPath?: string | null;
}): Promise<DesktopShellBetaReleaseBindingMatch> {
  const releaseTag = normalizeNullable(args.releaseTag);
  const expectedSha = normalizeNullable(args.expectedSha);

  const bindings: Array<
    DesktopShellBetaReleaseBinding & {
      artifactRunId: string | null;
      artifactWorkflowName: string | null;
      artifactConclusion: string | null;
      createdAt: string | null;
    }
  > = [];

  const localBindingPath = normalizeNullable(args.bindingJsonPath);
  if (localBindingPath) {
    const localBinding = await parseBindingFile(localBindingPath);
    if (localBinding) {
      bindings.push({
        ...localBinding,
        artifactRunId: normalizeNullable(localBinding.betaGateRunId),
        artifactWorkflowName:
          normalizeNullable(localBinding.betaGateWorkflowName) ?? "local-binding",
        artifactConclusion: "success",
        createdAt: localBinding.generatedAt ?? null,
      });
    }
  } else {
    const payload = runGhJson([
      "api",
      `repos/${args.repo}/actions/workflows/desktop-shell-beta-gate.yml/runs?status=success&per_page=30`,
    ]) as { workflow_runs?: GitHubRunMetadata[] };
    for (const run of payload.workflow_runs ?? []) {
      if (!run.id) {
        continue;
      }
      const binding = await readBindingFromRun({
        repo: args.repo,
        runId: String(run.id),
        workflowName: run.name ?? null,
        conclusion: run.conclusion ?? null,
      });
      if (!binding) {
        continue;
      }
      bindings.push({
        ...binding,
        artifactRunId: String(run.id),
        artifactWorkflowName: run.name ?? null,
        artifactConclusion: run.conclusion ?? null,
        createdAt: run.created_at ?? binding.generatedAt ?? null,
      });
    }
  }

  const eligible = bindings.filter((binding) => {
    const bindingTargetMatches = binding.handoffTarget === args.target;
    const statusOkay =
      binding.releaseHandoffStatus === "ready_for_controlled_beta" ||
      binding.releaseHandoffStatus === "ready_for_release_handoff";
    return bindingTargetMatches && statusOkay && binding.gateReached;
  });

  const sortNewestFirst = <T extends { createdAt?: string | null; generatedAt?: string | null }>(
    items: T[],
  ) =>
    [...items].toSorted((left, right) =>
      String(right.createdAt ?? right.generatedAt ?? "").localeCompare(
        String(left.createdAt ?? left.generatedAt ?? ""),
      ),
    );

  if (releaseTag && expectedSha) {
    const matches = sortNewestFirst(
      eligible.filter(
        (binding) =>
          normalizeNullable(binding.releaseTag) === releaseTag &&
          normalizeNullable(binding.expectedSha) === expectedSha,
      ),
    );
    if (matches.length > 0) {
      const chosen = matches[0]!;
      return {
        selectionMode: "tag_sha_binding",
        bindingMatched: true,
        releaseTag,
        expectedSha,
        runId: chosen.artifactRunId,
        workflowName: chosen.artifactWorkflowName,
        status: chosen.releaseHandoffStatus,
        gateReached: chosen.gateReached,
        notes:
          matches.length > 1
            ? [
                `Multiple tag+sha beta bindings matched; selected latest successful run ${chosen.artifactRunId ?? "local-binding"}.`,
              ]
            : [],
      };
    }

    const tagOnlyMatches = sortNewestFirst(
      eligible.filter(
        (binding) =>
          normalizeNullable(binding.releaseTag) === releaseTag &&
          normalizeNullable(binding.expectedSha) !== expectedSha,
      ),
    );
    if (tagOnlyMatches.length > 0) {
      return {
        selectionMode: "none",
        bindingMatched: false,
        releaseTag,
        expectedSha,
        runId: null,
        workflowName: null,
        status: "blocked",
        gateReached: false,
        notes: [
          `Found beta gate bindings for release tag ${releaseTag}, but none matched expected sha ${expectedSha}.`,
        ],
      };
    }
  }

  if (expectedSha) {
    const matches = sortNewestFirst(
      eligible.filter((binding) => normalizeNullable(binding.expectedSha) === expectedSha),
    );
    if (matches.length > 0) {
      const chosen = matches[0]!;
      return {
        selectionMode: "sha_fallback_binding",
        bindingMatched: true,
        releaseTag: normalizeNullable(chosen.releaseTag),
        expectedSha,
        runId: chosen.artifactRunId,
        workflowName: chosen.artifactWorkflowName,
        status: chosen.releaseHandoffStatus,
        gateReached: chosen.gateReached,
        notes:
          matches.length > 1
            ? [
                `Multiple sha-only beta bindings matched; selected latest successful run ${chosen.artifactRunId ?? "local-binding"}.`,
              ]
            : [],
      };
    }
  }

  return {
    selectionMode: "none",
    bindingMatched: false,
    releaseTag,
    expectedSha,
    runId: null,
    workflowName: null,
    status: "blocked",
    gateReached: false,
    notes: [
      "No matching beta gate binding was found for the requested release tag / sha / target.",
    ],
  };
}

async function resolveFromArtifact(args: {
  repo: string;
  runId: string;
  artifactName: string;
  artifactFileName: string;
  target: DesktopShellBetaReleaseHandoffTarget;
  expectedSha?: string | null;
}): Promise<DesktopShellBetaReleaseReference> {
  let run: GitHubRunMetadata;
  try {
    run = runGhJson(["api", `repos/${args.repo}/actions/runs/${args.runId}`]) as GitHubRunMetadata;
  } catch (error) {
    return buildBlockedReference({
      target: args.target,
      runId: args.runId,
      notes: [`Failed to resolve beta gate run ${args.runId}: ${String(error)}`],
    });
  }

  if (!run.id) {
    return buildBlockedReference({
      target: args.target,
      runId: args.runId,
      workflowName: run.name ?? null,
      conclusion: run.conclusion ?? null,
      notes: [`Beta gate run ${args.runId} did not return a valid Actions run payload.`],
    });
  }

  const notes: string[] = [];
  if (run.conclusion !== "success") {
    notes.push(
      `Beta gate run ${args.runId} concluded with ${run.conclusion ?? "unknown"} instead of success.`,
    );
  }
  if (args.expectedSha?.trim() && run.head_sha && run.head_sha !== args.expectedSha.trim()) {
    notes.push(
      `Beta gate run ${args.runId} was built from ${run.head_sha}, which does not match expected sha ${args.expectedSha.trim()}.`,
    );
  }

  let artifactList: GitHubArtifactList;
  try {
    artifactList = runGhJson([
      "api",
      `repos/${args.repo}/actions/runs/${args.runId}/artifacts`,
    ]) as GitHubArtifactList;
  } catch (error) {
    return buildBlockedReference({
      target: args.target,
      runId: args.runId,
      workflowName: run.name ?? null,
      conclusion: run.conclusion ?? null,
      notes: [
        ...notes,
        `Failed to list beta gate artifacts for run ${args.runId}: ${String(error)}`,
      ],
    });
  }

  const artifact = (artifactList.artifacts ?? []).find(
    (candidate) => candidate.name === args.artifactName && candidate.expired !== true,
  );
  if (!artifact?.id) {
    return buildBlockedReference({
      target: args.target,
      runId: args.runId,
      workflowName: run.name ?? null,
      conclusion: run.conclusion ?? null,
      notes: [...notes, `Run ${args.runId} does not expose artifact ${args.artifactName}.`],
    });
  }

  const downloadDir = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-shell-beta-handoff-"));
  try {
    execFileSync(
      "gh",
      [
        "run",
        "download",
        args.runId,
        "--repo",
        args.repo,
        "--name",
        args.artifactName,
        "--dir",
        downloadDir,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    return buildBlockedReference({
      target: args.target,
      runId: args.runId,
      workflowName: run.name ?? null,
      conclusion: run.conclusion ?? null,
      notes: [
        ...notes,
        `Failed to download artifact ${args.artifactName} from run ${args.runId}: ${String(error)}`,
      ],
    });
  }

  const artifactFilePath = await findFileRecursive(downloadDir, args.artifactFileName);
  if (!artifactFilePath) {
    return buildBlockedReference({
      target: args.target,
      runId: args.runId,
      workflowName: run.name ?? null,
      conclusion: run.conclusion ?? null,
      notes: [...notes, `Artifact ${args.artifactName} did not contain ${args.artifactFileName}.`],
    });
  }

  let verdict: DesktopShellBetaReleaseHandoffVerdict;
  try {
    verdict = JSON.parse(
      await fs.readFile(artifactFilePath, "utf8"),
    ) as DesktopShellBetaReleaseHandoffVerdict;
  } catch (error) {
    return buildBlockedReference({
      target: args.target,
      runId: args.runId,
      workflowName: run.name ?? null,
      conclusion: run.conclusion ?? null,
      notes: [
        ...notes,
        `Artifact ${args.artifactName} did not contain valid JSON verdict data: ${String(error)}`,
      ],
    });
  }

  if (verdict.target !== args.target) {
    notes.push(
      `Beta gate handoff target ${verdict.target} does not match required target ${args.target}.`,
    );
  }
  if (verdict.status === "blocked") {
    notes.push("Beta gate release handoff verdict is blocked.");
  }
  notes.push(...(verdict.notes ?? []));

  return {
    status: verdict.target === args.target ? verdict.status : "blocked",
    target: args.target,
    gateReached:
      Boolean(verdict.gateReached) &&
      verdict.target === args.target &&
      verdict.status !== "blocked",
    artifactRunId: String(run.id),
    artifactWorkflowName: run.name ?? null,
    artifactConclusion: run.conclusion ?? null,
    notes,
  };
}

async function resolveFromLocalVerdict(args: {
  handoffJsonPath: string;
  target: DesktopShellBetaReleaseHandoffTarget;
}): Promise<DesktopShellBetaReleaseReference> {
  let verdict: DesktopShellBetaReleaseHandoffVerdict;
  try {
    verdict = JSON.parse(
      await fs.readFile(args.handoffJsonPath, "utf8"),
    ) as DesktopShellBetaReleaseHandoffVerdict;
  } catch (error) {
    return buildBlockedReference({
      target: args.target,
      notes: [
        `Failed to read local beta handoff verdict ${args.handoffJsonPath}: ${String(error)}`,
      ],
    });
  }

  const notes = [...(verdict.notes ?? [])];
  if (verdict.target !== args.target) {
    notes.push(
      `Local beta handoff target ${verdict.target} does not match required target ${args.target}.`,
    );
  }
  if (verdict.status === "blocked") {
    notes.push("Local beta handoff verdict is blocked.");
  }
  return {
    status: verdict.target === args.target ? verdict.status : "blocked",
    target: args.target,
    gateReached:
      Boolean(verdict.gateReached) &&
      verdict.target === args.target &&
      verdict.status !== "blocked",
    artifactRunId: null,
    artifactWorkflowName: "local-verdict",
    artifactConclusion: "success",
    selectionMode: "none",
    bindingReleaseTag: null,
    bindingExpectedSha: null,
    bindingMatched: false,
    notes,
  };
}

async function main() {
  const repo = readOption("--repo")?.trim() || process.env.GITHUB_REPOSITORY || "";
  const runId = readOption("--run-id")?.trim() || process.env.BETA_GATE_RUN_ID || "";
  const handoffJsonPath =
    readOption("--handoff-json")?.trim() || process.env.BETA_GATE_HANDOFF_JSON || "";
  const releaseTag = readOption("--release-tag")?.trim() || process.env.RELEASE_TAG || null;
  const bindingJsonPath =
    readOption("--binding-json")?.trim() || process.env.BETA_GATE_BINDING_JSON || null;
  const artifactName =
    readOption("--artifact-name")?.trim() ||
    process.env.BETA_GATE_ARTIFACT_NAME ||
    "desktop-shell-beta-release-handoff";
  const artifactFileName =
    readOption("--artifact-file")?.trim() ||
    process.env.BETA_GATE_ARTIFACT_FILE ||
    "desktop-shell-beta-release-handoff.json";
  const target = normalizeTarget(readOption("--target")?.trim() || process.env.HANDOFF_TARGET);
  const expectedSha = readOption("--expected-sha")?.trim() || process.env.EXPECTED_SHA || null;
  const reportJson = readOption("--report-json")?.trim() || process.env.REPORT_JSON;
  const reportMd = readOption("--report-md")?.trim() || process.env.REPORT_MD;

  let reference: DesktopShellBetaReleaseReference;
  if (handoffJsonPath) {
    reference = await resolveFromLocalVerdict({
      handoffJsonPath,
      target,
    });
  } else if (!repo && !bindingJsonPath) {
    reference = buildBlockedReference({
      target,
      runId,
      notes: ["Missing GitHub repository context for beta gate artifact lookup."],
    });
  } else if (runId) {
    reference = await resolveFromArtifact({
      repo,
      runId,
      artifactName,
      artifactFileName,
      target,
      expectedSha,
    });
    reference = {
      ...reference,
      selectionMode: "explicit_run_id",
      bindingReleaseTag: null,
      bindingExpectedSha: null,
      bindingMatched: false,
    };
  } else {
    const match = await discoverBindingMatch({
      repo,
      target,
      releaseTag,
      expectedSha,
      bindingJsonPath,
    });
    if (!match.bindingMatched || !match.runId) {
      reference = buildBlockedReference({
        target,
        selectionMode: match.selectionMode,
        bindingReleaseTag: match.releaseTag,
        bindingExpectedSha: match.expectedSha,
        bindingMatched: match.bindingMatched,
        notes: match.notes,
      });
    } else {
      reference = await resolveFromArtifact({
        repo,
        runId: match.runId,
        artifactName,
        artifactFileName,
        target,
        expectedSha,
      });
      reference = {
        ...reference,
        selectionMode: match.selectionMode,
        bindingReleaseTag: match.releaseTag,
        bindingExpectedSha: match.expectedSha,
        bindingMatched: match.bindingMatched,
        notes: [...match.notes, ...reference.notes],
      };
    }
  }

  await writeJsonReport(reportJson, reference);
  await writeMarkdownReport(reportMd, renderReleaseReferenceMarkdown(reference));
  process.stdout.write(`${JSON.stringify(reference, null, 2)}\n`);
}

main().catch((error) => {
  console.error(`[resolve-desktop-shell-beta-handoff] ${String(error)}`);
  process.exitCode = 1;
});
