import { buildWindowsCompanionInstallPlan } from "../../commands/windows-companion-install-helpers.js";
import { readScheduledTaskInstallMode } from "../../daemon/schtasks.js";
import {
  readGatewayServiceState,
  type GatewayService,
} from "../../daemon/service.js";
import { defaultRuntime } from "../../runtime.js";
import { normalizeOptionalString } from "../../shared/string-coerce.js";
import { WRITE_SCOPE } from "../../gateway/method-scopes.js";
import { resolveWindowsCompanionService } from "../../windows-companion/service.js";
import {
  loadWindowsCompanionConfig,
  removeWindowsCompanionConfig,
  resolveWindowsCompanionConfigFromSources,
  saveWindowsCompanionConfig,
  type WindowsCompanionConfig,
} from "../../windows-companion/config.js";
import { runDesktopWindowsCompanionForeground } from "../../windows-companion/runtime.js";
import { resolveWindowsCompanionSingletonState } from "../../windows-companion/singleton.js";
import { formatCliCommand } from "../command-format.js";
import {
  runServiceRestart,
  runServiceStop,
  runServiceUninstall,
} from "../daemon-cli/lifecycle-core.js";
import { buildDaemonServiceSnapshot, installDaemonServiceAndEmit } from "../daemon-cli/response.js";
import {
  createCliStatusTextStyles,
  createDaemonInstallActionContext,
  failIfNixDaemonInstallMode,
} from "../daemon-cli/shared.js";

type WindowsCompanionGatewayOverrides = {
  url?: string;
  token?: string;
  bootstrapToken?: string;
  deviceToken?: string;
  password?: string;
  instanceId?: string;
  tlsFingerprint?: string;
};

type WindowsCompanionConfigOptions = {
  shellAppLabel?: string;
  gateway?: WindowsCompanionGatewayOverrides;
};

type WindowsCompanionInstallOptions = WindowsCompanionConfigOptions & {
  force?: boolean;
  json?: boolean;
};

type WindowsCompanionRunOptions = WindowsCompanionConfigOptions;
type WindowsCompanionForegroundOptions = WindowsCompanionRunOptions & {
  headless?: boolean;
};

type WindowsCompanionLifecycleOptions = {
  json?: boolean;
};

type WindowsCompanionStatusOptions = {
  json?: boolean;
};

type CompanionBridgeRoleStatus = {
  lifecycleIngressEnabled: boolean;
  localActionRelayEnabled: boolean;
  nativeExecutorEnabled: boolean;
};

type CompanionReachabilityStatus = {
  reachable: boolean;
  processHostState?: string | null;
  nextWakeAt?: string | null;
  bridgeRole: CompanionBridgeRoleStatus;
  error?: string;
};

