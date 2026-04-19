import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-bootstrap.js";
import { resolveAttachedDesktopLocalBridgeAdapter } from "./shell-local-bridge-provider-runtime.js";

afterEach(() => {
  bootstrapDesktopLocalBridgeProvider({ mode: "simulated" });
});

describe("shell local bridge desktop bootstrap", () => {
  it("clears any attached provider in simulated mode", () => {
    const result = bootstrapDesktopLocalBridgeProvider({ mode: "simulated" });

    expect(result).toEqual({
      mode: "simulated",
      attached: false,
      contractVersion: "v1",
      adapterLabel: null,
    });
    expect(resolveAttachedDesktopLocalBridgeAdapter()).toBeNull();
  });

  it("leaves desktop mode unattached when no transport is provided", () => {
    const result = bootstrapDesktopLocalBridgeProvider({ mode: "desktop" });

    expect(result).toEqual({
      mode: "desktop",
      attached: false,
      contractVersion: "v1",
      adapterLabel: null,
    });
    expect(resolveAttachedDesktopLocalBridgeAdapter()).toBeNull();
  });

  it("attaches a desktop provider when a transport is supplied", () => {
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
        description: "Resolve through desktop bootstrap transport.",
        requestedAt: "2026-04-16T00:00:00.000Z",
        resolvedAt: "2026-04-16T00:01:00.000Z",
        expiresAt: null,
        lifecycle: result.approved ? ("completed" as const) : ("rejected" as const),
        status: result.approved ? ("completed" as const) : ("rejected" as const),
        result,
      })),
    };

    const result = bootstrapDesktopLocalBridgeProvider({
      mode: "desktop",
      transport,
      readiness: "ready",
      label: "Bootstrap Desktop Bridge",
    });

    expect(result).toEqual({
      mode: "desktop",
      attached: true,
      contractVersion: "v1",
      adapterLabel: "Bootstrap Desktop Bridge",
    });
    expect(resolveAttachedDesktopLocalBridgeAdapter()?.getAdapter()).toEqual(
      expect.objectContaining({
        mode: "desktop",
        readiness: "ready",
        label: "Bootstrap Desktop Bridge",
      }),
    );
  });
});
