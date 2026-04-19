import {
  resolveShellLocalBridgeRuntimeProcessHostDecision,
  type ShellLocalBridgeRuntimeProcessHostDecision,
} from "./shell-app-contract.js";
import {
  backgroundDesktopShellRuntimeShellOwner,
  startDesktopShellRuntimeShellOwner,
  stopDesktopShellRuntimeShellOwner,
  wakeDesktopShellRuntimeShellOwner,
  type DesktopShellRuntimeShellOwnerOptions,
  type DesktopShellRuntimeShellOwnerResult,
} from "./shell-local-bridge-desktop-runtime.shell-owner.js";
import {
  resolveLocalBridgeStartupPosture,
  summarizeLocalBridgeHealthFeed,
  updateLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";

export type DesktopShellRuntimeProcessHostOptions =
  DesktopShellRuntimeShellOwnerOptions & {
    processHostOwned?: boolean;
  };

export type DesktopShellRuntimeProcessHostSnapshot = {
  shellOwnerWake: DesktopShellRuntimeShellOwnerResult | null;
  appOwnerState: DesktopShellRuntimeShellOwnerResult["appOwnerState"] | "stopped";
  shellOwnerState: DesktopShellRuntimeShellOwnerResult["shellOwnerState"] | "stopped";
  processHostDecision: ShellLocalBridgeRuntimeProcessHostDecision;
  processHostState: ShellLocalBridgeRuntimeProcessHostDecision["processHostState"];
  processHostOwned: boolean;
  processHostActive: boolean;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastForegroundAt: string | null;
  lastBackgroundAt: string | null;
  lastStopAt: string | null;
  shellOwnerSummary: string | null;
  processHostSummary: string;
};

export type DesktopShellRuntimeProcessHostResult = {
  shellOwnerWake: DesktopShellRuntimeShellOwnerResult | null;
  appOwnerWake: DesktopShellRuntimeShellOwnerResult["appOwnerWake"] | null;
  bootstrapWake: DesktopShellRuntimeShellOwnerResult["bootstrapWake"] | null;
  lifecycleWake: DesktopShellRuntimeShellOwnerResult["lifecycleWake"] | null;
  serviceWake: DesktopShellRuntimeShellOwnerResult["serviceWake"] | null;
  hostWake: DesktopShellRuntimeShellOwnerResult["hostWake"] | null;
  runnerTick: DesktopShellRuntimeShellOwnerResult["runnerTick"] | null;
  timerTick: DesktopShellRuntimeShellOwnerResult["timerTick"] | null;
  driverCycle: DesktopShellRuntimeShellOwnerResult["driverCycle"] | null;
  heartbeatCycle: DesktopShellRuntimeShellOwnerResult["heartbeatCycle"] | null;
  healthFeed: DesktopShellRuntimeShellOwnerResult["healthFeed"] | null;
  pollingDecision: DesktopShellRuntimeShellOwnerResult["pollingDecision"] | null;
  schedulerDecision: DesktopShellRuntimeShellOwnerResult["schedulerDecision"] | null;
  driverDecision: DesktopShellRuntimeShellOwnerResult["driverDecision"] | null;
  timerDecision: DesktopShellRuntimeShellOwnerResult["timerDecision"] | null;
  runnerDecision: DesktopShellRuntimeShellOwnerResult["runnerDecision"] | null;
  hostDecision: DesktopShellRuntimeShellOwnerResult["hostDecision"] | null;
  serviceDecision: DesktopShellRuntimeShellOwnerResult["serviceDecision"] | null;
  lifecycleDecision: DesktopShellRuntimeShellOwnerResult["lifecycleDecision"] | null;
  bootstrapDecision: DesktopShellRuntimeShellOwnerResult["bootstrapDecision"] | null;
  appOwnerDecision: DesktopShellRuntimeShellOwnerResult["appOwnerDecision"] | null;
  shellOwnerDecision: DesktopShellRuntimeShellOwnerResult["shellOwnerDecision"] | null;
  serviceState: DesktopShellRuntimeShellOwnerResult["serviceState"] | "released";
  lifecycleState: DesktopShellRuntimeShellOwnerResult["lifecycleState"] | "inactive";
  bootstrapState: DesktopShellRuntimeShellOwnerResult["bootstrapState"] | "stopped";
  appOwnerState: DesktopShellRuntimeShellOwnerResult["appOwnerState"] | "stopped";
  shellOwnerState: DesktopShellRuntimeShellOwnerResult["shellOwnerState"] | "stopped";
  shellOwnerOwned: boolean;
  shellOwnerActive: boolean;
  processHostDecision: ShellLocalBridgeRuntimeProcessHostDecision;
  processHostState: ShellLocalBridgeRuntimeProcessHostDecision["processHostState"];
  processHostOwned: boolean;
  processHostActive: boolean;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastForegroundAt: string | null;
  lastBackgroundAt: string | null;
  lastStopAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  shellOwnerSummary: string | null;
  processHostSummary: string;
};

function buildProcessHostTimestamps(
  action: "start" | "foreground" | "background" | "stop",
  now: number,
) {
  const current = resolveLocalBridgeStartupPosture();
  const timestamp = new Date(now).toISOString();
  return {
    lastStartAt: action === "start" ? timestamp : current?.lastStartAt ?? null,
    lastForegroundAt:
      action === "foreground" ? timestamp : current?.lastForegroundAt ?? null,
    lastBackgroundAt:
      action === "background" ? timestamp : current?.lastBackgroundAt ?? null,
    lastStopAt: action === "stop" ? timestamp : current?.lastStopAt ?? null,
  };
}

function resolveProcessHostSummary(params: {
  action: "start" | "foreground" | "background" | "stop";
  shellAppLabel: string;
  decisionSummary: string;
}): string {
  switch (params.action) {
    case "start":
      return `${params.shellAppLabel} started desktop runtime process host and ${params.decisionSummary}`;
    case "foreground":
      return `${params.shellAppLabel} foregrounded desktop runtime process host and ${params.decisionSummary}`;
    case "background":
      return `${params.shellAppLabel} backgrounded desktop runtime process host and released desktop process-host ownership.`;
    case "stop":
      return `${params.shellAppLabel} stopped desktop runtime process host and released desktop process-host ownership.`;
  }
}

export function resolveDesktopShellRuntimeProcessHostSnapshot(params: {
  shellOwnerWake: DesktopShellRuntimeShellOwnerResult | null;
  appOwnerState?: DesktopShellRuntimeProcessHostResult["appOwnerState"];
  shellOwnerState?: DesktopShellRuntimeProcessHostResult["shellOwnerState"];
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  processHostOwned?: boolean;
  now?: number;
  action?: "start" | "foreground" | "background" | "stop";
  shellAppLabel?: string;
}): DesktopShellRuntimeProcessHostSnapshot {
  const now = params.now ?? Date.now();
  const processHostDecision = resolveShellLocalBridgeRuntimeProcessHostDecision({
    shellOwnerState:
      params.shellOwnerState
      ?? params.shellOwnerWake?.shellOwnerState
      ?? "stopped",
    nextWakeAt: params.shellOwnerWake?.nextWakeAt ?? null,
    healthFeed: params.shellOwnerWake?.healthFeed,
    healthStatus:
      params.shellOwnerWake?.heartbeatCycle?.heartbeat?.healthStatus
      ?? params.shellOwnerWake?.healthFeed?.latestHealthStatus
      ?? undefined,
    attached: params.attached ?? params.shellOwnerWake?.heartbeatCycle?.heartbeat?.attached,
    readiness:
      params.adapterReadiness
      ?? params.shellOwnerWake?.heartbeatCycle?.heartbeat?.adapterReadiness,
    processHostOwned: params.processHostOwned,
    now,
  });
  const action = params.action ?? "foreground";
  const processHostState =
    action === "background"
      ? "background"
      : action === "stop"
        ? "stopped"
        : processHostDecision.processHostState;
  const processHostOwned =
    action === "background" || action === "stop"
      ? false
      : processHostDecision.processHostOwned;
  const processHostActive =
    processHostState === "foreground"
    || processHostState === "starting"
    || processHostState === "backoff_wait";
  const timestamps = buildProcessHostTimestamps(action, now);
  const processHostSummary = resolveProcessHostSummary({
    action,
    shellAppLabel: params.shellAppLabel?.trim() || "Desktop Shell",
    decisionSummary: processHostDecision.processHostSummary,
  });
  return {
    shellOwnerWake: params.shellOwnerWake,
    appOwnerState:
      params.appOwnerState
      ?? params.shellOwnerWake?.appOwnerState
      ?? "stopped",
    shellOwnerState:
      params.shellOwnerState
      ?? params.shellOwnerWake?.shellOwnerState
      ?? "stopped",
    processHostDecision: {
      ...processHostDecision,
      processHostState,
      processHostOwned,
      processHostActive,
      shouldStartNow: processHostState === "starting",
      shouldForegroundNow:
        processHostState === "starting" || processHostState === "foreground",
      shouldBackgroundNow: processHostState === "background",
      lastStartAt: timestamps.lastStartAt,
      lastForegroundAt: timestamps.lastForegroundAt,
      lastBackgroundAt: timestamps.lastBackgroundAt,
      lastStopAt: timestamps.lastStopAt,
      processHostSummary,
    },
    processHostState,
    processHostOwned,
    processHostActive,
    nextWakeAt:
      processHostState === "background" || processHostState === "stopped"
        ? null
        : processHostDecision.nextWakeAt,
    lastStartAt: timestamps.lastStartAt,
    lastForegroundAt: timestamps.lastForegroundAt,
    lastBackgroundAt: timestamps.lastBackgroundAt,
    lastStopAt: timestamps.lastStopAt,
    shellOwnerSummary: params.shellOwnerWake?.shellOwnerSummary ?? null,
    processHostSummary,
  };
}

function buildProcessHostResult(params: {
  action: "start" | "foreground" | "background" | "stop";
  shellAppLabel: string;
  shellOwnerWake: DesktopShellRuntimeShellOwnerResult | null;
  appOwnerState?: DesktopShellRuntimeProcessHostResult["appOwnerState"];
  shellOwnerState?: DesktopShellRuntimeProcessHostResult["shellOwnerState"];
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  processHostOwned?: boolean;
  processHostStateOverride?: DesktopShellRuntimeProcessHostResult["processHostState"] | null;
  processHostSummaryOverride?: string | null;
  now: number;
}): DesktopShellRuntimeProcessHostResult {
  const snapshot = resolveDesktopShellRuntimeProcessHostSnapshot({
    shellOwnerWake: params.shellOwnerWake,
    appOwnerState: params.appOwnerState,
    shellOwnerState: params.shellOwnerState,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    processHostOwned: params.processHostOwned,
    now: params.now,
    action: params.action,
    shellAppLabel: params.shellAppLabel,
  });
  const processHostState =
    params.processHostStateOverride ?? snapshot.processHostState;
  const processHostActive =
    processHostState === "foreground"
    || processHostState === "starting"
    || processHostState === "backoff_wait";
  const processHostSummary =
    params.processHostSummaryOverride ?? snapshot.processHostSummary;
  const processHostDecision = {
    ...snapshot.processHostDecision,
    processHostState,
    processHostActive,
    shouldStartNow: processHostState === "starting",
    shouldForegroundNow:
      processHostState === "starting" || processHostState === "foreground",
    shouldBackgroundNow: processHostState === "background",
    processHostSummary,
  };
  updateLocalBridgeStartupPosture({
    processHostState,
    processHostOwned: snapshot.processHostOwned,
    processHostActive,
    nextWakeAt:
      processHostState === "background" || processHostState === "stopped"
        ? null
        : snapshot.nextWakeAt,
    lastStartAt: snapshot.lastStartAt,
    lastForegroundAt: snapshot.lastForegroundAt,
    lastBackgroundAt: snapshot.lastBackgroundAt,
    lastStopAt: snapshot.lastStopAt,
    processHostSummary,
  });
  return {
    shellOwnerWake: params.shellOwnerWake,
    appOwnerWake: params.shellOwnerWake?.appOwnerWake ?? null,
    bootstrapWake: params.shellOwnerWake?.bootstrapWake ?? null,
    lifecycleWake: params.shellOwnerWake?.lifecycleWake ?? null,
    serviceWake: params.shellOwnerWake?.serviceWake ?? null,
    hostWake: params.shellOwnerWake?.hostWake ?? null,
    runnerTick: params.shellOwnerWake?.runnerTick ?? null,
    timerTick: params.shellOwnerWake?.timerTick ?? null,
    driverCycle: params.shellOwnerWake?.driverCycle ?? null,
    heartbeatCycle: params.shellOwnerWake?.heartbeatCycle ?? null,
    healthFeed: params.shellOwnerWake?.healthFeed ?? null,
    pollingDecision: params.shellOwnerWake?.pollingDecision ?? null,
    schedulerDecision: params.shellOwnerWake?.schedulerDecision ?? null,
    driverDecision: params.shellOwnerWake?.driverDecision ?? null,
    timerDecision: params.shellOwnerWake?.timerDecision ?? null,
    runnerDecision: params.shellOwnerWake?.runnerDecision ?? null,
    hostDecision: params.shellOwnerWake?.hostDecision ?? null,
    serviceDecision: params.shellOwnerWake?.serviceDecision ?? null,
    lifecycleDecision: params.shellOwnerWake?.lifecycleDecision ?? null,
    bootstrapDecision: params.shellOwnerWake?.bootstrapDecision ?? null,
    appOwnerDecision: params.shellOwnerWake?.appOwnerDecision ?? null,
    shellOwnerDecision: params.shellOwnerWake?.shellOwnerDecision ?? null,
    serviceState: params.shellOwnerWake?.serviceState ?? "released",
    lifecycleState: params.shellOwnerWake?.lifecycleState ?? "inactive",
    bootstrapState: params.shellOwnerWake?.bootstrapState ?? "stopped",
    appOwnerState: snapshot.appOwnerState,
    shellOwnerState: snapshot.shellOwnerState,
    shellOwnerOwned: params.shellOwnerWake?.shellOwnerOwned ?? false,
    shellOwnerActive: params.shellOwnerWake?.shellOwnerActive ?? false,
    processHostDecision,
    processHostState,
    processHostOwned: snapshot.processHostOwned,
    processHostActive,
    nextWakeAt:
      processHostState === "background" || processHostState === "stopped"
        ? null
        : snapshot.nextWakeAt,
    lastStartAt: snapshot.lastStartAt,
    lastForegroundAt: snapshot.lastForegroundAt,
    lastBackgroundAt: snapshot.lastBackgroundAt,
    lastStopAt: snapshot.lastStopAt,
    recommendedDelayMs: params.shellOwnerWake?.recommendedDelayMs ?? null,
    retryBackoffMs: params.shellOwnerWake?.retryBackoffMs ?? null,
    shellOwnerSummary: snapshot.shellOwnerSummary,
    processHostSummary,
  };
}

export function startDesktopShellRuntimeProcessHost(
  options: DesktopShellRuntimeProcessHostOptions = {},
): DesktopShellRuntimeProcessHostResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const preWakeFeed = summarizeLocalBridgeHealthFeed(now);
  const processHostStateOverride =
    preWakeFeed.stalenessStatus === "stale" || preWakeFeed.stalenessStatus === "idle"
      ? "starting"
      : null;
  const processHostSummaryOverride =
    preWakeFeed.stalenessStatus === "stale"
      ? `${shellAppLabel} started desktop runtime process host and Desktop runtime process host is starting now to recover stale desktop cadence freshness.`
      : preWakeFeed.stalenessStatus === "idle"
        ? `${shellAppLabel} started desktop runtime process host and Desktop runtime process host is starting now because desktop cadence has not started yet.`
        : null;
  const shellOwnerWake = startDesktopShellRuntimeShellOwner({
    ...options,
    now,
    appShellOwned: options.appShellOwned ?? options.shellOwnerOwned ?? true,
  });
  return buildProcessHostResult({
    action: "start",
    shellAppLabel,
    shellOwnerWake,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    processHostOwned: options.processHostOwned ?? true,
    processHostStateOverride,
    processHostSummaryOverride,
    now,
  });
}