function withProfileEnv(
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

function buildWindowsCompanionOverrides(
  opts: WindowsCompanionConfigOptions,
): Partial<WindowsCompanionConfig> {
  return {
    shellAppLabel: normalizeOptionalString(opts.shellAppLabel) ?? undefined,
    gateway: {
      url: normalizeOptionalString(opts.gateway?.url) ?? undefined,
      token: normalizeOptionalString(opts.gateway?.token) ?? undefined,
      bootstrapToken: normalizeOptionalString(opts.gateway?.bootstrapToken) ?? undefined,
      deviceToken: normalizeOptionalString(opts.gateway?.deviceToken) ?? undefined,
      password: normalizeOptionalString(opts.gateway?.password) ?? undefined,
      instanceId: normalizeOptionalString(opts.gateway?.instanceId) ?? undefined,
      tlsFingerprint: normalizeOptionalString(opts.gateway?.tlsFingerprint) ?? undefined,
    },
  };
}

function renderWindowsCompanionStartHints(): string[] {
  return [formatCliCommand("openclaw windows-companion install")];
}

async function withTemporaryProfileEnv<T>(
  profile: string | null | undefined,
  action: () => Promise<T>,
): Promise<T> {
  const previousProfile = process.env.OPENCLAW_PROFILE;
  const normalized = normalizeOptionalString(profile);
  if (normalized) {
    process.env.OPENCLAW_PROFILE = normalized;
  } else {
    delete process.env.OPENCLAW_PROFILE;
  }
  try {
    return await action();
  } finally {
    if (typeof previousProfile === "string") {
      process.env.OPENCLAW_PROFILE = previousProfile;
    } else {
      delete process.env.OPENCLAW_PROFILE;
    }
  }
}

function buildBridgeRoleStatus(
  startupPosture?: {
    nativeProcessIngressSource?: string | null;
    desktopHostPlatform?: string | null;
    nativeLocalActionTransportSource?: string | null;
    pendingNativeActionCount?: number | null;
    nativeLocalActionExecutionSource?: string | null;
    nativeLocalActionCapabilitySummary?: string | null;
  } | null,
): CompanionBridgeRoleStatus {
  const platform = startupPosture?.desktopHostPlatform ?? null;
  return {
    lifecycleIngressEnabled:
      platform === "windows" && startupPosture?.nativeProcessIngressSource === "windows_app_lifecycle",
    localActionRelayEnabled:
      platform === "windows"
      && (startupPosture?.nativeLocalActionTransportSource === "desktop_local_action_push"
        || typeof startupPosture?.pendingNativeActionCount === "number"),
    nativeExecutorEnabled:
      startupPosture?.nativeLocalActionExecutionSource === "windows_local_action_executor"
      || (platform === "windows" && Boolean(startupPosture?.nativeLocalActionCapabilitySummary)),
  };
}

async function probeWindowsCompanionReachability(
  config: WindowsCompanionConfig,
): Promise<CompanionReachabilityStatus> {
  try {
    const { callGateway } = await import("../../gateway/call.js");
    const status = await callGateway<{
      startupPosture?: {
        processHostState?: string | null;
        nextWakeAt?: string | null;
        nativeProcessIngressSource?: string | null;
        desktopHostPlatform?: string | null;
        nativeLocalActionTransportSource?: string | null;
        pendingNativeActionCount?: number | null;
        nativeLocalActionExecutionSource?: string | null;
        nativeLocalActionCapabilitySummary?: string | null;
      };
    }>({
      url: config.gateway?.url,
      token: config.gateway?.token,
      password: config.gateway?.password,
      tlsFingerprint: config.gateway?.tlsFingerprint,
      instanceId: config.gateway?.instanceId,
      method: "localBridge.status",
      params: undefined,
      clientName: "gateway-client",
      clientDisplayName: "OpenClaw Windows Companion Status",
      mode: "backend",
      platform: "windows",
      scopes: [WRITE_SCOPE],
      timeoutMs: 10_000,
    });
    const startupPosture = status.startupPosture ?? null;
    return {
      reachable: true,
      processHostState: startupPosture?.processHostState ?? null,
      nextWakeAt: startupPosture?.nextWakeAt ?? null,
      bridgeRole: buildBridgeRoleStatus(startupPosture),
    };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
      bridgeRole: buildBridgeRoleStatus(null),
    };
  }
}

async function resolveWindowsCompanionServiceState(
  service: GatewayService,
  profile?: string | null,
) {
  const env = withProfileEnv(process.env, profile);
  const state = await readGatewayServiceState(service, { env });
  const installMode = await readScheduledTaskInstallMode(state.env);
  return { state, installMode };
}

export async function runWindowsCompanionForeground(
  opts: WindowsCompanionForegroundOptions = {},
) {
  await runDesktopWindowsCompanionForeground({
    headless: Boolean(opts.headless),
    overrides: buildWindowsCompanionOverrides(opts),
  });
}

export async function runWindowsCompanionDaemonInstall(
  opts: WindowsCompanionInstallOptions,
): Promise<void> {
  const { json, stdout, warnings, emit, fail } = createDaemonInstallActionContext(opts.json);
  if (failIfNixDaemonInstallMode(fail)) {
    return;
  }

  const existing = await loadWindowsCompanionConfig();
  const nextConfig = resolveWindowsCompanionConfigFromSources({
    env: process.env,
    existing,
    overrides: buildWindowsCompanionOverrides(opts),
  });
  const serviceEnv = withProfileEnv(process.env, nextConfig.profile);
  const service = resolveWindowsCompanionService();
  let loaded = false;
  try {
    loaded = await service.isLoaded({ env: serviceEnv });
  } catch (error) {
    fail(`Windows companion service check failed: ${String(error)}`);
    return;
  }

  if (loaded && !opts.force) {
    emit({
      ok: true,
      result: "already-installed",
      message: `Windows companion service already ${service.loadedText}.`,
      service: buildDaemonServiceSnapshot(service, loaded),
      warnings: warnings.length ? warnings : undefined,
    });
    if (!json) {
      defaultRuntime.log(`Windows companion service already ${service.loadedText}.`);
      defaultRuntime.log(
        `Reinstall with: ${formatCliCommand("openclaw windows-companion install --force")}`,
      );
    }
    return;
  }

  const installPlan = await buildWindowsCompanionInstallPlan({
    env: serviceEnv,
    shellAppLabel: nextConfig.shellAppLabel,
  });

  await saveWindowsCompanionConfig(nextConfig);
  await installDaemonServiceAndEmit({
    serviceNoun: "Windows companion",
    service,
    warnings,
    emit,
    fail,
    install: async () => {
      await service.install({
        env: serviceEnv,
        stdout,
        programArguments: installPlan.programArguments,
        workingDirectory: installPlan.workingDirectory,
        environment: installPlan.environment,
        description: installPlan.description,
      });
      const installMode = await readScheduledTaskInstallMode(serviceEnv);
      await saveWindowsCompanionConfig({
        ...nextConfig,
        installMode,
      });
    },
  });
}

