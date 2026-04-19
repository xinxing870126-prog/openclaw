import {
  resolveShellLocalBridgeHealthFeedTimerDecision,
  type ShellLocalBridgeHealthFeedTimerDecision,
} from "./shell-app-contract.js";
import {
  runDesktopShellRuntimeDriverCycle,
  type DesktopShellRuntimeDriverCycleResult,
} from "./shell-local-bridge-desktop-runtime.driver.js";
import { updateLocalBridgeStartupPosture } from "./shell-local-bridge-provider-runtime.js";

export type DesktopShellRuntimeTimerOptions = {
  runtimeLabel?: string;
  shellAppLabel?: string;
  moduleLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  lastTickAt?: number | null;
  timerArmed?: boolean;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
};

export type DesktopShellRuntimeTimerSnapshot = {
  driverDecision: ShellLocalBridgeHealthFeedTimerDecision["timerState"] extends never
    ? never
    : DesktopShellRuntimeDriverCycleResult["driverDecision"];
  timerDecision: ShellLocalBridgeHealthFeedTimerDecision;
  timerState: ShellLocalBridgeHealthFeedTimerDecision["timerState"];
  shouldArmTimer: boolean;
  scheduledAt: string | null;
  nextTickAt: string | null;
  lastTickAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  timerSummary: string;
};

export type DesktopShellRuntimeTimerTickResult = {
  driverCycle: DesktopShellRuntimeDriverCycleResult;
  heartbeatCycle: DesktopShellRuntimeDriverCycleResult["heartbeatCycle"];
  healthFeed: DesktopShellRuntimeDriverCycleResult["healthFeed"];
  pollingDecision: DesktopShellRuntimeDriverCycleResult["pollingDecision"];
  schedulerDecision: DesktopShellRuntimeDriverCycleResult["schedulerDecision"];
  driverDecision: DesktopShellRuntimeDriverCycleResult["driverDecision"];
  timerDecision: ShellLocalBridgeHealthFeedTimerDecision;
  timerState: ShellLocalBridgeHealthFeedTimerDecision["timerState"];
  shouldArmTimer: boolean;
  scheduledAt: string | null;
  nextTickAt: string | null;
  lastTickAt: string | null;
  driverState: DesktopShellRuntimeDriverCycleResult["driverState"];
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  timerSummary: string;
};

export function resolveDesktopShellRuntimeTimerSnapshot(params: {
  driverCycle: DesktopShellRuntimeDriverCycleResult;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  lastTickAt?: number | null;
  timerArmed?: boolean;
}): DesktopShellRuntimeTimerSnapshot {
  const now = params.now ?? Date.now();
  const timerDecision = resolveShellLocalBridgeHealthFeedTimerDecision({
    driverDecision: params.driverCycle.driverDecision,
    healthFeed: params.driverCycle.healthFeed,
    healthStatus:
      params.driverCycle.heartbeatCycle.heartbeat?.healthStatus
      ?? params.driverCycle.healthFeed.latestHealthStatus
      ?? undefined,
    attached: params.attached ?? params.driverCycle.heartbeatCycle.heartbeat?.attached,
    readiness:
      params.adapterReadiness
      ?? params.driverCycle.heartbeatCycle.heartbeat?.adapterReadiness,
    now,
    lastTickAt: params.lastTickAt,
    timerArmed: params.timerArmed,
  });
  return {
    driverDecision: params.driverCycle.driverDecision,
    timerDecision,
    timerState: timerDecision.timerState,
    shouldArmTimer: timerDecision.shouldArmTimer,
    scheduledAt: timerDecision.scheduledAt,
    nextTickAt: timerDecision.nextTickAt,
    lastTickAt: timerDecision.lastTickAt,
    recommendedDelayMs: timerDecision.recommendedDelayMs,
    retryBackoffMs: timerDecision.retryBackoffMs,
    timerSummary: timerDecision.timerSummary,
  };
}

export function runDesktopShellRuntimeTimerTick(
  options: DesktopShellRuntimeTimerOptions = {},
): DesktopShellRuntimeTimerTickResult {
  const now = options.now ?? Date.now();
  const driverCycle = runDesktopShellRuntimeDriverCycle({
    runtimeLabel: options.runtimeLabel,
    shellAppLabel: options.shellAppLabel,
    moduleLabel: options.moduleLabel,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    now,
    lastRunAt: options.lastTickAt,
    recommendedDelayMsOverride: options.recommendedDelayMsOverride,
    retryBackoffMsOverride: options.retryBackoffMsOverride,
  });
  const snapshot = resolveDesktopShellRuntimeTimerSnapshot({
    driverCycle,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    now,
    lastTickAt: options.lastTickAt ?? now,
    timerArmed: options.timerArmed,
  });
  updateLocalBridgeStartupPosture({
    timerState: snapshot.timerState,
    scheduledAt: snapshot.scheduledAt,
    nextTickAt: snapshot.nextTickAt,
    lastTickAt: snapshot.lastTickAt,
    timerSummary: snapshot.timerSummary,
  });
  return {
    driverCycle,
    heartbeatCycle: driverCycle.heartbeatCycle,
    healthFeed: driverCycle.healthFeed,
    pollingDecision: driverCycle.pollingDecision,
    schedulerDecision: driverCycle.schedulerDecision,
    driverDecision: driverCycle.driverDecision,
    timerDecision: snapshot.timerDecision,
    timerState: snapshot.timerState,
    shouldArmTimer: snapshot.shouldArmTimer,
    scheduledAt: snapshot.scheduledAt,
    nextTickAt: snapshot.nextTickAt,
    lastTickAt: snapshot.lastTickAt,
    driverState: driverCycle.driverState,
    recommendedDelayMs: snapshot.recommendedDelayMs,
    retryBackoffMs: snapshot.retryBackoffMs,
    timerSummary: snapshot.timerSummary,
  };
}
