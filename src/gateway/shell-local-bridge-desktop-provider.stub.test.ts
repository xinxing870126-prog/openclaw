import { describe, expect, it, vi } from "vitest";
import { createDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-provider.stub.js";

describe("shell local bridge desktop provider stub", () => {
  it("builds a desktop provider from a transport implementation", () => {
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
        description: "Resolve through desktop bridge.",
        requestedAt: "2026-04-16T00:00:00.000Z",
        resolvedAt: "2026-04-16T00:01:00.000Z",
        expiresAt: null,
        lifecycle: result.approved ? ("completed" as const) : ("rejected" as const),
        status: result.approved ? ("completed" as const) : ("rejected" as const),
        result,
      })),
    };

    const provider = createDesktopLocalBridgeProvider({
      contract: {
        version: "v1",
        requestFields: ["actionId", "actionType", "title", "description", "constraints", "sessionKey", "requestedAt", "lifecycle"],
        resultFields: ["actionId", "approved", "payload", "error", "resolvedAt", "lifecycle"],
        visibleLifecycles: ["requested", "pending", "completed", "rejected"],
        reservedLifecycles: ["stale", "expired"],
      },
      transport,
      readiness: "ready",
      label: "Desktop Provider Stub",
    });

    const adapter = provider.getDesktopAdapter?.();

    expect(adapter?.getAdapter()).toEqual(
      expect.objectContaining({
        mode: "desktop",
        readiness: "ready",
        label: "Desktop Provider Stub",
      }),
    );
    expect(adapter?.getTransport()).toEqual({
      adapterMode: "desktop",
      adapterReadiness: "ready",
      contractVersion: "v1",
    });

    adapter?.requestAction({
      actionId: "desktop-action-3",
      actionType: "pick_file",
      title: "Choose desktop file",
      description: "Pick the file through desktop provider stub.",
    });

    expect(transport.requestAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: "desktop-action-3",
      }),
    );
  });
});
