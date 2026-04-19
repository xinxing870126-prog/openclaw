import {
  resolveShellLocalBridgeRuntimeRunnerDecision,
  type ShellLocalBridgeRuntimeRunnerDecision,
} from "./shell-app-contract.js";
import {
  runDesktopShellRuntimeTimerTick,
  type DesktopShellRuntimeTimerTickResult,
} from "./shell-local-bridge-desktop-runtime.timer.js";
import { updateLocalBridgeStartupPosture } from "./shell-local-bridge-provider-runtime.js";

export type DesktopShellRuntimeRunnerOptions = {
  runtimeLabel?: string;
  shellAppLabel?: string;
  moduleLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  lastTickAt?: number | null;
  runnerStarted?: boolean;
  timerArmed?: boolean;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
};

export type DesktopShellRuntimeRunnerSnapshot = {
  timerTick: DesktopShellRuntimeTimerTickResult;
  runnerDecision: ShellLocalBridgeRuntimeRunnerDecision;
  runnerState: ShellLocalBridgeRuntimeRunnerDecision["runnerState"];
  shouldKeepRunning: boolean;
  armed: boolean;
  nextWakeAt: string | null;
  lastTickStartedAt: string | null;
  lastTickCompletedAt: string | null;
  runnerSummary: string;
};

export type DesktopShellRuntimeRunnerTickResult = {
  timerTick: DesktopShellRuntimeTimerTickResult;
  driverCycle: DesktopShellRuntimeTimerTickResult["driverCycle"];
  heartbeatCycle: DesktopShellRuntimeTimerTickResult["heartbeatCycle"];
  healthFeed: DesktopShellRuntimeTimerTickResult["healthFeed"];
  pollingDecision: DesktopShellRuntimeTimerTickResult["pollingDecision"];
  schedulerDecision: DesktopShellRuntimeTimerTickResult["schedulerDecision"];
  driverDecision: DesktopShellRuntimeTimerTickResult["driverDecision"];
  timerDecision: DesktopShellRuntimeTimerTickResult["timerDecision"];
  runnerDecision: ShellLocalBridgeRuntimeRunnerDecision;
  runnerState: ShellLocalBridgeRuntimeRunnerDecision["runnerState"];
  shouldKeepRunning: boolean;
  armed: boolean;
  nextWakeAt: string | null;
  lastTickStartedAt: string | null;
  lastTickCompletedAt: string | null;
  timerState: DesktopShellRuntimeTimerTickResult["timerState"];
  scheduledAt: string | null;
  nextTickAt: string | null;
  lastTickAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  runnerSummary: string;
};

export function resolveDesktopShellRuntimeRunnerSnapshot(params: {
  timerTick: DesktopShellRuntimeTimerTickResult;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  runnerStarted?: boolean;
  lastTickAt?: number | null;
}): DesktopShellRuntimeRunnerSnapshot {
  const now = params.now ?? Date.now();
  const runnerDecision = resolveShellLocalBridgeRuntimeRunnerDecision({
    timerDecision: params.timerTick.timerDecision,
    healthFeed: params.timerTick.healthFeed,
    healthStatus:
      params.timerTick.heartbeatCycle.heartbeat?.healthStatus
      ?? params.timerTick.healthFeed.latestHealthStatus
      ?? undefined,
    attached: params.attached ?? params.timerTick.heartbeatCycle.heartbeat?.attached,
    readiness:
      params.adapterReadiness
      ?? params.timerTick.heartbeatCycle.heartbeat?.adapterReadiness,
    now,
    runnerStarted: params.runnerStarted,
    lastTickAt: params.lastTickAt,
  });
  return {
    timerTick: params.timerTick,
    runnerDecision,
    runnerState: runnerDecision.runnerState,
    shouldKeepRunning: runnerDecision.shouldKeepRunning,
    armed: runnerDecision.armed,
    nextWakeAt: runnerDecision.nextWakeAt,
    lastTickStartedAt: runnerDecision.lastTickStartedAt,
    lastTickCompletedAt: runnerDecision.lastTickCompletedAt,
    runnerSummary: runnerDecision.runnerSummary,
  };
}

