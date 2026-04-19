import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-provider.stub.js";
import { clearDesktopLocalBridgeProviderFactories } from "./shell-local-bridge-desktop-provider-registry.js";
import { resolveLocalBridgeStartupPosture, setLocalBridgeStartupPosture } from "./shell-local-bridge-provider-runtime.js";
import { startDesktopShellRuntimeModule } from "./shell-local-bridge-desktop-runtime.module.js";
import { runDesktopShellRuntimeDriverCycle } from "./shell-local-bridge-desktop-runtime.driver.js";

describe("desktop shell runtime driver", () => {
  afterEach(() => {
    clearDesktopLocalBridgeProviderFactories();
    setLocalBridgeStartupPosture(null);
    vi.useRealTimers();
  });

  it("keeps healthy cadence in scheduled driver state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Driver",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Driver Desktop Bridge",
          summary: "Attached from runtime driver test.",
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

    const cycle = runDesktopShellRuntimeDriverCycle({
      runtimeLabel: "Desktop Runtime Driver",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "ready",
      now: Date.now(),
    });

    expect(cycle.driverDecision).toEqual(
      expect.objectContaining({
        driverState: "scheduled",
        shouldRunNow: false,
        recommendedDelayMs: 60_000,
      }),
    );
    expect(cycle.nextRunAt).toBe("2026-04-17T00:01:00.000Z");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        driverState: "scheduled",
        nextRunAt: "2026-04-17T00:01:00.000Z",
        driverSummary: "Desktop runtime driver stays on the scheduled healthy cadence.",
      }),
    );
  });

  it("switches stale feed into run_now driver state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Driver",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Driver Desktop Bridge",
          summary: "Attached from runtime driver test.",
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
    const cycle = runDesktopShellRuntimeDriverCycle({
      runtimeLabel: "Desktop Runtime Driver",
      now: Date.now(),
    });

    expect(cycle.driverDecision).toEqual(
      expect.objectContaining({
        driverState: "run_now",
        shouldRunNow: true,
        recommendedDelayMs: 0,
      }),
    );
    expect(cycle.driverSummary).toContain("recover desktop health feed freshness");
  });

  it("switches unavailable posture into retry_backoff driver state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Driver",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Driver Desktop Bridge",
          summary: "Attached from runtime driver test.",
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

    const cycle = runDesktopShellRuntimeDriverCycle({
      runtimeLabel: "Desktop Runtime Driver",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "unavailable",
      now: Date.now(),
    });

    expect(cycle.driverDecision).toEqual(
      expect.objectContaining({
        driverState: "retry_backoff",
        shouldRunNow: false,
        retryBackoffMs: 15_000,
      }),
    );
    expect(cycle.nextRunAt).toBe("2026-04-17T00:00:15.000Z");
  });
});
