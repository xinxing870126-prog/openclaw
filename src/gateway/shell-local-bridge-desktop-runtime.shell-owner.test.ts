import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-provider.stub.js";
import { clearDesktopLocalBridgeProviderFactories } from "./shell-local-bridge-desktop-provider-registry.js";
import {
  resolveLocalBridgeStartupPosture,
  setLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";
import { startDesktopShellRuntimeModule } from "./shell-local-bridge-desktop-runtime.module.js";
import {
  backgroundDesktopShellRuntimeShellOwner,
  startDesktopShellRuntimeShellOwner,
  stopDesktopShellRuntimeShellOwner,
  wakeDesktopShellRuntimeShellOwner,
} from "./shell-local-bridge-desktop-runtime.shell-owner.js";

describe("desktop shell runtime shell owner", () => {
  afterEach(() => {
    clearDesktopLocalBridgeProviderFactories();
    setLocalBridgeStartupPosture(null);
    vi.useRealTimers();
  });

  it("starts into active shell-owner ownership on healthy cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Shell Owner",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Shell Owner Desktop Bridge",
          summary: "Attached from runtime shell-owner test.",
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

    const cycle = startDesktopShellRuntimeShellOwner({
      runtimeLabel: "Desktop Runtime Shell Owner",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "ready",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      serviceOwned: true,
      lifecycleOwned: true,
      bootstrapOwned: true,
      appOwnerOwned: true,
      appShellOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.shellOwnerDecision).toEqual(
      expect.objectContaining({
        shellOwnerState: "active",
        shellOwnerOwned: true,
        shellOwnerActive: true,
      }),
    );
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        shellOwnerState: "active",
        shellOwnerOwned: true,
        shellOwnerActive: true,
        lastStartAt: "2026-04-17T00:00:00.000Z",
      }),
    );
  });

  it("wakes into starting shell-owner state when desktop cadence is stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Shell Owner",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Shell Owner Desktop Bridge",
          summary: "Attached from runtime shell-owner test.",
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
    const cycle = wakeDesktopShellRuntimeShellOwner({
      runtimeLabel: "Desktop Runtime Shell Owner",
      shellAppLabel: "OpenClaw Desktop",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      serviceOwned: true,
      lifecycleOwned: true,
      bootstrapOwned: true,
      appOwnerOwned: true,
      appShellOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.shellOwnerDecision).toEqual(
      expect.objectContaining({
        shellOwnerState: "starting",
        shellOwnerOwned: true,
        shellOwnerActive: true,
      }),
    );
    expect(cycle.shellOwnerSummary).toContain(
      "starting now to recover stale desktop cadence freshness",
    );
  });

  it("uses backoff_wait shell-owner state when desktop integration is unavailable", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Shell Owner",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Shell Owner Desktop Bridge",
          summary: "Attached from runtime shell-owner test.",
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

    const cycle = wakeDesktopShellRuntimeShellOwner({
      runtimeLabel: "Desktop Runtime Shell Owner",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "unavailable",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      serviceOwned: true,
      lifecycleOwned: true,
      bootstrapOwned: true,
      appOwnerOwned: true,
      appShellOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.shellOwnerDecision).toEqual(
      expect.objectContaining({
        shellOwnerState: "backoff_wait",
        nextWakeAt: "2026-04-17T00:00:15.000Z",
      }),
    );
  });

  it("backgrounds shell-owner ownership", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:02:00.000Z"));

    const cycle = backgroundDesktopShellRuntimeShellOwner({
      now: Date.now(),
      shellAppLabel: "OpenClaw Desktop",
    });

    expect(cycle.shellOwnerDecision).toEqual(
      expect.objectContaining({
        shellOwnerState: "background",
        shellOwnerOwned: false,
        shellOwnerActive: false,
      }),
    );
    expect(cycle.lastBackgroundAt).toBe("2026-04-17T00:02:00.000Z");
  });

  it("stops shell-owner ownership", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:03:00.000Z"));

    const cycle = stopDesktopShellRuntimeShellOwner({
      now: Date.now(),
      shellAppLabel: "OpenClaw Desktop",
    });

    expect(cycle.shellOwnerDecision).toEqual(
      expect.objectContaining({
        shellOwnerState: "stopped",
        shellOwnerOwned: false,
        shellOwnerActive: false,
      }),
    );
    expect(cycle.lastStopAt).toBe("2026-04-17T00:03:00.000Z");
  });
});
