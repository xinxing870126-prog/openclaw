import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-provider.stub.js";
import { clearDesktopLocalBridgeProviderFactories } from "./shell-local-bridge-desktop-provider-registry.js";
import {
  resolveLocalBridgeStartupPosture,
  setLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";
import { startDesktopShellRuntimeModule } from "./shell-local-bridge-desktop-runtime.module.js";
import {
  backgroundDesktopShellRuntimeAppOwner,
  startDesktopShellRuntimeAppOwner,
  stopDesktopShellRuntimeAppOwner,
  wakeDesktopShellRuntimeAppOwner,
} from "./shell-local-bridge-desktop-runtime.app-owner.js";

describe("desktop shell runtime app owner", () => {
  afterEach(() => {
    clearDesktopLocalBridgeProviderFactories();
    setLocalBridgeStartupPosture(null);
    vi.useRealTimers();
  });

  it("starts into active app-owner ownership on healthy cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime App Owner",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime App Owner Desktop Bridge",
          summary: "Attached from runtime app-owner test.",
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

    const cycle = startDesktopShellRuntimeAppOwner({
      runtimeLabel: "Desktop Runtime App Owner",
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
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.appOwnerDecision).toEqual(
      expect.objectContaining({
        appOwnerState: "active",
        appOwnerOwned: true,
        appOwnerActive: true,
      }),
    );
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        appOwnerState: "active",
        appOwnerOwned: true,
        appOwnerActive: true,
        lastStartAt: "2026-04-17T00:00:00.000Z",
      }),
    );
  });

  it("wakes into starting app-owner state when desktop cadence is stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime App Owner",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime App Owner Desktop Bridge",
          summary: "Attached from runtime app-owner test.",
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
    const cycle = wakeDesktopShellRuntimeAppOwner({
      runtimeLabel: "Desktop Runtime App Owner",
      shellAppLabel: "OpenClaw Desktop",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      serviceOwned: true,
      lifecycleOwned: true,
      bootstrapOwned: true,
      appOwnerOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.appOwnerDecision).toEqual(
      expect.objectContaining({
        appOwnerState: "starting",
        appOwnerOwned: true,
        appOwnerActive: true,
      }),
    );
    expect(cycle.appOwnerSummary).toContain(
      "starting now to recover stale desktop cadence freshness",
    );
  });

  it("uses backoff_wait app-owner state when desktop integration is unavailable", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime App Owner",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime App Owner Desktop Bridge",
          summary: "Attached from runtime app-owner test.",
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

    const cycle = wakeDesktopShellRuntimeAppOwner({
      runtimeLabel: "Desktop Runtime App Owner",
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
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.appOwnerDecision).toEqual(
      expect.objectContaining({
        appOwnerState: "backoff_wait",
        nextWakeAt: "2026-04-17T00:00:15.000Z",
      }),
    );
  });

  it("backgrounds app-owner ownership", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:02:00.000Z"));

    const cycle = backgroundDesktopShellRuntimeAppOwner({
      now: Date.now(),
      shellAppLabel: "OpenClaw Desktop",
    });

    expect(cycle.appOwnerDecision).toEqual(
      expect.objectContaining({
        appOwnerState: "background",
        appOwnerOwned: false,
        appOwnerActive: false,
      }),
    );
    expect(cycle.lastBackgroundAt).toBe("2026-04-17T00:02:00.000Z");
  });

  it("stops app-owner ownership", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:03:00.000Z"));

    const cycle = stopDesktopShellRuntimeAppOwner({
      now: Date.now(),
      shellAppLabel: "OpenClaw Desktop",
    });

    expect(cycle.appOwnerDecision).toEqual(
      expect.objectContaining({
        appOwnerState: "stopped",
        appOwnerOwned: false,
        appOwnerActive: false,
      }),
    );
    expect(cycle.lastStopAt).toBe("2026-04-17T00:03:00.000Z");
  });
});
