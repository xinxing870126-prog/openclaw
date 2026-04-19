import {
  resolveShellLocalBridgeRuntimeBootstrapDecision,
  type ShellLocalBridgeRuntimeBootstrapDecision,
} from "./shell-app-contract.js";
import {
  bootDesktopShellRuntimeLifecycle,
  resumeDesktopShellRuntimeLifecycle,
  shutdownDesktopShellRuntimeLifecycle,
  suspendDesktopShellRuntimeLifecycle,
  type DesktopShellRuntimeLifecycleOptions,
  type DesktopShellRuntimeLifecycleResult,
} from "./shell-local-bridge-desktop-runtime.lifecycle.js";
import {
  resolveLocalBridgeStartupPosture,
  summarizeLocalBridgeHealthFeed,
  updateLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";

export type DesktopShellRuntimeBootstrapOptions =
  DesktopShellRuntimeLifecycleOptions & {
    bootstrapOwned?: boolean;
  };

export type DesktopShellRuntimeBootstrapSnapshot = {
  lifecycleWake: DesktopShellRuntimeLifecycleResult | null;
  bootstrapDecision: ShellLocalBridgeRuntimeBootstrapDecision;
  serviceState:
    | NonNullable<DesktopShellRuntimeLifecycleResult["serviceState"]>
    | "released";
  lifecycleState: DesktopShellRuntimeLifecycleResult["lifecycleState"] | "inactive";
  bootstrapState: ShellLocalBridgeRuntimeBootstrapDecision["bootstrapState"];
  bootstrapOwned: boolean;
  bootstrapActive: boolean;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastWakeAt: string | null;
  lastSuspendAt: string | null;
  lastStopAt: string | null;
  serviceSummary: string | null;
  lifecycleSummary: string | null;
  bootstrapSummary: string;
};

export type DesktopShellRuntimeBootstrapResult = {
  lifecycleWake: DesktopShellRuntimeLifecycleResult | null;
  serviceWake: DesktopShellRuntimeLifecycleResult["serviceWake"] | null;
  hostWake: DesktopShellRuntimeLifecycleResult["hostWake"] | null;
  runnerTick: DesktopShellRuntimeLifecycleResult["runnerTick"] | null;
  timerTick: DesktopShellRuntimeLifecycleResult["timerTick"] | null;
  driverCycle: DesktopShellRuntimeLifecycleResult["driverCycle"] | null;
  heartbeatCycle: DesktopShellRuntimeLifecycleResult["heartbeatCycle"] | null;
  healthFeed: DesktopShellRuntimeLifecycleResult["healthFeed"] | null;
  pollingDecision: DesktopShellRuntimeLifecycleResult["pollingDecision"] | null;
  schedulerDecision: DesktopShellRuntimeLifecycleResult["schedulerDecision"] | null;
  driverDecision: DesktopShellRuntimeLifecycleResult["driverDecision"] | null;
  timerDecision: DesktopShellRuntimeLifecycleResult["timerDecision"] | null;
  runnerDecision: DesktopShellRuntimeLifecycleResult["runnerDecision"] | null;
  hostDecision: DesktopShellRuntimeLifecycleResult["hostDecision"] | null;
  serviceDecision: DesktopShellRuntimeLifecycleResult["serviceDecision"] | null;
  lifecycleDecision: DesktopShellRuntimeLifecycleResult["lifecycleDecision"] | null;
  serviceState:
    | NonNullable<DesktopShellRuntimeLifecycleResult["serviceState"]>
    | "released";
  lifecycleState: DesktopShellRuntimeLifecycleResult["lifecycleState"] | "inactive";
  bootstrapDecision: ShellLocalBridgeRuntimeBootstrapDecision;
  bootstrapState: ShellLocalBridgeRuntimeBootstrapDecision["bootstrapState"];
  bootstrapOwned: boolean;
  bootstrapActive: boolean;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastWakeAt: string | null;
  lastSuspendAt: string | null;
  lastStopAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  serviceSummary: string | null;
  lifecycleSummary: string | null;
  bootstrapSummary: string;
};

function buildBootstrapTimestamps(
  action: "start" | "wake" | "suspend" | "stop",
  now: number,
) {
  const current = resolveLocalBridgeStartupPosture();
  const timestamp = new Date(now).toISOString();
  return {
    lastStartAt: action === "start" ? timestamp : current?.lastStartAt ?? null,
    lastWakeAt: action === "wake" ? timestamp : current?.lastWakeAt ?? null,
    lastSuspendAt: action === "suspend" ? timestamp : current?.lastSuspendAt ?? null,
    lastStopAt: action === "stop" ? timestamp : current?.lastStopAt ?? null,
  };
}

function resolveBootstrapSummary(params: {
  action: "start" | "wake" | "suspend" | "stop";
  shellAppLabel: string;
  decisionSummary: string;
}): string {
  switch (params.action) {
    case "start":
      return `${params.shellAppLabel} started desktop runtime bootstrap owner and ${params.decisionSummary}`;
    case "wake":
      return `${params.shellAppLabel} woke desktop runtime bootstrap owner and ${params.decisionSummary}`;
    case "suspend":
      return `${params.shellAppLabel} suspended desktop runtime bootstrap owner and released desktop bootstrap ownership.`;
    case "stop":
      return `${params.shellAppLabel} stopped desktop runtime bootstrap owner and released desktop bootstrap ownership.`;
  }
}

export function resolveDesktopShellRuntimeBootstrapSnapshot(params: {
  lifecycleWake: DesktopShellRuntimeLifecycleResult | null;
  serviceState?: DesktopShellRuntimeBootstrapResult["serviceState"];
  lifecycleState?: DesktopShellRuntimeBootstrapResult["lifecycleState"];
  serviceSummary?: string | null;
  lifecycleSummary?: string | null;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  bootstrapOwned?: boolean;
  now?: number;
  action?: "start" | "wake" | "suspend" | "stop";
  shellAppLabel?: string;
}): DesktopShellRuntimeBootstrapSnapshot {
  const now = params.now ?? Date.now();
  const bootstrapDecision = resolveShellLocalBridgeRuntimeBootstrapDecision({
    lifecycleState:
      params.lifecycleState
      ?? params.lifecycleWake?.lifecycleState
      ?? "inactive",
    nextWakeAt: params.lifecycleWake?.nextWakeAt ?? null,
    healthFeed: params.lifecycleWake?.healthFeed,
    healthStatus:
      params.lifecycleWake?.heartbeatCycle?.heartbeat?.healthStatus
      ?? params.lifecycleWake?.healthFeed?.latestHealthStatus
      ?? undefined,
    attached: params.attached ?? params.lifecycleWake?.heartbeatCycle?.heartbeat?.attached,
    readiness:
      params.adapterReadiness
      ?? params.lifecycleWake?.heartbeatCycle?.heartbeat?.adapterReadiness,
    bootstrapOwned: params.bootstrapOwned,
    now,
  });
  const action = params.action ?? "wake";
  const bootstrapState =
    action === "suspend"
      ? "suspended"
      : action === "stop"
        ? "stopped"
        : bootstrapDecision.bootstrapState;
  const bootstrapOwned =
    action === "suspend" || action === "stop"
      ? false
      : bootstrapDecision.bootstrapOwned;
  const bootstrapActive =
    bootstrapState === "active"
    || bootstrapState === "starting"
    || bootstrapState === "backoff_wait";
  const timestamps = buildBootstrapTimestamps(action, now);
  const bootstrapSummary = resolveBootstrapSummary({
    action,
    shellAppLabel: params.shellAppLabel?.trim() || "Desktop Shell",
    decisionSummary: bootstrapDecision.bootstrapSummary,
  });
  return {
    lifecycleWake: params.lifecycleWake,
    bootstrapDecision: {
      ...bootstrapDecision,
      bootstrapState,
      bootstrapOwned,
      bootstrapActive,
      shouldStartNow: bootstrapState === "starting",
      shouldWakeNow: bootstrapState === "starting",
      shouldSuspendNow: bootstrapState === "suspended",
      lastStartAt: timestamps.lastStartAt,
      lastWakeAt: timestamps.lastWakeAt,
      lastSuspendAt: timestamps.lastSuspendAt,
      lastStopAt: timestamps.lastStopAt,
      bootstrapSummary,
    },
    serviceState:
      params.serviceState
      ?? params.lifecycleWake?.serviceState
      ?? "released",
    lifecycleState:
      params.lifecycleState
      ?? params.lifecycleWake?.lifecycleState
      ?? "inactive",
    bootstrapState,
    bootstrapOwned,
    bootstrapActive,
    nextWakeAt:
      bootstrapState === "suspended" || bootstrapState === "stopped"
        ? null
        : bootstrapDecision.nextWakeAt,
    lastStartAt: timestamps.lastStartAt,
    lastWakeAt: timestamps.lastWakeAt,
    lastSuspendAt: timestamps.lastSuspendAt,
    lastStopAt: timestamps.lastStopAt,
    serviceSummary:
      params.serviceSummary
      ?? params.lifecycleWake?.serviceSummary
      ?? null,
    lifecycleSummary:
      params.lifecycleSummary
      ?? params.lifecycleWake?.lifecycleSummary
      ?? null,
    bootstrapSummary,
  };
}

function buildBootstrapResult(params: {
  action: "start" | "wake" | "suspend" | "stop";
  shellAppLabel: string;
  lifecycleWake: DesktopShellRuntimeLifecycleResult | null;
  serviceState?: DesktopShellRuntimeBootstrapResult["serviceState"];
  lifecycleState?: DesktopShellRuntimeBootstrapResult["lifecycleState"];
  serviceSummary?: string | null;
  lifecycleSummary?: string | null;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  bootstrapOwned?: boolean;
  bootstrapStateOverride?: DesktopShellRuntimeBootstrapResult["bootstrapState"] | null;
  bootstrapSummaryOverride?: string | null;
  now: number;
}): DesktopShellRuntimeBootstrapResult {
  const snapshot = resolveDesktopShellRuntimeBootstrapSnapshot({
    lifecycleWake: params.lifecycleWake,
    serviceState: params.serviceState,
    lifecycleState: params.lifecycleState,
    serviceSummary: params.serviceSummary,
    lifecycleSummary: params.lifecycleSummary,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    bootstrapOwned: params.bootstrapOwned,
    now: params.now,
    action: params.action,
    shellAppLabel: params.shellAppLabel,
  });
  const bootstrapState = params.bootstrapStateOverride ?? snapshot.bootstrapState;
  const bootstrapActive =
    bootstrapState === "active"
    || bootstrapState === "starting"
    || bootstrapState === "backoff_wait";
  const bootstrapSummary = params.bootstrapSummaryOverride ?? snapshot.bootstrapSummary;
  const bootstrapDecision = {
    ...snapshot.bootstrapDecision,
    bootstrapState,
    bootstrapActive,
    shouldStartNow: bootstrapState === "starting",
    shouldWakeNow: bootstrapState === "starting",
    shouldSuspendNow: bootstrapState === "suspended",
    bootstrapSummary,
  };
  updateLocalBridgeStartupPosture({
    bootstrapState,
    bootstrapOwned: snapshot.bootstrapOwned,
    bootstrapActive,
    nextWakeAt:
      bootstrapState === "suspended" || bootstrapState === "stopped"
        ? null
        : snapshot.nextWakeAt,
    lastStartAt: snapshot.lastStartAt,
    lastWakeAt: snapshot.lastWakeAt,
    lastSuspendAt: snapshot.lastSuspendAt,
    lastStopAt: snapshot.lastStopAt,
    bootstrapSummary,
  });
  return {
    lifecycleWake: params.lifecycleWake,
    serviceWake: params.lifecycleWake?.serviceWake ?? null,
    hostWake: params.lifecycleWake?.hostWake ?? null,
    runnerTick: params.lifecycleWake?.runnerTick ?? null,
    timerTick: params.lifecycleWake?.timerTick ?? null,
    driverCycle: params.lifecycleWake?.driverCycle ?? null,
    heartbeatCycle: params.lifecycleWake?.heartbeatCycle ?? null,
    healthFeed: params.lifecycleWake?.healthFeed ?? null,
    pollingDecision: params.lifecycleWake?.pollingDecision ?? null,
    schedulerDecision: params.lifecycleWake?.schedulerDecision ?? null,
    driverDecision: params.lifecycleWake?.driverDecision ?? null,
    timerDecision: params.lifecycleWake?.timerDecision ?? null,
    runnerDecision: params.lifecycleWake?.runnerDecision ?? null,
    hostDecision: params.lifecycleWake?.hostDecision ?? null,
    serviceDecision: params.lifecycleWake?.serviceDecision ?? null,
    lifecycleDecision: params.lifecycleWake?.lifecycleDecision ?? null,
    serviceState: snapshot.serviceState,
    lifecycleState: snapshot.lifecycleState,
    bootstrapDecision,
    bootstrapState,
    bootstrapOwned: snapshot.bootstrapOwned,
    bootstrapActive,
    nextWakeAt:
      bootstrapState === "suspended" || bootstrapState === "stopped"
        ? null
        : snapshot.nextWakeAt,
    lastStartAt: snapshot.lastStartAt,
    lastWakeAt: snapshot.lastWakeAt,
    lastSuspendAt: snapshot.lastSuspendAt,
    lastStopAt: snapshot.lastStopAt,
    recommendedDelayMs: params.lifecycleWake?.recommendedDelayMs ?? null,
    retryBackoffMs: params.lifecycleWake?.retryBackoffMs ?? null,
    serviceSummary: snapshot.serviceSummary,
    lifecycleSummary: snapshot.lifecycleSummary,
    bootstrapSummary,
  };
}

export function startDesktopShellRuntimeBootstrap(
  options: DesktopShellRuntimeBootstrapOptions = {},
): DesktopShellRuntimeBootstrapResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const preWakeFeed = summarizeLocalBridgeHealthFeed(now);
  const bootstrapStateOverride =
    preWakeFeed.stalenessStatus === "stale" || preWakeFeed.stalenessStatus === "idle"
      ? "starting"
      : null;
  const bootstrapSummaryOverride =
    preWakeFeed.stalenessStatus === "stale"
      ? `${shellAppLabel} started desktop runtime bootstrap owner and Desktop runtime bootstrap owner is starting now to recover stale desktop cadence freshness.`
      : preWakeFeed.stalenessStatus === "idle"
        ? `${shellAppLabel} started desktop runtime bootstrap owner and Desktop runtime bootstrap owner is starting now because desktop cadence has not started yet.`
        : null;
  const lifecycleWake = bootDesktopShellRuntimeLifecycle({
    ...options,
    now,
    lifecycleOwned: true,
    serviceOwned: options.serviceOwned ?? true,
  });
  return buildBootstrapResult({
    action: "start",
    shellAppLabel,
    lifecycleWake,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    bootstrapOwned: true,
    bootstrapStateOverride,
    bootstrapSummaryOverride,
    now,
  });
}

