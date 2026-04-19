import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-provider.stub.js";
import { clearDesktopLocalBridgeProviderFactories } from "./shell-local-bridge-desktop-provider-registry.js";
import { resolveLocalBridgeStartupPosture, setLocalBridgeStartupPosture } from "./shell-local-bridge-provider-runtime.js";
import { startDesktopShellRuntimeModule } from "./shell-local-bridge-desktop-runtime.module.js";
import {
  startDesktopShellRuntimeHost,
  stopDesktopShellRuntimeHost,
  wakeDesktopShellRuntimeHost,
} from "./shell-local-bridge-desktop-runtime.host.js";

describe("desktop shell runtime host", () => {
  afterEach(() => {
    clearDesktopLocalBridgeProviderFactories();
    setLocalBridgeStartupPosture(null);
    vi.useRealTimers();
  });

  it("arms the host on healthy cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Host",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Host Desktop Bridge",
          summary: "Attached from runtime host test.",
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

    const cycle = startDesktopShellRuntimeHost({
      runtimeLabel: "Desktop Runtime Host",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "ready",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.hostDecision).toEqual(
      expect.objectContaining({
        hostState: "armed",
        hostStarted: true,
        hostArmed: true,
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        hostState: "armed",
        hostStarted: true,
        hostArmed: true,
        nextWakeAt: "2026-04-17T00:01:00.000Z",
        hostSummary: "Desktop runtime host remains armed for the next desktop main-process wake.",
      }),
    );
  });

  it("wakes immediately when the feed is stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Host",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Host Desktop Bridge",
          summary: "Attached from runtime host test.",
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
    const cycle = wakeDesktopShellRuntimeHost({
      runtimeLabel: "Desktop Runtime Host",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.hostDecision).toEqual(
      expect.objectContaining({
        hostState: "waking",
        hostStarted: true,
        hostArmed: false,
      }),
    );
    expect(cycle.hostSummary).toContain("recover stale desktop cadence freshness");
  });

  it("uses backoff_wait when desktop integration is unavailable", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Host",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Host Desktop Bridge",
          summary: "Attached from runtime host test.",
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

    const cycle = wakeDesktopShellRuntimeHost({
      runtimeLabel: "Desktop Runtime Host",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "unavailable",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.hostDecision).toEqual(
      expect.objectContaining({
        hostState: "backoff_wait",
        nextWakeAt: "2026-04-17T00:00:15.000Z",
      }),
    );
  });

  it("stops the host and clears wake scheduling", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:02:00.000Z"));

    const decision = stopDesktopShellRuntimeHost({
      now: Date.now(),
    });

    expect(decision).toEqual(
      expect.objectContaining({
        hostState: "stopped",
        hostStarted: false,
        hostArmed: false,
        nextWakeAt: null,
      }),
    );
  });
});
