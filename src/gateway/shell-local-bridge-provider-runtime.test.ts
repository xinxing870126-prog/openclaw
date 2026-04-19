import { afterEach, describe, expect, it } from "vitest";
import type { LocalBridgeAdapter } from "./shell-local-bridge-provider.js";
import {
  attachDesktopLocalBridgeAdapter,
  attachLocalBridgeAdapterProvider,
  appendLocalBridgeHealthEvent,
  listLocalBridgeHealthEvents,
  resolveAttachedDesktopLocalBridgeAdapter,
  resolveLocalBridgeStartupPosture,
  setLocalBridgeStartupPosture,
  summarizeLocalBridgeHealthFeed,
  updateLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";

const DESKTOP_TEST_ADAPTER: LocalBridgeAdapter = {
  key: "desktop",
  getAdapter() {
    return {
      mode: "desktop",
      readiness: "ready",
      label: "Runtime Test Desktop Bridge",
      summary: "A runtime test adapter for desktop bridge provider attach semantics.",
      supports: ["request", "resolve", "focus_policy", "lifecycle_tracking"],
    };
  },
  getContract() {
    return {
      version: "v1",
      requestFields: ["actionId", "actionType", "title", "description", "constraints", "sessionKey", "requestedAt", "lifecycle"],
      resultFields: ["actionId", "approved", "payload", "error", "resolvedAt", "lifecycle"],
      visibleLifecycles: ["requested", "pending", "completed", "rejected"],
      reservedLifecycles: ["stale", "expired"],
    };
  },
  getTransport() {
    return {
      adapterMode: "desktop",
      adapterReadiness: "ready",
      contractVersion: "v1",
    };
  },
  listActions() {
    return [];
  },
  listActionsForSession() {
    return [];
  },
  listPendingActionsForSession() {
    return [];
  },
  requestAction() {
    throw new Error("not used in runtime attach test");
  },
  resolveAction() {
    throw new Error("not used in runtime attach test");
  },
};

afterEach(() => {
  attachLocalBridgeAdapterProvider(null);
  setLocalBridgeStartupPosture(null);
});

describe("shell local bridge provider runtime", () => {
  it("attaches a desktop adapter directly", () => {
    attachDesktopLocalBridgeAdapter(DESKTOP_TEST_ADAPTER);

    expect(resolveAttachedDesktopLocalBridgeAdapter()).toBe(DESKTOP_TEST_ADAPTER);
  });

  it("attaches a provider and resolves its desktop adapter", () => {
    attachLocalBridgeAdapterProvider({
      getDesktopAdapter: () => DESKTOP_TEST_ADAPTER,
    });

    expect(resolveAttachedDesktopLocalBridgeAdapter()).toBe(DESKTOP_TEST_ADAPTER);
  });

  it("stores and resolves local bridge startup posture", () => {
    setLocalBridgeStartupPosture({
      mode: "desktop",
      attached: true,
      startupModeLabel: "desktop bridge startup",
      startupSummary: "OpenClaw Desktop attached Runtime Test Desktop Bridge during startup using contract v1.",
      startupSource: "desktop_startup_wiring",
      shellAppLabel: "OpenClaw Desktop",
      providerKey: null,
    });

    expect(resolveLocalBridgeStartupPosture()).toEqual({
      mode: "desktop",
      attached: true,
      startupModeLabel: "desktop bridge startup",
      startupSummary: "OpenClaw Desktop attached Runtime Test Desktop Bridge during startup using contract v1.",
      startupSource: "desktop_startup_wiring",
      shellAppLabel: "OpenClaw Desktop",
      providerKey: null,
    });
  });

  it("updates local bridge startup posture incrementally", () => {
    setLocalBridgeStartupPosture({
      mode: "desktop",
      attached: true,
      adapterReadiness: "ready",
      healthStatus: "healthy",
      healthStatusLabel: "desktop bridge ready",
      startupModeLabel: "desktop bridge startup",
      startupSummary: "OpenClaw Desktop attached Runtime Test Desktop Bridge during startup using contract v1.",
      startupSource: "desktop_startup_wiring",
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
    });

    expect(
      updateLocalBridgeStartupPosture({
        adapterReadiness: "degraded",
        healthStatus: "degraded",
        healthStatusLabel: "desktop bridge degraded",
      }),
    ).toEqual({
      mode: "desktop",
      attached: true,
      adapterReadiness: "degraded",
      healthStatus: "degraded",
      healthStatusLabel: "desktop bridge degraded",
      startupModeLabel: "desktop bridge startup",
      startupSummary: "OpenClaw Desktop attached Runtime Test Desktop Bridge during startup using contract v1.",
      startupSource: "desktop_startup_wiring",
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
    });
  });

  it("stores recent local bridge health events in newest-first order", () => {
    appendLocalBridgeHealthEvent({
      occurredAt: "2026-04-17T00:00:00.000Z",
      source: "startup_posture",
      healthStatus: "healthy",
      healthStatusLabel: "desktop bridge ready",
      summary: "Startup wiring attached the desktop bridge.",
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
    });
    appendLocalBridgeHealthEvent({
      occurredAt: "2026-04-17T00:01:00.000Z",
      source: "runtime_heartbeat",
      healthStatus: "degraded",
      healthStatusLabel: "desktop bridge degraded",
      summary: "OpenClaw Desktop reported desktop bridge degraded through runtime health heartbeat.",
      shellAppLabel: "OpenClaw Desktop",
      moduleLabel: "Desktop Shell Startup Module",
      providerKey: "desktop-main",
    });

    expect(listLocalBridgeHealthEvents()).toEqual([
      expect.objectContaining({
        occurredAt: "2026-04-17T00:01:00.000Z",
        source: "runtime_heartbeat",
        healthStatus: "degraded",
      }),
      expect.objectContaining({
        occurredAt: "2026-04-17T00:00:00.000Z",
        source: "startup_posture",
        healthStatus: "healthy",
      }),
    ]);
    expect(summarizeLocalBridgeHealthFeed(Date.parse("2026-04-17T00:02:00.000Z"))).toEqual({
      eventCount: 2,
      latestOccurredAt: "2026-04-17T00:01:00.000Z",
      latestAgeMs: 60_000,
      staleAfterMs: 300_000,
      nextStaleAt: "2026-04-17T00:06:00.000Z",
      expectedHeartbeatIntervalMs: 60_000,
      pollRecommendedAfterMs: 0,
      missedHeartbeatCount: 0,
      freshnessReason: "desktop runtime heartbeat is within the expected freshness window",
      latestSource: "runtime_heartbeat",
      latestHealthStatus: "degraded",
      latestHealthStatusLabel: "desktop bridge degraded",
      stalenessStatus: "fresh",
      stalenessStatusLabel: "desktop health feed fresh",
    });
  });

  it("marks desktop health feed as stale when the latest event is too old", () => {
    appendLocalBridgeHealthEvent({
      occurredAt: "2026-04-17T00:00:00.000Z",
      source: "runtime_heartbeat",
      healthStatus: "healthy",
      healthStatusLabel: "desktop bridge ready",
      summary: "OpenClaw Desktop reported desktop bridge ready through runtime health heartbeat.",
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
    });

    expect(summarizeLocalBridgeHealthFeed(Date.parse("2026-04-17T00:10:30.000Z"))).toEqual({
      eventCount: 1,
      latestOccurredAt: "2026-04-17T00:00:00.000Z",
      latestAgeMs: 630_000,
      staleAfterMs: 300_000,
      nextStaleAt: "2026-04-17T00:05:00.000Z",
      expectedHeartbeatIntervalMs: 60_000,
      pollRecommendedAfterMs: 0,
      missedHeartbeatCount: 10,
      freshnessReason:
        "desktop runtime heartbeat has not refreshed within the expected freshness window",
      latestSource: "runtime_heartbeat",
      latestHealthStatus: "healthy",
      latestHealthStatusLabel: "desktop bridge ready",
      stalenessStatus: "stale",
      stalenessStatusLabel: "desktop health feed stale",
    });
  });
});
