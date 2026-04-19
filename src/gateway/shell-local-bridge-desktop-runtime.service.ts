import {
  resolveShellLocalBridgeRuntimeServiceDecision,
  type ShellLocalBridgeRuntimeServiceDecision,
} from "./shell-app-contract.js";
import {
  wakeDesktopShellRuntimeHost,
  type DesktopShellRuntimeHostWakeResult,
} from "./shell-local-bridge-desktop-runtime.host.js";
import { updateLocalBridgeStartupPosture } from "./shell-local-bridge-provider-runtime.js";

export type DesktopShellRuntimeServiceOptions = {
  runtimeLabel?: string;
  shellAppLabel?: string;
  moduleLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  hostStarted?: boolean;
  runnerStarted?: boolean;
  timerArmed?: boolean;
  serviceOwned?: boolean;
  lastTickAt?: number | null;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
};

export type DesktopShellRuntimeServiceSnapshot = {
  hostWake: DesktopShellRuntimeHostWakeResult;
  serviceDecision: ShellLocalBridgeRuntimeServiceDecision;
  serviceState: ShellLocalBridgeRuntimeServiceDecision["serviceState"];
  serviceOwned: boolean;
  serviceActive: boolean;
  nextWakeAt: string | null;
  lastAcquireAt: string | null;
  lastReleaseAt: string | null;
  serviceSummary: string;
};

export type DesktopShellRuntimeServiceWakeResult = {
  hostWake: DesktopShellRuntimeHostWakeResult;
  runnerTick: DesktopShellRuntimeHostWakeResult["runnerTick"];
  timerTick: DesktopShellRuntimeHostWakeResult["timerTick"];
  driverCycle: DesktopShellRuntimeHostWakeResult["driverCycle"];
  heartbeatCycle: DesktopShellRuntimeHostWakeResult["heartbeatCycle"];
  healthFeed: DesktopShellRuntimeHostWakeResult["healthFeed"];
  pollingDecision: DesktopShellRuntimeHostWakeResult["pollingDecision"];
  schedulerDecision: DesktopShellRuntimeHostWakeResult["schedulerDecision"];
  driverDecision: DesktopShellRuntimeHostWakeResult["driverDecision"];
  timerDecision: DesktopShellRuntimeHostWakeResult["timerDecision"];
  runnerDecision: DesktopShellRuntimeHostWakeResult["runnerDecision"];
  hostDecision: DesktopShellRuntimeHostWakeResult["hostDecision"];
  hostState: DesktopShellRuntimeHostWakeResult["hostState"];
  serviceDecision: ShellLocalBridgeRuntimeServiceDecision;
  serviceState: ShellLocalBridgeRuntimeServiceDecision["serviceState"];
  serviceOwned: boolean;
  serviceActive: boolean;
  nextWakeAt: string | null;
  lastAcquireAt: string | null;
  lastReleaseAt: string | null;
  recommendedDelayMs: DesktopShellRuntimeHostWakeResult["recommendedDelayMs"];
  retryBackoffMs: DesktopShellRuntimeHostWakeResult["retryBackoffMs"];
  hostSummary: string;
  serviceSummary: string;
};

export function resolveDesktopShellRuntimeServiceSnapshot(params: {
  hostWake: DesktopShellRuntimeHostWakeResult;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  serviceOwned?: boolean;
  now?: number;
}): DesktopShellRuntimeServiceSnapshot {
  const now = params.now ?? Date.now();
  const serviceDecision = resolveShellLocalBridgeRuntimeServiceDecision({
    hostState: params.hostWake.hostState,
    nextWakeAt: params.hostWake.nextWakeAt,
    healthFeed: params.hostWake.healthFeed,
    healthStatus:
      params.hostWake.heartbeatCycle.heartbeat?.healthStatus
      ?? params.hostWake.healthFeed.latestHealthStatus
      ?? undefined,
    attached: params.attached ?? params.hostWake.heartbeatCycle.heartbeat?.attached,
    readiness:
      params.adapterReadiness
      ?? params.hostWake.heartbeatCycle.heartbeat?.adapterReadiness,
    serviceOwned: params.serviceOwned,
    now,
  });
  return {
    hostWake: params.hostWake,
    serviceDecision,
    serviceState: serviceDecision.serviceState,
    serviceOwned: serviceDecision.serviceOwned,
    serviceActive: serviceDecision.serviceActive,
    nextWakeAt: serviceDecision.nextWakeAt,
    lastAcquireAt: serviceDecision.lastAcquireAt,
    lastReleaseAt: serviceDecision.lastReleaseAt,
    serviceSummary: serviceDecision.serviceSummary,
  };
}

