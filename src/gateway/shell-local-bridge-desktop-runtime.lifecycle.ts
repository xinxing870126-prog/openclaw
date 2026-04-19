import {
  resolveShellLocalBridgeRuntimeLifecycleDecision,
  type ShellLocalBridgeRuntimeLifecycleDecision,
} from "./shell-app-contract.js";
import {
  acquireDesktopShellRuntimeService,
  releaseDesktopShellRuntimeService,
  wakeDesktopShellRuntimeService,
  type DesktopShellRuntimeServiceOptions,
  type DesktopShellRuntimeServiceWakeResult,
} from "./shell-local-bridge-desktop-runtime.service.js";
import {
  resolveLocalBridgeStartupPosture,
  summarizeLocalBridgeHealthFeed,
  updateLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";

export type DesktopShellRuntimeLifecycleOptions =
  DesktopShellRuntimeServiceOptions & {
    lifecycleOwned?: boolean;
  };

export type DesktopShellRuntimeLifecycleSnapshot = {
  serviceWake: DesktopShellRuntimeServiceWakeResult | null;
  lifecycleDecision: ShellLocalBridgeRuntimeLifecycleDecision;
  serviceState:
    | DesktopShellRuntimeServiceWakeResult["serviceState"]
    | "released";
  lifecycleState: ShellLocalBridgeRuntimeLifecycleDecision["lifecycleState"];
  lifecycleOwned: boolean;
  lifecycleActive: boolean;
  nextWakeAt: string | null;
  lastBootAt: string | null;
  lastResumeAt: string | null;
  lastSuspendAt: string | null;
  lastShutdownAt: string | null;
  serviceSummary: string | null;
  lifecycleSummary: string;
};

export type DesktopShellRuntimeLifecycleResult = {
  serviceWake: DesktopShellRuntimeServiceWakeResult | null;
  hostWake: DesktopShellRuntimeServiceWakeResult["hostWake"] | null;
  runnerTick: DesktopShellRuntimeServiceWakeResult["runnerTick"] | null;
  timerTick: DesktopShellRuntimeServiceWakeResult["timerTick"] | null;
  driverCycle: DesktopShellRuntimeServiceWakeResult["driverCycle"] | null;
  heartbeatCycle: DesktopShellRuntimeServiceWakeResult["heartbeatCycle"] | null;
  healthFeed: DesktopShellRuntimeServiceWakeResult["healthFeed"] | null;
  pollingDecision: DesktopShellRuntimeServiceWakeResult["pollingDecision"] | null;
  schedulerDecision: DesktopShellRuntimeServiceWakeResult["schedulerDecision"] | null;
  driverDecision: DesktopShellRuntimeServiceWakeResult["driverDecision"] | null;
  timerDecision: DesktopShellRuntimeServiceWakeResult["timerDecision"] | null;
  runnerDecision: DesktopShellRuntimeServiceWakeResult["runnerDecision"] | null;
  hostDecision: DesktopShellRuntimeServiceWakeResult["hostDecision"] | null;
  serviceDecision:
    | DesktopShellRuntimeServiceWakeResult["serviceDecision"]
    | ReturnType<typeof releaseDesktopShellRuntimeService>;
  serviceState:
    | DesktopShellRuntimeServiceWakeResult["serviceState"]
    | "released";
  lifecycleDecision: ShellLocalBridgeRuntimeLifecycleDecision;
  lifecycleState: ShellLocalBridgeRuntimeLifecycleDecision["lifecycleState"];
  lifecycleOwned: boolean;
  lifecycleActive: boolean;
  nextWakeAt: string | null;
  lastBootAt: string | null;
  lastResumeAt: string | null;
  lastSuspendAt: string | null;
  lastShutdownAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  serviceSummary: string | null;
  lifecycleSummary: string;
};

function buildLifecycleTimestamps(
  action: "boot" | "resume" | "suspend" | "shutdown",
  now: number,
) {
  const current = resolveLocalBridgeStartupPosture();
  const timestamp = new Date(now).toISOString();
  return {
    lastBootAt: action === "boot" ? timestamp : current?.lastBootAt ?? null,
    lastResumeAt: action === "resume" ? timestamp : current?.lastResumeAt ?? null,
    lastSuspendAt: action === "suspend" ? timestamp : current?.lastSuspendAt ?? null,
    lastShutdownAt: action === "shutdown" ? timestamp : current?.lastShutdownAt ?? null,
  };
}

function resolveLifecycleSummary(params: {
  action: "boot" | "resume" | "suspend" | "shutdown";
  shellAppLabel: string;
  lifecycleState: DesktopShellRuntimeLifecycleResult["lifecycleState"];
  decisionSummary: string;
}): string {
  switch (params.action) {
    case "boot":
      return `${params.shellAppLabel} booted desktop runtime lifecycle owner and ${params.decisionSummary}`;
    case "resume":
      return `${params.shellAppLabel} resumed desktop runtime lifecycle owner and ${params.decisionSummary}`;
    case "suspend":
      return `${params.shellAppLabel} suspended desktop runtime lifecycle owner and released desktop cadence ownership.`;
    case "shutdown":
      return `${params.shellAppLabel} shut down desktop runtime lifecycle owner and released desktop cadence ownership.`;
  }
}

export function resolveDesktopShellRuntimeLifecycleSnapshot(params: {
  serviceWake: DesktopShellRuntimeServiceWakeResult | null;
  serviceState?: DesktopShellRuntimeServiceWakeResult["serviceState"] | "released";
  serviceSummary?: string | null;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  lifecycleOwned?: boolean;
  now?: number;
  action?: "boot" | "resume" | "suspend" | "shutdown";
  shellAppLabel?: string;
}): DesktopShellRuntimeLifecycleSnapshot {
  const now = params.now ?? Date.now();
  const lifecycleDecision = resolveShellLocalBridgeRuntimeLifecycleDecision({
    serviceState:
      params.serviceState
      ?? params.serviceWake?.serviceState
      ?? "released",
    nextWakeAt: params.serviceWake?.nextWakeAt ?? null,
    healthFeed: params.serviceWake?.healthFeed,
    healthStatus:
      params.serviceWake?.heartbeatCycle?.heartbeat?.healthStatus
      ?? params.serviceWake?.healthFeed?.latestHealthStatus
      ?? undefined,
    attached: params.attached ?? params.serviceWake?.heartbeatCycle?.heartbeat?.attached,
    readiness:
      params.adapterReadiness
      ?? params.serviceWake?.heartbeatCycle?.heartbeat?.adapterReadiness,
    lifecycleOwned: params.lifecycleOwned,
    now,
  });
  const action = params.action ?? "resume";
  const lifecycleState =
    action === "suspend"
      ? "suspended"
      : action === "shutdown"
        ? "inactive"
        : lifecycleDecision.lifecycleState;
  const lifecycleOwned =
    action === "suspend" || action === "shutdown"
      ? false
      : lifecycleDecision.lifecycleOwned;
  const lifecycleActive =
    lifecycleState === "active"
    || lifecycleState === "booting"
    || lifecycleState === "backoff_wait";
  const timestamps = buildLifecycleTimestamps(action, now);
  return {
    serviceWake: params.serviceWake,
    lifecycleDecision: {
      ...lifecycleDecision,
      lifecycleState,
      lifecycleOwned,
      lifecycleActive,
      shouldBootNow: lifecycleState === "booting",
      shouldResumeNow: lifecycleState === "booting",
      shouldSuspendNow: lifecycleState === "suspended",
      lastBootAt: timestamps.lastBootAt,
      lastResumeAt: timestamps.lastResumeAt,
      lastSuspendAt: timestamps.lastSuspendAt,
      lastShutdownAt: timestamps.lastShutdownAt,
      lifecycleSummary: resolveLifecycleSummary({
        action,
        shellAppLabel: params.shellAppLabel?.trim() || "Desktop Shell",
        lifecycleState,
        decisionSummary: lifecycleDecision.lifecycleSummary,
      }),
    },
    serviceState:
      params.serviceState
      ?? params.serviceWake?.serviceState
      ?? "released",
    lifecycleState,
    lifecycleOwned,
    lifecycleActive,
    nextWakeAt:
      lifecycleState === "suspended" || lifecycleState === "inactive"
        ? null
        : lifecycleDecision.nextWakeAt,
    lastBootAt: timestamps.lastBootAt,
    lastResumeAt: timestamps.lastResumeAt,
    lastSuspendAt: timestamps.lastSuspendAt,
    lastShutdownAt: timestamps.lastShutdownAt,
    serviceSummary:
      params.serviceSummary
      ?? params.serviceWake?.serviceSummary
      ?? null,
    lifecycleSummary: resolveLifecycleSummary({
      action,
      shellAppLabel: params.shellAppLabel?.trim() || "Desktop Shell",
      lifecycleState,
      decisionSummary: lifecycleDecision.lifecycleSummary,
    }),
  };
}

function buildLifecycleResult(params: {
  action: "boot" | "resume" | "suspend" | "shutdown";
  shellAppLabel: string;
  serviceWake: DesktopShellRuntimeServiceWakeResult | null;
  serviceDecision?:
    | DesktopShellRuntimeServiceWakeResult["serviceDecision"]
    | ReturnType<typeof releaseDesktopShellRuntimeService>;
  serviceState?: DesktopShellRuntimeServiceWakeResult["serviceState"] | "released";
  serviceSummary?: string | null;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  lifecycleOwned?: boolean;
  lifecycleStateOverride?: DesktopShellRuntimeLifecycleResult["lifecycleState"] | null;
  lifecycleSummaryOverride?: string | null;
  now: number;
}): DesktopShellRuntimeLifecycleResult {
  const snapshot = resolveDesktopShellRuntimeLifecycleSnapshot({
    serviceWake: params.serviceWake,
    serviceState: params.serviceState,
    serviceSummary: params.serviceSummary,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    lifecycleOwned: params.lifecycleOwned,
    now: params.now,
    action: params.action,
    shellAppLabel: params.shellAppLabel,
  });
  const lifecycleState = params.lifecycleStateOverride ?? snapshot.lifecycleState;
  const lifecycleActive =
    lifecycleState === "active"
    || lifecycleState === "booting"
    || lifecycleState === "backoff_wait";
  const lifecycleSummary = params.lifecycleSummaryOverride ?? snapshot.lifecycleSummary;
  const lifecycleDecision = {
    ...snapshot.lifecycleDecision,
    lifecycleState,
    lifecycleActive,
    shouldBootNow: lifecycleState === "booting",
    shouldResumeNow: lifecycleState === "booting",
    shouldSuspendNow: lifecycleState === "suspended",
    lifecycleSummary,
  };
  updateLocalBridgeStartupPosture({
    lifecycleState,
    lifecycleOwned: snapshot.lifecycleOwned,
    lifecycleActive,
    nextWakeAt:
      lifecycleState === "suspended" || lifecycleState === "inactive"
        ? null
        : snapshot.nextWakeAt,
    lastBootAt: snapshot.lastBootAt,
    lastResumeAt: snapshot.lastResumeAt,
    lastSuspendAt: snapshot.lastSuspendAt,
    lastShutdownAt: snapshot.lastShutdownAt,
    lifecycleSummary,
  });
  return {
    serviceWake: params.serviceWake,
    hostWake: params.serviceWake?.hostWake ?? null,
    runnerTick: params.serviceWake?.runnerTick ?? null,
    timerTick: params.serviceWake?.timerTick ?? null,
    driverCycle: params.serviceWake?.driverCycle ?? null,
    heartbeatCycle: params.serviceWake?.heartbeatCycle ?? null,
    healthFeed: params.serviceWake?.healthFeed ?? null,
    pollingDecision: params.serviceWake?.pollingDecision ?? null,
    schedulerDecision: params.serviceWake?.schedulerDecision ?? null,
    driverDecision: params.serviceWake?.driverDecision ?? null,
    timerDecision: params.serviceWake?.timerDecision ?? null,
    runnerDecision: params.serviceWake?.runnerDecision ?? null,
    hostDecision: params.serviceWake?.hostDecision ?? null,
    serviceDecision: params.serviceWake?.serviceDecision
      ?? params.serviceDecision
      ?? releaseDesktopShellRuntimeService({ now: params.now }),
    serviceState: snapshot.serviceState,
    lifecycleDecision,
    lifecycleState,
    lifecycleOwned: snapshot.lifecycleOwned,
    lifecycleActive,
    nextWakeAt:
      lifecycleState === "suspended" || lifecycleState === "inactive"
        ? null
        : snapshot.nextWakeAt,
    lastBootAt: snapshot.lastBootAt,
    lastResumeAt: snapshot.lastResumeAt,
    lastSuspendAt: snapshot.lastSuspendAt,
    lastShutdownAt: snapshot.lastShutdownAt,
    recommendedDelayMs: params.serviceWake?.recommendedDelayMs ?? null,
    retryBackoffMs: params.serviceWake?.retryBackoffMs ?? null,
    serviceSummary: snapshot.serviceSummary,
    lifecycleSummary,
  };
}

export function bootDesktopShellRuntimeLifecycle(
  options: DesktopShellRuntimeLifecycleOptions = {},
): DesktopShellRuntimeLifecycleResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const preWakeFeed = summarizeLocalBridgeHealthFeed(now);
  const lifecycleStateOverride =
    preWakeFeed.stalenessStatus === "stale" || preWakeFeed.stalenessStatus === "idle"
      ? "booting"
      : null;
  const lifecycleSummaryOverride =
    preWakeFeed.stalenessStatus === "stale"
      ? `${shellAppLabel} booted desktop runtime lifecycle owner and Desktop runtime lifecycle owner is booting now to recover stale desktop cadence freshness.`
      : preWakeFeed.stalenessStatus === "idle"
        ? `${shellAppLabel} booted desktop runtime lifecycle owner and Desktop runtime lifecycle owner is booting now because desktop cadence has not started yet.`
        : null;
  const serviceWake = acquireDesktopShellRuntimeService({
    ...options,
    now,
    serviceOwned: true,
  });
  return buildLifecycleResult({
    action: "boot",
    shellAppLabel,
    serviceWake,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    lifecycleOwned: true,
    lifecycleStateOverride,
    lifecycleSummaryOverride,
    now,
  });
}

