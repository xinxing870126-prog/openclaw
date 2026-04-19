import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-provider.stub.js";
import { clearDesktopLocalBridgeProviderFactories } from "./shell-local-bridge-desktop-provider-registry.js";
import {
  resolveLocalBridgeStartupPosture,
  setLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";
import { startDesktopShellRuntimeModule } from "./shell-local-bridge-desktop-runtime.module.js";
import { dispatchDesktopShellRuntimeProcessEvent } from "./shell-local-bridge-desktop-runtime.process-events.js";

describe("desktop shell runtime process events", () => {
  afterEach(() => {
    clearDesktopLocalBridgeProviderFactories();
    setLocalBridgeStartupPosture(null);
    vi.useRealTimers();
  });

  it("records foreground process events on top of canonical process-host cadence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Process Events",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Process Event Desktop Bridge",
          summary: "Attached from runtime process-event test.",
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

    const event = dispatchDesktopShellRuntimeProcessEvent({
      eventType: "foreground",
      runtimeLabel: "Desktop Runtime Process Events",
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

    expect(event.processHostState).toBe("foreground");
    expect(event.processEventType).toBe("foreground");
    expect(event.processEventSource).toBe("desktop_main_process_event_bridge");
    expect(event.lastProcessEventAt).toBe("2026-04-17T00:00:00.000Z");
    expect(event.processEventSummary).toContain("reported desktop main-process foreground");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        processEventType: "foreground",
        processEventSource: "desktop_main_process_event_bridge",
        lastProcessEventAt: "2026-04-17T00:00:00.000Z",
      }),
    );
  });

  it("keeps stale recovery semantics when foreground is dispatched after freshness goes stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Process Events",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Process Event Desktop Bridge",
          summary: "Attached from runtime process-event test.",
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
    const event = dispatchDesktopShellRuntimeProcessEvent({
      eventType: "foreground",
      runtimeLabel: "Desktop Runtime Process Events",
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

    expect(event.processHostState).toBe("starting");
    expect(event.processEventSummary).toContain("recover stale desktop cadence freshness");
  });

  it("records stop events while process-host transitions to stopped", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:03:00.000Z"));

    const event = dispatchDesktopShellRuntimeProcessEvent({
      eventType: "stop",
      shellAppLabel: "OpenClaw Desktop",
      now: Date.now(),
      processHostOwned: false,
    });

    expect(event.processHostState).toBe("stopped");
    expect(event.processEventType).toBe("stop");
    expect(event.lastProcessEventAt).toBe("2026-04-17T00:03:00.000Z");
  });
});