export function startDesktopShellRuntimeRunner(
  options: DesktopShellRuntimeRunnerOptions = {},
): DesktopShellRuntimeRunnerTickResult {
  return tickDesktopShellRuntimeRunner({
    ...options,
    runnerStarted: true,
  });
}

export function tickDesktopShellRuntimeRunner(
  options: DesktopShellRuntimeRunnerOptions = {},
): DesktopShellRuntimeRunnerTickResult {
  const now = options.now ?? Date.now();
  const timerTick = runDesktopShellRuntimeTimerTick({
    runtimeLabel: options.runtimeLabel,
    shellAppLabel: options.shellAppLabel,
    moduleLabel: options.moduleLabel,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    now,
    lastTickAt: options.lastTickAt,
    timerArmed: options.timerArmed,
    recommendedDelayMsOverride: options.recommendedDelayMsOverride,
    retryBackoffMsOverride: options.retryBackoffMsOverride,
  });
  const snapshot = resolveDesktopShellRuntimeRunnerSnapshot({
    timerTick,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    now,
    runnerStarted: options.runnerStarted ?? true,
    lastTickAt: options.lastTickAt ?? now,
  });
  updateLocalBridgeStartupPosture({
    runnerState: snapshot.runnerState,
    nextWakeAt: snapshot.nextWakeAt,
    lastTickStartedAt: snapshot.lastTickStartedAt,
    lastTickCompletedAt: snapshot.lastTickCompletedAt,
    runnerServiceSummary: snapshot.runnerSummary,
  });
  return {
    timerTick,
    driverCycle: timerTick.driverCycle,
    heartbeatCycle: timerTick.heartbeatCycle,
    healthFeed: timerTick.healthFeed,
    pollingDecision: timerTick.pollingDecision,
    schedulerDecision: timerTick.schedulerDecision,
    driverDecision: timerTick.driverDecision,
    timerDecision: timerTick.timerDecision,
    runnerDecision: snapshot.runnerDecision,
    runnerState: snapshot.runnerState,
    shouldKeepRunning: snapshot.shouldKeepRunning,
    armed: snapshot.armed,
    nextWakeAt: snapshot.nextWakeAt,
    lastTickStartedAt: snapshot.lastTickStartedAt,
    lastTickCompletedAt: snapshot.lastTickCompletedAt,
    timerState: timerTick.timerState,
    scheduledAt: timerTick.scheduledAt,
    nextTickAt: timerTick.nextTickAt,
    lastTickAt: timerTick.lastTickAt,
    recommendedDelayMs: timerTick.recommendedDelayMs,
    retryBackoffMs: timerTick.retryBackoffMs,
    runnerSummary: snapshot.runnerSummary,
  };
}

export function stopDesktopShellRuntimeRunner(
  options: Pick<DesktopShellRuntimeRunnerOptions, "now" | "lastTickAt"> = {},
): ShellLocalBridgeRuntimeRunnerDecision {
  const now = options.now ?? Date.now();
  const runnerDecision: ShellLocalBridgeRuntimeRunnerDecision = {
    runnerState: "stopped",
    shouldKeepRunning: false,
    armed: false,
    shouldTickNow: false,
    nextWakeAt: null,
    lastTickStartedAt:
      typeof options.lastTickAt === "number" && Number.isFinite(options.lastTickAt)
        ? new Date(options.lastTickAt).toISOString()
        : null,
    lastTickCompletedAt:
      typeof options.lastTickAt === "number" && Number.isFinite(options.lastTickAt)
        ? new Date(options.lastTickAt).toISOString()
        : new Date(now).toISOString(),
    runnerSummary: "Desktop runtime runner is stopped until the desktop main-process loop starts again.",
  };
  updateLocalBridgeStartupPosture({
    runnerState: runnerDecision.runnerState,
    nextWakeAt: runnerDecision.nextWakeAt,
    lastTickStartedAt: runnerDecision.lastTickStartedAt,
    lastTickCompletedAt: runnerDecision.lastTickCompletedAt,
    runnerServiceSummary: runnerDecision.runnerSummary,
  });
  return runnerDecision;
}