export function acquireDesktopShellRuntimeService(
  options: DesktopShellRuntimeServiceOptions = {},
): DesktopShellRuntimeServiceWakeResult {
  return wakeDesktopShellRuntimeService({
    ...options,
    serviceOwned: true,
  });
}

export function wakeDesktopShellRuntimeService(
  options: DesktopShellRuntimeServiceOptions = {},
): DesktopShellRuntimeServiceWakeResult {
  const now = options.now ?? Date.now();
  const hostWake = wakeDesktopShellRuntimeHost({
    runtimeLabel: options.runtimeLabel,
    shellAppLabel: options.shellAppLabel,
    moduleLabel: options.moduleLabel,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    now,
    lastTickAt: options.lastTickAt,
    hostStarted: options.hostStarted ?? true,
    runnerStarted: options.runnerStarted ?? true,
    timerArmed: options.timerArmed,
    recommendedDelayMsOverride: options.recommendedDelayMsOverride,
    retryBackoffMsOverride: options.retryBackoffMsOverride,
  });
  const snapshot = resolveDesktopShellRuntimeServiceSnapshot({
    hostWake,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    serviceOwned: options.serviceOwned ?? true,
    now,
  });
  updateLocalBridgeStartupPosture({
    serviceState: snapshot.serviceState,
    serviceOwned: snapshot.serviceOwned,
    serviceActive: snapshot.serviceActive,
    nextWakeAt: snapshot.nextWakeAt,
    lastAcquireAt: snapshot.lastAcquireAt,
    lastReleaseAt: snapshot.lastReleaseAt,
    serviceSummary: snapshot.serviceSummary,
  });
  return {
    hostWake,
    runnerTick: hostWake.runnerTick,
    timerTick: hostWake.timerTick,
    driverCycle: hostWake.driverCycle,
    heartbeatCycle: hostWake.heartbeatCycle,
    healthFeed: hostWake.healthFeed,
    pollingDecision: hostWake.pollingDecision,
    schedulerDecision: hostWake.schedulerDecision,
    driverDecision: hostWake.driverDecision,
    timerDecision: hostWake.timerDecision,
    runnerDecision: hostWake.runnerDecision,
    hostDecision: hostWake.hostDecision,
    hostState: hostWake.hostState,
    serviceDecision: snapshot.serviceDecision,
    serviceState: snapshot.serviceState,
    serviceOwned: snapshot.serviceOwned,
    serviceActive: snapshot.serviceActive,
    nextWakeAt: snapshot.nextWakeAt,
    lastAcquireAt: snapshot.lastAcquireAt,
    lastReleaseAt: snapshot.lastReleaseAt,
    recommendedDelayMs: hostWake.recommendedDelayMs,
    retryBackoffMs: hostWake.retryBackoffMs,
    hostSummary: hostWake.hostSummary,
    serviceSummary: snapshot.serviceSummary,
  };
}

export function releaseDesktopShellRuntimeService(
  options: Pick<DesktopShellRuntimeServiceOptions, "now"> = {},
): ShellLocalBridgeRuntimeServiceDecision {
  const now = options.now ?? Date.now();
  const serviceDecision: ShellLocalBridgeRuntimeServiceDecision = {
    serviceState: "released",
    serviceOwned: false,
    serviceActive: false,
    shouldWakeNow: false,
    nextWakeAt: null,
    lastAcquireAt: null,
    lastReleaseAt: new Date(now).toISOString(),
    serviceSummary:
      "Desktop runtime service owner is released until the desktop main process acquires the cadence loop again.",
  };
  updateLocalBridgeStartupPosture({
    serviceState: serviceDecision.serviceState,
    serviceOwned: serviceDecision.serviceOwned,
    serviceActive: serviceDecision.serviceActive,
    nextWakeAt: serviceDecision.nextWakeAt,
    lastAcquireAt: serviceDecision.lastAcquireAt,
    lastReleaseAt: serviceDecision.lastReleaseAt,
    serviceSummary: serviceDecision.serviceSummary,
  });
  return serviceDecision;
}
