import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-provider.stub.js";
import { clearDesktopLocalBridgeProviderFactories } from "./shell-local-bridge-desktop-provider-registry.js";
import { resolveLocalBridgeStartupPosture, setLocalBridgeStartupPosture } from "./shell-local-bridge-provider-runtime.js";
import { startDesktopShellRuntimeModule } from "./shell-local-bridge-desktop-runtime.module.js";
import { runDesktopShellRuntimeSchedulerCycle } from "./shell-local-bridge-desktop-runtime.scheduler.js";

describe("desktop shell runtime scheduler", () => {
  afterEach(() => {
    clearDesktopLocalBridgeProviderFactories();
    setLocalBridgeStartupPosture(null);
    vi.useRealTimers();
  });

  it("schedules healthy cadence from the canonical runtime cycle", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Module",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Scheduler Desktop Bridge",
          summary: "Attached from runtime scheduler test.",
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

    const cycle = runDesktopShellRuntimeSchedulerCycle({
      runtimeLabel: "Desktop Runtime Module",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "ready",
      now: Date.now(),
    });

    expect(cycle.schedulerDecision).toEqual(
      expect.objectContaining({
        runnerMode: "healthy_cadence",
        recommendedDelayMs: 60_000,
        retryBackoffMs: null,
      }),
    );
    expect(cycle.nextRunAt).toBe("2026-04-17T00:01:00.000Z");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        runnerMode: "healthy_cadence",
        nextRunAt: "2026-04-17T00:01:00.000Z",
        recommendedDelayMs: 60_000,
        runnerSummary: "Desktop runtime scheduler remains on the healthy cadence.",
      }),
    );
  });

  it("switches stale feed into immediate freshness recovery cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Module",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Scheduler Desktop Bridge",
          summary: "Attached from runtime scheduler test.",
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
    const cycle = runDesktopShellRuntimeSchedulerCycle({
      runtimeLabel: "Desktop Runtime Module",
      now: Date.now(),
    });

    expect(cycle.schedulerDecision).toEqual(
      expect.objectContaining({
        runnerMode: "freshness_recovery",
        shouldRunNow: true,
        recommendedDelayMs: 0,
        retryBackoffMs: 0,
      }),
    );
    expect(cycle.runnerSummary).toContain("freshness recovery");
  });
});
