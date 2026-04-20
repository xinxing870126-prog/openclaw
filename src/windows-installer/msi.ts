import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { readPackageVersion } from "../cli/update-cli/shared.js";
import { resolveStateDir } from "../config/paths.js";
import { resolveGatewayService, readGatewayServiceState } from "../daemon/service.js";
import { readJsonFile, writeJsonAtomic } from "../infra/json-files.js";
import { compareComparableSemver, parseComparableSemver } from "../infra/semver-compare.js";
import { runCommandWithTimeout } from "../process/exec.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { fetchWithTimeout } from "../utils/fetch-timeout.js";
import {
  resolveWindowsCompanionInstallerStatus,
  uninstallWindowsCompanionFromInstaller,
  type WindowsCompanionInstallerStatus,
} from "../windows-companion/installer.js";

const WINDOWS_MSI_MANIFEST_FILE = "windows-installer.json";
const WINDOWS_MSI_PRODUCT_NAME = "OpenClaw";
const WINDOWS_MSI_UPGRADE_CODE = "8E1F2338-5FA5-4797-8955-C66D4A809CC1";
const WINDOWS_MSI_ARCH = "x64";
const WINDOWS_MSI_DEFAULT_OUT_DIR = ".artifacts/windows-msi";
const WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS = 120_000;
const WINDOWS_MSI_DEFAULT_SIGNTOOL = "signtool";
const WINDOWS_MSI_DEFAULT_POWERSHELL = "pwsh";
const WINDOWS_MSI_DEFAULT_TIMESTAMP_URL = "http://timestamp.digicert.com";
const WINDOWS_MSI_RELEASES_API_URL = "https://api.github.com/repos/openclaw/openclaw/releases";
const WINDOWS_MSI_RELEASE_USER_AGENT = "openclaw-windows-msi-updater";
const WINDOWS_MSI_RELEASE_TIMEOUT_MS = 15_000;
const WINDOWS_WINGET_PACKAGE_IDENTIFIER = "OpenClaw.OpenClaw";
const WINDOWS_WINGET_PACKAGE_NAME = "OpenClaw";
const WINDOWS_WINGET_PUBLISHER = "OpenClaw";
const WINDOWS_WINGET_MONIKER = "openclaw";
const WINDOWS_WINGET_MANIFEST_VERSION = "1.9.0";
const WINDOWS_WINGET_DEFAULT_LOCALE = "en-US";
const WINDOWS_WINGET_SHORT_DESCRIPTION =
  "Multi-channel AI gateway with managed Windows companion host support.";
const WINDOWS_WINGET_LICENSE_URL = "https://github.com/openclaw/openclaw/blob/main/LICENSE";
const WINDOWS_WINGET_PACKAGE_URL = "https://github.com/openclaw/openclaw";
const WINDOWS_WINGET_PUBLISHER_SUPPORT_URL = "https://github.com/openclaw/openclaw/issues";
const WINDOWS_WINGET_DEFAULT_OUT_DIR = ".artifacts/windows-winget";
const WINDOWS_WINGET_UPSTREAM_REPO = "microsoft/winget-pkgs";
const WINDOWS_WINGET_BASE_BRANCH = "master";

type WindowsCompanionInstallModeValue = "schtasks" | "startup_folder";

export type WindowsMsiInstallMode = "msi";
export type WindowsMsiTimestampStatus = "present" | "missing" | "unknown";
export type WindowsMsiReleaseChannel = "stable" | "beta" | "dev";

export type WindowsInstallerManifest = {
  version: 1;
  installMode: WindowsMsiInstallMode;
  productName: string;
  productVersion: string;
  architecture: typeof WINDOWS_MSI_ARCH;
  installRoot: string;
  installedAt: string;
  updatedAt: string;
  companionEnabled: boolean;
  gatewayBootstrapSucceeded: boolean;
  companionBootstrapSucceeded: boolean;
  companionInstallMode?: WindowsCompanionInstallModeValue | null;
  companionSupervisorLabel?: string | null;
  repairHint?: string | null;
};

export type WindowsInstallerBootstrapStatus = {
  manifest: WindowsInstallerManifest | null;
  manifestPresent: boolean;
  gatewayInstalled: boolean;
  gatewayLoaded: boolean;
  gatewayRunning: boolean;
  companionConfigured: boolean;
  companionInstalled: boolean;
  companionRunning: boolean;
  companionInstallMode: WindowsCompanionInstallModeValue | null;
  companionSupervisorLabel: string | null;
  partialFailure: boolean;
  repairHints: string[];
};

export type WindowsInstallerBootstrapResult = {
  gateway: {
    ok: boolean;
    code: number | null;
    stdout: string;
    stderr: string;
  };
  companion: {
    attempted: boolean;
    ok: boolean;
    skipped: boolean;
    code: number | null;
    stdout: string;
    stderr: string;
  };
  manifest: WindowsInstallerManifest;
  status: WindowsInstallerBootstrapStatus;
};

export type WindowsInstallerCleanupResult = {
  gatewayRemoved: boolean;
  companionRemoved: boolean;
  manifestRemoved: boolean;
};

export type WindowsMsiBuildResult = {
  artifactPath: string;
  artifactName: string;
  sourcePath: string;
  stageDir: string;
  installRoot: string;
  version: string;
};

export type WindowsMsiSigningStatus = {
  status: string;
  statusMessage: string | null;
  signed: boolean;
  verified: boolean;
  signerSubject: string | null;
  expectedSignerMatched: boolean | null;
  timestampSubject: string | null;
  timestampStatus: WindowsMsiTimestampStatus;
};

export type WindowsReleaseArtifactMetadata = {
  artifactPath: string;
  artifactName: string;
  version: string;
  releaseChannel: string;
  exists: boolean;
  signed: boolean;
  signerSubject: string | null;
  expectedSignerMatched: boolean | null;
  timestampSubject: string | null;
  timestampStatus: WindowsMsiTimestampStatus;
  verificationStatus: string;
  verificationMessage: string | null;
};

export type WindowsInstalledProductStatus = {
  manifest: WindowsInstallerManifest | null;
  bootstrapStatus: WindowsInstallerBootstrapStatus;
  gatewayStatus: Record<string, unknown> | null;
  companionStatus: Record<string, unknown> | null;
  gatewayStatusCommand: CliCommandResult | null;
  companionStatusCommand: CliCommandResult | null;
  gatewayStatusCommandOk: boolean;
  companionStatusCommandOk: boolean;
  companionPresenceDetected: boolean;
  installRoot: string | null;
};

export type WindowsInstalledReleaseBaseline = {
  manifest: WindowsInstallerManifest;
  bootstrapStatus: WindowsInstallerBootstrapStatus;
  installRoot: string;
  installedVersion: string;
  releaseChannel: WindowsMsiReleaseChannel;
  installedAt: string;
  updatedAt: string;
  needsRepair: boolean;
  repairHints: string[];
};

export type WindowsMsiReleaseArtifact = {
  assetName: string;
  downloadUrl: string;
  releaseUrl: string | null;
  tagName: string;
  version: string;
  releaseChannel: WindowsMsiReleaseChannel;
  prerelease: boolean;
  publishedAt: string | null;
  releaseNotes: string | null;
};

export type WindowsMsiAvailableUpdateStatus =
  | "upgrade-available"
  | "up-to-date"
  | "repair-needed"
  | "unavailable";

export type WindowsMsiAvailableUpdate = {
  baseline: WindowsInstalledReleaseBaseline | null;
  latest: WindowsMsiReleaseArtifact | null;
  status: WindowsMsiAvailableUpdateStatus;
  comparison: number | null;
  reason: string | null;
};

export type WindowsMsiUpgradeResult = {
  performed: boolean;
  artifactPath: string | null;
  phaseResult: WindowsMsiSmokePhaseResult | null;
  update: WindowsMsiAvailableUpdate;
};

export type WindowsMsiRepairResult = {
  performed: boolean;
  artifactPath: string | null;
  phaseResult: WindowsMsiSmokePhaseResult | null;
  baseline: WindowsInstalledReleaseBaseline;
  artifact: WindowsMsiReleaseArtifact | null;
  exactVersionMatch: boolean;
};

export type WindowsWingetReleaseMetadata = {
  packageIdentifier: string;
  packageVersion: string;
  releaseChannel: WindowsMsiReleaseChannel;
  artifactName: string;
  artifactPath: string;
  artifactUrl: string;
  artifactSha256: string;
  releaseUrl: string | null;
  releaseNotes: string | null;
  publisher: string;
  packageName: string;
  moniker: string;
  shortDescription: string;
  license: string;
  licenseUrl: string;
  packageUrl: string;
  publisherUrl: string;
  publisherSupportUrl: string;
  installerType: "wix";
  scope: "user";
};

export type WindowsWingetManifestSet = {
  directoryPath: string;
  packageIdentifier: string;
  packageVersion: string;
  files: {
    versionManifestPath: string;
    defaultLocaleManifestPath: string;
    installerManifestPath: string;
  };
  metadata: WindowsWingetReleaseMetadata;
};

export type WindowsWingetPublishStatus = {
  published: boolean;
  skipped: boolean;
  branchName: string | null;
  prUrl: string | null;
  targetRepo: string;
  forkRepo: string;
  manifestDir: string;
  reason: string | null;
};

export type WindowsMsiSmokePhase = "install" | "repair" | "uninstall";

export type WindowsMsiSmokePhaseResult = {
  phase: WindowsMsiSmokePhase;
  artifactPath: string;
  logPath: string;
  msiexec: CliCommandResult;
  installedProduct: WindowsInstalledProductStatus | null;
};

type CliCommandResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

type WxsFileEntry = {
  relativePath: string;
  sourcePath: string;
};

type DirectoryNode = {
  name: string;
  children: Map<string, DirectoryNode>;
  files: WxsFileEntry[];
};

type WindowsAuthenticodeSignaturePayload = {
  status?: string | null;
  statusMessage?: string | null;
  signerSubject?: string | null;
  timestampSubject?: string | null;
};

