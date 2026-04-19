import {
  resolveShellLocalBridgeRuntimeAppOwnerDecision,
  type ShellLocalBridgeRuntimeAppOwnerDecision,
} from "./shell-app-contract.js";
import {
  startDesktopShellRuntimeBootstrap,
  stopDesktopShellRuntimeBootstrap,
  suspendDesktopShellRuntimeBootstrap,
  wakeDesktopShellRuntimeBootstrap,
  type DesktopShellRuntimeBootstrapOptions,
  type DesktopShellRuntimeBootstrapResult,
} from "./shell-local-bridge-desktop-runtime.bootstrap.js";
import {
  resolveLocalBridgeStartupPosture,
  summarizeLocalBridgeHealthFeed,
  updateLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";

export type DesktopShellRuntimeAppOwnerOptions =
  DesktopShellRuntimeBootstrapOptions & {
    appOwnerOwned?: boolean;
  };

export type DesktopShellRuntimeAppOwnerSnapshot = {
  bootstrapWake: DesktopShellRuntimeBootstrapResult | null;
  appOwnerDecision: ShellLocalBridgeRuntimeAppOwnerDecision;
  serviceState:
    | NonNullable<DesktopShellRuntimeBootstrapResult["serviceState"]>
    | "released";
  lifecycleState: DesktopShellRuntimeBootstrapResult["lifecycleState"] | "inactive";
  bootstrapState: DesktopShellRuntimeBootstrapResult["bootstrapState"] | "stopped";
  appOwnerState: ShellLocalBridgeRuntimeAppOwnerDecision["appOwnerState"];
  appOwnerOwned: boolean;
  appOwnerActive: boolean;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastWakeAt: string | null;
  lastBackgroundAt: string | null;
  lastStopAt: string | null;
  bootstrapSummary: string | null;
  appOwnerSummary: string;
};

export type DesktopShellRuntimeAppOwnerResult = {
  bootstrapWake: DesktopShellRuntimeBootstrapResult | null;
  lifecycleWake: DesktopShellRuntimeBootstrapResult["lifecycleWake"] | null;
  serviceWake: DesktopShellRuntimeBootstrapResult["serviceWake"] | null;
  hostWake: DesktopShellRuntimeBootstrapResult["hostWake"] | null;
  runnerTick: DesktopShellRuntimeBootstrapResult["runnerTick"] | null;
  timerTick: DesktopShellRuntimeBootstrapResult["timerTick"] | null;
  driverCycle: DesktopShellRuntimeBootstrapResult["driverCycle"] | null;
  heartbeatCycle: DesktopShellRuntimeBootstrapResult["heartbeatCycle"] | null;
  healthFeed: DesktopShellRuntimeBootstrapResult["healthFeed"] | null;
  pollingDecision: DesktopShellRuntimeBootstrapResult["pollingDecision"] | null;
  schedulerDecision: DesktopShellRuntimeBootstrapResult["schedulerDecision"] | null;
  driverDecision: DesktopShellRuntimeBootstrapResult["driverDecision"] | null;
  timerDecision: DesktopShellRuntimeBootstrapResult["timerDecision"] | null;
  runnerDecision: DesktopShellRuntimeBootstrapResult["runnerDecision"] | null;
  hostDecision: DesktopShellRuntimeBootstrapResult["hostDecision"] | null;
  serviceDecision: DesktopShellRuntimeBootstrapResult["serviceDecision"] | null;
  lifecycleDecision: DesktopShellRuntimeBootstrapResult["lifecycleDecision"] | null;
  bootstrapDecision: DesktopShellRuntimeBootstrapResult["bootstrapDecision"] | null;
  serviceState:
    | NonNullable<DesktopShellRuntimeBootstrapResult["serviceState"]>
    | "released";
  lifecycleState: DesktopShellRuntimeBootstrapResult["lifecycleState"] | "inactive";
  bootstrapState: DesktopShellRuntimeBootstrapResult["bootstrapState"] | "stopped";
  appOwnerDecision: ShellLocalBridgeRuntimeAppOwnerDecision;
  appOwnerState: ShellLocalBridgeRuntimeAppOwnerDecision["appOwnerState"];
  appOwnerOwned: boolean;
  appOwnerActive: boolean;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastWakeAt: string | null;
  lastBackgroundAt: string | null;
  lastStopAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  bootstrapSummary: string | null;
  appOwnerSummary: string;
};

function buildAppOwnerTimestamps(
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

function resolveAppOwnerSummary(params: {
  action: "start" | "wake" | "background" | "stop";
  shellAppLabel: string;
  decisionSummary: string;
}): string {
  switch (params.action) {
    case "start":
      return `${params.shellAppLabel} started desktop runtime app owner and ${params.decisionSummary}`;
    case "wake":
      return `${params.shellAppLabel} woke desktop runtime app owner and ${params.decisionSummary}`;
    case "background":
      return `${params.shellAppLabel} backgrounded desktop runtime app owner and released foreground desktop cadence ownership.`;
    case "stop":
      return `${params.shellAppLabel} stopped desktop runtime app owner and released desktop app-owner ownership.`;
  }
}

export function resolveDesktopShellRuntimeAppOwnerSnapshot(params: {
  bootstrapWake: DesktopShellRuntimeBootstrapResult | null;
  serviceState?: DesktopShellRuntimeAppOwnerResult["serviceState"];
  lifecycleState?: DesktopShellRuntimeAppOwnerResult["lifecycleState"];
  bootstrapState?: DesktopShellRuntimeAppOwnerResult["bootstrapState"];
  bootstrapSummary?: string | null;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  appOwnerOwned?: boolean;
  now?: number;
  action?: "start" | "wake" | "background" | "stop";
  shellAppLabel?: string;
}): DesktopShellRuntimeAppOwnerSnapshot {
  const now = params.now ?? Date.now();
  const appOwnerDecision = resolveShellLocalBridgeRuntimeAppOwnerDecision({
    bootstrapState:
      params.bootstrapState
      ?? params.bootstrapWake?.bootstrapState
      ?? "stopped",
    nextWakeAt: params.bootstrapWake?.nextWakeAt ?? null,
    healthFeed: params.bootstrapWake?.healthFeed,
    healthStatus:
      params.bootstrapWake?.heartbeatCycle?.heartbeat?.healthStatus
      ?? params.bootstrapWake?.healthFeed?.latestHealthStatus
      ?? undefined,
    attached: params.attached ?? params.bootstrapWake?.heartbeatCycle?.heartbeat?.attached,
    readiness:
      params.adapterReadiness
      ?? params.bootstrapWake?.heartbeatCycle?.heartbeat?.adapterReadiness,
    appOwnerOwned: params.appOwnerOwned,
    now,
  });
  const action = params.action ?? "wake";
  const appOwnerState =
    action === "background"
      ? "background"
      : action === "stop"
        ? "stopped"
        : appOwnerDecision.appOwnerState;
  const appOwnerOwned =
    action === "background" || action === "stop"
      ? false
      : appOwnerDecision.appOwnerOwned;
  const appOwnerActive =
    appOwnerState === "active"
    || appOwnerState === "starting"
    || appOwnerState === "backoff_wait";
  const timestamps = buildAppOwnerTimestamps(action, now);
  const appOwnerSummary = resolveAppOwnerSummary({
    action,
    shellAppLabel: params.shellAppLabel?.trim() || "Desktop Shell",
    decisionSummary: appOwnerDecision.appOwnerSummary,
  });
  return {
    bootstrapWake: params.bootstrapWake,
    appOwnerDecision: {
      ...appOwnerDecision,
      appOwnerState,
      appOwnerOwned,
      appOwnerActive,
      shouldStartNow: appOwnerState === "starting",
      shouldWakeNow: appOwnerState === "starting",
      shouldBackgroundNow: appOwnerState === "background",
      lastStartAt: timestamps.lastStartAt,
      lastWakeAt: timestamps.lastWakeAt,
      lastBackgroundAt: timestamps.lastBackgroundAt,
      lastStopAt: timestamps.lastStopAt,
      appOwnerSummary,
    },
    serviceState:
      params.serviceState
      ?? params.bootstrapWake?.serviceState
      ?? "released",
    lifecycleState:
      params.lifecycleState
      ?? params.bootstrapWake?.lifecycleState
      ?? "inactive",
    bootstrapState:
      params.bootstrapState
      ?? params.bootstrapWake?.bootstrapState
      ?? "stopped",
    appOwnerState,
    appOwnerOwned,
    appOwnerActive,
    nextWakeAt:
      appOwnerState === "background" || appOwnerState === "stopped"
        ? null
        : appOwnerDecision.nextWakeAt,
    lastStartAt: timestamps.lastStartAt,
    lastWakeAt: timestamps.lastWakeAt,
    lastBackgroundAt: timestamps.lastBackgroundAt,
    lastStopAt: timestamps.lastStopAt,
    bootstrapSummary:
      params.bootstrapSummary
      ?? params.bootstrapWake?.bootstrapSummary
      ?? null,
    appOwnerSummary,
  };
}

function buildAppOwnerResult(params: {
  action: "start" | "wake" | "background" | "stop";
  shellAppLabel: string;
  bootstrapWake: DesktopShellRuntimeBootstrapResult | null;
  serviceState?: DesktopShellRuntimeAppOwnerResult["serviceState"];
  lifecycleState?: DesktopShellRuntimeAppOwnerResult["lifecycleState"];
  bootstrapState?: DesktopShellRuntimeAppOwnerResult["bootstrapState"];
  bootstrapSummary?: string | null;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  appOwnerOwned?: boolean;
  appOwnerStateOverride?: DesktopShellRuntimeAppOwnerResult["appOwnerState"] | null;
  appOwnerSummaryOverride?: string | null;
  now: number;
}): DesktopShellRuntimeAppOwnerResult {
  const snapshot = resolveDesktopShellRuntimeAppOwnerSnapshot({
    bootstrapWake: params.bootstrapWake,
    serviceState: params.serviceState,
    lifecycleState: params.lifecycleState,
    bootstrapState: params.bootstrapState,
    bootstrapSummary: params.bootstrapSummary,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    appOwnerOwned: params.appOwnerOwned,
    now: params.now,
    action: params.action,
    shellAppLabel: params.shellAppLabel,
  });
  const appOwnerState = params.appOwnerStateOverride ?? snapshot.appOwnerState;
  const appOwnerActive =
    appOwnerState === "active"
    || appOwnerState === "starting"
    || appOwnerState === "backoff_wait";
  const appOwnerSummary = params.appOwnerSummaryOverride ?? snapshot.appOwnerSummary;
  const appOwnerDecision = {
    ...snapshot.appOwnerDecision,
    appOwnerState,
    appOwnerActive,
    shouldStartNow: appOwnerState === "starting",
    shouldWakeNow: appOwnerState === "starting",
    shouldBackgroundNow: appOwnerState === "background",
    appOwnerSummary,
  };
  updateLocalBridgeStartupPosture({
    appOwnerState,
    appOwnerOwned: snapshot.appOwnerOwned,
    appOwnerActive,
    nextWakeAt:
      appOwnerState === "background" || appOwnerState === "stopped"
        ? null
        : snapshot.nextWakeAt,
    lastStartAt: snapshot.lastStartAt,
    lastWakeAt: snapshot.lastWakeAt,
    lastBackgroundAt: snapshot.lastBackgroundAt,
    lastStopAt: snapshot.lastStopAt,
    appOwnerSummary,
  });
  return {
    bootstrapWake: params.bootstrapWake,
    lifecycleWake: params.bootstrapWake?.lifecycleWake ?? null,
    serviceWake: params.bootstrapWake?.serviceWake ?? null,
    hostWake: params.bootstrapWake?.hostWake ?? null,
    runnerTick: params.bootstrapWake?.runnerTick ?? null,
    timerTick: params.bootstrapWake?.timerTick ?? null,
    driverCycle: params.bootstrapWake?.driverCycle ?? null,
    heartbeatCycle: params.bootstrapWake?.heartbeatCycle ?? null,
    healthFeed: params.bootstrapWake?.healthFeed ?? null,
    pollingDecision: params.bootstrapWake?.pollingDecision ?? null,
    schedulerDecision: params.bootstrapWake?.schedulerDecision ?? null,
    driverDecision: params.bootstrapWake?.driverDecision ?? null,
    timerDecision: params.bootstrapWake?.timerDecision ?? null,
    runnerDecision: params.bootstrapWake?.runnerDecision ?? null,
    hostDecision: params.bootstrapWake?.hostDecision ?? null,
    serviceDecision: params.bootstrapWake?.serviceDecision ?? null,
    lifecycleDecision: params.bootstrapWake?.lifecycleDecision ?? null,
    bootstrapDecision: params.bootstrapWake?.bootstrapDecision ?? null,
    serviceState: snapshot.serviceState,
    lifecycleState: snapshot.lifecycleState,
    bootstrapState: snapshot.bootstrapState,
    appOwnerDecision,
    appOwnerState,
    appOwnerOwned: snapshot.appOwnerOwned,
    appOwnerActive,
    nextWakeAt:
      appOwnerState === "background" || appOwnerState === "stopped"
        ? null
        : snapshot.nextWakeAt,
    lastStartAt: snapshot.lastStartAt,
    lastWakeAt: snapshot.lastWakeAt,
    lastBackgroundAt: snapshot.lastBackgroundAt,
    lastStopAt: snapshot.lastStopAt,
    recommendedDelayMs: params.bootstrapWake?.recommendedDelayMs ?? null,
    retryBackoffMs: params.bootstrapWake?.retryBackoffMs ?? null,
    bootstrapSummary: snapshot.bootstrapSummary,
    appOwnerSummary,
  };
}

export function startDesktopShellRuntimeAppOwner(
  options: DesktopShellRuntimeAppOwnerOptions = {},
): DesktopShellRuntimeAppOwnerResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const preWakeFeed = summarizeLocalBridgeHealthFeed(now);
  const appOwnerStateOverride =
    preWakeFeed.stalenessStatus === "stale" || preWakeFeed.stalenessStatus === "idle"
      ? "starting"
      : null;
  const appOwnerSummaryOverride =
    preWakeFeed.stalenessStatus === "stale"
      ? `${shellAppLabel} started desktop runtime app owner and Desktop runtime app owner is starting now to recover stale desktop cadence freshness.`
      : preWakeFeed.stalenessStatus === "idle"
        ? `${shellAppLabel} started desktop runtime app owner and Desktop runtime app owner is starting now because desktop cadence has not started yet.`
        : null;
  const bootstrapWake = startDesktopShellRuntimeBootstrap({
    ...options,
    now,
    bootstrapOwned: true,
    lifecycleOwned: options.lifecycleOwned ?? true,
    serviceOwned: options.serviceOwned ?? true,
  });
  return buildAppOwnerResult({
    action: "start",
    shellAppLabel,
    bootstrapWake,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    appOwnerOwned: true,
    appOwnerStateOverride,
    appOwnerSummaryOverride,
    now,
  });
}

export function wakeDesktopShellRuntimeAppOwner(
  options: DesktopShellRuntimeAppOwnerOptions = {},
): DesktopShellRuntimeAppOwnerResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const preWakeFeed = summarizeLocalBridgeHealthFeed(now);
  const appOwnerStateOverride =
    preWakeFeed.stalenessStatus === "stale" || preWakeFeed.stalenessStatus === "idle"
      ? "starting"
      : null;
  const appOwnerSummaryOverride =
    preWakeFeed.stalenessStatus === "stale"
      ? `${shellAppLabel} woke desktop runtime app owner and Desktop runtime app owner is starting now to recover stale desktop cadence freshness.`
      : preWakeFeed.stalenessStatus === "idle"
        ? `${shellAppLabel} woke desktop runtime app owner and Desktop runtime app owner is starting now because desktop cadence has not started yet.`
        : null;
  const bootstrapWake = wakeDesktopShellRuntimeBootstrap({
    ...options,
    now,
    bootstrapOwned: options.bootstrapOwned ?? true,
    lifecycleOwned: options.lifecycleOwned ?? true,
    serviceOwned: options.serviceOwned ?? true,
  });
  return buildAppOwnerResult({
    action: "wake",
    shellAppLabel,
    bootstrapWake,
    attached: options.attached,
    adapterReadiness: options.adapterReadiness,
    appOwnerOwned: options.appOwnerOwned ?? true,
    appOwnerStateOverride,
    appOwnerSummaryOverride,
    now,
  });
}

export function backgroundDesktopShellRuntimeAppOwner(
  options: Pick<DesktopShellRuntimeAppOwnerOptions, "now" | "shellAppLabel"> = {},
): DesktopShellRuntimeAppOwnerResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const bootstrapWake = suspendDesktopShellRuntimeBootstrap({
    now,
    shellAppLabel,
  });
  return buildAppOwnerResult({
    action: "background",
    shellAppLabel,
    bootstrapWake,
    appOwnerOwned: false,
    now,
  });
}

export function stopDesktopShellRuntimeAppOwner(
  options: Pick<DesktopShellRuntimeAppOwnerOptions, "now" | "shellAppLabel"> = {},
): DesktopShellRuntimeAppOwnerResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const bootstrapWake = stopDesktopShellRuntimeBootstrap({
    now,
    shellAppLabel,
  });
  return buildAppOwnerResult({
    action: "stop",
    shellAppLabel,
    bootstrapWake,
    appOwnerOwned: false,
    now,
  });
}
