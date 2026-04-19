import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAttachedDesktopLocalBridgeAdapter } from "./shell-local-bridge-provider-runtime.js";
import {
  clearDesktopLocalBridgeProviderFactories,
  registerDesktopLocalBridgeProviderFactory,
} from "./shell-local-bridge-desktop-provider-registry.js";
import { startDesktopLocalBridgeStartupStub } from "./shell-local-bridge-desktop-startup.stub.js";

afterEach(() => {
  clearDesktopLocalBridgeProviderFactories();
  startDesktopLocalBridgeStartupStub({ env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "simulated" } as NodeJS.ProcessEnv });
});

describe("shell local bridge desktop startup stub", () => {
  it("defaults to simulated mode when no desktop env is set", () => {
    const result = startDesktopLocalBridgeStartupStub({
      env: {} as NodeJS.ProcessEnv,
    });

    expect(result).toEqual({
      mode: "simulated",
      attached: false,
      adapterReadiness: "unavailable",
      contractVersion: "v1",
      adapterLabel: null,
      providerKey: null,
      providerStatus: "no_provider",
    });
  });

  it("keeps desktop mode unattached when startup transport is absent", () => {
    const result = startDesktopLocalBridgeStartupStub({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
    });

    expect(result).toEqual({
      mode: "desktop",
      attached: false,
      adapterReadiness: "unavailable",
      contractVersion: "v1",
      adapterLabel: null,
      providerKey: null,
      providerStatus: "no_provider",
    });
    expect(resolveAttachedDesktopLocalBridgeAdapter()).toBeNull();
  });

  it("attaches desktop transport when startup env selects desktop mode", () => {
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
        description: "Resolve through startup desktop transport.",
        requestedAt: "2026-04-16T00:00:00.000Z",
        resolvedAt: "2026-04-16T00:01:00.000Z",
        expiresAt: null,
        lifecycle: result.approved ? ("completed" as const) : ("rejected" as const),
        status: result.approved ? ("completed" as const) : ("rejected" as const),
        result,
      })),
    };

    const result = startDesktopLocalBridgeStartupStub({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      transport,
      readiness: "ready",
      label: "Startup Desktop Bridge",
    });

    expect(result).toEqual({
      mode: "desktop",
      attached: true,
      adapterReadiness: "ready",
      contractVersion: "v1",
      adapterLabel: "Startup Desktop Bridge",
      providerKey: null,
      providerStatus: "direct_transport",
    });
    expect(resolveAttachedDesktopLocalBridgeAdapter()?.getAdapter()).toEqual(
      expect.objectContaining({
        mode: "desktop",
        readiness: "ready",
        label: "Startup Desktop Bridge",
      }),
    );
  });

  it("attaches a registered desktop provider factory by provider key", () => {
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
        description: "Resolve through registered provider.",
        requestedAt: "2026-04-16T00:00:00.000Z",
        resolvedAt: "2026-04-16T00:01:00.000Z",
        expiresAt: null,
        lifecycle: result.approved ? ("completed" as const) : ("rejected" as const),
        status: result.approved ? ("completed" as const) : ("rejected" as const),
        result,
      })),
    };

    registerDesktopLocalBridgeProviderFactory("desktop-main", () => ({
      getDesktopAdapter: () => ({
        key: "desktop" as const,
        getAdapter: () => ({
          mode: "desktop" as const,
          readiness: "ready" as const,
          label: "Registry Desktop Bridge",
          summary: "Registry-backed desktop bridge.",
          supports: ["request", "resolve", "focus_policy", "lifecycle_tracking"] as const,
        }),
        getContract: () => ({
          version: "v1" as const,
          requestFields: ["actionId", "actionType", "title", "description", "constraints", "sessionKey", "requestedAt", "lifecycle"],
          resultFields: ["actionId", "approved", "payload", "error", "resolvedAt", "lifecycle"],
          visibleLifecycles: ["requested", "pending", "completed", "rejected"],
          reservedLifecycles: ["stale", "expired"],
        }),
        getTransport: () => ({
          adapterMode: "desktop" as const,
          adapterReadiness: "ready" as const,
          contractVersion: "v1" as const,
        }),
        listActions: transport.listActions,
        listActionsForSession: transport.listActionsForSession,
        listPendingActionsForSession: transport.listPendingActionsForSession,
        requestAction: transport.requestAction,
        resolveAction: transport.resolveAction,
      }),
    }));

    const result = startDesktopLocalBridgeStartupStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
        OPENCLAW_DESKTOP_LOCAL_BRIDGE_PROVIDER_KEY: "desktop-main",
      } as NodeJS.ProcessEnv,
    });

    expect(result).toEqual({
      mode: "desktop",
      attached: true,
      adapterReadiness: "ready",
      contractVersion: "v1",
      adapterLabel: "Registry Desktop Bridge",
      providerKey: "desktop-main",
      providerStatus: "registry_provider",
    });
    expect(resolveAttachedDesktopLocalBridgeAdapter()?.getAdapter()).toEqual(
      expect.objectContaining({
        label: "Registry Desktop Bridge",
      }),
    );
  });

  it("keeps desktop mode unattached when provider key exists but no factory is registered", () => {
    const result = startDesktopLocalBridgeStartupStub({
      env: {
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
        OPENCLAW_DESKTOP_LOCAL_BRIDGE_PROVIDER_KEY: "desktop-missing",
      } as NodeJS.ProcessEnv,
    });

    expect(result).toEqual({
      mode: "desktop",
      attached: false,
      adapterReadiness: "unavailable",
      contractVersion: "v1",
      adapterLabel: null,
      providerKey: "desktop-missing",
      providerStatus: "missing_provider",
    });
  });
});
