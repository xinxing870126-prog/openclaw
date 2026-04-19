import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-provider.stub.js";
import { clearDesktopLocalBridgeProviderFactories } from "./shell-local-bridge-desktop-provider-registry.js";
import { resolveLocalBridgeStartupPosture, setLocalBridgeStartupPosture } from "./shell-local-bridge-provider-runtime.js";
import { startDesktopShellRuntimeModule } from "./shell-local-bridge-desktop-runtime.module.js";
import {
  acquireDesktopShellRuntimeService,
  releaseDesktopShellRuntimeService,
  wakeDesktopShellRuntimeService,
} from "./shell-local-bridge-desktop-runtime.service.js";

describe("desktop shell runtime service", () => {
  afterEach(() => {
    clearDesktopLocalBridgeProviderFactories();
    setLocalBridgeStartupPosture(null);
    vi.useRealTimers();
  });

  it("acquires the service on healthy cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Service",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Service Desktop Bridge",
          summary: "Attached from runtime service test.",
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

    const cycle = acquireDesktopShellRuntimeService({
      runtimeLabel: "Desktop Runtime Service",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "ready",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      serviceOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.serviceDecision).toEqual(
      expect.objectContaining({
        serviceState: "acquired",
        serviceOwned: true,
        serviceActive: true,
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        serviceState: "acquired",
        serviceOwned: true,
        serviceActive: true,
        nextWakeAt: "2026-04-17T00:01:00.000Z",
        serviceSummary:
          "Desktop runtime service owner remains acquired for the next desktop main-process wake.",
      }),
    );
  });

  it("wakes immediately when the feed is stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Service",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Service Desktop Bridge",
          summary: "Attached from runtime service test.",
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
    const cycle = wakeDesktopShellRuntimeService({
      runtimeLabel: "Desktop Runtime Service",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      serviceOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.serviceDecision).toEqual(
      expect.objectContaining({
        serviceState: "waking",
        serviceOwned: true,
        serviceActive: true,
      }),
    );
    expect(cycle.serviceSummary).toContain("recover stale desktop cadence freshness");
  });

  it("uses backoff_wait when desktop integration is unavailable", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Service",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Service Desktop Bridge",
          summary: "Attached from runtime service test.",
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

    const cycle = wakeDesktopShellRuntimeService({
      runtimeLabel: "Desktop Runtime Service",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "unavailable",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      serviceOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.serviceDecision).toEqual(
      expect.objectContaining({
        serviceState: "backoff_wait",
        nextWakeAt: "2026-04-17T00:00:15.000Z",
      }),
    );
  });

  it("releases the service and clears ownership", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:02:00.000Z"));

    const decision = releaseDesktopShellRuntimeService({
      now: Date.now(),
    });

    expect(decision).toEqual(
      expect.objectContaining({
        serviceState: "released",
        serviceOwned: false,
        serviceActive: false,
        nextWakeAt: null,
      }),
    );
  });
});
