import type { GatewayServiceRuntime } from "../daemon/service-runtime.js";
import { readScheduledTaskInstallMode } from "../daemon/schtasks.js";
import { readGatewayServiceState } from "../daemon/service.js";
import { buildWindowsCompanionInstallPlan } from "../commands/windows-companion-install-helpers.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import {
  loadWindowsCompanionConfig,
  removeWindowsCompanionConfig,
  resolveWindowsCompanionConfigFromSources,
  saveWindowsCompanionConfig,
  type WindowsCompanionConfig,
  type WindowsCompanionGatewayConfig,
  type WindowsCompanionInstallMode,
} from "./config.js";
import { resolveWindowsCompanionService } from "./service.js";

export type WindowsCompanionInstallSelectionReason =
  | "default"
  | "explicit-include"
  | "explicit-skip"
  | "unsupported-platform";

export type WindowsCompanionInstallSelection = {
  enabled: boolean;
  reason: WindowsCompanionInstallSelectionReason;
};

export type WindowsCompanionInstallerStatus = {
  selected: boolean;
  configured: boolean;
  installed: boolean;
  loaded: boolean;
  running: boolean;
  installMode: WindowsCompanionInstallMode | null;
  profile: string | null;
  supervisorLabel: string | null;
  config: WindowsCompanionConfig | null;
  runtime?: GatewayServiceRuntime;
};

export type WindowsCompanionInstallerGatewayOverrides = WindowsCompanionGatewayConfig;

function withInstallerProfileEnv(
  env: NodeJS.ProcessEnv,
  profile?: string | null,
): NodeJS.ProcessEnv {
  const normalized = normalizeOptionalString(profile);
  if (!normalized) {
    const nextEnv = { ...env };
    delete nextEnv.OPENCLAW_PROFILE;
    return nextEnv;
  }
  return {
    ...env,
    OPENCLAW_PROFILE: normalized,
  };
}

function toConfigOverrides(params: {
  shellAppLabel?: string;
  gateway?: WindowsCompanionInstallerGatewayOverrides;
}): Partial<WindowsCompanionConfig> {
  return {
    shellAppLabel: normalizeOptionalString(params.shellAppLabel) ?? undefined,
    gateway: {
      url: normalizeOptionalString(params.gateway?.url) ?? undefined,
      token: normalizeOptionalString(params.gateway?.token) ?? undefined,
      bootstrapToken: normalizeOptionalString(params.gateway?.bootstrapToken) ?? undefined,
      deviceToken: normalizeOptionalString(params.gateway?.deviceToken) ?? undefined,
      password: normalizeOptionalString(params.gateway?.password) ?? undefined,
      instanceId: normalizeOptionalString(params.gateway?.instanceId) ?? undefined,
      tlsFingerprint: normalizeOptionalString(params.gateway?.tlsFingerprint) ?? undefined,
    },
  };
}

export function resolveWindowsCompanionInstallSelection(params: {
  platform?: NodeJS.Platform;
  withWindowsCompanion?: boolean;
  withoutWindowsCompanion?: boolean;
} = {}): WindowsCompanionInstallSelection {
  const platform = params.platform ?? process.platform;
  if (params.withWindowsCompanion && params.withoutWindowsCompanion) {
    throw new Error("Cannot enable and disable the Windows companion in the same invocation.");
  }
  if (platform !== "win32") {
    return {
      enabled: false,
      reason: "unsupported-platform",
    };
  }
  if (params.withoutWindowsCompanion) {
    return {
      enabled: false,
      reason: "explicit-skip",
    };
  }
  if (params.withWindowsCompanion) {
    return {
      enabled: true,
      reason: "explicit-include",
    };
  }
  return {
    enabled: true,
    reason: "default",
  };
}

export async function resolveWindowsCompanionInstallerStatus(params: {
  env?: NodeJS.ProcessEnv;
  selection?: WindowsCompanionInstallSelection;
} = {}): Promise<WindowsCompanionInstallerStatus> {
  const env = params.env ?? process.env;
  const selection =
    params.selection
    ?? resolveWindowsCompanionInstallSelection({
      platform: process.platform,
    });
  const existing = await loadWindowsCompanionConfig(env).catch(() => null);
  const profile = normalizeOptionalString(existing?.profile) ?? null;
  const supervisorLabel = normalizeOptionalString(existing?.supervisorLabel) ?? null;

  if (process.platform !== "win32") {
    return {
      selected: selection.enabled,
      configured: existing !== null,
      installed: false,
      loaded: false,
      running: false,
      installMode: null,
      profile,
      supervisorLabel,
      config: existing,
    };
  }

  const serviceEnv = withInstallerProfileEnv(env, profile);
  const state = await readGatewayServiceState(resolveWindowsCompanionService(), {
    env: serviceEnv,
  }).catch(() => ({
    installed: false,
    loaded: false,
    running: false,
    env: serviceEnv,
    command: null,
    runtime: undefined,
  }));
  const installMode = await readScheduledTaskInstallMode(state.env).catch(() => null);
  return {
    selected: selection.enabled,
    configured: existing !== null,
    installed: state.installed,
    loaded: state.loaded,
    running: state.running,
    installMode,
    profile,
    supervisorLabel,
    config: existing,
    runtime: state.runtime,
  };
}

