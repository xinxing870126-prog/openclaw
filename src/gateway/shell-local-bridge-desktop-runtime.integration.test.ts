import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveLocalBridgeStartupPosture,
  setLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";
import {
  initializeDesktopShellRuntimeIntegration,
  pollDesktopShellRuntimeIntegrationHealthFeed,
  runDesktopShellRuntimeIntegrationBootstrapWake,
  runDesktopShellRuntimeIntegrationAppOwnerWake,
  dispatchDesktopShellRuntimeIntegrationProcessEvent,
  dispatchDesktopShellRuntimeIntegrationNativeProcessEvent,
  runDesktopShellRuntimeIntegrationShellOwnerWake,
  runDesktopShellRuntimeIntegrationProcessHostWake,
  reportDesktopShellRuntimeIntegrationHealth,
  runDesktopShellRuntimeIntegrationDriverCycle,
  runDesktopShellRuntimeIntegrationHeartbeatCycle,
  runDesktopShellRuntimeIntegrationHostWake,
  runDesktopShellRuntimeIntegrationLifecycleWake,
  runDesktopShellRuntimeIntegrationServiceWake,
  runDesktopShellRuntimeIntegrationRunnerTick,
  runDesktopShellRuntimeIntegrationSchedulerCycle,
  runDesktopShellRuntimeIntegrationTimerTick,
} from "./shell-local-bridge-desktop-runtime.integration.js";

afterEach(() => {
  setLocalBridgeStartupPosture(null);
});

