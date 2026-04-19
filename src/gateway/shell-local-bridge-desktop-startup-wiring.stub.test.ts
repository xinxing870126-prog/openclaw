import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveAttachedDesktopLocalBridgeAdapter,
  resolveLocalBridgeStartupPosture,
  setLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";
import { wireDesktopShellLocalBridgeStartup } from "./shell-local-bridge-desktop-startup-wiring.stub.js";

afterEach(() => {
  setLocalBridgeStartupPosture(null);
  wireDesktopShellLocalBridgeStartup({
    env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "simulated" } as NodeJS.ProcessEnv,
  });
});

describe("shell local bridge desktop startup wiring stub", () => {
  it("returns a simulated startup summary by default", () => {
    const result = wireDesktopShellLocalBridgeStartup({
      env: {} as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
    });

    expect(result).toEqual({
      mode: "simulated",
      attached: false,
      adapterReadiness: "unavailable",
      healthStatus: "simulated",
      healthStatusLabel: "simulated bridge path",
      contractVersion: "v1",
      adapterLabel: null,
      providerKey: null,
      providerStatus: "no_provider",
      providerStatusLabel: "no desktop provider",
      shellAppLabel: "OpenClaw Desktop",
      startupModeLabel: "simulated bridge startup",
      startupSummary: "OpenClaw Desktop is starting with the simulated local bridge path.",
    });
    expect(resolveLocalBridgeStartupPosture()).toEqual({
      mode: "simulated",
      attached: false,
      adapterReadiness: "unavailable",
      healthSource: "startup_posture",
      healthStatus: "simulated",
      healthStatusLabel: "simulated bridge path",
      healthEventSummary: null,
      startupModeLabel: "simulated bridge startup",
      startupSummary: "OpenClaw Desktop is starting with the simulated local bridge path.",
      startupSource: "desktop_startup_wiring",
      providerStatus: "no_provider",
      providerStatusLabel: "no desktop provider",
      shellAppLabel: "OpenClaw Desktop",
      providerKey: null,
    });
  });

  it("returns a desktop unattached summary when no startup transport exists", () => {
    const result = wireDesktopShellLocalBridgeStartup({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
    });

    expect(result).toEqual({
      mode: "desktop",
      attached: false,
      adapterReadiness: "unavailable",
      healthStatus: "awaiting_attach",
      healthStatusLabel: "awaiting desktop attach",
      contractVersion: "v1",
      adapterLabel: null,
      providerKey: null,
      providerStatus: "no_provider",
      providerStatusLabel: "no desktop provider",
      shellAppLabel: "OpenClaw Desktop",
      startupModeLabel: "desktop bridge startup",
      startupSummary:
        "OpenClaw Desktop is in desktop bridge mode, but no desktop transport was attached during startup.",
    });
    expect(resolveAttachedDesktopLocalBridgeAdapter()).toBeNull();
    expect(resolveLocalBridgeStartupPosture()).toEqual({
      mode: "desktop",
      attached: false,
      adapterReadiness: "unavailable",
      healthSource: "startup_posture",
      healthStatus: "awaiting_attach",
      healthStatusLabel: "awaiting desktop attach",
      healthEventSummary: null,
      startupModeLabel: "desktop bridge startup",
      startupSummary:
        "OpenClaw Desktop is in desktop bridge mode, but no desktop transport was attached during startup.",
      startupSource: "desktop_startup_wiring",
      providerStatus: "no_provider",
      providerStatusLabel: "no desktop provider",
      shellAppLabel: "OpenClaw Desktop",
      providerKey: null,
    });
  });

  it("returns an attached desktop startup summary when startup transport is provided", () => {
    const transport = {
      listActions: vi.fn(() => []),
      listActionsForSession: vi.fn(() => []),
      listPendingActionsForSession: vi.fn(() => []),
      requestAction: vi.fn((input) => ({
        actionId: input.actionId,
        actionType: input.actionType,
        title: input.title,
        description: input.description,
        constraints: input.constraints,
        sessionKey: input.sessionKey,
        requestedAt: "2026-04-16T00:00:00.000Z",
        resolvedAt: null,
        expiresAt: null,
        lifecycle: "pending" as const,
        status: "pending" as const,
      })),
      resolveAction: vi.fn((actionId, result) => ({
        actionId,
        actionType: "pick_file" as const,
        title: "Choose desktop file",
        description: "Resolve through desktop startup wiring transport.",
        requestedAt: "2026-04-16T00:00:00.000Z",
        resolvedAt: "2026-04-16T00:01:00.000Z",
        expiresAt: null,
        lifecycle: result.approved ? ("completed" as const) : ("rejected" as const),
        status: result.approved ? ("completed" as const) : ("rejected" as const),
        result,
      })),
    };

    const result = wireDesktopShellLocalBridgeStartup({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      transport,
      readiness: "ready",
      label: "Startup Wiring Desktop Bridge",
    });

    expect(result).toEqual({
      mode: "desktop",
      attached: true,
      adapterReadiness: "ready",
      healthStatus: "healthy",
      healthStatusLabel: "desktop bridge ready",
      contractVersion: "v1",
      adapterLabel: "Startup Wiring Desktop Bridge",
      providerKey: null,
      providerStatus: "direct_transport",
      providerStatusLabel: "direct desktop transport",
      shellAppLabel: "OpenClaw Desktop",
      startupModeLabel: "desktop bridge startup",
      startupSummary:
        "OpenClaw Desktop attached Startup Wiring Desktop Bridge during startup using contract v1.",
    });
    expect(resolveAttachedDesktopLocalBridgeAdapter()?.getAdapter()).toEqual(
      expect.objectContaining({
        mode: "desktop",
        readiness: "ready",
        label: "Startup Wiring Desktop Bridge",
      }),
    );
    expect(resolveLocalBridgeStartupPosture()).toEqual({
      mode: "desktop",
      attached: true,
      adapterReadiness: "ready",
      healthSource: "startup_posture",
      healthStatus: "healthy",
      healthStatusLabel: "desktop bridge ready",
      healthEventSummary: null,
      startupModeLabel: "desktop bridge startup",
      startupSummary:
        "OpenClaw Desktop attached Startup Wiring Desktop Bridge during startup using contract v1.",
      startupSource: "desktop_startup_wiring",
      providerStatus: "direct_transport",
      providerStatusLabel: "direct desktop transport",
      shellAppLabel: "OpenClaw Desktop",
      providerKey: null,
    });
  });
});
