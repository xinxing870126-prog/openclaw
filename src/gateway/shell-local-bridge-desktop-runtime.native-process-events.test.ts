import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-provider.stub.js";
import { clearDesktopLocalBridgeProviderFactories } from "./shell-local-bridge-desktop-provider-registry.js";
import {
  resolveLocalBridgeStartupPosture,
  setLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";
import { startDesktopShellRuntimeModule } from "./shell-local-bridge-desktop-runtime.module.js";
import { dispatchDesktopShellRuntimeNativeProcessEvent } from "./shell-local-bridge-desktop-runtime.native-process-events.js";

describe("desktop shell runtime native process events", () => {
  afterEach(() => {
    clearDesktopLocalBridgeProviderFactories();
    setLocalBridgeStartupPosture(null);
    vi.useRealTimers();
  });

  it("normalizes native foreground events into canonical process events", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Native Process Events",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Native Process Event Desktop Bridge",
          summary: "Attached from runtime native process-event test.",
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

    const event = dispatchDesktopShellRuntimeNativeProcessEvent({
      nativeEventType: "app_foregrounded",
      runtimeLabel: "Desktop Runtime Native Process Events",
      shellAppLabel: "OpenClaw Desktop",
      hostPlatform: "macos",
      nativeEventIngressSource: "macos_app_lifecycle",
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

    expect(event.processHostState).toBe("foreground");
    expect(event.processEventType).toBe("foreground");
    expect(event.nativeProcessEventType).toBe("app_foregrounded");
    expect(event.nativeProcessEventSource).toBe("desktop_native_main_process_bridge");
    expect(event.desktopHostPlatform).toBe("macos");
    expect(event.nativeProcessIngressSource).toBe("macos_app_lifecycle");
    expect(event.lastNativeProcessEventAt).toBe("2026-04-18T00:00:00.000Z");
    expect(event.nativeProcessEventSummary).toContain("from macos_app_lifecycle on macos");
    expect(resolveLocalBridgeStartupPosture()).toEqual(
      expect.objectContaining({
        processEventType: "foreground",
        nativeProcessEventType: "app_foregrounded",
        nativeProcessEventSource: "desktop_native_main_process_bridge",
        desktopHostPlatform: "macos",
        nativeProcessIngressSource: "macos_app_lifecycle",
        lastNativeProcessEventAt: "2026-04-18T00:00:00.000Z",
      }),
    );
  });

  it("preserves stale freshness recovery semantics when native foreground arrives late", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T00:00:00.000Z"));

    startDesktopShellRuntimeModule({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Native Process Events",
      providerKey: "desktop-main",
      providerFactory: () =>
        createDesktopLocalBridgeProvider({
          label: "Runtime Native Process Event Desktop Bridge",
          summary: "Attached from runtime native process-event test.",
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

    vi.setSystemTime(new Date("2026-04-18T00:06:30.000Z"));
    const event = dispatchDesktopShellRuntimeNativeProcessEvent({
      nativeEventType: "app_foregrounded",
      runtimeLabel: "Desktop Runtime Native Process Events",
      shellAppLabel: "OpenClaw Desktop",
      hostPlatform: "macos",
      nativeEventIngressSource: "macos_app_lifecycle",
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

    expect(event.processHostState).toBe("starting");
    expect(event.processEventSummary).toContain("recover stale desktop cadence freshness");
    expect(event.nativeProcessEventSummary).toContain("from macos_app_lifecycle on macos");
  });

  it("records native stop metadata while canonical process-host stops", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T00:03:00.000Z"));

    const event = dispatchDesktopShellRuntimeNativeProcessEvent({
      nativeEventType: "app_stopped",
      shellAppLabel: "OpenClaw Desktop",
      hostPlatform: "windows",
      nativeEventIngressSource: "windows_app_lifecycle",
      now: Date.now(),
      processHostOwned: false,
    });

    expect(event.processHostState).toBe("stopped");
    expect(event.processEventType).toBe("stop");
    expect(event.nativeProcessEventType).toBe("app_stopped");
    expect(event.desktopHostPlatform).toBe("windows");
    expect(event.nativeProcessIngressSource).toBe("windows_app_lifecycle");
    expect(event.lastNativeProcessEventAt).toBe("2026-04-18T00:03:00.000Z");
    expect(event.nativeProcessEventSummary).toContain("from windows_app_lifecycle on windows");
  });
});
