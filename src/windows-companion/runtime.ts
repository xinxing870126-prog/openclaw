import { spawn } from "node:child_process";
import process from "node:process";
import { WINDOWS_COMPANION_SERVICE_KIND } from "../daemon/constants.js";
import {
  DesktopWindowsCompanionHost,
  type DesktopWindowsCompanionHostOptions,
} from "../../apps/windows/src/DesktopWindowsCompanionHost.js";
import { dashboardCommand } from "../commands/dashboard.js";
import { defaultRuntime } from "../runtime.js";
import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalString,
} from "../shared/string-coerce.js";
import { resolveWindowsInstallerBootstrapStatus } from "../windows-installer/msi.js";
import {
  loadWindowsCompanionConfig,
  resolveWindowsCompanionConfigFromSources,
  type WindowsCompanionConfig,
} from "./config.js";
import {
  acquireWindowsCompanionSingleton,
  releaseWindowsCompanionSingleton,
} from "./singleton.js";
import {
  resolveWindowsCompanionRecoveryDelayMs,
  resolveWindowsCompanionRecoveryPolicy,
  restartWindowsCompanionProcessWithFreshPid,
  type WindowsCompanionRecoveryReason,
  type WindowsCompanionRecoveryState,
} from "./recovery.js";
import {
  readWindowsCompanionTrayCommands,
  renderWindowsCompanionTrayState,
  startWindowsCompanionTray,
  stopWindowsCompanionTray,
  type WindowsCompanionTrayAction,
  type WindowsCompanionTrayAttentionState,
  type WindowsCompanionTrayHandle,
  type WindowsCompanionTrayHealthState,
  type WindowsCompanionTrayMode,
  updateWindowsCompanionTrayAttention,
} from "./tray.js";
import {
  openWindowsCompanionDashboardTarget,
  resolveWindowsCompanionDashboardTarget,
  type WindowsCompanionDashboardTarget,
  type WindowsCompanionDashboardTargetReason,
} from "./dashboard-target.js";

export type WindowsCompanionRuntimeConfig = {
  profile?: string | null;
  shellAppLabel: string;
  gateway: {
    url?: string;
    token?: string;
    bootstrapToken?: string;
    deviceToken?: string;
    password?: string;
    instanceId?: string;
    tlsFingerprint?: string;
  };
};

type WindowsCompanionRuntimeMode = "interactive" | "headless";

type WindowsCompanionRuntimeBootstrapStatus = {
  reachable: boolean;
  processHostState: string | null;
  lifecycleIngressEnabled: boolean;
  localActionRelayEnabled: boolean;
  nativeExecutorEnabled: boolean;
  nextWakeAt: string | null;
  pendingNativeActionCount: number;
};

function normalizeRuntimeConfig(config: WindowsCompanionConfig): WindowsCompanionRuntimeConfig {
  return {
    profile: config.profile ?? null,
    shellAppLabel: config.shellAppLabel?.trim() || "OpenClaw Windows Companion",
    gateway: {
      url: normalizeOptionalString(config.gateway?.url),
      token: normalizeOptionalString(config.gateway?.token),
      bootstrapToken: normalizeOptionalString(config.gateway?.bootstrapToken),
      deviceToken: normalizeOptionalString(config.gateway?.deviceToken),
      password: normalizeOptionalString(config.gateway?.password),
      instanceId: normalizeOptionalString(config.gateway?.instanceId),
      tlsFingerprint: normalizeOptionalString(config.gateway?.tlsFingerprint),
    },
  };
}

export async function resolveWindowsCompanionRuntimeConfig(params: {
  env?: NodeJS.ProcessEnv;
  overrides?: Partial<WindowsCompanionConfig>;
} = {}): Promise<WindowsCompanionRuntimeConfig> {
  const env = params.env ?? process.env;
  const existing = await loadWindowsCompanionConfig(env);
  return normalizeRuntimeConfig(
    resolveWindowsCompanionConfigFromSources({
      env,
      existing,
      overrides: params.overrides,
    }),
  );
}