export async function runWindowsCompanionDaemonUninstall(
  opts: WindowsCompanionLifecycleOptions = {},
): Promise<void> {
  const existing = await loadWindowsCompanionConfig();
  await withTemporaryProfileEnv(existing?.profile, async () => {
    await runServiceUninstall({
      serviceNoun: "Windows companion",
      service: resolveWindowsCompanionService(),
      opts,
      stopBeforeUninstall: true,
      assertNotLoadedAfterUninstall: false,
    });
  });
  await removeWindowsCompanionConfig(withProfileEnv(process.env, existing?.profile));
}

export async function runWindowsCompanionDaemonStop(
  opts: WindowsCompanionLifecycleOptions = {},
): Promise<void> {
  const existing = await loadWindowsCompanionConfig();
  await withTemporaryProfileEnv(existing?.profile, async () => {
    await runServiceStop({
      serviceNoun: "Windows companion",
      service: resolveWindowsCompanionService(),
      opts,
    });
  });
}

export async function runWindowsCompanionDaemonRestart(
  opts: WindowsCompanionLifecycleOptions = {},
): Promise<void> {
  const existing = await loadWindowsCompanionConfig();
  await withTemporaryProfileEnv(existing?.profile, async () => {
    await runServiceRestart({
      serviceNoun: "Windows companion",
      service: resolveWindowsCompanionService(),
      renderStartHints: renderWindowsCompanionStartHints,
      opts,
    });
  });
}

