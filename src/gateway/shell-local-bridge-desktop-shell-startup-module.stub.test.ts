import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-provider.stub.js";
import { clearDesktopLocalBridgeProviderFactories } from "./shell-local-bridge-desktop-provider-registry.js";
import { resolveLocalBridgeStartupPosture, setLocalBridgeStartupPosture } from "./shell-local-bridge-provider-runtime.js";
import {
  reportDesktopShellStartupModuleHealth,
  runDesktopShellStartupModuleAppOwnerWake,
  dispatchDesktopShellStartupModuleNativeProcessEvent,
  dispatchDesktopShellStartupModuleProcessEvent,
  runDesktopShellStartupModuleProcessHostWake,
  runDesktopShellStartupModuleShellOwnerWake,
  runDesktopShellStartupModuleBootstrapWake,
  runDesktopShellStartupModuleDriverCycle,
  runDesktopShellStartupModuleHeartbeatCycle,
  runDesktopShellStartupModuleHostWake,
  runDesktopShellStartupModuleLifecycleWake,
  runDesktopShellStartupModuleServiceWake,
  runDesktopShellStartupModuleRunnerTick,
  runDesktopShellStartupModuleSchedulerCycle,
  runDesktopShellStartupModuleTimerTick,
  startDesktopShellStartupModuleStub,
} from "./shell-local-bridge-desktop-shell-startup-module.stub.js";

