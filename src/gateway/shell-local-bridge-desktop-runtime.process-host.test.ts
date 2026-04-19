import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-provider.stub.js";
import { clearDesktopLocalBridgeProviderFactories } from "./shell-local-bridge-desktop-provider-registry.js";
import {
  resolveLocalBridgeStartupPosture,
  setLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";
import { startDesktopShellRuntimeModule } from "./shell-local-bridge-desktop-runtime.module.js";
import {
  backgroundDesktopShellRuntimeProcessHost,
  foregroundDesktopShellRuntimeProcessHost,
  startDesktopShellRuntimeProcessHost,
  stopDesktopShellRuntimeProcessHost,
} from "./shell-local-bridge-desktop-runtime.process-host.js";

describe("desktop shell runtime process host", () => {
  afterEach(() => {
    clearDesktopLocalBridgeProviderFactories();
    setLocalBridgeStartupPosture(null);
    vi.useRealTimers();
  });

  it("starts into foreground process-host ownership on healthy cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Process Host",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Process Host Desktop Bridge",
          summary: "Attached from runtime process-host test.",
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

    const cycle = startDesktopShellRuntimeProcessHost({
      runtimeLabel: "Desktop Runtime Process Host",
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
      processHostOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.processHostDecision).toEqual(
      expect.objectContaining({
        processHostState: "foreground",
        processHostOwned: true,
        processHostActive: true,
      }),
    );
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        processHostState: "foreground",
        processHostOwned: true,
        processHostActive: true,
        lastStartAt: "2026-04-17T00:00:00.000Z",
      }),
    );
  });

  it("foregrounds into starting process-host state when desktop cadence is stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Process Host",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Process Host Desktop Bridge",
          summary: "Attached from runtime process-host test.",
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
    const cycle = foregroundDesktopShellRuntimeProcessHost({
      runtimeLabel: "Desktop Runtime Process Host",
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
      processHostOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.processHostDecision).toEqual(
      expect.objectContaining({
        processHostState: "starting",
        processHostOwned: true,
        processHostActive: true,
      }),
    );
    expect(cycle.processHostSummary).toContain(
      "starting now to recover stale desktop cadence freshness",
    );
  });

  it("uses backoff_wait process-host state when desktop integration is unavailable", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Process Host",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Process Host Desktop Bridge",
          summary: "Attached from runtime process-host test.",
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

    const cycle = foregroundDesktopShellRuntimeProcessHost({
      runtimeLabel: "Desktop Runtime Process Host",
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
      processHostOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.processHostDecision).toEqual(
      expect.objectContaining({
        processHostState: "backoff_wait",
        nextWakeAt: "2026-04-17T00:00:15.000Z",
      }),
    );
  });

  it("backgrounds process-host ownership", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:02:00.000Z"));

    const cycle = backgroundDesktopShellRuntimeProcessHost({
      now: Date.now(),
      shellAppLabel: "OpenClaw Desktop",
    });

    expect(cycle.processHostDecision).toEqual(
      expect.objectContaining({
        processHostState: "background",
        processHostOwned: false,
        processHostActive: false,
      }),
    );
    expect(cycle.lastBackgroundAt).toBe("2026-04-17T00:02:00.000Z");
  });

  it("stops process-host ownership", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:03:00.000Z"));

    const cycle = stopDesktopShellRuntimeProcessHost({
      now: Date.now(),
      shellAppLabel: "OpenClaw Desktop",
    });

    expect(cycle.processHostDecision).toEqual(
      expect.objectContaining({
        processHostState: "stopped",
        processHostOwned: false,
        processHostActive: false,
      }),
    );
    expect(cycle.lastStopAt).toBe("2026-04-17T00:03:00.000Z");
  });
});