export async function runWindowsCompanionDaemonStatus(
  opts: WindowsCompanionStatusOptions = {},
): Promise<void> {
  const json = Boolean(opts.json);
  const service = resolveWindowsCompanionService();
  const config = resolveWindowsCompanionConfigFromSources({
    env: process.env,
    existing: await loadWindowsCompanionConfig(),
  });
  const { state, installMode } = await resolveWindowsCompanionServiceState(service, config.profile);
  const reachability = await probeWindowsCompanionReachability(config);
  const singleton = await resolveWindowsCompanionSingletonState({
    profile: config.profile ?? null,
  });
  const payload = {
    service: {
      ...buildDaemonServiceSnapshot(service, state.loaded),
      installed: state.installed,
      running: state.running,
      installMode,
      runtime: state.runtime,
    },
    config: {
      pathConfigured: Boolean(config.gateway?.url || config.gateway?.token || config.gateway?.password),
      shellAppLabel: config.shellAppLabel,
      profile: config.profile ?? null,
      supervisorLabel: config.supervisorLabel ?? null,
    },
    reachability,
    singleton: {
      active: singleton.active,
      pid: singleton.pid,
      mode: singleton.mode,
      trayHealthState: singleton.trayHealthState ?? null,
      statusLine: singleton.statusLine ?? null,
      lastNotificationKind: singleton.lastNotificationKind ?? null,
      lastNotificationAt: singleton.lastNotificationAt ?? null,
      recoveryState: singleton.recoveryState ?? null,
      lastRecoveryReason: singleton.lastRecoveryReason ?? null,
      lastRecoveryAt: singleton.lastRecoveryAt ?? null,
      recoveryAttemptCount: singleton.recoveryAttemptCount ?? null,
      currentDashboardTarget: singleton.currentDashboardTarget ?? null,
      lastDashboardTarget: singleton.lastDashboardTarget ?? null,
      currentPendingActionId: singleton.currentPendingActionId ?? null,
      currentResolvedActionId: singleton.currentResolvedActionId ?? null,
      lastResolvedActionOutcome: singleton.lastResolvedActionOutcome ?? null,
      lastDashboardTargetActionId: singleton.lastDashboardTargetActionId ?? null,
      lastDashboardTargetResultActionId: singleton.lastDashboardTargetResultActionId ?? null,
      lastAttentionTargetReason: singleton.lastAttentionTargetReason ?? null,
    },
  };

  if (json) {
    defaultRuntime.writeJson(payload);
    return;
  }

  const { label, accent, infoText, okText, warnText, errorText } = createCliStatusTextStyles();
  defaultRuntime.log(
    `${label("Service:")} ${accent(service.label)} (${state.installed ? okText("installed") : warnText("not installed")})`,
  );
  defaultRuntime.log(
    `${label("Install mode:")} ${infoText(installMode ?? "not installed")}`,
  );
  defaultRuntime.log(
    `${label("Runtime:")} ${state.running ? okText("running") : warnText("stopped")}`,
  );
  defaultRuntime.log(
    `${label("Gateway:")} ${reachability.reachable ? okText("reachable") : errorText("unreachable")}`,
  );
  defaultRuntime.log(
    `${label("Lifecycle ingress:")} ${reachability.bridgeRole.lifecycleIngressEnabled ? okText("enabled") : warnText("disabled")}`,
  );
  defaultRuntime.log(
    `${label("Local-action relay:")} ${reachability.bridgeRole.localActionRelayEnabled ? okText("enabled") : warnText("disabled")}`,
  );
  defaultRuntime.log(
    `${label("Native executor:")} ${reachability.bridgeRole.nativeExecutorEnabled ? okText("enabled") : warnText("disabled")}`,
  );
  if (reachability.processHostState) {
    defaultRuntime.log(`${label("Process host:")} ${infoText(reachability.processHostState)}`);
  }
  if (reachability.nextWakeAt) {
    defaultRuntime.log(`${label("Next wake:")} ${infoText(reachability.nextWakeAt)}`);
  }
  if (reachability.error) {
    defaultRuntime.log(`${label("Probe detail:")} ${errorText(reachability.error)}`);
  }
  if (payload.singleton.active) {
    defaultRuntime.log(`${label("Singleton:")} ${okText(`active (pid ${String(payload.singleton.pid)})`)}`);
  } else {
    defaultRuntime.log(`${label("Singleton:")} ${warnText("inactive")}`);
  }
  if (payload.singleton.mode) {
    defaultRuntime.log(`${label("Tray mode:")} ${infoText(payload.singleton.mode)}`);
  }
  if (payload.singleton.trayHealthState) {
    defaultRuntime.log(`${label("Tray health:")} ${infoText(payload.singleton.trayHealthState)}`);
  }
  if (payload.singleton.statusLine) {
    defaultRuntime.log(`${label("Tray status:")} ${infoText(payload.singleton.statusLine)}`);
  }
  if (payload.singleton.lastNotificationKind) {
    defaultRuntime.log(
      `${label("Last attention:")} ${infoText(
        `${payload.singleton.lastNotificationKind}${payload.singleton.lastNotificationAt ? ` · ${payload.singleton.lastNotificationAt}` : ""}`,
      )}`,
    );
  }
  if (payload.singleton.currentDashboardTarget) {
    defaultRuntime.log(
      `${label("Current attention target:")} ${infoText(payload.singleton.currentDashboardTarget)}`,
    );
  }
  if (payload.singleton.currentPendingActionId) {
    defaultRuntime.log(
      `${label("Current pending action:")} ${infoText(payload.singleton.currentPendingActionId)}`,
    );
  }
  if (payload.singleton.currentResolvedActionId) {
    defaultRuntime.log(
      `${label("Current resolved action:")} ${infoText(payload.singleton.currentResolvedActionId)}`,
    );
  }
  if (payload.singleton.lastResolvedActionOutcome) {
    defaultRuntime.log(
      `${label("Resolved outcome:")} ${infoText(payload.singleton.lastResolvedActionOutcome)}`,
    );
  }
  if (payload.singleton.lastDashboardTarget) {
    defaultRuntime.log(
      `${label("Last dashboard target:")} ${infoText(payload.singleton.lastDashboardTarget)}`,
    );
  }
  if (payload.singleton.lastDashboardTargetActionId) {
    defaultRuntime.log(
      `${label("Last dashboard action:")} ${infoText(payload.singleton.lastDashboardTargetActionId)}`,
    );
  }
  if (payload.singleton.lastDashboardTargetResultActionId) {
    defaultRuntime.log(
      `${label("Last dashboard result:")} ${infoText(payload.singleton.lastDashboardTargetResultActionId)}`,
    );
  }
  if (payload.singleton.lastAttentionTargetReason) {
    defaultRuntime.log(
      `${label("Attention target reason:")} ${infoText(payload.singleton.lastAttentionTargetReason)}`,
    );
  }
  if (payload.singleton.recoveryState) {
    defaultRuntime.log(`${label("Recovery state:")} ${infoText(payload.singleton.recoveryState)}`);
  }
  if (payload.singleton.lastRecoveryReason) {
    defaultRuntime.log(
      `${label("Last recovery:")} ${infoText(
        `${payload.singleton.lastRecoveryReason}${payload.singleton.lastRecoveryAt ? ` · ${payload.singleton.lastRecoveryAt}` : ""}`,
      )}`,
    );
  }
  if (typeof payload.singleton.recoveryAttemptCount === "number") {
    defaultRuntime.log(
      `${label("Recovery attempts:")} ${infoText(String(payload.singleton.recoveryAttemptCount))}`,
    );
  }
}