type GitHubReleaseAsset = {
  name?: string | null;
  browser_download_url?: string | null;
};

type GitHubReleasePayload = {
  html_url?: string | null;
  tag_name?: string | null;
  prerelease?: boolean | null;
  draft?: boolean | null;
  published_at?: string | null;
  body?: string | null;
  assets?: GitHubReleaseAsset[] | null;
};

function sanitizeId(value: string, prefix: string): string {
  const normalized = value.replace(/[^A-Za-z0-9_.]/g, "_");
  const hashSuffix = createHash("sha256").update(value).digest("hex").slice(0, 10).toUpperCase();
  const maxBaseLength = Math.max(1, 70 - prefix.length - hashSuffix.length - 1);
  const base = normalized.slice(0, maxBaseLength) || "X";
  return `${prefix}${base}_${hashSuffix}`;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function trimMultilineForSummary(value: string, maxLength = 600): string | null {
  const normalized = value.replaceAll("\u0000", "").trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

function summarizeWindowsInstalledProductStatus(
  status: WindowsInstalledProductStatus | null,
): Record<string, unknown> | null {
  if (!status) {
    return null;
  }
  const companionPresence = detectCompanionPresence({
    gatewayStatus: status.gatewayStatus,
    companionStatus: status.companionStatus,
  });
  return {
    installRoot: status.installRoot,
    manifestPresent: status.manifest !== null,
    manifestVersion: status.manifest?.productVersion ?? null,
    bootstrapStatus: {
      gatewayInstalled: status.bootstrapStatus.gatewayInstalled,
      gatewayLoaded: status.bootstrapStatus.gatewayLoaded,
      gatewayRunning: status.bootstrapStatus.gatewayRunning,
      companionConfigured: status.bootstrapStatus.companionConfigured,
      companionInstalled: status.bootstrapStatus.companionInstalled,
      companionRunning: status.bootstrapStatus.companionRunning,
      companionInstallMode: status.bootstrapStatus.companionInstallMode,
      companionSupervisorLabel: status.bootstrapStatus.companionSupervisorLabel,
      partialFailure: status.bootstrapStatus.partialFailure,
      repairHints: status.bootstrapStatus.repairHints,
    },
    gatewayStatusCommandOk: status.gatewayStatusCommandOk,
    gatewayStatusCommand: status.gatewayStatusCommand
      ? {
          code: status.gatewayStatusCommand.code,
          stdout: trimMultilineForSummary(status.gatewayStatusCommand.stdout),
          stderr: trimMultilineForSummary(status.gatewayStatusCommand.stderr),
        }
      : null,
    companionStatusCommandOk: status.companionStatusCommandOk,
    companionStatusCommand: status.companionStatusCommand
      ? {
          code: status.companionStatusCommand.code,
          stdout: trimMultilineForSummary(status.companionStatusCommand.stdout),
          stderr: trimMultilineForSummary(status.companionStatusCommand.stderr),
        }
      : null,
    companionPresenceDetected: status.companionPresenceDetected,
    companionPresenceSource: companionPresence.source,
    gatewayStatusSummary:
      status.gatewayStatus !== null
        ? {
            rpc: status.gatewayStatus.rpc ?? null,
            windowsCompanion: status.gatewayStatus.windowsCompanion ?? null,
          }
        : null,
    companionStatusSummary:
      status.companionStatus !== null
        ? {
            service: status.companionStatus.service ?? null,
            reachability: status.companionStatus.reachability ?? null,
            singleton: status.companionStatus.singleton ?? null,
          }
        : null,
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function detectCompanionPresence(params: {
  gatewayStatus: Record<string, unknown> | null;
  companionStatus: Record<string, unknown> | null;
}): { detected: boolean; source: "gateway_status" | "companion_status" | "none" } {
  const windowsCompanion = params.gatewayStatus?.windowsCompanion;
  if (isObjectRecord(windowsCompanion)) {
    return {
      detected: true,
      source: "gateway_status",
    };
  }
  const companionService = params.companionStatus?.service;
  if (isObjectRecord(companionService) && companionService.installed === true) {
    return {
      detected: true,
      source: "companion_status",
    };
  }
  return {
    detected: false,
    source: "none",
  };
}

function resolveDefaultMsiOutDir(rootDir: string): string {
  return path.join(rootDir, WINDOWS_MSI_DEFAULT_OUT_DIR);
}

function resolveWindowsTimestampStatus(params: {
  signed: boolean;
  timestampSubject: string | null;
}): WindowsMsiTimestampStatus {
  if (params.timestampSubject) {
    return "present";
  }
  return params.signed ? "missing" : "unknown";
}

function normalizeWindowsAuthenticodeSignature(
  payload: WindowsAuthenticodeSignaturePayload,
  expectedSignerSubject?: string | null,
): WindowsMsiSigningStatus {
  const signerSubject = normalizeOptionalString(payload.signerSubject) ?? null;
  const timestampSubject = normalizeOptionalString(payload.timestampSubject) ?? null;
  const signed = signerSubject !== null;
  const expected = normalizeOptionalString(expectedSignerSubject)?.toLowerCase() ?? null;
  const expectedSignerMatched =
    expected === null ? null : (signerSubject?.toLowerCase().includes(expected) ?? false);
  const status = normalizeOptionalString(payload.status) ?? "UnknownError";
  const validSignature = status === "Valid";
  return {
    status,
    statusMessage: normalizeOptionalString(payload.statusMessage) ?? null,
    signed,
    verified: validSignature && signed && expectedSignerMatched !== false,
    signerSubject,
    expectedSignerMatched,
    timestampSubject,
    timestampStatus: resolveWindowsTimestampStatus({ signed, timestampSubject }),
  };
}

function resolveInstallRootVersion(params: { version?: string; rootDir: string }): Promise<string> {
  if (params.version?.trim()) {
    return Promise.resolve(params.version.trim());
  }
  return readPackageVersion(params.rootDir);
}

function resolveWindowsMsiPackageVersion(version: string): string {
  const parsed = parseComparableSemver(version, { normalizeLegacyDotBeta: true });
  const numericSegments =
    version
      .match(/\d+/g)
      ?.map((segment) => Number.parseInt(segment, 10))
      .filter(Number.isFinite) ?? [];

  const rawMajor = parsed?.major ?? numericSegments[0] ?? 0;
  const rawMinor = parsed?.minor ?? numericSegments[1] ?? 0;
  const rawPatch = parsed?.patch ?? numericSegments[2] ?? 0;
  const major =
    rawMajor < 256
      ? rawMajor
      : rawMajor >= 2000 && rawMajor - 2000 < 256
        ? rawMajor - 2000
        : rawMajor % 256;
  const minor = Math.min(Math.max(rawMinor, 0), 255);
  const patch = Math.min(Math.max(rawPatch, 0), 65_535);
  return `${major}.${minor}.${patch}`;
}

function resolveCommandSuccess(result: CliCommandResult): boolean {
  return result.code === 0;
}

function resolveWindowsMsiReleaseChannel(version: string): WindowsMsiReleaseChannel {
  const normalizedVersion = version.trim().toLowerCase();
  const parsed = parseComparableSemver(version, { normalizeLegacyDotBeta: true });
  const prereleaseHead = parsed?.prerelease?.[0]?.toLowerCase() ?? "";
  if (normalizedVersion.includes("-dev")) {
    return "dev";
  }
  if (!prereleaseHead) {
    return "stable";
  }
  if (prereleaseHead.includes("beta")) {
    return "beta";
  }
  return "stable";
}

function parseWindowsMsiAssetVersion(assetName: string): string | null {
  const match = /^OpenClaw-(.+)-windows-x64\.msi$/i.exec(assetName.trim());
  return match?.[1]?.trim() ?? null;
}

function releaseMatchesChannel(params: {
  release: GitHubReleasePayload;
  releaseChannel: WindowsMsiReleaseChannel;
  version: string;
}): boolean {
  const tag = normalizeOptionalString(params.release.tag_name)?.toLowerCase() ?? "";
  const inferred = resolveWindowsMsiReleaseChannel(params.version);
  if (params.releaseChannel === "stable") {
    return params.release.prerelease !== true && inferred === "stable";
  }
  if (params.releaseChannel === "beta") {
    return params.release.prerelease === true && (inferred === "beta" || tag.includes("beta"));
  }
  return params.release.prerelease === true && inferred === "dev";
}

async function fetchWindowsMsiReleaseFeed(
  params: {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<GitHubReleasePayload[]> {
  const fetchImpl = params.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (typeof fetchImpl !== "function") {
    throw new Error("Global fetch is unavailable; cannot resolve Windows MSI releases.");
  }
  const response = await fetchWithTimeout(
    WINDOWS_MSI_RELEASES_API_URL,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": WINDOWS_MSI_RELEASE_USER_AGENT,
      },
    },
    params.timeoutMs ?? WINDOWS_MSI_RELEASE_TIMEOUT_MS,
    fetchImpl,
  );
  if (!response.ok) {
    throw new Error(`GitHub Releases lookup failed (${response.status}).`);
  }
  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("GitHub Releases lookup returned an unexpected payload.");
  }
  return payload as GitHubReleasePayload[];
}

function resolveWindowsMsiReleaseArtifactFromFeed(params: {
  releases: GitHubReleasePayload[];
  releaseChannel: WindowsMsiReleaseChannel;
  version?: string | null;
}): WindowsMsiReleaseArtifact | null {
  for (const release of params.releases) {
    if (release.draft === true) {
      continue;
    }
    for (const asset of release.assets ?? []) {
      const assetName = normalizeOptionalString(asset.name);
      const downloadUrl = normalizeOptionalString(asset.browser_download_url);
      if (!assetName || !downloadUrl) {
        continue;
      }
      const version = parseWindowsMsiAssetVersion(assetName);
      if (!version) {
        continue;
      }
      if (!releaseMatchesChannel({ release, releaseChannel: params.releaseChannel, version })) {
        continue;
      }
      if (params.version && version !== params.version) {
        continue;
      }
      return {
        assetName,
        downloadUrl,
        releaseUrl: normalizeOptionalString(release.html_url) ?? null,
        tagName: normalizeOptionalString(release.tag_name) ?? assetName,
        version,
        releaseChannel: params.releaseChannel,
        prerelease: release.prerelease === true,
        publishedAt: normalizeOptionalString(release.published_at) ?? null,
        releaseNotes: normalizeOptionalString(release.body) ?? null,
      };
    }
  }
  return null;
}

async function downloadWindowsMsiReleaseArtifact(params: {
  artifact: WindowsMsiReleaseArtifact;
  outDir?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const fetchImpl = params.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (typeof fetchImpl !== "function") {
    throw new Error("Global fetch is unavailable; cannot download the Windows MSI artifact.");
  }
  const outDir = params.outDir ?? path.join(os.tmpdir(), "openclaw-windows-msi-downloads");
  await fs.mkdir(outDir, { recursive: true });
  const artifactPath = path.join(outDir, params.artifact.assetName);
  const response = await fetchWithTimeout(
    params.artifact.downloadUrl,
    {
      headers: {
        Accept: "application/octet-stream",
        "User-Agent": WINDOWS_MSI_RELEASE_USER_AGENT,
      },
    },
    params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS,
    fetchImpl,
  );
  if (!response.ok) {
    throw new Error(
      `Failed to download Windows MSI artifact (${response.status}) from ${params.artifact.downloadUrl}.`,
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(artifactPath, bytes);
  return artifactPath;
}

async function sha256File(filePath: string): Promise<string> {
  const payload = await fs.readFile(filePath);
  return createHash("sha256").update(payload).digest("hex").toUpperCase();
}

function resolveWindowsWingetManifestRoot(version: string): string {
  const segments = WINDOWS_WINGET_PACKAGE_IDENTIFIER.split(".");
  const first = segments[0]?.[0]?.toLowerCase() ?? "o";
  return path.join("manifests", first, ...segments, version);
}

function sanitizeReleaseNotes(value: string | null): string | null {
  const trimmed = normalizeOptionalString(value);
  if (!trimmed) {
    return null;
  }
  return trimmed.length > 10_000 ? `${trimmed.slice(0, 10_000)}…` : trimmed;
}

function renderWindowsWingetVersionManifest(params: {
  packageIdentifier: string;
  packageVersion: string;
}): string {
  return YAML.stringify({
    PackageIdentifier: params.packageIdentifier,
    PackageVersion: params.packageVersion,
    DefaultLocale: WINDOWS_WINGET_DEFAULT_LOCALE,
    ManifestType: "version",
    ManifestVersion: WINDOWS_WINGET_MANIFEST_VERSION,
  });
}

function renderWindowsWingetDefaultLocaleManifest(metadata: WindowsWingetReleaseMetadata): string {
  const payload: Record<string, unknown> = {
    PackageIdentifier: metadata.packageIdentifier,
    PackageVersion: metadata.packageVersion,
    PackageLocale: WINDOWS_WINGET_DEFAULT_LOCALE,
    Publisher: metadata.publisher,
    PublisherUrl: metadata.publisherUrl,
    PublisherSupportUrl: metadata.publisherSupportUrl,
    PackageName: metadata.packageName,
    PackageUrl: metadata.packageUrl,
    License: metadata.license,
    LicenseUrl: metadata.licenseUrl,
    ShortDescription: metadata.shortDescription,
    Moniker: metadata.moniker,
    ReleaseNotesUrl: metadata.releaseUrl,
    ManifestType: "defaultLocale",
    ManifestVersion: WINDOWS_WINGET_MANIFEST_VERSION,
  };
  if (metadata.releaseNotes) {
    payload.ReleaseNotes = metadata.releaseNotes;
  }
  return YAML.stringify(payload);
}

function renderWindowsWingetInstallerManifest(metadata: WindowsWingetReleaseMetadata): string {
  return YAML.stringify({
    PackageIdentifier: metadata.packageIdentifier,
    PackageVersion: metadata.packageVersion,
    InstallerType: metadata.installerType,
    Scope: metadata.scope,
    UpgradeBehavior: "install",
    Installers: [
      {
        Architecture: WINDOWS_MSI_ARCH,
        InstallerUrl: metadata.artifactUrl,
        InstallerSha256: metadata.artifactSha256,
        InstallerType: metadata.installerType,
        Scope: metadata.scope,
        AppsAndFeaturesEntries: [
          {
            DisplayName: WINDOWS_MSI_PRODUCT_NAME,
            UpgradeCode: WINDOWS_MSI_UPGRADE_CODE,
          },
        ],
      },
    ],
    ManifestType: "installer",
    ManifestVersion: WINDOWS_WINGET_MANIFEST_VERSION,
  });
}

function resolveRepairHint(params: {
  gatewayOk: boolean;
  companionAttempted: boolean;
  companionOk: boolean;
}): string | null {
  if (!params.gatewayOk) {
    return "openclaw gateway install --force";
  }
  if (params.companionAttempted && !params.companionOk) {
    return "openclaw windows-companion install --force";
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveInstalledCliEntrypoint(installRoot: string): Promise<string> {
  const candidates = [
    path.join(installRoot, "dist", "entry.js"),
    path.join(installRoot, "dist", "entry.mjs"),
    path.join(installRoot, "openclaw.mjs"),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // keep going
    }
  }
  throw new Error(`Cannot find installed OpenClaw CLI entry in ${candidates.join(" or ")}.`);
}

async function runInstalledCliCommand(params: {
  installRoot: string;
  env: NodeJS.ProcessEnv;
  args: string[];
  timeoutMs?: number;
}): Promise<CliCommandResult> {
  const entrypoint = await resolveInstalledCliEntrypoint(params.installRoot);
  const result = await runCommandWithTimeout([process.execPath, entrypoint, ...params.args], {
    cwd: params.installRoot,
    env: params.env,
    timeoutMs: params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS,
  });
  return {
    code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function runInstalledCliJsonCommand(params: {
  installRoot: string;
  env: NodeJS.ProcessEnv;
  args: string[];
  timeoutMs?: number;
}): Promise<{ ok: boolean; parsed: Record<string, unknown> | null; command: CliCommandResult }> {
  const command = await runInstalledCliCommand(params);
  if (command.code !== 0) {
    return { ok: false, parsed: null, command };
  }
  try {
    return {
      ok: true,
      parsed: JSON.parse(command.stdout) as Record<string, unknown>,
      command,
    };
  } catch {
    return { ok: false, parsed: null, command };
  }
}

async function stopAndUninstallGatewayManagedHost(
  env: NodeJS.ProcessEnv,
): Promise<{ removed: boolean }> {
  const service = resolveGatewayService();
  const state = await readGatewayServiceState(service, { env }).catch(() => ({
    installed: false,
    loaded: false,
    running: false,
    env,
    command: null,
    runtime: undefined,
  }));
  if (!state.installed) {
    return { removed: false };
  }
  if (state.loaded) {
    await service.stop({ env: state.env, stdout: process.stdout }).catch(() => undefined);
  }
  await service.uninstall({ env: state.env, stdout: process.stdout });
  return { removed: true };
}

function normalizeManifest(
  manifest: Partial<WindowsInstallerManifest> | null,
): WindowsInstallerManifest | null {
  if (!manifest || manifest.installMode !== "msi") {
    return null;
  }
  const installRoot = normalizeOptionalString(manifest.installRoot);
  const productVersion = normalizeOptionalString(manifest.productVersion);
  if (!installRoot || !productVersion) {
    return null;
  }
  return {
    version: 1,
    installMode: "msi",
    productName: normalizeOptionalString(manifest.productName) ?? WINDOWS_MSI_PRODUCT_NAME,
    productVersion,
    architecture: WINDOWS_MSI_ARCH,
    installRoot,
    installedAt: normalizeOptionalString(manifest.installedAt) ?? new Date(0).toISOString(),
    updatedAt: normalizeOptionalString(manifest.updatedAt) ?? new Date(0).toISOString(),
    companionEnabled: manifest.companionEnabled !== false,
    gatewayBootstrapSucceeded: manifest.gatewayBootstrapSucceeded !== false,
    companionBootstrapSucceeded: manifest.companionBootstrapSucceeded !== false,
    companionInstallMode:
      manifest.companionInstallMode === "schtasks" ||
      manifest.companionInstallMode === "startup_folder"
        ? manifest.companionInstallMode
        : null,
    companionSupervisorLabel: normalizeOptionalString(manifest.companionSupervisorLabel) ?? null,
    repairHint: normalizeOptionalString(manifest.repairHint) ?? null,
  };
}

export function resolveWindowsInstallerManifestPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), WINDOWS_MSI_MANIFEST_FILE);
}

export async function loadWindowsInstallerManifest(
  env: NodeJS.ProcessEnv = process.env,
): Promise<WindowsInstallerManifest | null> {
  const parsed = await readJsonFile<Partial<WindowsInstallerManifest>>(
    resolveWindowsInstallerManifestPath(env),
  );
  return normalizeManifest(parsed);
}

export async function saveWindowsInstallerManifest(
  manifest: WindowsInstallerManifest,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  await writeJsonAtomic(resolveWindowsInstallerManifestPath(env), manifest, {
    mode: 0o600,
    trailingNewline: true,
  });
}

export async function removeWindowsInstallerManifest(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  await fs.rm(resolveWindowsInstallerManifestPath(env), { force: true });
}

function buildRepairHints(params: {
  manifest: WindowsInstallerManifest | null;
  companionStatus: WindowsCompanionInstallerStatus;
  gatewayInstalled: boolean;
}): string[] {
  const hints = new Set<string>();
  if (params.manifest?.installMode === "msi") {
    if (!params.gatewayInstalled) {
      hints.add("openclaw gateway install --force");
    }
    if (params.manifest.companionEnabled && !params.companionStatus.installed) {
      hints.add("openclaw windows-companion install --force");
    }
    if (params.manifest.repairHint) {
      hints.add(params.manifest.repairHint);
    }
  }
  return [...hints];
}

export async function resolveWindowsInstallerBootstrapStatus(
  params: {
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<WindowsInstallerBootstrapStatus> {
  const env = params.env ?? process.env;
  const manifest = await loadWindowsInstallerManifest(env).catch(() => null);
  const service = resolveGatewayService();
  const gatewayState = await readGatewayServiceState(service, { env }).catch(() => ({
    installed: false,
    loaded: false,
    running: false,
    env,
    command: null,
    runtime: undefined,
  }));
  const companionStatus = await resolveWindowsCompanionInstallerStatus({ env }).catch(() => ({
    selected: false,
    configured: false,
    installed: false,
    loaded: false,
    running: false,
    installMode: null,
    profile: null,
    supervisorLabel: null,
    config: null,
  }));
  const repairHints = buildRepairHints({
    manifest,
    companionStatus,
    gatewayInstalled: gatewayState.installed,
  });
  const partialFailure = repairHints.length > 0;
  return {
    manifest,
    manifestPresent: manifest !== null,
    gatewayInstalled: gatewayState.installed,
    gatewayLoaded: gatewayState.loaded,
    gatewayRunning: gatewayState.running,
    companionConfigured: companionStatus.configured,
    companionInstalled: companionStatus.installed,
    companionRunning: companionStatus.running,
    companionInstallMode: companionStatus.installMode,
    companionSupervisorLabel: companionStatus.supervisorLabel,
    partialFailure,
    repairHints,
  };
}

export async function resolveWindowsInstalledProductStatus(
  params: {
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
  } = {},
): Promise<WindowsInstalledProductStatus> {
  const env = params.env ?? process.env;
  const bootstrapStatus = await resolveWindowsInstallerBootstrapStatus({ env });
  const installRoot = bootstrapStatus.manifest?.installRoot ?? null;
  if (!installRoot) {
    return {
      manifest: bootstrapStatus.manifest,
      bootstrapStatus,
      gatewayStatus: null,
      companionStatus: null,
      gatewayStatusCommand: null,
      companionStatusCommand: null,
      gatewayStatusCommandOk: false,
      companionStatusCommandOk: false,
      companionPresenceDetected: false,
      installRoot: null,
    };
  }
  const [gatewayStatusCommand, companionStatusCommand] = await Promise.all([
    runInstalledCliJsonCommand({
      installRoot,
      env,
      args: ["gateway", "status", "--deep", "--json"],
      timeoutMs: params.timeoutMs,
    }).catch(() => ({
      ok: false,
      parsed: null,
      command: { code: null, stdout: "", stderr: "" },
    })),
    runInstalledCliJsonCommand({
      installRoot,
      env,
      args: ["windows-companion", "status", "--json"],
      timeoutMs: params.timeoutMs,
    }).catch(() => ({
      ok: false,
      parsed: null,
      command: { code: null, stdout: "", stderr: "" },
    })),
  ]);
  const companionPresence = detectCompanionPresence({
    gatewayStatus: gatewayStatusCommand.parsed,
    companionStatus: companionStatusCommand.parsed,
  });
  return {
    manifest: bootstrapStatus.manifest,
    bootstrapStatus,
    gatewayStatus: gatewayStatusCommand.parsed,
    companionStatus: companionStatusCommand.parsed,
    gatewayStatusCommand: gatewayStatusCommand.command,
    companionStatusCommand: companionStatusCommand.command,
    gatewayStatusCommandOk: gatewayStatusCommand.ok,
    companionStatusCommandOk: companionStatusCommand.ok,
    companionPresenceDetected: companionPresence.detected,
    installRoot,
  };
}

export async function resolveWindowsInstalledReleaseBaseline(
  params: {
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<WindowsInstalledReleaseBaseline | null> {
  const bootstrapStatus = await resolveWindowsInstallerBootstrapStatus({
    env: params.env,
  });
  const manifest = bootstrapStatus.manifest;
  if (!manifest) {
    return null;
  }
  const needsRepair =
    bootstrapStatus.partialFailure ||
    !bootstrapStatus.gatewayInstalled ||
    (manifest.companionEnabled && !bootstrapStatus.companionInstalled);
  return {
    manifest,
    bootstrapStatus,
    installRoot: manifest.installRoot,
    installedVersion: manifest.productVersion,
    releaseChannel: resolveWindowsMsiReleaseChannel(manifest.productVersion),
    installedAt: manifest.installedAt,
    updatedAt: manifest.updatedAt,
    needsRepair,
    repairHints: [...bootstrapStatus.repairHints],
  };
}

export async function resolveWindowsMsiAvailableUpdate(
  params: {
    baseline?: WindowsInstalledReleaseBaseline | null;
    releaseChannel?: WindowsMsiReleaseChannel;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<WindowsMsiAvailableUpdate> {
  const baseline =
    params.baseline === undefined
      ? await resolveWindowsInstalledReleaseBaseline()
      : params.baseline;
  const releaseChannel = params.releaseChannel ?? baseline?.releaseChannel ?? "stable";
  const releases = await fetchWindowsMsiReleaseFeed({
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
  const latest = resolveWindowsMsiReleaseArtifactFromFeed({
    releases,
    releaseChannel,
  });
  if (!latest) {
    return {
      baseline,
      latest: null,
      status: baseline?.needsRepair ? "repair-needed" : "unavailable",
      comparison: null,
      reason: `No signed Windows MSI release was found for channel ${releaseChannel}.`,
    };
  }
  const comparison = baseline
    ? compareComparableSemver(
        parseComparableSemver(baseline.installedVersion, { normalizeLegacyDotBeta: true }),
        parseComparableSemver(latest.version, { normalizeLegacyDotBeta: true }),
      )
    : null;
  if (baseline?.needsRepair) {
    return {
      baseline,
      latest,
      status: "repair-needed",
      comparison,
      reason: "The installed Windows MSI baseline is damaged and should be repaired.",
    };
  }
  if (comparison !== null && comparison >= 0) {
    return {
      baseline,
      latest,
      status: "up-to-date",
      comparison,
      reason: null,
    };
  }
  return {
    baseline,
    latest,
    status: "upgrade-available",
    comparison,
    reason: null,
  };
}

export async function runWindowsMsiUpgrade(
  params: {
    baseline?: WindowsInstalledReleaseBaseline | null;
    releaseChannel?: WindowsMsiReleaseChannel;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    downloadDir?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<WindowsMsiUpgradeResult> {
  const update = await resolveWindowsMsiAvailableUpdate({
    baseline: params.baseline,
    releaseChannel: params.releaseChannel,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
  if (update.status === "repair-needed") {
    throw new Error(update.reason ?? "The installed Windows MSI baseline needs repair.");
  }
  if (update.status !== "upgrade-available" || !update.latest) {
    return {
      performed: false,
      artifactPath: null,
      phaseResult: null,
      update,
    };
  }
  const artifactPath = await downloadWindowsMsiReleaseArtifact({
    artifact: update.latest,
    outDir: params.downloadDir,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
  const phaseResult = await runWindowsMsiSmokeInstall({
    artifactPath,
    env: params.env,
    timeoutMs: params.timeoutMs,
  });
  return {
    performed: true,
    artifactPath,
    phaseResult,
    update,
  };
}

export async function runWindowsMsiRepair(
  params: {
    baseline?: WindowsInstalledReleaseBaseline | null;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    downloadDir?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<WindowsMsiRepairResult> {
  const baseline =
    params.baseline === undefined
      ? await resolveWindowsInstalledReleaseBaseline({ env: params.env })
      : params.baseline;
  if (!baseline) {
    throw new Error("No installed Windows MSI baseline was found.");
  }
  const releases = await fetchWindowsMsiReleaseFeed({
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
  const exactArtifact = resolveWindowsMsiReleaseArtifactFromFeed({
    releases,
    releaseChannel: baseline.releaseChannel,
    version: baseline.installedVersion,
  });
  const artifact =
    exactArtifact ??
    resolveWindowsMsiReleaseArtifactFromFeed({
      releases,
      releaseChannel: baseline.releaseChannel,
    });
  if (!artifact) {
    throw new Error(
      `No signed Windows MSI artifact was found for repair on channel ${baseline.releaseChannel}.`,
    );
  }
  const artifactPath = await downloadWindowsMsiReleaseArtifact({
    artifact,
    outDir: params.downloadDir,
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
  const phaseResult = await runWindowsMsiSmokeRepair({
    artifactPath,
    env: params.env,
    timeoutMs: params.timeoutMs,
  });
  return {
    performed: true,
    artifactPath,
    phaseResult,
    baseline,
    artifact,
    exactVersionMatch: artifact.version === baseline.installedVersion,
  };
}

function resolveWindowsMsiLogPath(params: {
  artifactPath: string;
  phase: WindowsMsiSmokePhase;
  logPath?: string;
}): string {
  if (params.logPath?.trim()) {
    return path.resolve(params.logPath);
  }
  const artifactStem = path.basename(params.artifactPath, path.extname(params.artifactPath));
  return path.join(os.tmpdir(), `${artifactStem}-${params.phase}.log`);
}

async function readWindowsMsiLogTail(params: {
  logPath: string;
  maxLines?: number;
}): Promise<string | null> {
  try {
    const raw = await fs.readFile(params.logPath);
    const normalized = decodeWindowsMsiLogBuffer(raw).trim();
    if (!normalized) {
      return null;
    }
    return extractWindowsMsiDiagnosticExcerpt(normalized, {
      maxLines: params.maxLines ?? 80,
    });
  } catch {
    return null;
  }
}

async function readWindowsMsiLogText(logPath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(logPath);
    const normalized = decodeWindowsMsiLogBuffer(raw).trim();
    return normalized || null;
  } catch {
    return null;
  }
}

function decodeWindowsMsiLogBuffer(buffer: Buffer): string {
  if (buffer.length === 0) {
    return "";
  }
  const hasUtf16LeBom = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe;
  let text: string;
  if (hasUtf16LeBom) {
    text = buffer.subarray(2).toString("utf16le");
  } else {
    let zeroOddBytes = 0;
    for (let index = 1; index < buffer.length; index += 2) {
      if (buffer[index] === 0) {
        zeroOddBytes += 1;
      }
    }
    const oddBytePairs = Math.floor(buffer.length / 2);
    const looksUtf16Le = oddBytePairs > 0 && zeroOddBytes / oddBytePairs > 0.35;
    text = looksUtf16Le ? buffer.toString("utf16le") : buffer.toString("utf8");
  }
  return text.replaceAll("\u0000", "").replace(/\r\n/g, "\n");
}

function extractWindowsMsiDiagnosticExcerpt(
  text: string,
  options: { maxLines?: number } = {},
): string {
  const maxLines = Math.max(1, options.maxLines ?? 80);
  const lines = text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, index, values) => !(line === "" && values[index - 1] === ""));
  const anchorPatterns = [
    /Return value 3/i,
    /CustomAction/i,
    /Action (start|ended)/i,
    /WixQuietExec/i,
    /RunPostInstallBootstrap/i,
    /RunPostUninstallCleanup/i,
    /bootstrap-runtime/i,
    /Product:\s*OpenClaw\s*--\s*Installation failed/i,
    /MainEngineThread is returning 1603/i,
  ];
  let anchorIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (anchorPatterns.some((pattern) => pattern.test(lines[index] ?? ""))) {
      anchorIndex = index;
      break;
    }
  }
  if (anchorIndex === -1) {
    return lines.slice(-maxLines).join("\n");
  }
  const contextBefore = Math.min(Math.floor(maxLines / 3), anchorIndex);
  const remaining = Math.max(0, maxLines - contextBefore - 1);
  const start = Math.max(0, anchorIndex - contextBefore);
  const end = Math.min(lines.length, anchorIndex + remaining + 1);
  return lines.slice(start, end).join("\n");
}

function windowsMsiUninstallLooksSuccessful(logText: string | null): boolean {
  if (!logText) {
    return false;
  }
  return (
    /Windows Installer removed the product\./i.test(logText) &&
    /Removal success or error status:\s*1603\./i.test(logText)
  );
}

async function runWindowsMsiSmokePhase(params: {
  phase: WindowsMsiSmokePhase;
  artifactPath: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  logPath?: string;
  retryAttempts?: number;
  retryDelayMs?: number;
}): Promise<WindowsMsiSmokePhaseResult> {
  const env = { ...process.env, ...params.env };
  const artifactPath = path.resolve(params.artifactPath);
  const logPath = resolveWindowsMsiLogPath({
    artifactPath,
    phase: params.phase,
    logPath: params.logPath,
  });
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const msiexecArgs =
    params.phase === "install"
      ? ["/i", artifactPath]
      : params.phase === "repair"
        ? ["/fa", artifactPath]
        : ["/x", artifactPath];
  const msiexec = await runCommandWithTimeout(
    ["msiexec", ...msiexecArgs, "/qn", "/norestart", "/l*v", logPath],
    {
      env,
      timeoutMs: params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS,
    },
  );
  if (msiexec.code !== 0) {
    const logText = await readWindowsMsiLogText(logPath);
    const logTail = logText ? extractWindowsMsiDiagnosticExcerpt(logText, { maxLines: 80 }) : null;
    if (params.phase === "uninstall" && windowsMsiUninstallLooksSuccessful(logText)) {
      // Some Windows runner uninstall passes still bubble up 1603 after the product
      // has already been removed. Fall through to residual state checks before failing.
    } else {
      throw new Error(
        `Windows MSI ${params.phase} failed with code ${String(msiexec.code)}. Log: ${logPath}` +
          (logTail ? `\n--- MSI log tail ---\n${logTail}` : ""),
      );
    }
  }

  if (params.phase === "uninstall") {
    const installedProduct = await resolveWindowsInstalledProductStatus({
      env,
      timeoutMs: params.timeoutMs,
    });
    return {
      phase: params.phase,
      artifactPath,
      logPath,
      msiexec,
      installedProduct,
    };
  }

  const retryAttempts = Math.max(1, params.retryAttempts ?? 10);
  const retryDelayMs = Math.max(0, params.retryDelayMs ?? 2_000);
  let installedProduct: WindowsInstalledProductStatus | null = null;
  for (let attempt = 0; attempt < retryAttempts; attempt += 1) {
    installedProduct = await resolveWindowsInstalledProductStatus({
      env,
      timeoutMs: params.timeoutMs,
    });
    const companionInstallMode = installedProduct.bootstrapStatus.companionInstallMode;
    const installReady =
      installedProduct.manifest !== null &&
      installedProduct.bootstrapStatus.gatewayInstalled &&
      installedProduct.bootstrapStatus.companionInstalled &&
      (companionInstallMode === "schtasks" || companionInstallMode === "startup_folder") &&
      installedProduct.gatewayStatusCommandOk &&
      installedProduct.companionStatusCommandOk &&
      installedProduct.companionPresenceDetected;
    if (installReady) {
      return {
        phase: params.phase,
        artifactPath,
        logPath,
        msiexec,
        installedProduct,
      };
    }
    if (attempt < retryAttempts - 1) {
      await sleep(retryDelayMs);
    }
  }
  const logTail = await readWindowsMsiLogTail({ logPath });
  const installedProductSummary = summarizeWindowsInstalledProductStatus(installedProduct);
  throw new Error(
    `Windows MSI ${params.phase} verification failed. Log: ${logPath}` +
      (installedProductSummary
        ? `\n--- Installed product snapshot ---\n${JSON.stringify(installedProductSummary, null, 2)}`
        : "") +
      (logTail ? `\n--- MSI log tail ---\n${logTail}` : ""),
  );
}

export async function runWindowsPostInstallBootstrap(params: {
  installRoot: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  companionEnabled?: boolean;
  productVersion?: string;
  productName?: string;
}): Promise<WindowsInstallerBootstrapResult> {
  const env = { ...process.env, ...params.env };
  const companionEnabled = params.companionEnabled !== false;
  const gatewayResult = await runInstalledCliCommand({
    installRoot: params.installRoot,
    env,
    args: ["gateway", "install", "--force", "--json"],
    timeoutMs: params.timeoutMs,
  });

  let companionResult: WindowsInstallerBootstrapResult["companion"] = {
    attempted: false,
    ok: false,
    skipped: true,
    code: null,
    stdout: "",
    stderr: "",
  };
  if (resolveCommandSuccess(gatewayResult) && companionEnabled) {
    const result = await runInstalledCliCommand({
      installRoot: params.installRoot,
      env,
      args: ["windows-companion", "install", "--force", "--json"],
      timeoutMs: params.timeoutMs,
    });
    companionResult = {
      attempted: true,
      ok: resolveCommandSuccess(result),
      skipped: false,
      code: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  const companionStatus = companionEnabled
    ? await resolveWindowsCompanionInstallerStatus({ env }).catch(() => null)
    : null;
  const manifest = normalizeManifest({
    installMode: "msi",
    productName: params.productName ?? WINDOWS_MSI_PRODUCT_NAME,
    productVersion:
      params.productVersion ??
      (await resolveInstallRootVersion({
        rootDir: params.installRoot,
      })),
    architecture: WINDOWS_MSI_ARCH,
    installRoot: params.installRoot,
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    companionEnabled,
    gatewayBootstrapSucceeded: resolveCommandSuccess(gatewayResult),
    companionBootstrapSucceeded: companionEnabled ? companionResult.ok : true,
    companionInstallMode: companionStatus?.installMode ?? null,
    companionSupervisorLabel: companionStatus?.supervisorLabel ?? null,
    repairHint: resolveRepairHint({
      gatewayOk: resolveCommandSuccess(gatewayResult),
      companionAttempted: companionResult.attempted,
      companionOk: companionResult.ok,
    }),
  });

  if (!manifest) {
    throw new Error("Failed to normalize Windows installer manifest.");
  }
  await saveWindowsInstallerManifest(manifest, env);
  const status = await resolveWindowsInstallerBootstrapStatus({ env });
  return {
    gateway: {
      ok: resolveCommandSuccess(gatewayResult),
      code: gatewayResult.code,
      stdout: gatewayResult.stdout,
      stderr: gatewayResult.stderr,
    },
    companion: companionResult,
    manifest,
    status,
  };
}

export async function runWindowsPostUninstallCleanup(
  params: {
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<WindowsInstallerCleanupResult> {
  const env = { ...process.env, ...params.env };
  const companion = await uninstallWindowsCompanionFromInstaller({
    env,
    stdout: process.stdout,
  }).catch(() => ({ removed: false }));
  const gateway = await stopAndUninstallGatewayManagedHost(env).catch(() => ({ removed: false }));
  await removeWindowsInstallerManifest(env).catch(() => undefined);
  return {
    gatewayRemoved: gateway.removed,
    companionRemoved: Boolean(companion.removed),
    manifestRemoved: true,
  };
}

function buildNodePathClause(): string {
  return [
    "$node = $null",
    "try { $cmd = Get-Command node -ErrorAction Stop; $node = $cmd.Source } catch { }",
    "if (-not $node) {",
    "  Write-Error 'Node.js 22.14+ or Node 24 is required for the OpenClaw MSI bootstrap runtime.'",
    "  exit 2",
    "}",
  ].join("\n");
}

export function renderWindowsInstallerBootstrapScript(params: {
  installRoot: string;
  productVersion: string;
}): string {
  const installRoot = params.installRoot.replaceAll("'", "''");
  const productVersion = params.productVersion.replaceAll("'", "''");
  return [
    "param(",
    "  [Parameter(Mandatory = $true)][ValidateSet('install', 'uninstall')]",
    "  [string]$Mode",
    ")",
    "$ErrorActionPreference = 'Stop'",
    `$installRoot = '${installRoot}'`,
    `$productVersion = '${productVersion}'`,
    '$bootstrapLog = Join-Path ([System.IO.Path]::GetTempPath()) ("OpenClaw-bootstrap-" + $Mode + ".log")',
    "function Write-BootstrapLog([string]$Message) {",
    "  $line = \"[$((Get-Date).ToString('o'))] $Message\"",
    "  Add-Content -Path $bootstrapLog -Value $line -Encoding utf8",
    "  Write-Host $line",
    "}",
    "Set-Content -Path $bootstrapLog -Value \"[$((Get-Date).ToString('o'))] bootstrap mode=$Mode installRoot=$installRoot productVersion=$productVersion\" -Encoding utf8",
    buildNodePathClause(),
    "$runtime = Join-Path $installRoot 'dist\\windows-installer\\bootstrap-runtime.js'",
    "if (-not (Test-Path $runtime)) {",
    '  Write-BootstrapLog "Missing bootstrap runtime: $runtime"',
    '  Write-Error "Missing bootstrap runtime: $runtime (bootstrap log: $bootstrapLog)"',
    "  exit 3",
    "}",
    'Write-BootstrapLog "Using node: $node"',
    'Write-BootstrapLog "Using runtime: $runtime"',
    "try {",
    "  & $node $runtime $Mode --install-root $installRoot --product-version $productVersion --result-log-path $bootstrapLog *>&1 | Tee-Object -FilePath $bootstrapLog -Append",
    "  $exitCode = if ($null -ne $LASTEXITCODE) { [int]$LASTEXITCODE } else { 0 }",
    '  Write-BootstrapLog "bootstrap runtime exited with code $exitCode"',
    "  exit $exitCode",
    "} catch {",
    "  $message = ($_ | Out-String).Trim()",
    "  if ($message) {",
    '    Write-BootstrapLog "bootstrap runtime threw: $message"',
    '    Write-Error "$message (bootstrap log: $bootstrapLog)"',
    "  } else {",
    '    Write-BootstrapLog "bootstrap runtime threw an unknown error"',
    '    Write-Error "Bootstrap runtime failed unexpectedly (bootstrap log: $bootstrapLog)"',
    "  }",
    "  exit 90",
    "}",
    "",
  ].join("\n");
}

function createDirectoryTree(entries: WxsFileEntry[]): DirectoryNode {
  const root: DirectoryNode = { name: "", children: new Map(), files: [] };
  for (const entry of entries) {
    const parts = entry.relativePath.split(/[\\/]/).filter(Boolean);
    let node = root;
    for (const segment of parts.slice(0, -1)) {
      let child = node.children.get(segment);
      if (!child) {
        child = { name: segment, children: new Map(), files: [] };
        node.children.set(segment, child);
      }
      node = child;
    }
    node.files.push(entry);
  }
  return root;
}

function renderDirectoryNode(node: DirectoryNode, parentId: string, prefix = ""): string {
  const lines: string[] = [];
  const childEntries = [...node.children.entries()].toSorted((left, right) =>
    left[0].localeCompare(right[0]),
  );
  for (const [name, child] of childEntries) {
    const dirId = sanitizeId(`${prefix}${name}`, "Dir_");
    lines.push(
      `${"  ".repeat(prefix.split("/").length + 2)}<Directory Id="${dirId}" Name="${xmlEscape(name)}">`,
    );
    lines.push(renderDirectoryNode(child, dirId, `${prefix}${name}/`));
    lines.push(`${"  ".repeat(prefix.split("/").length + 2)}</Directory>`);
  }
  const fileIndent = "  ".repeat(prefix.split("/").length + 2);
  for (const entry of [...node.files].toSorted((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  )) {
    const componentId = sanitizeId(entry.relativePath, "Cmp_");
    const fileId = sanitizeId(entry.relativePath, "Fil_");
    lines.push(`${fileIndent}<Component Id="${componentId}" Guid="*">`);
    lines.push(
      `${fileIndent}  <File Id="${fileId}" Source="${xmlEscape(entry.sourcePath)}" KeyPath="yes" />`,
    );
    lines.push(`${fileIndent}</Component>`);
  }
  return lines.join("\n");
}

function renderDirectoryFragment(entries: WxsFileEntry[]): string {
  const tree = createDirectoryTree(entries);
  const body = renderDirectoryNode(tree, "INSTALLDIR", "");
  return [
    '    <StandardDirectory Id="LocalAppDataFolder">',
    `      <Directory Id="INSTALLDIR" Name="${WINDOWS_MSI_PRODUCT_NAME}">`,
    body,
    "      </Directory>",
    "    </StandardDirectory>",
  ].join("\n");
}

export function renderWindowsMsiSource(params: {
  version: string;
  productName?: string;
  manufacturer?: string;
  upgradeCode?: string;
  fileEntries: WxsFileEntry[];
  installRoot: string;
}): string {
  const productName = params.productName ?? WINDOWS_MSI_PRODUCT_NAME;
  const manufacturer = params.manufacturer ?? WINDOWS_MSI_PRODUCT_NAME;
  const upgradeCode = params.upgradeCode ?? WINDOWS_MSI_UPGRADE_CODE;
  const bootstrapScript = path.join(params.installRoot, "bootstrap", "msi-bootstrap.ps1");
  const packageVersion = resolveWindowsMsiPackageVersion(params.version);
  return [
    '<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">',
    `  <Package Name="${xmlEscape(productName)}" Manufacturer="${xmlEscape(manufacturer)}" Version="${xmlEscape(packageVersion)}" UpgradeCode="${xmlEscape(upgradeCode)}" Scope="perUser" InstallerVersion="500" Compressed="yes">`,
    renderDirectoryFragment(params.fileEntries),
    '    <Feature Id="MainFeature" Title="OpenClaw" Level="1">',
    '      <ComponentGroupRef Id="MainFeatureComponents" />',
    "    </Feature>",
    '    <SetProperty Id="RunPostInstallBootstrap" Action="SetRunPostInstallBootstrapCommandLine" Value="&quot;[SystemFolder]WindowsPowerShell\\v1.0\\powershell.exe&quot; -NoProfile -ExecutionPolicy Bypass -File &quot;' +
      xmlEscape(bootstrapScript) +
      '&quot; install" After="InstallFiles" Sequence="execute" Condition="NOT REMOVE~=&quot;ALL&quot;" />',
    '    <CustomAction Id="RunPostInstallBootstrap" BinaryRef="Wix4UtilCA_X86" DllEntry="WixQuietExec" Execute="deferred" Return="check" Impersonate="yes" />',
    '    <SetProperty Id="RunPostUninstallCleanup" Action="SetRunPostUninstallCleanupCommandLine" Value="&quot;[SystemFolder]WindowsPowerShell\\v1.0\\powershell.exe&quot; -NoProfile -ExecutionPolicy Bypass -File &quot;' +
      xmlEscape(bootstrapScript) +
      '&quot; uninstall" Before="RemoveFiles" Sequence="execute" Condition="REMOVE~=&quot;ALL&quot;" />',
    '    <CustomAction Id="RunPostUninstallCleanup" BinaryRef="Wix4UtilCA_X86" DllEntry="WixQuietExec" Execute="deferred" Return="ignore" Impersonate="yes" />',
    "    <InstallExecuteSequence>",
    '      <Custom Action="RunPostInstallBootstrap" After="SetRunPostInstallBootstrapCommandLine" />',
    '      <Custom Action="RunPostUninstallCleanup" After="SetRunPostUninstallCleanupCommandLine" />',
    "    </InstallExecuteSequence>",
    "  </Package>",
    "  <Fragment>",
    '    <ComponentGroup Id="MainFeatureComponents">',
    ...params.fileEntries
      .map((entry) => `      <ComponentRef Id="${sanitizeId(entry.relativePath, "Cmp_")}" />`)
      .toSorted((left, right) => left.localeCompare(right)),
    "    </ComponentGroup>",
    "  </Fragment>",
    "</Wix>",
    "",
  ].join("\n");
}

async function listFilesRecursive(rootDir: string): Promise<WxsFileEntry[]> {
  const entries: WxsFileEntry[] = [];
  async function walk(currentDir: string) {
    const dirents = await fs.readdir(currentDir, { withFileTypes: true });
    for (const dirent of dirents) {
      const nextPath = path.join(currentDir, dirent.name);
      if (dirent.isDirectory()) {
        await walk(nextPath);
        continue;
      }
      if (!dirent.isFile()) {
        continue;
      }
      entries.push({
        relativePath: path.relative(rootDir, nextPath),
        sourcePath: nextPath,
      });
    }
  }
  await walk(rootDir);
  return entries;
}

const WINDOWS_MSI_PAYLOAD_PATHS = [
  "CHANGELOG.md",
  "LICENSE",
  "README.md",
  "openclaw.mjs",
  "assets",
  "dist",
  "docs",
  "skills",
  "scripts/npm-runner.mjs",
  "scripts/postinstall-bundled-plugins.mjs",
  "scripts/windows-cmd-helpers.mjs",
] as const;

async function stageWindowsMsiPayload(params: {
  rootDir: string;
  installRoot: string;
}): Promise<void> {
  await fs.rm(params.installRoot, { recursive: true, force: true });
  await fs.mkdir(params.installRoot, { recursive: true });
  for (const relativePath of WINDOWS_MSI_PAYLOAD_PATHS) {
    const sourcePath = path.join(params.rootDir, relativePath);
    const destinationPath = path.join(params.installRoot, relativePath);
    await fs.cp(sourcePath, destinationPath, {
      recursive: true,
      force: true,
    });
  }
}

async function ensureBuiltArtifacts(rootDir: string): Promise<void> {
  const required = [
    path.join(rootDir, "dist", "index.js"),
    path.join(rootDir, "dist", "entry.js"),
    path.join(rootDir, "dist", "apps", "windows", "main.js"),
    path.join(rootDir, "dist", "windows-installer", "bootstrap-runtime.js"),
  ];
  for (const candidate of required) {
    await fs.access(candidate);
  }
}

export async function verifyWindowsMsiSignature(params: {
  artifactPath: string;
  expectedSignerSubject?: string;
  powershellBinary?: string;
  timeoutMs?: number;
}): Promise<WindowsMsiSigningStatus> {
  const artifactPath = path.resolve(params.artifactPath);
  const powershellBinary = params.powershellBinary ?? WINDOWS_MSI_DEFAULT_POWERSHELL;
  const script = [
    "$signature = Get-AuthenticodeSignature -FilePath $env:OPENCLAW_WINDOWS_MSI_PATH",
    "$payload = [ordered]@{",
    "  status = [string]$signature.Status",
    "  statusMessage = [string]$signature.StatusMessage",
    "  signerSubject = if ($signature.SignerCertificate) { [string]$signature.SignerCertificate.Subject } else { $null }",
    "  timestampSubject = if ($signature.TimeStamperCertificate) { [string]$signature.TimeStamperCertificate.Subject } else { $null }",
    "}",
    "$payload | ConvertTo-Json -Compress",
  ].join("; ");
  const result = await runCommandWithTimeout(
    [powershellBinary, "-NoLogo", "-NoProfile", "-Command", script],
    {
      env: {
        ...process.env,
        OPENCLAW_WINDOWS_MSI_PATH: artifactPath,
      },
      timeoutMs: params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS,
    },
  );
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || "Get-AuthenticodeSignature failed");
  }
  let parsed: WindowsAuthenticodeSignaturePayload;
  try {
    parsed = JSON.parse(result.stdout) as WindowsAuthenticodeSignaturePayload;
  } catch (error) {
    throw new Error(
      `Failed to parse Windows MSI signature JSON: ${String(error)}${result.stdout ? `\n${result.stdout}` : ""}`,
      { cause: error },
    );
  }
  return normalizeWindowsAuthenticodeSignature(parsed, params.expectedSignerSubject);
}

export async function signWindowsMsiArtifact(params: {
  artifactPath: string;
  pfxPath: string;
  pfxPassword: string;
  certSubject?: string;
  signtoolBinary?: string;
  timestampUrl?: string;
  timeoutMs?: number;
}): Promise<WindowsMsiSigningStatus> {
  const signtoolBinary = params.signtoolBinary ?? WINDOWS_MSI_DEFAULT_SIGNTOOL;
  const timestampUrl = params.timestampUrl ?? WINDOWS_MSI_DEFAULT_TIMESTAMP_URL;
  const argv = [
    signtoolBinary,
    "sign",
    "/fd",
    "SHA256",
    "/td",
    "SHA256",
    "/tr",
    timestampUrl,
    "/f",
    path.resolve(params.pfxPath),
    "/p",
    params.pfxPassword,
  ];
  if (normalizeOptionalString(params.certSubject)) {
    argv.push("/n", normalizeOptionalString(params.certSubject)!);
  }
  argv.push(path.resolve(params.artifactPath));
  const result = await runCommandWithTimeout(argv, {
    timeoutMs: params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS,
  });
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || "signtool sign failed");
  }
  const signingStatus = await verifyWindowsMsiSignature({
    artifactPath: params.artifactPath,
    expectedSignerSubject: params.certSubject,
    timeoutMs: params.timeoutMs,
  });
  if (!signingStatus.verified || signingStatus.timestampStatus !== "present") {
    throw new Error(
      `Signed MSI failed verification: status=${signingStatus.status}, signer=${signingStatus.signerSubject ?? "unknown"}, timestamp=${signingStatus.timestampStatus}.`,
    );
  }
  return signingStatus;
}

export async function resolveWindowsReleaseArtifactMetadata(params: {
  artifactPath: string;
  version: string;
  releaseChannel: string;
  expectedSignerSubject?: string;
  timeoutMs?: number;
  powershellBinary?: string;
  signingStatus?: WindowsMsiSigningStatus;
}): Promise<WindowsReleaseArtifactMetadata> {
  const artifactPath = path.resolve(params.artifactPath);
  const artifactName = path.basename(artifactPath);
  const exists = await fs
    .access(artifactPath)
    .then(() => true)
    .catch(() => false);
  if (!exists) {
    return {
      artifactPath,
      artifactName,
      version: params.version,
      releaseChannel: params.releaseChannel,
      exists: false,
      signed: false,
      signerSubject: null,
      expectedSignerMatched: null,
      timestampSubject: null,
      timestampStatus: "unknown",
      verificationStatus: "missing",
      verificationMessage: "MSI artifact does not exist.",
    };
  }
  const signingStatus =
    params.signingStatus ??
    (await verifyWindowsMsiSignature({
      artifactPath,
      expectedSignerSubject: params.expectedSignerSubject,
      powershellBinary: params.powershellBinary,
      timeoutMs: params.timeoutMs,
    }));
  return {
    artifactPath,
    artifactName,
    version: params.version,
    releaseChannel: params.releaseChannel,
    exists: true,
    signed: signingStatus.signed,
    signerSubject: signingStatus.signerSubject,
    expectedSignerMatched: signingStatus.expectedSignerMatched,
    timestampSubject: signingStatus.timestampSubject,
    timestampStatus: signingStatus.timestampStatus,
    verificationStatus: signingStatus.status,
    verificationMessage: signingStatus.statusMessage,
  };
}

export async function resolveWindowsWingetReleaseMetadata(params: {
  artifactPath: string;
  version: string;
  releaseChannel: WindowsMsiReleaseChannel;
  expectedSignerSubject?: string;
  timeoutMs?: number;
  powershellBinary?: string;
  signingStatus?: WindowsMsiSigningStatus;
  fetchImpl?: typeof fetch;
}): Promise<WindowsWingetReleaseMetadata> {
  if (params.releaseChannel !== "stable") {
    throw new Error(
      `winget publication is stable-only. Refusing release channel ${params.releaseChannel}.`,
    );
  }
  const artifactPath = path.resolve(params.artifactPath);
  const releaseMetadata = await resolveWindowsReleaseArtifactMetadata({
    artifactPath,
    version: params.version,
    releaseChannel: params.releaseChannel,
    expectedSignerSubject: params.expectedSignerSubject,
    timeoutMs: params.timeoutMs,
    powershellBinary: params.powershellBinary,
    signingStatus: params.signingStatus,
  });
  if (!releaseMetadata.exists || !releaseMetadata.signed) {
    throw new Error("winget metadata requires an existing signed MSI artifact.");
  }
  const releases = await fetchWindowsMsiReleaseFeed({
    timeoutMs: params.timeoutMs,
    fetchImpl: params.fetchImpl,
  });
  const releaseArtifact = resolveWindowsMsiReleaseArtifactFromFeed({
    releases,
    releaseChannel: params.releaseChannel,
    version: params.version,
  });
  if (!releaseArtifact) {
    throw new Error(
      `Could not find a matching signed Windows MSI release asset for ${params.version}.`,
    );
  }
  return {
    packageIdentifier: WINDOWS_WINGET_PACKAGE_IDENTIFIER,
    packageVersion: params.version,
    releaseChannel: params.releaseChannel,
    artifactName: releaseMetadata.artifactName,
    artifactPath,
    artifactUrl: releaseArtifact.downloadUrl,
    artifactSha256: await sha256File(artifactPath),
    releaseUrl: releaseArtifact.releaseUrl,
    releaseNotes: sanitizeReleaseNotes(releaseArtifact.releaseNotes),
    publisher: WINDOWS_WINGET_PUBLISHER,
    packageName: WINDOWS_WINGET_PACKAGE_NAME,
    moniker: WINDOWS_WINGET_MONIKER,
    shortDescription: WINDOWS_WINGET_SHORT_DESCRIPTION,
    license: "MIT",
    licenseUrl: WINDOWS_WINGET_LICENSE_URL,
    packageUrl: WINDOWS_WINGET_PACKAGE_URL,
    publisherUrl: WINDOWS_WINGET_PACKAGE_URL,
    publisherSupportUrl: WINDOWS_WINGET_PUBLISHER_SUPPORT_URL,
    installerType: "wix",
    scope: "user",
  };
}

export async function buildWindowsWingetManifestSet(params: {
  artifactPath: string;
  version: string;
  releaseChannel: WindowsMsiReleaseChannel;
  outDir?: string;
  expectedSignerSubject?: string;
  timeoutMs?: number;
  powershellBinary?: string;
  signingStatus?: WindowsMsiSigningStatus;
  fetchImpl?: typeof fetch;
}): Promise<WindowsWingetManifestSet> {
  const metadata = await resolveWindowsWingetReleaseMetadata(params);
  const outDir = params.outDir ?? path.join(process.cwd(), WINDOWS_WINGET_DEFAULT_OUT_DIR);
  const manifestRoot = path.join(outDir, resolveWindowsWingetManifestRoot(metadata.packageVersion));
  await fs.rm(manifestRoot, { recursive: true, force: true });
  await fs.mkdir(manifestRoot, { recursive: true });
  const baseFileName = WINDOWS_WINGET_PACKAGE_IDENTIFIER;
  const versionManifestPath = path.join(manifestRoot, `${baseFileName}.yaml`);
  const defaultLocaleManifestPath = path.join(manifestRoot, `${baseFileName}.locale.en-US.yaml`);
  const installerManifestPath = path.join(manifestRoot, `${baseFileName}.installer.yaml`);
  await fs.writeFile(
    versionManifestPath,
    renderWindowsWingetVersionManifest({
      packageIdentifier: metadata.packageIdentifier,
      packageVersion: metadata.packageVersion,
    }),
    "utf8",
  );
  await fs.writeFile(
    defaultLocaleManifestPath,
    renderWindowsWingetDefaultLocaleManifest(metadata),
    "utf8",
  );
  await fs.writeFile(installerManifestPath, renderWindowsWingetInstallerManifest(metadata), "utf8");
  return {
    directoryPath: manifestRoot,
    packageIdentifier: metadata.packageIdentifier,
    packageVersion: metadata.packageVersion,
    files: {
      versionManifestPath,
      defaultLocaleManifestPath,
      installerManifestPath,
    },
    metadata,
  };
}

export async function publishWindowsWingetManifest(params: {
  manifestSet: WindowsWingetManifestSet;
  forkRepo: string;
  targetRepo?: string;
  baseBranch?: string;
  branchName?: string;
  githubToken: string;
  gitUserName?: string;
  gitUserEmail?: string;
  timeoutMs?: number;
}): Promise<WindowsWingetPublishStatus> {
  const targetRepo = params.targetRepo ?? WINDOWS_WINGET_UPSTREAM_REPO;
  const baseBranch = params.baseBranch ?? WINDOWS_WINGET_BASE_BRANCH;
  const branchName =
    params.branchName ??
    `openclaw-winget-v${params.manifestSet.packageVersion.replace(/[^A-Za-z0-9.-]/g, "-")}`;
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-winget-publish-"));
  const cloneDir = path.join(tempRoot, "repo");
  const forkRepoUrl = `https://x-access-token:${params.githubToken}@github.com/${params.forkRepo}.git`;
  const targetManifestDir = path.join(
    cloneDir,
    resolveWindowsWingetManifestRoot(params.manifestSet.packageVersion),
  );
  try {
    let command = await runCommandWithTimeout(["git", "clone", forkRepoUrl, cloneDir], {
      timeoutMs: params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS,
    });
    if (command.code !== 0) {
      throw new Error(command.stderr || command.stdout || "Failed to clone winget fork.");
    }
    command = await runCommandWithTimeout(
      ["git", "-C", cloneDir, "remote", "add", "upstream", `https://github.com/${targetRepo}.git`],
      {
        timeoutMs: params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS,
      },
    );
    if (command.code !== 0) {
      throw new Error(command.stderr || command.stdout || "Failed to add winget upstream remote.");
    }
    command = await runCommandWithTimeout(
      ["git", "-C", cloneDir, "fetch", "upstream", baseBranch],
      {
        timeoutMs: params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS,
      },
    );
    if (command.code !== 0) {
      throw new Error(command.stderr || command.stdout || "Failed to fetch winget upstream.");
    }
    command = await runCommandWithTimeout(
      ["git", "-C", cloneDir, "checkout", "-B", branchName, `upstream/${baseBranch}`],
      { timeoutMs: params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS },
    );
    if (command.code !== 0) {
      throw new Error(
        command.stderr || command.stdout || "Failed to create winget publish branch.",
      );
    }
    await fs.mkdir(path.dirname(targetManifestDir), { recursive: true });
    await fs.rm(targetManifestDir, { recursive: true, force: true });
    await fs.cp(params.manifestSet.directoryPath, targetManifestDir, { recursive: true });
    await runCommandWithTimeout(
      ["git", "-C", cloneDir, "config", "user.name", params.gitUserName ?? "OpenClaw Release Bot"],
      { timeoutMs: params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS },
    );
    await runCommandWithTimeout(
      [
        "git",
        "-C",
        cloneDir,
        "config",
        "user.email",
        params.gitUserEmail ?? "release-bot@openclaw.ai",
      ],
      { timeoutMs: params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS },
    );
    command = await runCommandWithTimeout(["git", "-C", cloneDir, "status", "--porcelain"], {
      timeoutMs: params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS,
    });
    if (command.code !== 0) {
      throw new Error(command.stderr || command.stdout || "Failed to inspect winget repo status.");
    }
    if (!command.stdout.trim()) {
      return {
        published: false,
        skipped: true,
        branchName,
        prUrl: null,
        targetRepo,
        forkRepo: params.forkRepo,
        manifestDir: targetManifestDir,
        reason: "winget manifests already match the current signed MSI release.",
      };
    }
    await runCommandWithTimeout(
      [
        "git",
        "-C",
        cloneDir,
        "add",
        resolveWindowsWingetManifestRoot(params.manifestSet.packageVersion),
      ],
      {
        timeoutMs: params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS,
      },
    );
    command = await runCommandWithTimeout(
      ["git", "-C", cloneDir, "commit", "-m", `Add OpenClaw ${params.manifestSet.packageVersion}`],
      { timeoutMs: params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS },
    );
    if (command.code !== 0) {
      throw new Error(command.stderr || command.stdout || "Failed to commit winget manifests.");
    }
    command = await runCommandWithTimeout(
      ["git", "-C", cloneDir, "push", "origin", branchName, "--force-with-lease"],
      {
        timeoutMs: params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS,
      },
    );
    if (command.code !== 0) {
      throw new Error(command.stderr || command.stdout || "Failed to push winget manifest branch.");
    }
    const forkOwner = params.forkRepo.split("/")[0] ?? "";
    command = await runCommandWithTimeout(
      [
        "gh",
        "pr",
        "create",
        "--repo",
        targetRepo,
        "--base",
        baseBranch,
        "--head",
        `${forkOwner}:${branchName}`,
        "--title",
        `Add OpenClaw ${params.manifestSet.packageVersion}`,
        "--body",
        [
          `## Summary`,
          ``,
          `- publish OpenClaw ${params.manifestSet.packageVersion}`,
          `- source signed MSI: ${params.manifestSet.metadata.artifactUrl}`,
          `- release notes: ${params.manifestSet.metadata.releaseUrl ?? "n/a"}`,
        ].join("\n"),
      ],
      {
        env: {
          ...process.env,
          GH_TOKEN: params.githubToken,
          GITHUB_TOKEN: params.githubToken,
        },
        timeoutMs: params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS,
      },
    );
    if (command.code !== 0) {
      throw new Error(command.stderr || command.stdout || "Failed to create winget PR.");
    }
    return {
      published: true,
      skipped: false,
      branchName,
      prUrl: normalizeOptionalString(command.stdout) ?? null,
      targetRepo,
      forkRepo: params.forkRepo,
      manifestDir: targetManifestDir,
      reason: null,
    };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function buildWindowsMsiInstaller(
  params: {
    rootDir?: string;
    outDir?: string;
    version?: string;
    artifactName?: string;
    wixBinary?: string;
    skipWixBuild?: boolean;
    timeoutMs?: number;
  } = {},
): Promise<WindowsMsiBuildResult> {
  const rootDir = params.rootDir ?? process.cwd();
  const version = await resolveInstallRootVersion({ version: params.version, rootDir });
  await ensureBuiltArtifacts(rootDir);
  const outDir = params.outDir ?? resolveDefaultMsiOutDir(rootDir);
  const artifactName = params.artifactName ?? `OpenClaw-${version}-windows-${WINDOWS_MSI_ARCH}.msi`;
  const stageDir = path.join(outDir, "stage");
  const installRoot = path.join(stageDir, "payload");
  const sourcePath = path.join(stageDir, "OpenClaw.wxs");
  const artifactPath = path.join(outDir, artifactName);
  await fs.rm(stageDir, { recursive: true, force: true });
  await fs.mkdir(stageDir, { recursive: true });
  await stageWindowsMsiPayload({
    rootDir,
    installRoot,
  });
  await fs.mkdir(path.join(installRoot, "bootstrap"), { recursive: true });
  await fs.writeFile(
    path.join(installRoot, "bootstrap", "msi-bootstrap.ps1"),
    renderWindowsInstallerBootstrapScript({ installRoot, productVersion: version }),
    "utf8",
  );
  const fileEntries = await listFilesRecursive(installRoot);
  await fs.writeFile(
    sourcePath,
    renderWindowsMsiSource({
      version,
      fileEntries,
      installRoot,
    }),
    "utf8",
  );

  if (!params.skipWixBuild) {
    const wixBinary = params.wixBinary ?? "wix";
    const result = await runCommandWithTimeout(
      [wixBinary, "build", sourcePath, "-ext", "WixToolset.Util.wixext", "-o", artifactPath],
      {
        cwd: rootDir,
        timeoutMs: params.timeoutMs ?? WINDOWS_MSI_BOOTSTRAP_TIMEOUT_MS,
      },
    );
    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || "wix build failed");
    }
  }

  return {
    artifactPath,
    artifactName,
    sourcePath,
    stageDir,
    installRoot,
    version,
  };
}

export async function runWindowsMsiSmokeInstall(params: {
  artifactPath: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  logPath?: string;
  retryAttempts?: number;
  retryDelayMs?: number;
}): Promise<WindowsMsiSmokePhaseResult> {
  return await runWindowsMsiSmokePhase({
    phase: "install",
    artifactPath: params.artifactPath,
    env: params.env,
    timeoutMs: params.timeoutMs,
    logPath: params.logPath,
    retryAttempts: params.retryAttempts,
    retryDelayMs: params.retryDelayMs,
  });
}

export async function runWindowsMsiSmokeRepair(params: {
  artifactPath: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  logPath?: string;
  retryAttempts?: number;
  retryDelayMs?: number;
}): Promise<WindowsMsiSmokePhaseResult> {
  return await runWindowsMsiSmokePhase({
    phase: "repair",
    artifactPath: params.artifactPath,
    env: params.env,
    timeoutMs: params.timeoutMs,
    logPath: params.logPath,
    retryAttempts: params.retryAttempts,
    retryDelayMs: params.retryDelayMs,
  });
}

export async function runWindowsMsiSmokeUninstall(params: {
  artifactPath: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  logPath?: string;
}): Promise<WindowsMsiSmokePhaseResult> {
  const result = await runWindowsMsiSmokePhase({
    phase: "uninstall",
    artifactPath: params.artifactPath,
    env: params.env,
    timeoutMs: params.timeoutMs,
    logPath: params.logPath,
  });
  const installedProduct = result.installedProduct;
  if (
    installedProduct?.manifest !== null ||
    installedProduct?.bootstrapStatus.gatewayInstalled ||
    installedProduct?.bootstrapStatus.companionInstalled
  ) {
    const installedProductSummary = summarizeWindowsInstalledProductStatus(installedProduct);
    throw new Error(
      `Windows MSI uninstall verification failed. Log: ${result.logPath}` +
        (installedProductSummary
          ? `\n--- Installed product snapshot ---\n${JSON.stringify(installedProductSummary, null, 2)}`
          : ""),
    );
  }
  return result;
}

export const WINDOWS_INSTALLER_INTERNALS = {
  WINDOWS_MSI_UPGRADE_CODE,
  WINDOWS_MSI_PRODUCT_NAME,
  WINDOWS_MSI_ARCH,
};
