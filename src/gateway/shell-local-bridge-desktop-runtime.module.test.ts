import { afterEach, describe, expect, it, vi } from "vitest";
import {
  pollDesktopShellRuntimeModuleHealthFeed,
  runDesktopShellRuntimeModuleHeartbeatCycle,
  reportDesktopShellRuntimeModuleHealth,
  startDesktopShellRuntimeModule,
} from "./shell-local-bridge-desktop-runtime.module.js";
import {
  resolveLocalBridgeStartupPosture,
  setLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";

afterEach(() => {
  setLocalBridgeStartupPosture(null);
  vi.useRealTimers();
});

describe("desktop shell runtime module", () => {
  it("writes runtime posture during startup", () => {
    const startup = startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "simulated" } as NodeJS.ProcessEnv,
      runtimeLabel: "Desktop Runtime Module",
    });

    expect(startup.runtimeSummary).toBe(
      "Desktop Runtime Module started simulated bridge runtime (not attached) using no provider key.",
    );
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        runtimeLabel: "Desktop Runtime Module",
        runtimeSummary:
          "Desktop Runtime Module started simulated bridge runtime (not attached) using no provider key.",
      }),
    );
  });

  it("updates runtime posture on health heartbeat and poll refresh", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Module",
      providerKey: "desktop-main",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Module Desktop Bridge",
    });

    const heartbeat = reportDesktopShellRuntimeModuleHealth({
      runtimeLabel: "Desktop Runtime Module",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "degraded",
    });
    expect(heartbeat.runtimeSummary).toBe(
      "Desktop Runtime Module reported desktop bridge degraded.",
    );

    vi.setSystemTime(new Date("2026-04-17T00:06:30.000Z"));
    const poll = pollDesktopShellRuntimeModuleHealthFeed({
      runtimeLabel: "Desktop Runtime Module",
    });
    expect(poll.healthFeed).toEqual(
      expect.objectContaining({
        stalenessStatus: "stale",
        expectedHeartbeatIntervalMs: 60_000,
        pollRecommendedAfterMs: 0,
      }),
    );
    expect(poll.runtimeSummary).toContain("desktop health feed stale");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        runtimeLabel: "Desktop Runtime Module",
        runtimeSummary: poll.runtimeSummary,
      }),
    );
  });

  it("runs a unified heartbeat cycle that reports health and returns polling guidance", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Module",
      providerKey: "desktop-main",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Module Desktop Bridge",
    });

    vi.setSystemTime(new Date("2026-04-17T00:01:30.000Z"));
    const cycle = runDesktopShellRuntimeModuleHeartbeatCycle({
      runtimeLabel: "Desktop Runtime Module",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "degraded",
      now: Date.now(),
    });

    expect(cycle.heartbeat).toEqual(
      expect.objectContaining({
        runtimeLabel: "Desktop Runtime Module",
        healthStatus: "degraded",
      }),
    );
    expect(cycle.healthFeed).toEqual(
      expect.objectContaining({
        stalenessStatus: "fresh",
        latestHealthStatus: "degraded",
      }),
    );
    expect(cycle.pollingDecision).toEqual(
      expect.objectContaining({
        stalenessStatus: "fresh",
        shouldPollNow: false,
        pollRecommendedAfterMs: 60_000,
        freshnessReason: "desktop runtime heartbeat is within the expected freshness window",
      }),
    );
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        runtimeLabel: "Desktop Runtime Module",
        runtimeSummary: cycle.runtimeSummary,
      }),
    );
  });
});