export function foregroundDesktopShellRuntimeProcessHost(
  options: DesktopShellRuntimeProcessHostOptions = {},
): DesktopShellRuntimeProcessHostResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const preWakeFeed = summarizeLocalBridgeHealthFeed(now);
  const processHostStateOverride =
    preWakeFeed.stalenessStatus === "stale" || preWakeFeed.stalenessStatus === "idle"
      ? "starting"
      : null;
  const processHostSummaryOverride =
    preWakeFeed.stalenessStatus === "stale"
      ? `${shellAppLabel} foregrounded desktop runtime process host and Desktop runtime process host is starting now to recover stale desktop cadence freshness.`
      : preWakeFeed.stalenessStatus === "idle"
        ? `${shellAppLabel} foregrounded desktop runtime process host and Desktop runtime process host is starting now because desktop cadence has not started yet.`
        : null;
  const shellOwnerWake = wakeDesktopShellRuntimeShellOwner({
    ...options,
    now,
    appShellOwned: options.appShellOwned ?? options.shellOwnerOwned ?? true,
  });
  return buildProcessHostResult({
    action: "foreground",
    shellAppLabel,
    shellOwnerWake,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    processHostOwned: options.processHostOwned ?? true,
    processHostStateOverride,
    processHostSummaryOverride,
    now,
  });
}

export function backgroundDesktopShellRuntimeProcessHost(
  options: Pick<DesktopShellRuntimeProcessHostOptions, "now" | "shellAppLabel"> = {},
): DesktopShellRuntimeProcessHostResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const shellOwnerWake = backgroundDesktopShellRuntimeShellOwner({
    now,
    shellAppLabel,
  });
  return buildProcessHostResult({
    action: "background",
    shellAppLabel,
    shellOwnerWake,
    processHostOwned: false,
    now,
  });
}

export function stopDesktopShellRuntimeProcessHost(
  options: Pick<DesktopShellRuntimeProcessHostOptions, "now" | "shellAppLabel"> = {},
): DesktopShellRuntimeProcessHostResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const shellOwnerWake = stopDesktopShellRuntimeShellOwner({
    now,
    shellAppLabel,
  });
  return buildProcessHostResult({
    action: "stop",
    shellAppLabel,
    shellOwnerWake,
    processHostOwned: false,
    now,
  });
}
