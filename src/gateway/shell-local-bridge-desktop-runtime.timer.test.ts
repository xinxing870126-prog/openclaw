import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-provider.stub.js";
import { clearDesktopLocalBridgeProviderFactories } from "./shell-local-bridge-desktop-provider-registry.js";
import { resolveLocalBridgeStartupPosture, setLocalBridgeStartupPosture } from "./shell-local-bridge-provider-runtime.js";
import { startDesktopShellRuntimeModule } from "./shell-local-bridge-desktop-runtime.module.js";
import { runDesktopShellRuntimeTimerTick } from "./shell-local-bridge-desktop-runtime.timer.js";

describe("desktop shell runtime timer", () => {
  afterEach(() => {
    clearDesktopLocalBridgeProviderFactories();
    setLocalBridgeStartupPosture(null);
    vi.useRealTimers();
  });

  it("arms the timer on healthy cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Timer",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Timer Desktop Bridge",
          summary: "Attached from runtime timer test.",
          readiness: "ready",
          transport: {
            listActions: () => [],
            listActionsForSession: () => [],
            listPendingActionsForSession: () => [],
            requestAction: (action) => action,
            resolveAction: (action) => action,
          },
        }),
    });

    const cycle = runDesktopShellRuntimeTimerTick({
      runtimeLabel: "Desktop Runtime Timer",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "ready",
      now: Date.now(),
      timerArmed: true,
    });

    expect(cycle.timerDecision).toEqual(
      expect.objectContaining({
        timerState: "armed",
        shouldArmTimer: true,
        shouldTickNow: false,
        nextTickAt: "2026-04-17T00:01:00.000Z",
      }),
    );
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        timerState: "armed",
        nextTickAt: "2026-04-17T00:01:00.000Z",
        timerSummary: "Desktop runtime timer remains armed on the healthy cadence.",
      }),
    );
  });

  it("ticks immediately when the health feed is stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Timer",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Timer Desktop Bridge",
          summary: "Attached from runtime timer test.",
          readiness: "ready",
          transport: {
            listActions: () => [],
            listActionsForSession: () => [],
            listPendingActionsForSession: () => [],
            requestAction: (action) => action,
            resolveAction: (action) => action,
          },
        }),
    });

    vi.setSystemTime(new Date("2026-04-17T00:06:30.000Z"));
    const cycle = runDesktopShellRuntimeTimerTick({
      runtimeLabel: "Desktop Runtime Timer",
      now: Date.now(),
      timerArmed: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.timerDecision).toEqual(
      expect.objectContaining({
        timerState: "tick_now",
        shouldArmTimer: false,
        shouldTickNow: true,
      }),
    );
    expect(cycle.timerSummary).toContain("recover desktop health feed freshness");
  });

  it("waits in backoff when desktop integration is unavailable", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Timer",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Timer Desktop Bridge",
          summary: "Attached from runtime timer test.",
          readiness: "ready",
          transport: {
            listActions: () => [],
            listActionsForSession: () => [],
            listPendingActionsForSession: () => [],
            requestAction: (action) => action,
            resolveAction: (action) => action,
          },
        }),
    });

    const cycle = runDesktopShellRuntimeTimerTick({
      runtimeLabel: "Desktop Runtime Timer",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "unavailable",
      now: Date.now(),
      timerArmed: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.timerDecision).toEqual(
      expect.objectContaining({
        timerState: "backoff_wait",
        shouldArmTimer: true,
        shouldTickNow: false,
        retryBackoffMs: 15_000,
      }),
    );
    expect(cycle.nextTickAt).toBe("2026-04-17T00:00:15.000Z");
  });
});
