import {
  resolveShellLocalBridgeRuntimeHostDecision,
  type ShellLocalBridgeRuntimeHostDecision,
} from "./shell-app-contract.js";
import {
  tickDesktopShellRuntimeRunner,
  type DesktopShellRuntimeRunnerTickResult,
} from "./shell-local-bridge-desktop-runtime.runner.js";
import { updateLocalBridgeStartupPosture } from "./shell-local-bridge-provider-runtime.js";

export type DesktopShellRuntimeHostOptions = {
  runtimeLabel?: string;
  shellAppLabel?: string;
  moduleLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  lastTickAt?: number | null;
  hostStarted?: boolean;
  runnerStarted?: boolean;
  timerArmed?: boolean;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
};

export type DesktopShellRuntimeHostSnapshot = {
  runnerTick: DesktopShellRuntimeRunnerTickResult;
  hostDecision: ShellLocalBridgeRuntimeHostDecision;
  hostState: ShellLocalBridgeRuntimeHostDecision["hostState"];
  hostStarted: boolean;
  hostArmed: boolean;
  nextWakeAt: string | null;
  lastWakeStartedAt: string | null;
  lastWakeCompletedAt: string | null;
  hostSummary: string;
};

export type DesktopShellRuntimeHostWakeResult = {
  runnerTick: DesktopShellRuntimeRunnerTickResult;
  timerTick: DesktopShellRuntimeRunnerTickResult["timerTick"];
  driverCycle: DesktopShellRuntimeRunnerTickResult["driverCycle"];
  heartbeatCycle: DesktopShellRuntimeRunnerTickResult["heartbeatCycle"];
  healthFeed: DesktopShellRuntimeRunnerTickResult["healthFeed"];
  pollingDecision: DesktopShellRuntimeRunnerTickResult["pollingDecision"];
  schedulerDecision: DesktopShellRuntimeRunnerTickResult["schedulerDecision"];
  driverDecision: DesktopShellRuntimeRunnerTickResult["driverDecision"];
  timerDecision: DesktopShellRuntimeRunnerTickResult["timerDecision"];
  runnerDecision: DesktopShellRuntimeRunnerTickResult["runnerDecision"];
  runnerState: DesktopShellRuntimeRunnerTickResult["runnerState"];
  hostDecision: ShellLocalBridgeRuntimeHostDecision;
  hostState: ShellLocalBridgeRuntimeHostDecision["hostState"];
  hostStarted: boolean;
  hostArmed: boolean;
  nextWakeAt: string | null;
  lastWakeStartedAt: string | null;
  lastWakeCompletedAt: string | null;
  recommendedDelayMs: DesktopShellRuntimeRunnerTickResult["recommendedDelayMs"];
  retryBackoffMs: DesktopShellRuntimeRunnerTickResult["retryBackoffMs"];
  hostSummary: string;
};

export function resolveDesktopShellRuntimeHostSnapshot(params: {
  runnerTick: DesktopShellRuntimeRunnerTickResult;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  hostStarted?: boolean;
  now?: number;
}): DesktopShellRuntimeHostSnapshot {
  const now = params.now ?? Date.now();
  const hostDecision = resolveShellLocalBridgeRuntimeHostDecision({
    runnerState: params.runnerTick.runnerState,
    nextWakeAt: params.runnerTick.nextWakeAt,
    healthFeed: params.runnerTick.healthFeed,
    healthStatus:
      params.runnerTick.heartbeatCycle.heartbeat?.healthStatus
      ?? params.runnerTick.healthFeed.latestHealthStatus
      ?? undefined,
    attached: params.attached ?? params.runnerTick.heartbeatCycle.heartbeat?.attached,
    readiness:
      params.adapterReadiness
      ?? params.runnerTick.heartbeatCycle.heartbeat?.adapterReadiness,
    hostStarted: params.hostStarted,
    now,
  });
  return {
    runnerTick: params.runnerTick,
    hostDecision,
    hostState: hostDecision.hostState,
    hostStarted: hostDecision.hostStarted,
    hostArmed: hostDecision.hostArmed,
    nextWakeAt: hostDecision.nextWakeAt,
    lastWakeStartedAt: hostDecision.lastWakeStartedAt,
    lastWakeCompletedAt: hostDecision.lastWakeCompletedAt,
    hostSummary: hostDecision.hostSummary,
  };
}