describe("desktop shell startup module stub", () => {
  afterEach(() => {
    clearDesktopLocalBridgeProviderFactories();
    setLocalBridgeStartupPosture(null);
  });

  it("wraps app runtime startup with module-level summary", () => {
    const result = startDesktopShellStartupModuleStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Module Desktop Bridge",
          summary: "Attached from startup module stub.",
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
      shellAppLabel: "OpenClaw Desktop",
      moduleLabel: "Desktop Shell Startup Module",
      providerRegistered: true,
      providerKey: "desktop-main",
      providerStatus: "registry_provider",
      providerStatusLabel: "registered desktop provider",
      mode: "desktop",
      attached: true,
      moduleStatus: "registered_attached",
      moduleStatusLabel: "module registered / attached",
    });
    expect(result.moduleSummary).toContain("Desktop Shell Startup Module registered provider desktop-main");
    expect(result.moduleSummary).toContain("OpenClaw Desktop");
    expect(resolveLocalBridgeStartupPosture()).toMatchObject({
      shellAppLabel: "OpenClaw Desktop",
      moduleLabel: "Desktop Shell Startup Module",
      moduleSummary: result.moduleSummary,
      healthSource: "startup_posture",
      healthEventSummary: null,
      providerStatus: "registry_provider",
      providerStatusLabel: "registered desktop provider",
      moduleStatus: "registered_attached",
      moduleStatusLabel: "module registered / attached",
      providerKey: "desktop-main",
    });
  });

  it("uses custom module and shell labels when provided", () => {
    const result = startDesktopShellStartupModuleStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "simulated",
      } as NodeJS.ProcessEnv,
      moduleLabel: "Native Shell Bootstrap",
      shellAppLabel: "Native OpenClaw Desktop",
    });

    expect(result.moduleLabel).toBe("Native Shell Bootstrap");
    expect(result.shellAppLabel).toBe("Native OpenClaw Desktop");
    expect(result.providerStatus).toBe("no_provider");
    expect(result.providerStatusLabel).toBe("no desktop provider");
    expect(result.moduleStatus).toBe("reused_pending_attach");
    expect(result.moduleStatusLabel).toBe("module reused / pending attach");
    expect(result.moduleSummary).toContain("Native Shell Bootstrap");
    expect(result.moduleSummary).toContain("Native OpenClaw Desktop");
  });

  it("updates startup posture health after module startup", () => {
    startDesktopShellStartupModuleStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Module Desktop Bridge",
          summary: "Attached from startup module stub.",
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

    reportDesktopShellStartupModuleHealth({
      adapterReadiness: "unavailable",
    });

    expect(resolveLocalBridgeStartupPosture()).toMatchObject({
      attached: true,
      adapterReadiness: "unavailable",
      healthSource: "runtime_heartbeat",
      healthStatus: "unavailable",
      healthStatusLabel: "desktop bridge unavailable",
      healthEventSummary:
        "Desktop Shell Startup Module reported desktop bridge unavailable through runtime health heartbeat.",
      moduleLabel: "Desktop Shell Startup Module",
      providerKey: "desktop-main",
    });
  });

  it("runs a unified startup-module heartbeat cycle with module context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellStartupModuleStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Module Desktop Bridge",
          summary: "Attached from startup module stub.",
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
    const cycle = runDesktopShellStartupModuleHeartbeatCycle({
      adapterReadiness: "degraded",
      now: Date.now(),
    });

    expect(cycle.moduleLabel).toBe("Desktop Shell Startup Module");
    expect(cycle.moduleStatus).toBe("registered_attached");
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
  });

  it("wraps the canonical scheduler with module context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellStartupModuleStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Module Desktop Bridge",
          summary: "Attached from startup module stub.",
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

    const cycle = runDesktopShellStartupModuleSchedulerCycle({
      runtimeLabel: "Desktop Runtime Module",
      now: Date.now(),
    });

    expect(cycle.moduleLabel).toBe("Desktop Shell Startup Module");
    expect(cycle.schedulerDecision).toEqual(
      expect.objectContaining({
        runnerMode: "healthy_cadence",
        recommendedDelayMs: 60_000,
      }),
    );
    expect(cycle.nextRunAt).toBe("2026-04-17T00:01:00.000Z");
  });

  it("wraps the canonical driver with module context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellStartupModuleStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Module Desktop Bridge",
          summary: "Attached from startup module stub.",
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

    const cycle = runDesktopShellStartupModuleDriverCycle({
      runtimeLabel: "Desktop Runtime Module",
      now: Date.now(),
    });

    expect(cycle.moduleLabel).toBe("Desktop Shell Startup Module");
    expect(cycle.driverDecision).toEqual(
      expect.objectContaining({
        driverState: "scheduled",
        recommendedDelayMs: 60_000,
      }),
    );
    expect(cycle.nextRunAt).toBe("2026-04-17T00:01:00.000Z");
  });

  it("wraps the canonical timer with module context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellStartupModuleStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Module Desktop Bridge",
          summary: "Attached from startup module stub.",
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

    const cycle = runDesktopShellStartupModuleTimerTick({
      runtimeLabel: "Desktop Runtime Module",
      now: Date.now(),
      timerArmed: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.moduleLabel).toBe("Desktop Shell Startup Module");
    expect(cycle.timerDecision).toEqual(
      expect.objectContaining({
        timerState: "armed",
        shouldArmTimer: true,
      }),
    );
    expect(cycle.nextTickAt).toBe("2026-04-17T00:01:00.000Z");
  });

  it("wraps the canonical runner with module context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellStartupModuleStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Module Desktop Bridge",
          summary: "Attached from startup module stub.",
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

    const cycle = runDesktopShellStartupModuleRunnerTick({
      runtimeLabel: "Desktop Runtime Module",
      now: Date.now(),
      runnerStarted: true,
      timerArmed: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.moduleLabel).toBe("Desktop Shell Startup Module");
    expect(cycle.runnerDecision).toEqual(
      expect.objectContaining({
        runnerState: "armed",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical host with module context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellStartupModuleStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Module Desktop Bridge",
          summary: "Attached from startup module stub.",
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

    const cycle = runDesktopShellStartupModuleHostWake({
      runtimeLabel: "Desktop Runtime Module",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.moduleLabel).toBe("Desktop Shell Startup Module");
    expect(cycle.hostDecision).toEqual(
      expect.objectContaining({
        hostState: "armed",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical service with module context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellStartupModuleStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Module Desktop Bridge",
          summary: "Attached from startup module stub.",
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

    const cycle = runDesktopShellStartupModuleServiceWake({
      runtimeLabel: "Desktop Runtime Module",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      serviceOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.moduleLabel).toBe("Desktop Shell Startup Module");
    expect(cycle.serviceDecision).toEqual(
      expect.objectContaining({
        serviceState: "acquired",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical lifecycle with module context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellStartupModuleStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Module Desktop Bridge",
          summary: "Attached from startup module stub.",
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

    const cycle = runDesktopShellStartupModuleLifecycleWake({
      runtimeLabel: "Desktop Runtime Module",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      serviceOwned: true,
      lifecycleOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.moduleLabel).toBe("Desktop Shell Startup Module");
    expect(cycle.lifecycleDecision).toEqual(
      expect.objectContaining({
        lifecycleState: "active",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical bootstrap with module context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellStartupModuleStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Module Desktop Bridge",
          summary: "Attached from startup module stub.",
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

    const cycle = runDesktopShellStartupModuleBootstrapWake({
      runtimeLabel: "Desktop Runtime Module",
      now: Date.now(),
      hostStarted: true,
      runnerStarted: true,
      timerArmed: true,
      serviceOwned: true,
      lifecycleOwned: true,
      bootstrapOwned: true,
      lastTickAt: Date.parse("2026-04-17T00:00:00.000Z"),
    });

    expect(cycle.moduleLabel).toBe("Desktop Shell Startup Module");
    expect(cycle.bootstrapDecision).toEqual(
      expect.objectContaining({
        bootstrapState: "active",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical app owner with module context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellStartupModuleStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Module Desktop Bridge",
          summary: "Attached from startup module stub.",
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

    const cycle = runDesktopShellStartupModuleAppOwnerWake({
      runtimeLabel: "Desktop Runtime Module",
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

    expect(cycle.moduleLabel).toBe("Desktop Shell Startup Module");
    expect(cycle.appOwnerDecision).toEqual(
      expect.objectContaining({
        appOwnerState: "active",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical shell owner with module context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellStartupModuleStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Module Desktop Bridge",
          summary: "Attached from startup module stub.",
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

    const cycle = runDesktopShellStartupModuleShellOwnerWake({
      runtimeLabel: "Desktop Runtime Module",
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

    expect(cycle.moduleLabel).toBe("Desktop Shell Startup Module");
    expect(cycle.shellOwnerDecision).toEqual(
      expect.objectContaining({
        shellOwnerState: "active",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical process host with module context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellStartupModuleStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
      } as NodeJS.ProcessEnv,
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Module Desktop Bridge",
          summary: "Attached from startup module stub.",
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

    const cycle = runDesktopShellStartupModuleProcessHostWake({
      runtimeLabel: "Desktop Runtime Module",
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

    expect(cycle.moduleLabel).toBe("Desktop Shell Startup Module");
    expect(cycle.processHostDecision).toEqual(
      expect.objectContaining({
        processHostState: "foreground",
        nextWakeAt: "2026-04-17T00:01:00.000Z",
      }),
    );
  });

  it("wraps the canonical process-event adapter with module context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellStartupModuleStub({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Module Desktop Bridge",
          summary: "Attached from startup module stub.",
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

    const cycle = dispatchDesktopShellStartupModuleProcessEvent({
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

    expect(cycle.moduleLabel).toBe("Desktop Shell Startup Module");
    expect(cycle.processEventType).toBe("foreground");
    expect(cycle.processEventSummary).toContain("reported desktop main-process foreground");
  });

  it("wraps the native process-event bridge with module context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T00:00:00.000Z"));

    startDesktopShellStartupModuleStub({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Startup Module Desktop Bridge",
          summary: "Attached from startup module stub.",
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

    const cycle = dispatchDesktopShellStartupModuleNativeProcessEvent({
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

    expect(cycle.moduleLabel).toBe("Desktop Shell Startup Module");
    expect(cycle.nativeProcessEventType).toBe("app_foregrounded");
    expect(cycle.nativeProcessEventSummary).toContain("ingested native desktop app_foregrounded");
  });
});