describe("desktop shell runtime integration", () => {
  it("wraps app runtime startup with a runtime-oriented summary", () => {
    const startup = initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "simulated" } as NodeJS.ProcessEnv,
      runtimeLabel: "Desktop Runtime Bridge",
    });

    expect(startup.runtimeLabel).toBe("Desktop Runtime Bridge");
    expect(startup.runtimeSummary).toBe(
      "Desktop Runtime Bridge started simulated bridge runtime (not attached) using no provider key.",
    );
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        runtimeLabel: "Desktop Runtime Bridge",
        runtimeSummary:
          "Desktop Runtime Bridge started simulated bridge runtime (not attached) using no provider key.",
      }),
    );
  });

  it("wraps runtime health heartbeat with a runtime-oriented summary", () => {
    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });

    const heartbeat = reportDesktopShellRuntimeIntegrationHealth({
      runtimeLabel: "Desktop Runtime Bridge",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "degraded",
    });

    expect(heartbeat.runtimeLabel).toBe("Desktop Runtime Bridge");
    expect(heartbeat.healthStatus).toBe("degraded");
    expect(heartbeat.runtimeSummary).toBe(
      "Desktop Runtime Bridge reported desktop bridge degraded.",
    );
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        runtimeLabel: "Desktop Runtime Bridge",
        runtimeSummary: "Desktop Runtime Bridge reported desktop bridge degraded.",
      }),
    );
  });

  it("keeps polling refresh available through the compatibility runtime integration exports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });
    reportDesktopShellRuntimeIntegrationHealth({
      runtimeLabel: "Desktop Runtime Bridge",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "ready",
    });

    vi.setSystemTime(new Date("2026-04-17T00:06:30.000Z"));
    const poll = pollDesktopShellRuntimeIntegrationHealthFeed({
      runtimeLabel: "Desktop Runtime Bridge",
    });

    expect(poll.healthFeed).toEqual(
      expect.objectContaining({
        stalenessStatus: "stale",
        pollRecommendedAfterMs: 0,
      }),
    );
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        runtimeLabel: "Desktop Runtime Bridge",
        runtimeSummary: poll.runtimeSummary,
      }),
    );
  });

  it("keeps the unified heartbeat cycle available through the compatibility runtime integration exports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });

    vi.setSystemTime(new Date("2026-04-17T00:01:30.000Z"));
    const cycle = runDesktopShellRuntimeIntegrationHeartbeatCycle({
      runtimeLabel: "Desktop Runtime Bridge",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "degraded",
      now: Date.now(),
    });

    expect(cycle.heartbeat).toEqual(
      expect.objectContaining({
        runtimeLabel: "Desktop Runtime Bridge",
        healthStatus: "degraded",
      }),
    );
    expect(cycle.pollingDecision).toEqual(
      expect.objectContaining({
        stalenessStatus: "fresh",
        shouldPollNow: false,
        pollRecommendedAfterMs: 60_000,
      }),
    );
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        runtimeLabel: "Desktop Runtime Bridge",
        runtimeSummary: cycle.runtimeSummary,
      }),
    );
  });

  it("keeps the unified scheduler cycle available through the compatibility runtime integration exports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });

    const cycle = runDesktopShellRuntimeIntegrationSchedulerCycle({
      runtimeLabel: "Desktop Runtime Bridge",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "ready",
      now: Date.now(),
    });

    expect(cycle.schedulerDecision).toEqual(
      expect.objectContaining({
        runnerMode: "healthy_cadence",
        recommendedDelayMs: 60_000,
      }),
    );
    expect(cycle.nextRunAt).toBe("2026-04-17T00:01:00.000Z");
  });

  it("keeps the unified driver cycle available through the compatibility runtime integration exports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });

    const cycle = runDesktopShellRuntimeIntegrationDriverCycle({
      runtimeLabel: "Desktop Runtime Bridge",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "ready",
      now: Date.now(),
    });

    expect(cycle.driverDecision).toEqual(
      expect.objectContaining({
        driverState: "scheduled",
        recommendedDelayMs: 60_000,
      }),
    );
    expect(cycle.nextRunAt).toBe("2026-04-17T00:01:00.000Z");
  });

  it("keeps the unified timer tick available through the compatibility runtime integration exports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });

    const cycle = runDesktopShellRuntimeIntegrationTimerTick({
      runtimeLabel: "Desktop Runtime Bridge",
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "ready",
      now: Date.now(),
      timerArmed: true,
    });

    expect(cycle.timerDecision).toEqual(
      expect.objectContaining({
        timerState: "armed",
        shouldArmTimer: true,
      }),
    );
    expect(cycle.nextTickAt).toBe("2026-04-17T00:01:00.000Z");
  });

  it("keeps the unified runner tick available through the compatibility runtime integration exports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });

    const cycle = runDesktopShellRuntimeIntegrationRunnerTick({
      runtimeLabel: "Desktop Runtime Bridge",
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
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("keeps the unified host wake available through the compatibility runtime integration exports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });

    const cycle = runDesktopShellRuntimeIntegrationHostWake({
      runtimeLabel: "Desktop Runtime Bridge",
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
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("keeps the unified service wake available through the compatibility runtime integration exports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });

    const cycle = runDesktopShellRuntimeIntegrationServiceWake({
      runtimeLabel: "Desktop Runtime Bridge",
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
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("keeps the unified lifecycle wake available through the compatibility runtime integration exports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });

    const cycle = runDesktopShellRuntimeIntegrationLifecycleWake({
      runtimeLabel: "Desktop Runtime Bridge",
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
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("keeps the unified bootstrap wake available through the compatibility runtime integration exports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });

    const cycle = runDesktopShellRuntimeIntegrationBootstrapWake({
      runtimeLabel: "Desktop Runtime Bridge",
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
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("keeps the unified app-owner wake available through the compatibility runtime integration exports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });

    const cycle = runDesktopShellRuntimeIntegrationAppOwnerWake({
      runtimeLabel: "Desktop Runtime Bridge",
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
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("keeps the unified shell-owner wake available through the compatibility runtime integration exports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });

    const cycle = runDesktopShellRuntimeIntegrationShellOwnerWake({
      runtimeLabel: "Desktop Runtime Bridge",
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
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("keeps the unified process-host wake available through the compatibility runtime integration exports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });

    const cycle = runDesktopShellRuntimeIntegrationProcessHostWake({
      runtimeLabel: "Desktop Runtime Bridge",
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
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("keeps the unified process-event adapter available through the compatibility runtime integration exports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });

    const cycle = dispatchDesktopShellRuntimeIntegrationProcessEvent({
      eventType: "foreground",
      runtimeLabel: "Desktop Runtime Bridge",
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

    expect(cycle.processHostState).toBe("foreground");
    expect(cycle.processEventType).toBe("foreground");
    expect(cycle.processEventSource).toBe("desktop_main_process_event_bridge");
    expect(cycle.lastProcessEventAt).toBe("2026-04-17T00:00:00.000Z");
  });

  it("keeps the native process-event bridge available through the compatibility runtime integration exports", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T00:00:00.000Z"));

    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      transport: {
        listActions: vi.fn(() => []),
        listActionsForSession: vi.fn(() => []),
        listPendingActionsForSession: vi.fn(() => []),
        requestAction: vi.fn(),
        resolveAction: vi.fn(),
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });

    const cycle = dispatchDesktopShellRuntimeIntegrationNativeProcessEvent({
      nativeEventType: "app_foregrounded",
      runtimeLabel: "Desktop Runtime Bridge",
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
      lastTickAt: Date.parse("2026-04-18T00:00:00.000Z"),
    });

    expect(cycle.processHostState).toBe("foreground");
    expect(cycle.processEventType).toBe("foreground");
    expect(cycle.nativeProcessEventType).toBe("app_foregrounded");
    expect(cycle.nativeProcessEventSource).toBe("desktop_native_main_process_bridge");
    expect(cycle.lastNativeProcessEventAt).toBe("2026-04-18T00:00:00.000Z");
  });
});
