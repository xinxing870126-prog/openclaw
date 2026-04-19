import {
  resolveShellLocalBridgeRuntimeShellOwnerDecision,
  type ShellLocalBridgeRuntimeShellOwnerDecision,
} from "./shell-app-contract.js";
import {
  backgroundDesktopShellRuntimeAppOwner,
  startDesktopShellRuntimeAppOwner,
  stopDesktopShellRuntimeAppOwner,
  wakeDesktopShellRuntimeAppOwner,
  type DesktopShellRuntimeAppOwnerOptions,
  type DesktopShellRuntimeAppOwnerResult,
} from "./shell-local-bridge-desktop-runtime.app-owner.js";
import {
  resolveLocalBridgeStartupPosture,
  summarizeLocalBridgeHealthFeed,
  updateLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";

export type DesktopShellRuntimeShellOwnerOptions =
  DesktopShellRuntimeAppOwnerOptions & {
    appShellOwned?: boolean;
    shellOwnerOwned?: boolean;
  };

export type DesktopShellRuntimeShellOwnerSnapshot = {
  appOwnerWake: DesktopShellRuntimeAppOwnerResult | null;
  appOwnerState: DesktopShellRuntimeAppOwnerResult["appOwnerState"] | "stopped";
  shellOwnerDecision: ShellLocalBridgeRuntimeShellOwnerDecision;
  serviceState: DesktopShellRuntimeAppOwnerResult["serviceState"] | "released";
  lifecycleState: DesktopShellRuntimeAppOwnerResult["lifecycleState"] | "inactive";
  bootstrapState: DesktopShellRuntimeAppOwnerResult["bootstrapState"] | "stopped";
  shellOwnerState: ShellLocalBridgeRuntimeShellOwnerDecision["shellOwnerState"];
  shellOwnerOwned: boolean;
  shellOwnerActive: boolean;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastWakeAt: string | null;
  lastBackgroundAt: string | null;
  lastStopAt: string | null;
  appOwnerSummary: string | null;
  shellOwnerSummary: string;
};

export type DesktopShellRuntimeShellOwnerResult = {
  appOwnerWake: DesktopShellRuntimeAppOwnerResult | null;
  bootstrapWake: DesktopShellRuntimeAppOwnerResult["bootstrapWake"] | null;
  lifecycleWake: DesktopShellRuntimeAppOwnerResult["lifecycleWake"] | null;
  serviceWake: DesktopShellRuntimeAppOwnerResult["serviceWake"] | null;
  hostWake: DesktopShellRuntimeAppOwnerResult["hostWake"] | null;
  runnerTick: DesktopShellRuntimeAppOwnerResult["runnerTick"] | null;
  timerTick: DesktopShellRuntimeAppOwnerResult["timerTick"] | null;
  driverCycle: DesktopShellRuntimeAppOwnerResult["driverCycle"] | null;
  heartbeatCycle: DesktopShellRuntimeAppOwnerResult["heartbeatCycle"] | null;
  healthFeed: DesktopShellRuntimeAppOwnerResult["healthFeed"] | null;
  pollingDecision: DesktopShellRuntimeAppOwnerResult["pollingDecision"] | null;
  schedulerDecision: DesktopShellRuntimeAppOwnerResult["schedulerDecision"] | null;
  driverDecision: DesktopShellRuntimeAppOwnerResult["driverDecision"] | null;
  timerDecision: DesktopShellRuntimeAppOwnerResult["timerDecision"] | null;
  runnerDecision: DesktopShellRuntimeAppOwnerResult["runnerDecision"] | null;
  hostDecision: DesktopShellRuntimeAppOwnerResult["hostDecision"] | null;
  serviceDecision: DesktopShellRuntimeAppOwnerResult["serviceDecision"] | null;
  lifecycleDecision: DesktopShellRuntimeAppOwnerResult["lifecycleDecision"] | null;
  bootstrapDecision: DesktopShellRuntimeAppOwnerResult["bootstrapDecision"] | null;
  appOwnerDecision: DesktopShellRuntimeAppOwnerResult["appOwnerDecision"] | null;
  serviceState: DesktopShellRuntimeAppOwnerResult["serviceState"] | "released";
  lifecycleState: DesktopShellRuntimeAppOwnerResult["lifecycleState"] | "inactive";
  bootstrapState: DesktopShellRuntimeAppOwnerResult["bootstrapState"] | "stopped";
  appOwnerState: DesktopShellRuntimeAppOwnerResult["appOwnerState"] | "stopped";
  appOwnerOwned: boolean;
  appOwnerActive: boolean;
  shellOwnerDecision: ShellLocalBridgeRuntimeShellOwnerDecision;
  shellOwnerState: ShellLocalBridgeRuntimeShellOwnerDecision["shellOwnerState"];
  shellOwnerOwned: boolean;
  shellOwnerActive: boolean;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastWakeAt: string | null;
  lastBackgroundAt: string | null;
  lastStopAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  bootstrapSummary: string | null;
  appOwnerSummary: string | null;
  shellOwnerSummary: string;
};

function buildShellOwnerTimestamps(
  action: "start" | "wake" | "background" | "stop",
  now: number,
) {
  const current = resolveLocalBridgeStartupPosture();
  const timestamp = new Date(now).toISOString();
  return {
    lastStartAt: action === "start" ? timestamp : current?.lastStartAt ?? null,
    lastWakeAt: action === "wake" ? timestamp : current?.lastWakeAt ?? null,
    lastBackgroundAt:
      action === "background" ? timestamp : current?.lastBackgroundAt ?? null,
    lastStopAt: action === "stop" ? timestamp : current?.lastStopAt ?? null,
  };
}

function resolveShellOwnerSummary(params: {
  action: "start" | "wake" | "background" | "stop";
  shellAppLabel: string;
  decisionSummary: string;
}): string {
  switch (params.action) {
    case "start":
      return `${params.shellAppLabel} started desktop runtime shell owner and ${params.decisionSummary}`;
    case "wake":
      return `${params.shellAppLabel} woke desktop runtime shell owner and ${params.decisionSummary}`;
    case "background":
      return `${params.shellAppLabel} backgrounded desktop runtime shell owner and released desktop shell facade ownership.`;
    case "stop":
      return `${params.shellAppLabel} stopped desktop runtime shell owner and released desktop shell facade ownership.`;
  }
}

export function resolveDesktopShellRuntimeShellOwnerSnapshot(params: {
  appOwnerWake: DesktopShellRuntimeAppOwnerResult | null;
  serviceState?: DesktopShellRuntimeShellOwnerResult["serviceState"];
  lifecycleState?: DesktopShellRuntimeShellOwnerResult["lifecycleState"];
  bootstrapState?: DesktopShellRuntimeShellOwnerResult["bootstrapState"];
  appOwnerState?: DesktopShellRuntimeShellOwnerResult["appOwnerState"];
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  shellOwnerOwned?: boolean;
  now?: number;
  action?: "start" | "wake" | "background" | "stop";
  shellAppLabel?: string;
}): DesktopShellRuntimeShellOwnerSnapshot {
  const now = params.now ?? Date.now();
  const shellOwnerDecision = resolveShellLocalBridgeRuntimeShellOwnerDecision({
    appOwnerState:
      params.appOwnerState
      ?? params.appOwnerWake?.appOwnerState
      ?? "stopped",
    nextWakeAt: params.appOwnerWake?.nextWakeAt ?? null,
    healthFeed: params.appOwnerWake?.healthFeed,
    healthStatus:
      params.appOwnerWake?.heartbeatCycle?.heartbeat?.healthStatus
      ?? params.appOwnerWake?.healthFeed?.latestHealthStatus
      ?? undefined,
    attached: params.attached ?? params.appOwnerWake?.heartbeatCycle?.heartbeat?.attached,
    readiness:
      params.adapterReadiness
      ?? params.appOwnerWake?.heartbeatCycle?.heartbeat?.adapterReadiness,
    shellOwnerOwned: params.shellOwnerOwned,
    now,
  });
  const action = params.action ?? "wake";
  const shellOwnerState =
    action === "background"
      ? "background"
      : action === "stop"
        ? "stopped"
        : shellOwnerDecision.shellOwnerState;
  const shellOwnerOwned =
    action === "background" || action === "stop"
      ? false
      : shellOwnerDecision.shellOwnerOwned;
  const shellOwnerActive =
    shellOwnerState === "active"
    || shellOwnerState === "starting"
    || shellOwnerState === "backoff_wait";
  const timestamps = buildShellOwnerTimestamps(action, now);
  const shellOwnerSummary = resolveShellOwnerSummary({
    action,
    shellAppLabel: params.shellAppLabel?.trim() || "Desktop Shell",
    decisionSummary: shellOwnerDecision.shellOwnerSummary,
  });
  return {
    appOwnerWake: params.appOwnerWake,
    appOwnerState:
      params.appOwnerState
      ?? params.appOwnerWake?.appOwnerState
      ?? "stopped",
    shellOwnerDecision: {
      ...shellOwnerDecision,
      shellOwnerState,
      shellOwnerOwned,
      shellOwnerActive,
      shouldStartNow: shellOwnerState === "starting",
      shouldWakeNow: shellOwnerState === "starting",
      shouldBackgroundNow: shellOwnerState === "background",
      lastStartAt: timestamps.lastStartAt,
      lastWakeAt: timestamps.lastWakeAt,
      lastBackgroundAt: timestamps.lastBackgroundAt,
      lastStopAt: timestamps.lastStopAt,
      shellOwnerSummary,
    },
    serviceState:
      params.serviceState
      ?? params.appOwnerWake?.serviceState
      ?? "released",
    lifecycleState:
      params.lifecycleState
      ?? params.appOwnerWake?.lifecycleState
      ?? "inactive",
    bootstrapState:
      params.bootstrapState
      ?? params.appOwnerWake?.bootstrapState
      ?? "stopped",
    shellOwnerState,
    shellOwnerOwned,
    shellOwnerActive,
    nextWakeAt:
      shellOwnerState === "background" || shellOwnerState === "stopped"
        ? null
        : shellOwnerDecision.nextWakeAt,
    lastStartAt: timestamps.lastStartAt,
    lastWakeAt: timestamps.lastWakeAt,
    lastBackgroundAt: timestamps.lastBackgroundAt,
    lastStopAt: timestamps.lastStopAt,
    appOwnerSummary: params.appOwnerWake?.appOwnerSummary ?? null,
    shellOwnerSummary,
  };
}

function buildShellOwnerResult(params: {
  action: "start" | "wake" | "background" | "stop";
  shellAppLabel: string;
  appOwnerWake: DesktopShellRuntimeAppOwnerResult | null;
  serviceState?: DesktopShellRuntimeShellOwnerResult["serviceState"];
  lifecycleState?: DesktopShellRuntimeShellOwnerResult["lifecycleState"];
  bootstrapState?: DesktopShellRuntimeShellOwnerResult["bootstrapState"];
  appOwnerState?: DesktopShellRuntimeShellOwnerResult["appOwnerState"];
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  shellOwnerOwned?: boolean;
  shellOwnerStateOverride?: DesktopShellRuntimeShellOwnerResult["shellOwnerState"] | null;
  shellOwnerSummaryOverride?: string | null;
  now: number;
}): DesktopShellRuntimeShellOwnerResult {
  const snapshot = resolveDesktopShellRuntimeShellOwnerSnapshot({
    appOwnerWake: params.appOwnerWake,
    serviceState: params.serviceState,
    lifecycleState: params.lifecycleState,
    bootstrapState: params.bootstrapState,
    appOwnerState: params.appOwnerState,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    shellOwnerOwned: params.shellOwnerOwned,
    now: params.now,
    action: params.action,
    shellAppLabel: params.shellAppLabel,
  });
  const shellOwnerState =
    params.shellOwnerStateOverride ?? snapshot.shellOwnerState;
  const shellOwnerActive =
    shellOwnerState === "active"
    || shellOwnerState === "starting"
    || shellOwnerState === "backoff_wait";
  const shellOwnerSummary =
    params.shellOwnerSummaryOverride ?? snapshot.shellOwnerSummary;
  const shellOwnerDecision = {
    ...snapshot.shellOwnerDecision,
    shellOwnerState,
    shellOwnerActive,
    shouldStartNow: shellOwnerState === "starting",
    shouldWakeNow: shellOwnerState === "starting",
    shouldBackgroundNow: shellOwnerState === "background",
    shellOwnerSummary,
  };
  updateLocalBridgeStartupPosture({
    shellOwnerState,
    shellOwnerOwned: snapshot.shellOwnerOwned,
    shellOwnerActive,
    nextWakeAt:
      shellOwnerState === "background" || shellOwnerState === "stopped"
        ? null
        : snapshot.nextWakeAt,
    lastStartAt: snapshot.lastStartAt,
    lastWakeAt: snapshot.lastWakeAt,
    lastBackgroundAt: snapshot.lastBackgroundAt,
    lastStopAt: snapshot.lastStopAt,
    shellOwnerSummary,
  });
  return {
    appOwnerWake: params.appOwnerWake,
    bootstrapWake: params.appOwnerWake?.bootstrapWake ?? null,
    lifecycleWake: params.appOwnerWake?.lifecycleWake ?? null,
    serviceWake: params.appOwnerWake?.serviceWake ?? null,
    hostWake: params.appOwnerWake?.hostWake ?? null,
    runnerTick: params.appOwnerWake?.runnerTick ?? null,
    timerTick: params.appOwnerWake?.timerTick ?? null,
    driverCycle: params.appOwnerWake?.driverCycle ?? null,
    heartbeatCycle: params.appOwnerWake?.heartbeatCycle ?? null,
    healthFeed: params.appOwnerWake?.healthFeed ?? null,
    pollingDecision: params.appOwnerWake?.pollingDecision ?? null,
    schedulerDecision: params.appOwnerWake?.schedulerDecision ?? null,
    driverDecision: params.appOwnerWake?.driverDecision ?? null,
    timerDecision: params.appOwnerWake?.timerDecision ?? null,
    runnerDecision: params.appOwnerWake?.runnerDecision ?? null,
    hostDecision: params.appOwnerWake?.hostDecision ?? null,
    serviceDecision: params.appOwnerWake?.serviceDecision ?? null,
    lifecycleDecision: params.appOwnerWake?.lifecycleDecision ?? null,
    bootstrapDecision: params.appOwnerWake?.bootstrapDecision ?? null,
    appOwnerDecision: params.appOwnerWake?.appOwnerDecision ?? null,
    serviceState: snapshot.serviceState,
    lifecycleState: snapshot.lifecycleState,
    bootstrapState: snapshot.bootstrapState,
    appOwnerState: snapshot.appOwnerState,
    appOwnerOwned: params.appOwnerWake?.appOwnerOwned ?? false,
    appOwnerActive: params.appOwnerWake?.appOwnerActive ?? false,
    shellOwnerDecision,
    shellOwnerState,
    shellOwnerOwned: snapshot.shellOwnerOwned,
    shellOwnerActive,
    nextWakeAt:
      shellOwnerState === "background" || shellOwnerState === "stopped"
        ? null
        : snapshot.nextWakeAt,
    lastStartAt: snapshot.lastStartAt,
    lastWakeAt: snapshot.lastWakeAt,
    lastBackgroundAt: snapshot.lastBackgroundAt,
    lastStopAt: snapshot.lastStopAt,
    recommendedDelayMs: params.appOwnerWake?.recommendedDelayMs ?? null,
    retryBackoffMs: params.appOwnerWake?.retryBackoffMs ?? null,
    bootstrapSummary: params.appOwnerWake?.bootstrapSummary ?? null,
    appOwnerSummary: snapshot.appOwnerSummary,
    shellOwnerSummary,
  };
}

export function startDesktopShellRuntimeShellOwner(
  options: DesktopShellRuntimeShellOwnerOptions = {},
): DesktopShellRuntimeShellOwnerResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const preWakeFeed = summarizeLocalBridgeHealthFeed(now);
  const shellOwnerStateOverride =
    preWakeFeed.stalenessStatus === "stale" || preWakeFeed.stalenessStatus === "idle"
      ? "starting"
      : null;
  const shellOwnerSummaryOverride =
    preWakeFeed.stalenessStatus === "stale"
      ? `${shellAppLabel} started desktop runtime shell owner and Desktop runtime shell owner is starting now to recover stale desktop cadence freshness.`
      : preWakeFeed.stalenessStatus === "idle"
        ? `${shellAppLabel} started desktop runtime shell owner and Desktop runtime shell owner is starting now because desktop cadence has not started yet.`
        : null;
  const appOwnerWake = startDesktopShellRuntimeAppOwner({
    ...options,
    now,
    serviceOwned: options.serviceOwned ?? true,
    lifecycleOwned: options.lifecycleOwned ?? true,
    bootstrapOwned: options.bootstrapOwned ?? true,
    appOwnerOwned: true,
  });
  return buildShellOwnerResult({
    action: "start",
    shellAppLabel,
    appOwnerWake,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    shellOwnerOwned: options.appShellOwned ?? options.shellOwnerOwned ?? true,
    shellOwnerStateOverride,
    shellOwnerSummaryOverride,
    now,
  });
}

