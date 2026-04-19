import type { LocalBridgeAdapter, LocalBridgeAdapterProvider } from "./shell-local-bridge-provider.js";
import type {
  ShellLocalBridgeHealthEvent,
  ShellLocalBridgeHealthFeedSummary,
  ShellLocalBridgeStartupPosture,
} from "./shell-app-contract.js";

let attachedLocalBridgeAdapterProvider: LocalBridgeAdapterProvider | null = null;
let localBridgeStartupPosture: ShellLocalBridgeStartupPosture | null = null;
let localBridgeRecentHealthEvents: ShellLocalBridgeHealthEvent[] = [];
const MAX_LOCAL_BRIDGE_HEALTH_EVENTS = 5;
const LOCAL_BRIDGE_HEALTH_FEED_EXPECTED_HEARTBEAT_INTERVAL_MS = 60 * 1000;
const LOCAL_BRIDGE_HEALTH_FEED_STALE_AFTER_MS = 5 * 60 * 1000;

export function attachLocalBridgeAdapterProvider(
  provider: LocalBridgeAdapterProvider | null,
): void {
  attachedLocalBridgeAdapterProvider = provider;
}

export function attachDesktopLocalBridgeAdapter(
  adapter: LocalBridgeAdapter | null,
): void {
  attachedLocalBridgeAdapterProvider = adapter
    ? {
        getDesktopAdapter: () => adapter,
      }
    : null;
}

export function resolveAttachedDesktopLocalBridgeAdapter(): LocalBridgeAdapter | null {
  return attachedLocalBridgeAdapterProvider?.getDesktopAdapter?.() ?? null;
}

export function setLocalBridgeStartupPosture(
  posture: ShellLocalBridgeStartupPosture | null,
): void {
  localBridgeStartupPosture = posture;
  localBridgeRecentHealthEvents = [];
}

export function updateLocalBridgeStartupPosture(
  patch: Partial<ShellLocalBridgeStartupPosture> | null,
): ShellLocalBridgeStartupPosture | null {
  if (!patch) {
    return localBridgeStartupPosture;
  }
  if (!localBridgeStartupPosture) {
    return null;
  }
  localBridgeStartupPosture = {
    ...localBridgeStartupPosture,
    ...patch,
  };
  return localBridgeStartupPosture;
}

export function resolveLocalBridgeStartupPosture(): ShellLocalBridgeStartupPosture | null {
  return localBridgeStartupPosture;
}

export function appendLocalBridgeHealthEvent(
  event: ShellLocalBridgeHealthEvent | null,
): ShellLocalBridgeHealthEvent[] {
  if (!event) {
    return localBridgeRecentHealthEvents;
  }
  localBridgeRecentHealthEvents = [event, ...localBridgeRecentHealthEvents]
    .slice(0, MAX_LOCAL_BRIDGE_HEALTH_EVENTS);
  return localBridgeRecentHealthEvents;
}

export function listLocalBridgeHealthEvents(): ShellLocalBridgeHealthEvent[] {
  return [...localBridgeRecentHealthEvents];
}

export function summarizeLocalBridgeHealthFeed(
  now: number = Date.now(),
): ShellLocalBridgeHealthFeedSummary {
  const latest = localBridgeRecentHealthEvents[0] ?? null;
  const latestOccurredAt = latest?.occurredAt ?? null;
  const latestTimestamp = latestOccurredAt ? Date.parse(latestOccurredAt) : Number.NaN;
  const nextStaleAt =
    Number.isFinite(latestTimestamp)
      ? new Date(latestTimestamp + LOCAL_BRIDGE_HEALTH_FEED_STALE_AFTER_MS).toISOString()
      : null;
  const latestAgeMs =
    Number.isFinite(latestTimestamp)
      ? Math.max(0, now - latestTimestamp)
      : null;
  const missedHeartbeatCount =
    latestAgeMs === null
      ? 0
      : Math.max(
          0,
          Math.ceil(latestAgeMs / LOCAL_BRIDGE_HEALTH_FEED_EXPECTED_HEARTBEAT_INTERVAL_MS) - 1,
        );
  const pollRecommendedAfterMs =
    localBridgeRecentHealthEvents.length <= 0
      ? 0
      : latestAgeMs === null
        ? null
        : latestAgeMs >= LOCAL_BRIDGE_HEALTH_FEED_EXPECTED_HEARTBEAT_INTERVAL_MS
          ? 0
          : LOCAL_BRIDGE_HEALTH_FEED_EXPECTED_HEARTBEAT_INTERVAL_MS - latestAgeMs;
  const stalenessStatus =
    localBridgeRecentHealthEvents.length <= 0
      ? "idle"
      : latestAgeMs !== null && latestAgeMs >= LOCAL_BRIDGE_HEALTH_FEED_STALE_AFTER_MS
        ? "stale"
        : "fresh";
  const freshnessReason =
    stalenessStatus === "idle"
      ? "desktop health feed has not received any runtime events yet"
      : stalenessStatus === "stale"
        ? "desktop runtime heartbeat has not refreshed within the expected freshness window"
        : missedHeartbeatCount > 0
          ? "desktop runtime heartbeat is delayed but still within the freshness window"
          : "desktop runtime heartbeat is within the expected freshness window";
  return {
    eventCount: localBridgeRecentHealthEvents.length,
    latestOccurredAt,
    latestAgeMs,
    staleAfterMs: LOCAL_BRIDGE_HEALTH_FEED_STALE_AFTER_MS,
    nextStaleAt,
    expectedHeartbeatIntervalMs: LOCAL_BRIDGE_HEALTH_FEED_EXPECTED_HEARTBEAT_INTERVAL_MS,
    pollRecommendedAfterMs,
    missedHeartbeatCount,
    freshnessReason,
    latestSource: latest?.source ?? null,
    latestHealthStatus: latest?.healthStatus ?? null,
    latestHealthStatusLabel: latest?.healthStatusLabel ?? null,
    stalenessStatus,
    stalenessStatusLabel:
      stalenessStatus === "stale"
        ? "desktop health feed stale"
        : stalenessStatus === "fresh"
          ? "desktop health feed fresh"
          : "desktop health feed idle",
  };
}
