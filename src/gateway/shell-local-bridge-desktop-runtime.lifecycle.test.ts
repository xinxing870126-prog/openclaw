import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-provider.stub.js";
import { clearDesktopLocalBridgeProviderFactories } from "./shell-local-bridge-desktop-provider-registry.js";
import {
  resolveLocalBridgeStartupPosture,
  setLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";
import { startDesktopShellRuntimeModule } from "./shell-local-bridge-desktop-runtime.module.js";
import {
  bootDesktopShellRuntimeLifecycle,
  resumeDesktopShellRuntimeLifecycle,
  shutdownDesktopShellRuntimeLifecycle,
  suspendDesktopShellRuntimeLifecycle,
} from "./shell-local-bridge-desktop-runtime.lifecycle.js";

describe("desktop shell runtime lifecycle", () => {
  afterEach(() => {
    clearDesktopLocalBridgeProviderFactories();
    setLocalBridgeStartupPosture(null);
    vi.useRealTimers();
  });

  it("boots into active lifecycle ownership on healthy cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Lifecycle",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Lifecycle Desktop Bridge",
          summary: "Attached from runtime lifecycle test.",
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

    const cycle = bootDesktopShellRuntimeLifecycle({
      runtimeLabel: "Desktop Runtime Lifecycle",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "ready",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      serviceOwned: true,
      lifecycleOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.lifecycleDecision).toEqual(
      expect.objectContaining({
        lifecycleState: "active",
        lifecycleOwned: true,
        lifecycleActive: true,
      }),
    );
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        lifecycleState: "active",
        lifecycleOwned: true,
        lifecycleActive: true,
        lastBootAt: "2026-04-17T00:00:00.000Z",
      }),
    );
  });

  it("resumes into booting lifecycle when desktop cadence is stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Lifecycle",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Lifecycle Desktop Bridge",
          summary: "Attached from runtime lifecycle test.",
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
    const cycle = resumeDesktopShellRuntimeLifecycle({
      runtimeLabel: "Desktop Runtime Lifecycle",
      shellAppLabel: "OpenClaw Desktop",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      serviceOwned: true,
      lifecycleOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.lifecycleDecision).toEqual(
      expect.objectContaining({
        lifecycleState: "booting",
        lifecycleOwned: true,
        lifecycleActive: true,
      }),
    );
    expect(cycle.lifecycleSummary).toContain("booting now to recover stale desktop cadence freshness");
  });

  it("uses backoff_wait lifecycle state when desktop integration is unavailable", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Lifecycle",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Lifecycle Desktop Bridge",
          summary: "Attached from runtime lifecycle test.",
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

    const cycle = resumeDesktopShellRuntimeLifecycle({
      runtimeLabel: "Desktop Runtime Lifecycle",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "unavailable",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      serviceOwned: true,
      lifecycleOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.lifecycleDecision).toEqual(
      expect.objectContaining({
        lifecycleState: "backoff_wait",
        nextWakeAt: "2026-04-17T00:00:15.000Z",
      }),
    );
  });

  it("suspends and releases lifecycle ownership", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:02:00.000Z"));

    const cycle = suspendDesktopShellRuntimeLifecycle({
      now: Date.now(),
      shellAppLabel: "OpenClaw Desktop",
    });

    expect(cycle.lifecycleDecision).toEqual(
      expect.objectContaining({
        lifecycleState: "suspended",
        lifecycleOwned: false,
        lifecycleActive: false,
      }),
    );
    expect(cycle.lastSuspendAt).toBe("2026-04-17T00:02:00.000Z");
  });

  it("shuts down back to inactive lifecycle state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:03:00.000Z"));

    const cycle = shutdownDesktopShellRuntimeLifecycle({
      now: Date.now(),
      shellAppLabel: "OpenClaw Desktop",
    });

    expect(cycle.lifecycleDecision).toEqual(
      expect.objectContaining({
        lifecycleState: "inactive",
        lifecycleOwned: false,
        lifecycleActive: false,
      }),
    );
    expect(cycle.lastShutdownAt).toBe("2026-04-17T00:03:00.000Z");
  });
});
