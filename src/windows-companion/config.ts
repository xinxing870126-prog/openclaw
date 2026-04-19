import fs from "node:fs/promises";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { readJsonFile, writeJsonAtomic } from "../infra/json-files.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { resolveWindowsCompanionWindowsTaskName } from "../daemon/constants.js";

export type WindowsCompanionInstallMode = "schtasks" | "startup_folder";

export type WindowsCompanionGatewayConfig = {
  url?: string;
  token?: string;
  bootstrapToken?: string;
  deviceToken?: string;
  password?: string;
  instanceId?: string;
  tlsFingerprint?: string;
};

export type WindowsCompanionConfig = {
  version: 1;
  profile?: string | null;
  shellAppLabel?: string;
  installMode?: WindowsCompanionInstallMode | null;
  supervisorLabel?: string;
  gateway?: WindowsCompanionGatewayConfig;
};

const WINDOWS_COMPANION_CONFIG_FILE = "windows-companion.json";

function normalizeGatewayConfig(
  gateway?: WindowsCompanionGatewayConfig | null,
): WindowsCompanionGatewayConfig | undefined {
  if (!gateway) {
    return undefined;
  }
  const normalized: WindowsCompanionGatewayConfig = {
    url: normalizeOptionalString(gateway.url),
    token: normalizeOptionalString(gateway.token),
    bootstrapToken: normalizeOptionalString(gateway.bootstrapToken),
    deviceToken: normalizeOptionalString(gateway.deviceToken),
    password: normalizeOptionalString(gateway.password),
    instanceId: normalizeOptionalString(gateway.instanceId),
    tlsFingerprint: normalizeOptionalString(gateway.tlsFingerprint),
  };
  return Object.values(normalized).some((value) => typeof value === "string" && value.length > 0)
    ? normalized
    : undefined;
}

function normalizeInstallMode(value: unknown): WindowsCompanionInstallMode | null {
  return value === "schtasks" || value === "startup_folder" ? value : null;
}

function normalizeProfile(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeConfig(config: Partial<WindowsCompanionConfig> | null): WindowsCompanionConfig {
  const profile = normalizeProfile(config?.profile);
  return {
    version: 1,
    profile,
    shellAppLabel:
      normalizeOptionalString(config?.shellAppLabel) ?? "OpenClaw Windows Companion",
    installMode: normalizeInstallMode(config?.installMode),
    supervisorLabel:
      normalizeOptionalString(config?.supervisorLabel)
      ?? resolveWindowsCompanionWindowsTaskName(profile ?? undefined),
    gateway: normalizeGatewayConfig(config?.gateway ?? undefined),
  };
}

export function resolveWindowsCompanionConfigPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(resolveStateDir(env), WINDOWS_COMPANION_CONFIG_FILE);
}

export async function loadWindowsCompanionConfig(
  env: NodeJS.ProcessEnv = process.env,
): Promise<WindowsCompanionConfig | null> {
  const filePath = resolveWindowsCompanionConfigPath(env);
  const parsed = await readJsonFile<Partial<WindowsCompanionConfig>>(filePath);
  return parsed ? normalizeConfig(parsed) : null;
}

export async function saveWindowsCompanionConfig(
  config: WindowsCompanionConfig,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const filePath = resolveWindowsCompanionConfigPath(env);
  await writeJsonAtomic(filePath, normalizeConfig(config), {
    mode: 0o600,
    trailingNewline: true,
  });
}

export async function removeWindowsCompanionConfig(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const filePath = resolveWindowsCompanionConfigPath(env);
  await fs.rm(filePath, { force: true });
}

export function resolveWindowsCompanionConfigFromSources(params: {
  env?: NodeJS.ProcessEnv;
  existing?: WindowsCompanionConfig | null;
  overrides?: Partial<WindowsCompanionConfig>;
}): WindowsCompanionConfig {
  const env = params.env ?? process.env;
  const profile =
    normalizeProfile(params.overrides?.profile)
    ?? normalizeProfile(params.existing?.profile)
    ?? normalizeProfile(env.OPENCLAW_PROFILE);
  return normalizeConfig({
    ...params.existing,
    ...params.overrides,
    profile,
    shellAppLabel:
      normalizeOptionalString(params.overrides?.shellAppLabel)
      ?? normalizeOptionalString(params.existing?.shellAppLabel)
      ?? normalizeOptionalString(env.OPENCLAW_WINDOWS_SHELL_APP_LABEL)
      ?? "OpenClaw Windows Companion",
    installMode: normalizeInstallMode(params.overrides?.installMode ?? params.existing?.installMode),
    supervisorLabel:
      normalizeOptionalString(params.overrides?.supervisorLabel)
      ?? normalizeOptionalString(params.existing?.supervisorLabel)
      ?? resolveWindowsCompanionWindowsTaskName(profile ?? undefined),
    gateway: {
      ...params.existing?.gateway,
      ...params.overrides?.gateway,
      url:
        normalizeOptionalString(params.overrides?.gateway?.url)
        ?? normalizeOptionalString(env.OPENCLAW_GATEWAY_URL)
        ?? normalizeOptionalString(params.existing?.gateway?.url),
      token:
        normalizeOptionalString(params.overrides?.gateway?.token)
        ?? normalizeOptionalString(env.OPENCLAW_GATEWAY_TOKEN)
        ?? normalizeOptionalString(params.existing?.gateway?.token),
      bootstrapToken:
        normalizeOptionalString(params.overrides?.gateway?.bootstrapToken)
        ?? normalizeOptionalString(env.OPENCLAW_GATEWAY_BOOTSTRAP_TOKEN)
        ?? normalizeOptionalString(params.existing?.gateway?.bootstrapToken),
      deviceToken:
        normalizeOptionalString(params.overrides?.gateway?.deviceToken)
        ?? normalizeOptionalString(env.OPENCLAW_GATEWAY_DEVICE_TOKEN)
        ?? normalizeOptionalString(params.existing?.gateway?.deviceToken),
      password:
        normalizeOptionalString(params.overrides?.gateway?.password)
        ?? normalizeOptionalString(env.OPENCLAW_GATEWAY_PASSWORD)
        ?? normalizeOptionalString(params.existing?.gateway?.password),
      instanceId:
        normalizeOptionalString(params.overrides?.gateway?.instanceId)
        ?? normalizeOptionalString(env.OPENCLAW_GATEWAY_INSTANCE_ID)
        ?? normalizeOptionalString(params.existing?.gateway?.instanceId),
      tlsFingerprint:
        normalizeOptionalString(params.overrides?.gateway?.tlsFingerprint)
        ?? normalizeOptionalString(env.OPENCLAW_GATEWAY_TLS_FINGERPRINT)
        ?? normalizeOptionalString(params.existing?.gateway?.tlsFingerprint),
    },
  });
}