export async function installWindowsCompanionFromInstaller(params: {
  env?: NodeJS.ProcessEnv;
  stdout?: NodeJS.WritableStream;
  force?: boolean;
  selection?: WindowsCompanionInstallSelection;
  shellAppLabel?: string;
  gateway?: WindowsCompanionInstallerGatewayOverrides;
}): Promise<{
  attempted: boolean;
  skipped: boolean;
  alreadyInstalled: boolean;
  installed: boolean;
  installMode: WindowsCompanionInstallMode | null;
  config: WindowsCompanionConfig | null;
}> {
  const env = params.env ?? process.env;
  const selection =
    params.selection
    ?? resolveWindowsCompanionInstallSelection({
      platform: process.platform,
    });
  if (!selection.enabled) {
    return {
      attempted: false,
      skipped: true,
      alreadyInstalled: false,
      installed: false,
      installMode: null,
      config: null,
    };
  }

  const existing = await loadWindowsCompanionConfig(env).catch(() => null);
  const nextConfig = resolveWindowsCompanionConfigFromSources({
    env,
    existing,
    overrides: toConfigOverrides({
      shellAppLabel: params.shellAppLabel,
      gateway: params.gateway,
    }),
  });
  const serviceEnv = withInstallerProfileEnv(env, nextConfig.profile);
  const service = resolveWindowsCompanionService();
  const state = await readGatewayServiceState(service, { env: serviceEnv });
  await saveWindowsCompanionConfig(nextConfig, serviceEnv);

  if (state.loaded && !params.force) {
    const installMode = await readScheduledTaskInstallMode(state.env).catch(() => null);
    await saveWindowsCompanionConfig(
      {
        ...nextConfig,
        installMode,
      },
      serviceEnv,
    );
    return {
      attempted: false,
      skipped: false,
      alreadyInstalled: true,
      installed: true,
      installMode,
      config: {
        ...nextConfig,
        installMode,
      },
    };
  }

  const installPlan = await buildWindowsCompanionInstallPlan({
    env: serviceEnv,
    shellAppLabel: nextConfig.shellAppLabel,
  });
  await service.install({
    env: serviceEnv,
    stdout: params.stdout ?? process.stdout,
    programArguments: installPlan.programArguments,
    workingDirectory: installPlan.workingDirectory,
    environment: installPlan.environment,
    description: installPlan.description,
  });
  const installMode = await readScheduledTaskInstallMode(serviceEnv).catch(() => null);
  const savedConfig = {
    ...nextConfig,
    installMode,
  } satisfies WindowsCompanionConfig;
  await saveWindowsCompanionConfig(savedConfig, serviceEnv);
  return {
    attempted: true,
    skipped: false,
    alreadyInstalled: false,
    installed: true,
    installMode,
    config: savedConfig,
  };
}

export async function uninstallWindowsCompanionFromInstaller(params: {
  env?: NodeJS.ProcessEnv;
  stdout?: NodeJS.WritableStream;
  selection?: WindowsCompanionInstallSelection;
} = {}): Promise<{
  attempted: boolean;
  skipped: boolean;
  removed: boolean;
}> {
  const env = params.env ?? process.env;
  const selection =
    params.selection
    ?? resolveWindowsCompanionInstallSelection({
      platform: process.platform,
      withWindowsCompanion: true,
    });
  if (!selection.enabled) {
    return {
      attempted: false,
      skipped: true,
      removed: false,
    };
  }

  const existing = await loadWindowsCompanionConfig(env).catch(() => null);
  const serviceEnv = withInstallerProfileEnv(env, existing?.profile);
  const service = resolveWindowsCompanionService();
  const state = await readGatewayServiceState(service, { env: serviceEnv });
  if (state.loaded) {
    await service.stop({
      env: serviceEnv,
      stdout: params.stdout ?? process.stdout,
    });
  }
  if (state.installed) {
    await service.uninstall({
      env: serviceEnv,
      stdout: params.stdout ?? process.stdout,
    });
  }
  await removeWindowsCompanionConfig(serviceEnv);
  return {
    attempted: state.installed || state.loaded || existing !== null,
    skipped: false,
    removed: state.installed || state.loaded || existing !== null,
  };
}
