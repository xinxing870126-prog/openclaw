import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-provider.stub.js";
import { clearDesktopLocalBridgeProviderFactories } from "./shell-local-bridge-desktop-provider-registry.js";
import {
  resolveAttachedDesktopLocalBridgeAdapter,
  resolveLocalBridgeStartupPosture,
  setLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";
import {
  reportDesktopShellAppRuntimeHealthHeartbeatStub,
  runDesktopShellAppRuntimeAppOwnerWakeStub,
  dispatchDesktopShellAppRuntimeNativeProcessEventStub,
  dispatchDesktopShellAppRuntimeProcessEventStub,
  runDesktopShellAppRuntimeProcessHostWakeStub,
  runDesktopShellAppRuntimeShellOwnerWakeStub,
  runDesktopShellAppRuntimeBootstrapWakeStub,
  runDesktopShellAppRuntimeDriverCycleStub,
  runDesktopShellAppRuntimeHealthHeartbeatCycleStub,
  runDesktopShellAppRuntimeHostWakeStub,
  runDesktopShellAppRuntimeLifecycleWakeStub,
  runDesktopShellAppRuntimeServiceWakeStub,
  runDesktopShellAppRuntimeRunnerTickStub,
  runDesktopShellAppRuntimeSchedulerCycleStub,
  runDesktopShellAppRuntimeTimerTickStub,
  startDesktopShellAppRuntimeStub,
} from "./shell-local-bridge-desktop-app-runtime.stub.js";

describe("desktop shell app runtime stub", () => {
  afterEach(() => {
    clearDesktopLocalBridgeProviderFactories();
    setLocalBridgeStartupPosture(null);
  });

  it("registers a provider factory and wires desktop startup in one step", () => {
    const result = startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "App Runtime Desktop Bridge",
          summary: "Attached from app runtime stub.",
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

    expect(result).toMatchObject({
      mode: "desktop",
      attached: true,
      providerKey: "desktop-main",
      providerRegistered: true,
      providerStatus: "registry_provider",
      providerStatusLabel: "registered desktop provider",
      shellAppLabel: "OpenClaw Desktop",
    });
    expect(result.startupRuntimeSummary).toContain("registered provider desktop-main");
    expect(resolveAttachedDesktopLocalBridgeAdapter()?.getAdapter().label).toBe(
      "App Runtime Desktop Bridge",
    );
  });

  it("throws when a provider factory is supplied without a provider key", () => {
    expect(() =>
      startDesktopShellAppRuntimeStub({
        env: {
          OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
        } as NodeJS.ProcessEnv,
        providerFactory: () => null,
      }),
    ).toThrowError("desktop shell app runtime provider factory requires a provider key");
  });

  it("can reuse an already configured provider key without re-registering", () => {
    const result = startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
        OPENCLAW_DESKTOP_LOCAL_BRIDGE_PROVIDER_KEY: "desktop-shared",
      } as NodeJS.ProcessEnv,
    });

    expect(result.providerRegistered).toBe(false);
    expect(result.providerKey).toBe("desktop-shared");
    expect(result.providerStatus).toBe("missing_provider");
    expect(result.providerStatusLabel).toBe("missing desktop provider");
    expect(result.startupRuntimeSummary).toContain("reused provider desktop-shared");
  });

  it("reports runtime health heartbeat after startup", () => {
    startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "App Runtime Desktop Bridge",
          summary: "Attached from app runtime stub.",
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

    const heartbeat = reportDesktopShellAppRuntimeHealthHeartbeatStub({
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "degraded",
    });

    expect(heartbeat).toEqual({
      attached: true,
      adapterReadiness: "degraded",
      healthSource: "runtime_heartbeat",
      healthStatus: "degraded",
      healthStatusLabel: "desktop bridge degraded",
      heartbeatSummary: "OpenClaw Desktop reported desktop bridge degraded through runtime health heartbeat.",
    });
    expect(resolveLocalBridgeStartupPosture()).toMatchObject({
      attached: true,
      adapterReadiness: "degraded",
      healthSource: "runtime_heartbeat",
      healthStatus: "degraded",
      healthStatusLabel: "desktop bridge degraded",
      healthEventSummary:
        "OpenClaw Desktop reported desktop bridge degraded through runtime health heartbeat.",
      providerKey: "desktop-main",
    });
  });

  it("runs a unified app runtime heartbeat cycle with polling guidance", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "App Runtime Desktop Bridge",
          summary: "Attached from app runtime stub.",
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

    vi.setSystemTime(new Date("2026-04-17T00:01:30.000Z"));
    const cycle = runDesktopShellAppRuntimeHealthHeartbeatCycleStub({
      shellAppLabel: "OpenClaw Desktop",
      adapterReadiness: "degraded",
      now: Date.now(),
    });

    expect(cycle.heartbeat).toEqual(
      expect.objectContaining({
        healthStatus: "degraded",
      }),
    );
    expect(cycle.healthFeed).toEqual(
      expect.objectContaining({
        stalenessStatus: "fresh",
        latestHealthStatus: "degraded",
      }),
    );
    expect(cycle.pollingDecision).toEqual(
      expect.objectContaining({
        stalenessStatus: "fresh",
        shouldPollNow: false,
        pollRecommendedAfterMs: 60_000,
      }),
    );
    expect(cycle.startupRuntimeSummary).toContain("desktop health feed fresh");
  });

  it("wraps the canonical runtime scheduler for app runtime cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "App Runtime Desktop Bridge",
          summary: "Attached from app runtime stub.",
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

    const cycle = runDesktopShellAppRuntimeSchedulerCycleStub({
      runtimeLabel: "Desktop Runtime Module",
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
    expect(cycle.startupRuntimeSummary).toContain("healthy cadence");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        runnerMode: "healthy_cadence",
        nextRunAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical runtime driver for app runtime cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "App Runtime Desktop Bridge",
          summary: "Attached from app runtime stub.",
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

    const cycle = runDesktopShellAppRuntimeDriverCycleStub({
      runtimeLabel: "Desktop Runtime Module",
      shellAppLabel: "OpenClaw Desktop",
      now: Date.now(),
    });

    expect(cycle.driverDecision).toEqual(
      expect.objectContaining({
        driverState: "scheduled",
        recommendedDelayMs: 60_000,
      }),
    );
    expect(cycle.nextRunAt).toBe("2026-04-17T00:01:00.000Z");
    expect(cycle.startupRuntimeSummary).toContain("scheduled healthy cadence");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        driverState: "scheduled",
        nextRunAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical runtime timer for app runtime cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "App Runtime Desktop Bridge",
          summary: "Attached from app runtime stub.",
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

    const cycle = runDesktopShellAppRuntimeTimerTickStub({
      runtimeLabel: "Desktop Runtime Module",
      shellAppLabel: "OpenClaw Desktop",
      now: Date.now(),
      timerArmed: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.timerDecision).toEqual(
      expect.objectContaining({
        timerState: "armed",
        shouldArmTimer: true,
      }),
    );
    expect(cycle.nextTickAt).toBe("2026-04-17T00:01:00.000Z");
    expect(cycle.startupRuntimeSummary).toContain("runtime timer observed");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        timerState: "armed",
        nextTickAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical runtime runner for app runtime cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "App Runtime Desktop Bridge",
          summary: "Attached from app runtime stub.",
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

    const cycle = runDesktopShellAppRuntimeRunnerTickStub({
      runtimeLabel: "Desktop Runtime Module",
      shellAppLabel: "OpenClaw Desktop",
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
    expect(cycle.startupRuntimeSummary).toContain("runtime runner observed");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        runnerState: "armed",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical runtime host for app runtime cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "App Runtime Desktop Bridge",
          summary: "Attached from app runtime stub.",
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

    const cycle = runDesktopShellAppRuntimeHostWakeStub({
      runtimeLabel: "Desktop Runtime Module",
      shellAppLabel: "OpenClaw Desktop",
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
    expect(cycle.startupRuntimeSummary).toContain("runtime host observed");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        hostState: "armed",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical runtime service for app runtime cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "App Runtime Desktop Bridge",
          summary: "Attached from app runtime stub.",
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

    const cycle = runDesktopShellAppRuntimeServiceWakeStub({
      runtimeLabel: "Desktop Runtime Module",
      shellAppLabel: "OpenClaw Desktop",
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
    expect(cycle.startupRuntimeSummary).toContain("runtime service observed");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        serviceState: "acquired",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical runtime lifecycle for app runtime cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "App Runtime Desktop Bridge",
          summary: "Attached from app runtime stub.",
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

    const cycle = runDesktopShellAppRuntimeLifecycleWakeStub({
      runtimeLabel: "Desktop Runtime Module",
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
        lifecycleState: "active",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
    expect(cycle.startupRuntimeSummary).toContain("runtime lifecycle observed");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        lifecycleState: "active",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical runtime bootstrap for app runtime cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "App Runtime Desktop Bridge",
          summary: "Attached from app runtime stub.",
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

    const cycle = runDesktopShellAppRuntimeBootstrapWakeStub({
      runtimeLabel: "Desktop Runtime Module",
      shellAppLabel: "OpenClaw Desktop",
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
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
    expect(cycle.startupRuntimeSummary).toContain("runtime bootstrap observed");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        bootstrapState: "active",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical runtime app owner for app runtime cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "App Runtime Desktop Bridge",
          summary: "Attached from app runtime stub.",
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

    const cycle = runDesktopShellAppRuntimeAppOwnerWakeStub({
      runtimeLabel: "Desktop Runtime Module",
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
        appOwnerState: "active",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
    expect(cycle.startupRuntimeSummary).toContain("runtime app owner observed");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        appOwnerState: "active",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical runtime shell owner for app runtime cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "App Runtime Desktop Bridge",
          summary: "Attached from app runtime stub.",
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

    const cycle = runDesktopShellAppRuntimeShellOwnerWakeStub({
      runtimeLabel: "Desktop Runtime Module",
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
        shellOwnerState: "active",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
    expect(cycle.startupRuntimeSummary).toContain("runtime shell owner observed");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        shellOwnerState: "active",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical runtime process host for app runtime cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "App Runtime Desktop Bridge",
          summary: "Attached from app runtime stub.",
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

    const cycle = runDesktopShellAppRuntimeProcessHostWakeStub({
      runtimeLabel: "Desktop Runtime Module",
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
        processHostState: "foreground",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
    expect(cycle.startupRuntimeSummary).toContain("runtime process host observed");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        processHostState: "foreground",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical process-event adapter for app runtime cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "App Runtime Desktop Bridge",
          summary: "Attached from app runtime stub.",
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

    const cycle = dispatchDesktopShellAppRuntimeProcessEventStub({
      eventType: "foreground",
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

    expect(cycle.processHostState).toBe("foreground");
    expect(cycle.processEventType).toBe("foreground");
    expect(cycle.processEventSummary).toContain("reported desktop main-process foreground");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        processEventType: "foreground",
        processEventSource: "desktop_main_process_event_bridge",
        lastProcessEventAt: "2026-04-17T00:00:00.000Z",
      }),
    );
  });

  it("wraps the native process-event bridge for app runtime cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T00:00:00.000Z"));

    startDesktopShellAppRuntimeStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "App Runtime Desktop Bridge",
          summary: "Attached from app runtime stub.",
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

    const cycle = dispatchDesktopShellAppRuntimeNativeProcessEventStub({
      nativeEventType: "app_foregrounded",
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
      lastTickAt: Date.parse("2026-04-18T00:00:00.000Z"),
    });

    expect(cycle.processHostState).toBe("foreground");
    expect(cycle.processEventType).toBe("foreground");
    expect(cycle.nativeProcessEventType).toBe("app_foregrounded");
    expect(cycle.nativeProcessEventSummary).toContain("ingested native desktop app_foregrounded");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        nativeProcessEventType: "app_foregrounded",
        nativeProcessEventSource: "desktop_native_main_process_bridge",
        lastNativeProcessEventAt: "2026-04-18T00:00:00.000Z",
      }),
    );
  });
});
