import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-provider.stub.js";
import { clearDesktopLocalBridgeProviderFactories } from "./shell-local-bridge-desktop-provider-registry.js";
import {
  resolveLocalBridgeStartupPosture,
  setLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";
import { startDesktopShellRuntimeModule } from "./shell-local-bridge-desktop-runtime.module.js";
import {
  startDesktopShellRuntimeBootstrap,
  stopDesktopShellRuntimeBootstrap,
  suspendDesktopShellRuntimeBootstrap,
  wakeDesktopShellRuntimeBootstrap,
} from "./shell-local-bridge-desktop-runtime.bootstrap.js";

describe("desktop shell runtime bootstrap", () => {
  afterEach(() => {
    clearDesktopLocalBridgeProviderFactories();
    setLocalBridgeStartupPosture(null);
    vi.useRealTimers();
  });

  it("starts into active bootstrap ownership on healthy cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bootstrap",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Bootstrap Desktop Bridge",
          summary: "Attached from runtime bootstrap test.",
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

    const cycle = startDesktopShellRuntimeBootstrap({
      runtimeLabel: "Desktop Runtime Bootstrap",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "ready",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      serviceOwned: true,
      lifecycleOwned: true,
      bootstrapOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.bootstrapDecision).toEqual(
      expect.objectContaining({
        bootstrapState: "active",
        bootstrapOwned: true,
        bootstrapActive: true,
      }),
    );
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        bootstrapState: "active",
        bootstrapOwned: true,
        bootstrapActive: true,
        lastStartAt: "2026-04-17T00:00:00.000Z",
      }),
    );
  });

  it("wakes into starting bootstrap when desktop cadence is stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bootstrap",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Bootstrap Desktop Bridge",
          summary: "Attached from runtime bootstrap test.",
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
    const cycle = wakeDesktopShellRuntimeBootstrap({
      runtimeLabel: "Desktop Runtime Bootstrap",
      shellAppLabel: "OpenClaw Desktop",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      serviceOwned: true,
      lifecycleOwned: true,
      bootstrapOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.bootstrapDecision).toEqual(
      expect.objectContaining({
        bootstrapState: "starting",
        bootstrapOwned: true,
        bootstrapActive: true,
      }),
    );
    expect(cycle.bootstrapSummary).toContain("starting now to recover stale desktop cadence freshness");
  });

  it("uses backoff_wait bootstrap state when desktop integration is unavailable", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bootstrap",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Bootstrap Desktop Bridge",
          summary: "Attached from runtime bootstrap test.",
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

    const cycle = wakeDesktopShellRuntimeBootstrap({
      runtimeLabel: "Desktop Runtime Bootstrap",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "unavailable",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      serviceOwned: true,
      lifecycleOwned: true,
      bootstrapOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.bootstrapDecision).toEqual(
      expect.objectContaining({
        bootstrapState: "backoff_wait",
        nextWakeAt: "2026-04-17T00:00:15.000Z",
      }),
    );
  });

  it("suspends bootstrap ownership", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:02:00.000Z"));

    const cycle = suspendDesktopShellRuntimeBootstrap({
      now: Date.now(),
      shellAppLabel: "OpenClaw Desktop",
    });

    expect(cycle.bootstrapDecision).toEqual(
      expect.objectContaining({
        bootstrapState: "suspended",
        bootstrapOwned: false,
        bootstrapActive: false,
      }),
    );
    expect(cycle.lastSuspendAt).toBe("2026-04-17T00:02:00.000Z");
  });

  it("stops bootstrap ownership", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:03:00.000Z"));

    const cycle = stopDesktopShellRuntimeBootstrap({
      now: Date.now(),
      shellAppLabel: "OpenClaw Desktop",
    });

    expect(cycle.bootstrapDecision).toEqual(
      expect.objectContaining({
        bootstrapState: "stopped",
        bootstrapOwned: false,
        bootstrapActive: false,
      }),
    );
    expect(cycle.lastStopAt).toBe("2026-04-17T00:03:00.000Z");
  });
});