export function createDesktopWindowsCompanionHostFromConfig(
  config: WindowsCompanionRuntimeConfig,
  options: Omit<DesktopWindowsCompanionHostOptions, "shellAppLabel" | "gatewayClientOptions"> = {},
): DesktopWindowsCompanionHost {
  return new DesktopWindowsCompanionHost({
    ...options,
    shellAppLabel: config.shellAppLabel,
    gatewayClientOptions: {
      url: config.gateway.url,
      token: config.gateway.token,
      bootstrapToken: config.gateway.bootstrapToken,
      deviceToken: config.gateway.deviceToken,
      password: config.gateway.password,
      instanceId: config.gateway.instanceId,
      tlsFingerprint: config.gateway.tlsFingerprint,
      role: "desktop_companion",
      clientName: "gateway-client",
      clientDisplayName: "OpenClaw Windows Companion",
      mode: "backend",
      platform: "windows",
      scopes: ["desktop:write"],
    },
  });
}

export async function runDesktopWindowsCompanionForeground(params: {
  env?: NodeJS.ProcessEnv;
  headless?: boolean;
  overrides?: Partial<WindowsCompanionConfig>;
} = {}): Promise<void> {
  const env = params.env ?? process.env;
  const recoveryDelayMs = resolveWindowsCompanionRecoveryDelayMs(env);
  if (recoveryDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, recoveryDelayMs));
  }
  const runtimeConfig = await resolveWindowsCompanionRuntimeConfig(params);
  const mode: WindowsCompanionRuntimeMode =
    process.platform === "win32" && !params.headless ? "interactive" : "headless";
  const recoveryPolicy = resolveWindowsCompanionRecoveryPolicy({ env, mode });
  const singletonResult = await acquireWindowsCompanionSingleton({
    env,
    profile: runtimeConfig.profile ?? null,
    mode,
  });
  const managedAutostart =
    normalizeLowercaseStringOrEmpty(env.OPENCLAW_SERVICE_KIND) === WINDOWS_COMPANION_SERVICE_KIND;
  if (!singletonResult.acquired) {
    if (!managedAutostart && mode === "interactive") {
      await dashboardCommand(defaultRuntime, {
        controlUiPath:
          singletonResult.state.currentDashboardTarget
          ?? singletonResult.state.lastDashboardTarget
          ?? undefined,
      }).catch(() => undefined);
    }
    return;
  }
  const singletonHandle = singletonResult.handle;
  let trayAttentionState: WindowsCompanionTrayAttentionState | null = null;
  let trayHandle: WindowsCompanionTrayHandle | null = null;
  let lastTrayHealthState: WindowsCompanionTrayHealthState = "degraded";
  let lastTrayStatusLine = "starting";
  let trayRecoveryAttempts = 0;
  let trayRecoveryInFlight = false;
  let recoveryState: WindowsCompanionRecoveryState = "idle";
  let lastPendingNativeActionCount = 0;
  let lastPendingActionSessionKey: string | null = null;
  let lastPendingActionId: string | null = null;
  let lastResolvedActionSessionKey: string | null = null;
  let lastResolvedActionId: string | null = null;
  let lastResolvedActionOutcome: "completed" | "rejected" | null = null;
  let lastDashboardTarget: string | null = null;
  let lastAttentionTargetReason: WindowsCompanionDashboardTargetReason = null;
  const host = createDesktopWindowsCompanionHostFromConfig(runtimeConfig, {
    onActionRequired: ({ actionId, sessionKey, title }) => {
      lastPendingNativeActionCount = Math.max(lastPendingNativeActionCount, 1);
      lastPendingActionSessionKey = normalizeOptionalString(sessionKey) ?? null;
      lastPendingActionId = normalizeOptionalString(actionId) ?? null;
      lastResolvedActionSessionKey = null;
      lastResolvedActionId = null;
      lastResolvedActionOutcome = null;
      const next = updateWindowsCompanionTrayAttention({
        previous: trayAttentionState,
        healthState: lastTrayHealthState,
        shellAppLabel: runtimeConfig.shellAppLabel,
        actionRequired: {
          actionId,
          title,
        },
      });
      trayAttentionState = next.attentionState;
      const dashboardTarget = resolveCurrentDashboardTarget();
      void singletonHandle.update({
        lastNotificationKind: next.notification?.kind ?? trayAttentionState.lastNotificationKind ?? null,
        lastNotificationAt: next.notification?.createdAt ?? trayAttentionState.lastNotificationAt ?? null,
        statusLine: lastTrayStatusLine,
        trayHealthState: lastTrayHealthState,
        recoveryState,
        recoveryAttemptCount: recoveryPolicy.recoveryAttemptCount + trayRecoveryAttempts,
        currentDashboardTarget: dashboardTarget.controlUiPath,
        currentPendingActionId: dashboardTarget.actionId,
        currentResolvedActionId: dashboardTarget.resultActionId,
        lastResolvedActionOutcome,
        lastAttentionTargetReason: dashboardTarget.reason,
      });
      if (trayHandle && next.notification) {
        void trayHandle.update(
          renderCurrentTrayState(next.notification),
        );
      }
    },
    onActionResolved: ({ actionId, sessionKey, outcome }) => {
      lastPendingNativeActionCount = 0;
      lastPendingActionSessionKey = null;
      lastPendingActionId = null;
      lastResolvedActionSessionKey = normalizeOptionalString(sessionKey) ?? null;
      lastResolvedActionId = normalizeOptionalString(actionId) ?? null;
      lastResolvedActionOutcome = outcome;
      const dashboardTarget = resolveCurrentDashboardTarget();
      void singletonHandle.update({
        statusLine: lastTrayStatusLine,
        trayHealthState: lastTrayHealthState,
        recoveryState,
        recoveryAttemptCount: recoveryPolicy.recoveryAttemptCount + trayRecoveryAttempts,
        currentDashboardTarget: dashboardTarget.controlUiPath,
        currentPendingActionId: dashboardTarget.actionId,
        currentResolvedActionId: dashboardTarget.resultActionId,
        lastResolvedActionOutcome,
        lastAttentionTargetReason: dashboardTarget.reason,
      });
      if (trayHandle) {
        void trayHandle.update(renderCurrentTrayState());
      }
    },
  });
  let shuttingDown = false;
  let trayCommandOffset = 0;
  let trayCommandTimer: NodeJS.Timeout | null = null;
  let trayStatusTimer: NodeJS.Timeout | null = null;
  let trayActionQueue: Promise<void> = Promise.resolve();

  async function updateLocalRuntimeDiagnostics(params: {
    trayHealthState?: WindowsCompanionTrayHealthState | null;
    statusLine?: string | null;
    lastNotificationKind?: WindowsCompanionTrayAttentionState["lastNotificationKind"] | null;
    lastNotificationAt?: string | null;
    recoveryState?: WindowsCompanionRecoveryState | null;
    lastRecoveryReason?: WindowsCompanionRecoveryReason | null;
    lastRecoveryAt?: string | null;
    recoveryAttemptCount?: number | null;
    currentDashboardTarget?: string | null;
    lastDashboardTarget?: string | null;
    currentPendingActionId?: string | null;
    currentResolvedActionId?: string | null;
    lastResolvedActionOutcome?: "completed" | "rejected" | null;
    lastDashboardTargetActionId?: string | null;
    lastDashboardTargetResultActionId?: string | null;
    lastAttentionTargetReason?: WindowsCompanionDashboardTargetReason | null;
  }): Promise<void> {
    await singletonHandle.update({
      trayHealthState: params.trayHealthState ?? lastTrayHealthState,
      statusLine: params.statusLine ?? lastTrayStatusLine,
      lastNotificationKind: params.lastNotificationKind ?? trayAttentionState?.lastNotificationKind ?? null,
      lastNotificationAt: params.lastNotificationAt ?? trayAttentionState?.lastNotificationAt ?? null,
      recoveryState: params.recoveryState ?? recoveryState,
      lastRecoveryReason: params.lastRecoveryReason ?? null,
      lastRecoveryAt: params.lastRecoveryAt ?? null,
      recoveryAttemptCount:
        params.recoveryAttemptCount ?? recoveryPolicy.recoveryAttemptCount + trayRecoveryAttempts,
      currentDashboardTarget:
        params.currentDashboardTarget ?? resolveCurrentDashboardTarget().controlUiPath,
      currentPendingActionId:
        params.currentPendingActionId ?? resolveCurrentDashboardTarget().actionId,
      currentResolvedActionId:
        params.currentResolvedActionId ?? resolveCurrentDashboardTarget().resultActionId,
      lastResolvedActionOutcome:
        params.lastResolvedActionOutcome ?? lastResolvedActionOutcome,
      lastDashboardTarget: params.lastDashboardTarget ?? lastDashboardTarget,
      lastDashboardTargetActionId: params.lastDashboardTargetActionId ?? null,
      lastDashboardTargetResultActionId: params.lastDashboardTargetResultActionId ?? null,
      lastAttentionTargetReason:
        params.lastAttentionTargetReason ?? lastAttentionTargetReason,
    });
  }

  function resolveCurrentDashboardTarget(): WindowsCompanionDashboardTarget {
    const target = resolveWindowsCompanionDashboardTarget({
      healthState: lastTrayHealthState,
      pendingNativeActionCount: lastPendingNativeActionCount,
      pendingActionSessionKey: lastPendingActionSessionKey,
      pendingActionId: lastPendingActionId,
      resolvedActionSessionKey: lastResolvedActionSessionKey,
      resolvedActionId: lastResolvedActionId,
      resolvedActionOutcome: lastResolvedActionOutcome,
    });
    lastAttentionTargetReason = target.reason;
    return target;
  }

  function renderCurrentTrayState(
    notification?: Parameters<typeof renderWindowsCompanionTrayState>[0]["notification"],
  ) {
    const dashboardTarget = resolveCurrentDashboardTarget();
    return renderWindowsCompanionTrayState({
      healthState: lastTrayHealthState,
      mode: mode as WindowsCompanionTrayMode,
      shellAppLabel: runtimeConfig.shellAppLabel,
      statusLine: lastTrayStatusLine,
      primaryAction: dashboardTarget.primaryAction,
      primaryActionLabel: dashboardTarget.primaryActionLabel,
      reviewDesktopHealthVisible: dashboardTarget.reviewDesktopHealthVisible,
      notification,
    });
  }

  async function shutdown(exitCode = 0): Promise<void> {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    try {
      if (trayCommandTimer) {
        clearInterval(trayCommandTimer);
        trayCommandTimer = null;
      }
      if (trayStatusTimer) {
        clearInterval(trayStatusTimer);
        trayStatusTimer = null;
      }
      await stopWindowsCompanionTray(trayHandle);
      trayHandle = null;
      await host.background();
      await host.stop();
      await releaseWindowsCompanionSingleton(singletonHandle);
    } finally {
      process.exitCode = exitCode;
    }
  }

  async function shutdownForRecovery(params: {
    exitCode: number;
    state: WindowsCompanionRecoveryState;
    reason: WindowsCompanionRecoveryReason;
    detail?: string;
    attemptCount?: number;
  }): Promise<void> {
    recoveryState = params.state;
    await updateLocalRuntimeDiagnostics({
      recoveryState: params.state,
      lastRecoveryReason: params.reason,
      lastRecoveryAt: new Date().toISOString(),
      recoveryAttemptCount: params.attemptCount ?? recoveryPolicy.recoveryAttemptCount + trayRecoveryAttempts,
      statusLine: params.detail ? `${lastTrayStatusLine} · ${params.detail}` : lastTrayStatusLine,
    });
    await shutdown(params.exitCode);
  }

  function resolveCliInvocation(): { command: string; argsPrefix: string[] } {
    const entrypoint = process.argv[1]?.trim();
    if (entrypoint) {
      return {
        command: process.execPath,
        argsPrefix: [entrypoint],
      };
    }
    return {
      command: "openclaw",
      argsPrefix: [],
    };
  }

  function launchDetachedCli(args: string[]): void {
    const invocation = resolveCliInvocation();
    const child = spawn(invocation.command, [...invocation.argsPrefix, ...args], {
      detached: true,
      env: process.env,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
  }

  async function probeRuntimeStatus(): Promise<WindowsCompanionRuntimeBootstrapStatus> {
    try {
      const { callGateway } = await import("../gateway/call.js");
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
        url: runtimeConfig.gateway.url,
        token: runtimeConfig.gateway.token,
        password: runtimeConfig.gateway.password,
        tlsFingerprint: runtimeConfig.gateway.tlsFingerprint,
        instanceId: runtimeConfig.gateway.instanceId,
        method: "localBridge.status",
        params: undefined,
        clientName: "gateway-client",
        clientDisplayName: "OpenClaw Windows Companion Tray",
        mode: "backend",
        platform: "windows",
        scopes: ["desktop:write"],
        timeoutMs: 10_000,
      });
      const startupPosture = status.startupPosture ?? null;
      const platform = startupPosture?.desktopHostPlatform ?? null;
      return {
        reachable: true,
        processHostState: startupPosture?.processHostState ?? null,
        lifecycleIngressEnabled:
          platform === "windows"
          && startupPosture?.nativeProcessIngressSource === "windows_app_lifecycle",
        localActionRelayEnabled:
          platform === "windows"
          && (startupPosture?.nativeLocalActionTransportSource === "desktop_local_action_push"
            || typeof startupPosture?.pendingNativeActionCount === "number"),
        nativeExecutorEnabled:
          startupPosture?.nativeLocalActionExecutionSource === "windows_local_action_executor"
          || (platform === "windows" && Boolean(startupPosture?.nativeLocalActionCapabilitySummary)),
        nextWakeAt: startupPosture?.nextWakeAt ?? null,
        pendingNativeActionCount:
          typeof startupPosture?.pendingNativeActionCount === "number"
            ? startupPosture.pendingNativeActionCount
            : 0,
      };
    } catch {
      return {
        reachable: false,
        processHostState: null,
        lifecycleIngressEnabled: false,
        localActionRelayEnabled: false,
        nativeExecutorEnabled: false,
        nextWakeAt: null,
        pendingNativeActionCount: 0,
      };
    }
  }

  async function resolveTrayHealthState(): Promise<{
    healthState: WindowsCompanionTrayHealthState;
    statusLine: string;
    pendingNativeActionCount: number;
  }> {
    const [bootstrapStatus, runtimeStatus] = await Promise.all([
      resolveWindowsInstallerBootstrapStatus({ env: params.env }),
      probeRuntimeStatus(),
    ]);
    if (
      bootstrapStatus.partialFailure
      || !bootstrapStatus.gatewayInstalled
      || (bootstrapStatus.companionConfigured && !bootstrapStatus.companionInstalled)
    ) {
      return {
        healthState: "repair_needed",
        statusLine: "repair needed",
        pendingNativeActionCount: runtimeStatus.pendingNativeActionCount,
      };
    }
    if (
      runtimeStatus.reachable
      && runtimeStatus.lifecycleIngressEnabled
      && runtimeStatus.localActionRelayEnabled
      && runtimeStatus.nativeExecutorEnabled
    ) {
      return {
        healthState: "healthy",
        statusLine: runtimeStatus.processHostState
          ? `healthy · ${runtimeStatus.processHostState}`
          : "healthy",
        pendingNativeActionCount: runtimeStatus.pendingNativeActionCount,
      };
    }
    return {
      healthState: "degraded",
      statusLine: runtimeStatus.reachable ? "degraded" : "gateway unreachable",
      pendingNativeActionCount: runtimeStatus.pendingNativeActionCount,
    };
  }

  async function updateTrayState(): Promise<void> {
    const { healthState, statusLine, pendingNativeActionCount } = await resolveTrayHealthState();
    lastTrayHealthState = healthState;
    lastTrayStatusLine = statusLine;
    lastPendingNativeActionCount = pendingNativeActionCount;
    if (pendingNativeActionCount === 0) {
      lastPendingActionSessionKey = null;
      lastPendingActionId = null;
    }
    const next = updateWindowsCompanionTrayAttention({
      previous: trayAttentionState,
      healthState,
      shellAppLabel: runtimeConfig.shellAppLabel,
      notifyOnRecovery: true,
    });
    trayAttentionState = next.attentionState;
    await updateLocalRuntimeDiagnostics({
      trayHealthState: healthState,
      statusLine,
      lastNotificationKind: next.notification?.kind ?? trayAttentionState.lastNotificationKind ?? null,
      lastNotificationAt: next.notification?.createdAt ?? trayAttentionState.lastNotificationAt ?? null,
      currentDashboardTarget: resolveCurrentDashboardTarget().controlUiPath,
      currentPendingActionId: resolveCurrentDashboardTarget().actionId,
      currentResolvedActionId: resolveCurrentDashboardTarget().resultActionId,
      lastResolvedActionOutcome,
      lastAttentionTargetReason,
    });
    if (!trayHandle) {
      return;
    }
    try {
      await trayHandle.update(renderCurrentTrayState(next.notification));
    } catch (error) {
      await handleTrayAdapterFailure(error);
    }
  }

  async function handleTrayAction(action: WindowsCompanionTrayAction): Promise<void> {
    switch (action) {
      case "open_dashboard": {
        const target = resolveCurrentDashboardTarget();
        await openWindowsCompanionDashboardTarget(target, defaultRuntime);
        lastDashboardTarget = target.controlUiPath;
        await updateLocalRuntimeDiagnostics({
          lastDashboardTarget,
          currentDashboardTarget: target.controlUiPath,
          currentPendingActionId: target.actionId,
          currentResolvedActionId: target.resultActionId,
          lastDashboardTargetActionId: target.actionId,
          lastDashboardTargetResultActionId: target.resultActionId,
          lastResolvedActionOutcome,
          lastAttentionTargetReason: target.reason,
        });
        return;
      }
      case "review_desktop_health": {
        const target = resolveWindowsCompanionDashboardTarget({
          healthState: "degraded",
          pendingNativeActionCount: 0,
          pendingActionSessionKey: null,
          pendingActionId: null,
        });
        await openWindowsCompanionDashboardTarget(target, defaultRuntime);
        lastDashboardTarget = target.controlUiPath;
        await updateLocalRuntimeDiagnostics({
          lastDashboardTarget,
          currentDashboardTarget: resolveCurrentDashboardTarget().controlUiPath,
          currentPendingActionId: resolveCurrentDashboardTarget().actionId,
          currentResolvedActionId: resolveCurrentDashboardTarget().resultActionId,
          lastDashboardTargetActionId: target.actionId,
          lastDashboardTargetResultActionId: target.resultActionId,
          lastResolvedActionOutcome,
          lastAttentionTargetReason: resolveCurrentDashboardTarget().reason,
        });
        return;
      }
      case "repair_openclaw":
        launchDetachedCli(["update", "--repair"]);
        return;
      case "restart_gateway":
        launchDetachedCli(["gateway", "restart"]);
        return;
      case "restart_windows_companion":
        launchDetachedCli(["windows-companion", "restart"]);
        return;
      case "exit_companion":
        await shutdown(0);
        return;
      default:
        return;
    }
  }

  function queueTrayAction(action: WindowsCompanionTrayAction): void {
    trayActionQueue = trayActionQueue.then(async () => {
      if (!shuttingDown) {
        await handleTrayAction(action);
      }
    });
  }

  async function pollTrayCommands(): Promise<void> {
    if (!trayHandle || shuttingDown) {
      return;
    }
    let result;
    try {
      result = await readWindowsCompanionTrayCommands({
        commandPath: trayHandle.commandPath,
        offset: trayCommandOffset,
      });
    } catch (error) {
      await handleTrayAdapterFailure(error);
      return;
    }
    trayCommandOffset = result.offset;
    for (const command of result.commands) {
      queueTrayAction(command.action);
    }
  }

  function attachTrayProcessHandlers(handle: WindowsCompanionTrayHandle): void {
    const trayProcess = handle.process as NodeJS.EventEmitter & {
      once?: (event: string, listener: (...args: unknown[]) => void) => unknown;
    };
    const onUnexpectedExit = () => {
      if (shuttingDown || trayHandle !== handle) {
        return;
      }
      void handleTrayAdapterFailure(new Error("tray adapter exited"));
    };
    trayProcess.once?.("exit", onUnexpectedExit);
    trayProcess.once?.("error", onUnexpectedExit);
  }

  async function startInteractiveTray(): Promise<void> {
    trayHandle = await startWindowsCompanionTray({
      env,
      state: renderCurrentTrayState(),
    });
    attachTrayProcessHandlers(trayHandle);
  }

  async function handleTrayAdapterFailure(error: unknown): Promise<void> {
    if (shuttingDown || mode !== "interactive" || trayRecoveryInFlight) {
      return;
    }
    trayRecoveryInFlight = true;
    trayRecoveryAttempts += 1;
    try {
      await stopWindowsCompanionTray(trayHandle);
      trayHandle = null;
      if (trayRecoveryAttempts <= recoveryPolicy.maxTrayRebuildAttempts) {
        recoveryState = "idle";
        await updateLocalRuntimeDiagnostics({
          recoveryState,
          lastRecoveryReason: "tray_adapter_failed",
          lastRecoveryAt: new Date().toISOString(),
          recoveryAttemptCount: recoveryPolicy.recoveryAttemptCount + trayRecoveryAttempts,
          statusLine: "recovering tray adapter",
          trayHealthState: "degraded",
        });
        try {
          await startInteractiveTray();
          await updateTrayState();
          return;
        } catch {
          // fall through to headless fallback below
        }
      }
      recoveryState = "headless_fallback";
      await updateLocalRuntimeDiagnostics({
        recoveryState,
        lastRecoveryReason: "tray_adapter_failed",
        lastRecoveryAt: new Date().toISOString(),
        recoveryAttemptCount: recoveryPolicy.recoveryAttemptCount + trayRecoveryAttempts,
        trayHealthState: "degraded",
        statusLine:
          error instanceof Error
            ? `headless fallback · ${error.message}`
            : "headless fallback · tray unavailable",
      });
    } finally {
      trayRecoveryInFlight = false;
    }
  }

  async function handleFatalHostRuntimeFailure(error: unknown): Promise<void> {
    const result = restartWindowsCompanionProcessWithFreshPid({
      env,
      mode,
      reason: "host_runtime_failed",
      policy: recoveryPolicy,
    });
    await shutdownForRecovery({
      exitCode: result.handled ? 0 : 1,
      state: result.state,
      reason: "host_runtime_failed",
      detail:
        result.detail
        ?? (error instanceof Error ? error.message : String(error)),
      attemptCount: result.attemptCount,
    });
  }

  try {
    await host.start();
    await host.foreground();
  } catch (error) {
    await handleFatalHostRuntimeFailure(error);
    return;
  }

  if (mode === "interactive") {
    try {
      await startInteractiveTray();
    } catch (error) {
      await handleTrayAdapterFailure(error);
    }
    await updateTrayState();
    trayCommandTimer = setInterval(() => {
      void pollTrayCommands().catch((error) => {
        void handleTrayAdapterFailure(error);
      });
    }, 500);
    trayStatusTimer = setInterval(() => {
      void updateTrayState().catch((error) => {
        void handleTrayAdapterFailure(error);
      });
    }, 15_000);
  }

  await updateLocalRuntimeDiagnostics({
    recoveryState,
    recoveryAttemptCount: recoveryPolicy.recoveryAttemptCount + trayRecoveryAttempts,
  });

  process.once("SIGINT", () => {
    void shutdown(0);
  });
  process.once("SIGTERM", () => {
    void shutdown(0);
  });
  process.once("beforeExit", () => {
    void shutdown(process.exitCode ?? 0);
  });
}