export function wakeDesktopShellRuntimeBootstrap(
  options: DesktopShellRuntimeBootstrapOptions = {},
): DesktopShellRuntimeBootstrapResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const preWakeFeed = summarizeLocalBridgeHealthFeed(now);
  const bootstrapStateOverride =
    preWakeFeed.stalenessStatus === "stale" || preWakeFeed.stalenessStatus === "idle"
      ? "starting"
      : null;
  const bootstrapSummaryOverride =
    preWakeFeed.stalenessStatus === "stale"
      ? `${shellAppLabel} woke desktop runtime bootstrap owner and Desktop runtime bootstrap owner is starting now to recover stale desktop cadence freshness.`
      : preWakeFeed.stalenessStatus === "idle"
        ? `${shellAppLabel} woke desktop runtime bootstrap owner and Desktop runtime bootstrap owner is starting now because desktop cadence has not started yet.`
        : null;
  const lifecycleWake = resumeDesktopShellRuntimeLifecycle({
    ...options,
    now,
    lifecycleOwned: options.lifecycleOwned ?? true,
    serviceOwned: options.serviceOwned ?? true,
  });
  return buildBootstrapResult({
    action: "wake",
    shellAppLabel,
    lifecycleWake,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    bootstrapOwned: options.bootstrapOwned ?? true,
    bootstrapStateOverride,
    bootstrapSummaryOverride,
    now,
  });
}

export function suspendDesktopShellRuntimeBootstrap(
  options: Pick<DesktopShellRuntimeBootstrapOptions, "now" | "shellAppLabel"> = {},
): DesktopShellRuntimeBootstrapResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const lifecycleWake = suspendDesktopShellRuntimeLifecycle({
    now,
    shellAppLabel,
  });
  return buildBootstrapResult({
    action: "suspend",
    shellAppLabel,
    lifecycleWake,
    bootstrapOwned: false,
    now,
  });
}

export function stopDesktopShellRuntimeBootstrap(
  options: Pick<DesktopShellRuntimeBootstrapOptions, "now" | "shellAppLabel"> = {},
): DesktopShellRuntimeBootstrapResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const lifecycleWake = shutdownDesktopShellRuntimeLifecycle({
    now,
    shellAppLabel,
  });
  return buildBootstrapResult({
    action: "stop",
    shellAppLabel,
    lifecycleWake,
    bootstrapOwned: false,
    now,
  });
}