export function startDesktopShellRuntimeHost(
  options: DesktopShellRuntimeHostOptions = {},
): DesktopShellRuntimeHostWakeResult {
  return wakeDesktopShellRuntimeHost({
    ...options,
    hostStarted: true,
  });
}

export function wakeDesktopShellRuntimeHost(
  options: DesktopShellRuntimeHostOptions = {},
): DesktopShellRuntimeHostWakeResult {
  const now = options.now ?? Date.now();
  const runnerTick = tickDesktopShellRuntimeRunner({
    runtimeLabel: options.runtimeLabel,
    shellAppLabel: options.shellAppLabel,
    moduleLabel: options.moduleLabel,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    now,
    lastTickAt: options.lastTickAt,
    runnerStarted: options.runnerStarted ?? true,
    timerArmed: options.timerArmed,
    recommendedDelayMsOverride: options.recommendedDelayMsOverride,
    retryBackoffMsOverride: options.retryBackoffMsOverride,
  });
  const snapshot = resolveDesktopShellRuntimeHostSnapshot({
    runnerTick,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    hostStarted: options.hostStarted ?? true,
    now,
  });
  updateLocalBridgeStartupPosture({
    hostState: snapshot.hostState,
    hostStarted: snapshot.hostStarted,
    hostArmed: snapshot.hostArmed,
    nextWakeAt: snapshot.nextWakeAt,
    lastWakeStartedAt: snapshot.lastWakeStartedAt,
    lastWakeCompletedAt: snapshot.lastWakeCompletedAt,
    hostSummary: snapshot.hostSummary,
  });
  return {
    runnerTick,
    timerTick: runnerTick.timerTick,
    driverCycle: runnerTick.driverCycle,
    heartbeatCycle: runnerTick.heartbeatCycle,
    healthFeed: runnerTick.healthFeed,
    pollingDecision: runnerTick.pollingDecision,
    schedulerDecision: runnerTick.schedulerDecision,
    driverDecision: runnerTick.driverDecision,
    timerDecision: runnerTick.timerDecision,
    runnerDecision: runnerTick.runnerDecision,
    runnerState: runnerTick.runnerState,
    hostDecision: snapshot.hostDecision,
    hostState: snapshot.hostState,
    hostStarted: snapshot.hostStarted,
    hostArmed: snapshot.hostArmed,
    nextWakeAt: snapshot.nextWakeAt,
    lastWakeStartedAt: snapshot.lastWakeStartedAt,
    lastWakeCompletedAt: snapshot.lastWakeCompletedAt,
    recommendedDelayMs: runnerTick.recommendedDelayMs,
    retryBackoffMs: runnerTick.retryBackoffMs,
    hostSummary: snapshot.hostSummary,
  };
}

export function stopDesktopShellRuntimeHost(
  options: Pick<DesktopShellRuntimeHostOptions, "now"> = {},
): ShellLocalBridgeRuntimeHostDecision {
  const now = options.now ?? Date.now();
  const hostDecision: ShellLocalBridgeRuntimeHostDecision = {
    hostState: "stopped",
    hostStarted: false,
    hostArmed: false,
    shouldWakeNow: false,
    nextWakeAt: null,
    lastWakeStartedAt: null,
    lastWakeCompletedAt: new Date(now).toISOString(),
    hostSummary: "Desktop runtime host is stopped until the desktop main process starts the cadence loop again.",
  };
  updateLocalBridgeStartupPosture({
    hostState: hostDecision.hostState,
    hostStarted: hostDecision.hostStarted,
    hostArmed: hostDecision.hostArmed,
    nextWakeAt: hostDecision.nextWakeAt,
    lastWakeStartedAt: hostDecision.lastWakeStartedAt,
    lastWakeCompletedAt: hostDecision.lastWakeCompletedAt,
    hostSummary: hostDecision.hostSummary,
  });
  return hostDecision;
}
