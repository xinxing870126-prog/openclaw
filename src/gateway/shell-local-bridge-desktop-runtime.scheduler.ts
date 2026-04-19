import {
  resolveShellLocalBridgeHealthFeedSchedulerDecision,
  type ShellLocalBridgeHealthFeedSchedulerDecision,
} from "./shell-app-contract.js";
import {
  runDesktopShellRuntimeModuleHeartbeatCycle,
  type DesktopShellRuntimeModuleHeartbeatCycleResult,
} from "./shell-local-bridge-desktop-runtime.module.js";
import { updateLocalBridgeStartupPosture } from "./shell-local-bridge-provider-runtime.js";

export type DesktopShellRuntimeSchedulerOptions = {
  runtimeLabel?: string;
  shellAppLabel?: string;
  moduleLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
};

export type DesktopShellRuntimeSchedulerCycleResult = {
  heartbeatCycle: DesktopShellRuntimeModuleHeartbeatCycleResult;
  healthFeed: DesktopShellRuntimeModuleHeartbeatCycleResult["healthFeed"];
  pollingDecision: DesktopShellRuntimeModuleHeartbeatCycleResult["pollingDecision"];
  schedulerDecision: ShellLocalBridgeHealthFeedSchedulerDecision;
  nextRunAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  runnerSummary: string;
};

export function runDesktopShellRuntimeSchedulerCycle(
  options: DesktopShellRuntimeSchedulerOptions = {},
): DesktopShellRuntimeSchedulerCycleResult {
  const now = options.now ?? Date.now();
  const heartbeatCycle = runDesktopShellRuntimeModuleHeartbeatCycle({
    runtimeLabel: options.runtimeLabel,
    shellAppLabel: options.shellAppLabel,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    now,
  });
  const baseDecision = resolveShellLocalBridgeHealthFeedSchedulerDecision({
    healthFeed: heartbeatCycle.healthFeed,
    healthStatus:
      heartbeatCycle.heartbeat?.healthStatus
      ?? heartbeatCycle.healthFeed.latestHealthStatus
      ?? undefined,
    attached: options.attached ?? heartbeatCycle.heartbeat?.attached,
    readiness: options.adapterReadiness ?? heartbeatCycle.heartbeat?.adapterReadiness,
    now,
  });
  const recommendedDelayMs =
    options.recommendedDelayMsOverride ?? baseDecision.recommendedDelayMs;
  const retryBackoffMs =
    options.retryBackoffMsOverride ?? baseDecision.retryBackoffMs;
  const shouldRunNow =
    recommendedDelayMs === 0 || baseDecision.shouldRunNow;
  const nextRunAt =
    shouldRunNow
      ? new Date(now).toISOString()
      : typeof recommendedDelayMs === "number"
        ? new Date(now + recommendedDelayMs).toISOString()
        : null;
  const schedulerDecision: ShellLocalBridgeHealthFeedSchedulerDecision = {
    ...baseDecision,
    shouldRunNow,
    recommendedDelayMs,
    retryBackoffMs,
    nextRunAt,
  };
  updateLocalBridgeStartupPosture({
    runnerMode: schedulerDecision.runnerMode,
    nextRunAt: schedulerDecision.nextRunAt,
    recommendedDelayMs: schedulerDecision.recommendedDelayMs,
    retryBackoffMs: schedulerDecision.retryBackoffMs,
    runnerSummary: schedulerDecision.runnerSummary,
  });
  return {
    heartbeatCycle,
    healthFeed: heartbeatCycle.healthFeed,
    pollingDecision: heartbeatCycle.pollingDecision,
    schedulerDecision,
    nextRunAt: schedulerDecision.nextRunAt,
    recommendedDelayMs: schedulerDecision.recommendedDelayMs,
    retryBackoffMs: schedulerDecision.retryBackoffMs,
    runnerSummary: schedulerDecision.runnerSummary,
  };
}
