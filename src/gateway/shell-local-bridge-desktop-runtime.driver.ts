import {
  resolveShellLocalBridgeHealthFeedDriverDecision,
  type ShellLocalBridgeHealthFeedDriverDecision,
} from "./shell-app-contract.js";
import {
  runDesktopShellRuntimeSchedulerCycle,
  type DesktopShellRuntimeSchedulerCycleResult,
} from "./shell-local-bridge-desktop-runtime.scheduler.js";
import { updateLocalBridgeStartupPosture } from "./shell-local-bridge-provider-runtime.js";

export type DesktopShellRuntimeDriverOptions = {
  runtimeLabel?: string;
  shellAppLabel?: string;
  moduleLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  lastRunAt?: number | null;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
};

export type DesktopShellRuntimeDriverCycleResult = {
  schedulerCycle: DesktopShellRuntimeSchedulerCycleResult;
  heartbeatCycle: DesktopShellRuntimeSchedulerCycleResult["heartbeatCycle"];
  healthFeed: DesktopShellRuntimeSchedulerCycleResult["healthFeed"];
  pollingDecision: DesktopShellRuntimeSchedulerCycleResult["pollingDecision"];
  schedulerDecision: DesktopShellRuntimeSchedulerCycleResult["schedulerDecision"];
  driverDecision: ShellLocalBridgeHealthFeedDriverDecision;
  driverState: ShellLocalBridgeHealthFeedDriverDecision["driverState"];
  nextRunAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  driverSummary: string;
};

export function runDesktopShellRuntimeDriverCycle(
  options: DesktopShellRuntimeDriverOptions = {},
): DesktopShellRuntimeDriverCycleResult {
  const now = options.now ?? Date.now();
  const schedulerCycle = runDesktopShellRuntimeSchedulerCycle({
    runtimeLabel: options.runtimeLabel,
    shellAppLabel: options.shellAppLabel,
    moduleLabel: options.moduleLabel,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    now,
    recommendedDelayMsOverride: options.recommendedDelayMsOverride,
    retryBackoffMsOverride: options.retryBackoffMsOverride,
  });
  const driverDecision = resolveShellLocalBridgeHealthFeedDriverDecision({
    schedulerDecision: schedulerCycle.schedulerDecision,
    healthFeed: schedulerCycle.healthFeed,
    healthStatus:
      schedulerCycle.heartbeatCycle.heartbeat?.healthStatus
      ?? schedulerCycle.healthFeed.latestHealthStatus
      ?? undefined,
    attached: options.attached ?? schedulerCycle.heartbeatCycle.heartbeat?.attached,
    readiness: options.adapterReadiness ?? schedulerCycle.heartbeatCycle.heartbeat?.adapterReadiness,
    now,
  });
  updateLocalBridgeStartupPosture({
    nextRunAt: driverDecision.nextRunAt,
    recommendedDelayMs: driverDecision.recommendedDelayMs,
    retryBackoffMs: driverDecision.retryBackoffMs,
    driverState: driverDecision.driverState,
    driverSummary: driverDecision.driverSummary,
  });
  return {
    schedulerCycle,
    heartbeatCycle: schedulerCycle.heartbeatCycle,
    healthFeed: schedulerCycle.healthFeed,
    pollingDecision: schedulerCycle.pollingDecision,
    schedulerDecision: schedulerCycle.schedulerDecision,
    driverDecision,
    driverState: driverDecision.driverState,
    nextRunAt: driverDecision.nextRunAt,
    recommendedDelayMs: driverDecision.recommendedDelayMs,
    retryBackoffMs: driverDecision.retryBackoffMs,
    driverSummary: driverDecision.driverSummary,
  };
}