export function wakeDesktopShellRuntimeShellOwner(
  options: DesktopShellRuntimeShellOwnerOptions = {},
): DesktopShellRuntimeShellOwnerResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const preWakeFeed = summarizeLocalBridgeHealthFeed(now);
  const shellOwnerStateOverride =
    preWakeFeed.stalenessStatus === "stale" || preWakeFeed.stalenessStatus === "idle"
      ? "starting"
      : null;
  const shellOwnerSummaryOverride =
    preWakeFeed.stalenessStatus === "stale"
      ? `${shellAppLabel} woke desktop runtime shell owner and Desktop runtime shell owner is starting now to recover stale desktop cadence freshness.`
      : preWakeFeed.stalenessStatus === "idle"
        ? `${shellAppLabel} woke desktop runtime shell owner and Desktop runtime shell owner is starting now because desktop cadence has not started yet.`
        : null;
  const appOwnerWake = wakeDesktopShellRuntimeAppOwner({
    ...options,
    now,
    serviceOwned: options.serviceOwned ?? true,
    lifecycleOwned: options.lifecycleOwned ?? true,
    bootstrapOwned: options.bootstrapOwned ?? true,
    appOwnerOwned: options.appOwnerOwned ?? true,
  });
  return buildShellOwnerResult({
    action: "wake",
    shellAppLabel,
    appOwnerWake,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    shellOwnerOwned: options.appShellOwned ?? options.shellOwnerOwned ?? true,
    shellOwnerStateOverride,
    shellOwnerSummaryOverride,
    now,
  });
}

export function backgroundDesktopShellRuntimeShellOwner(
  options: Pick<DesktopShellRuntimeShellOwnerOptions, "now" | "shellAppLabel"> = {},
): DesktopShellRuntimeShellOwnerResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const appOwnerWake = backgroundDesktopShellRuntimeAppOwner({
    now,
    shellAppLabel,
  });
  return buildShellOwnerResult({
    action: "background",
    shellAppLabel,
    appOwnerWake,
    shellOwnerOwned: false,
    now,
  });
}

export function stopDesktopShellRuntimeShellOwner(
  options: Pick<DesktopShellRuntimeShellOwnerOptions, "now" | "shellAppLabel"> = {},
): DesktopShellRuntimeShellOwnerResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const appOwnerWake = stopDesktopShellRuntimeAppOwner({
    now,
    shellAppLabel,
  });
  return buildShellOwnerResult({
    action: "stop",
    shellAppLabel,
    appOwnerWake,
    shellOwnerOwned: false,
    now,
  });
}
