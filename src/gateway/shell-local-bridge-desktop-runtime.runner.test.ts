import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-provider.stub.js";
import { clearDesktopLocalBridgeProviderFactories } from "./shell-local-bridge-desktop-provider-registry.js";
import { resolveLocalBridgeStartupPosture, setLocalBridgeStartupPosture } from "./shell-local-bridge-provider-runtime.js";
import { startDesktopShellRuntimeModule } from "./shell-local-bridge-desktop-runtime.module.js";
import {
  startDesktopShellRuntimeRunner,
  stopDesktopShellRuntimeRunner,
  tickDesktopShellRuntimeRunner,
} from "./shell-local-bridge-desktop-runtime.runner.js";

describe("desktop shell runtime runner", () => {
  afterEach(() => {
    clearDesktopLocalBridgeProviderFactories();
    setLocalBridgeStartupPosture(null);
    vi.useRealTimers();
  });

  it("arms the runner on healthy cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Runner",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Runner Desktop Bridge",
          summary: "Attached from runtime runner test.",
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

    const cycle = startDesktopShellRuntimeRunner({
      runtimeLabel: "Desktop Runtime Runner",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "ready",
      now: Date.now(),
      runnerStarted: true,
      timerArmed: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.runnerDecision).toEqual(
      expect.objectContaining({
        runnerState: "armed",
        shouldKeepRunning: true,
        armed: true,
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        runnerState: "armed",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
        runnerServiceSummary: "Desktop runtime runner remains armed for the next scheduled cadence wake.",
      }),
    );
  });

  it("ticks immediately when the feed is stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Runner",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Runner Desktop Bridge",
          summary: "Attached from runtime runner test.",
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
    const cycle = tickDesktopShellRuntimeRunner({
      runtimeLabel: "Desktop Runtime Runner",
      now: Date.now(),
      runnerStarted: true,
      timerArmed: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.runnerDecision).toEqual(
      expect.objectContaining({
        runnerState: "ticking",
        shouldKeepRunning: true,
        armed: false,
      }),
    );
    expect(cycle.runnerSummary).toContain("recover stale desktop health feed freshness");
  });

  it("uses backoff_wait when desktop integration is unavailable", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Runner",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Runner Desktop Bridge",
          summary: "Attached from runtime runner test.",
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

    const cycle = tickDesktopShellRuntimeRunner({
      runtimeLabel: "Desktop Runtime Runner",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "unavailable",
      now: Date.now(),
      runnerStarted: true,
      timerArmed: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.runnerDecision).toEqual(
      expect.objectContaining({
        runnerState: "backoff_wait",
        nextWakeAt: "2026-04-17T00:00:15.000Z",
      }),
    );
  });

  it("stops the runner and clears wake scheduling", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:02:00.000Z"));

    const decision = stopDesktopShellRuntimeRunner({
      now: Date.now(),
      lastTickAt: Date.parse("2026-04-17T00:01:00.000Z"),
    });

    expect(decision).toEqual(
      expect.objectContaining({
        runnerState: "stopped",
        shouldKeepRunning: false,
        nextWakeAt: null,
      }),
    );
  });
});