export function resumeDesktopShellRuntimeLifecycle(
  options: DesktopShellRuntimeLifecycleOptions = {},
): DesktopShellRuntimeLifecycleResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const preWakeFeed = summarizeLocalBridgeHealthFeed(now);
  const lifecycleStateOverride =
    preWakeFeed.stalenessStatus === "stale" || preWakeFeed.stalenessStatus === "idle"
      ? "booting"
      : null;
  const lifecycleSummaryOverride =
    preWakeFeed.stalenessStatus === "stale"
      ? `${shellAppLabel} resumed desktop runtime lifecycle owner and Desktop runtime lifecycle owner is booting now to recover stale desktop cadence freshness.`
      : preWakeFeed.stalenessStatus === "idle"
        ? `${shellAppLabel} resumed desktop runtime lifecycle owner and Desktop runtime lifecycle owner is booting now because desktop cadence has not started yet.`
        : null;
  const serviceWake = wakeDesktopShellRuntimeService({
    ...options,
    now,
    serviceOwned: options.serviceOwned ?? true,
  });
  return buildLifecycleResult({
    action: "resume",
    shellAppLabel,
    serviceWake,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    lifecycleOwned: options.lifecycleOwned ?? true,
    lifecycleStateOverride,
    lifecycleSummaryOverride,
    now,
  });
}

export function suspendDesktopShellRuntimeLifecycle(
  options: Pick<DesktopShellRuntimeLifecycleOptions, "now" | "shellAppLabel"> = {},
): DesktopShellRuntimeLifecycleResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const release = releaseDesktopShellRuntimeService({ now });
  return buildLifecycleResult({
    action: "suspend",
    shellAppLabel,
    serviceWake: null,
    serviceDecision: release,
    serviceState: release.serviceState,
    serviceSummary: release.serviceSummary,
    lifecycleOwned: false,
    now,
  });
}

export function shutdownDesktopShellRuntimeLifecycle(
  options: Pick<DesktopShellRuntimeLifecycleOptions, "now" | "shellAppLabel"> = {},
): DesktopShellRuntimeLifecycleResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const release = releaseDesktopShellRuntimeService({ now });
  return buildLifecycleResult({
    action: "shutdown",
    shellAppLabel,
    serviceWake: null,
    serviceDecision: release,
    serviceState: release.serviceState,
    serviceSummary: release.serviceSummary,
    lifecycleOwned: false,
    now,
  });
}
