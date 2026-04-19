import { describe, expect, it } from "vitest";
import type { EventFrame } from "./protocol/index.js";
import type {
  ShellLocalActionExecutionResult,
  ShellLocalBridgeActionRequestedEvent,
  ShellLocalBridgeNativeProcessEventRequest,
  ShellLocalBridgeNativeProcessEventResponse,
  ShellLocalBridgeStatusResponse,
  ShellPendingLocalAction,
} from "./shell-app-contract.js";
import {
  DesktopWindowsCompanionHost,
  type DesktopWindowsCompanionGatewayTransport,
} from "../../apps/windows/src/DesktopWindowsCompanionHost.js";

class FakeDesktopWindowsCompanionGatewayTransport
  implements DesktopWindowsCompanionGatewayTransport
{
  private handlers = {
    onEvent: (_event: EventFrame) => {},
    onGap: (_info: { expected: number; received: number }) => {},
    onClose: (_code: number, _reason: string) => {},
  };

  readonly requests: Array<{ method: string; params?: Record<string, unknown> }> = [];
  statusPayload: ShellLocalBridgeStatusResponse = {
    generatedAt: "2026-04-18T00:00:00.000Z",
    status: "ready",
    adapter: {
      mode: "desktop",
      readiness: "ready",
      label: "Windows Desktop Bridge",
      summary: "Windows desktop bridge is attached and ready.",
      supports: ["request", "resolve", "lifecycle_tracking"],
    },
    contract: {
      version: "v1",
      requestFields: ["actionId", "actionType", "title", "description", "constraints"],
      resultFields: ["actionId", "approved", "payload", "error"],
      lifecycleFields: ["requestedAt", "resolvedAt", "lifecycle", "status"],
      statusFields: ["pendingCount", "completedCount", "actions"],
    },
    startupPosture: {
      startupSource: "desktop_startup_wiring",
      moduleStatus: "registered_attached",
      desktopHostPlatform: "windows",
      nativeProcessIngressSource: "windows_app_lifecycle",
      processHostState: "foreground",
    },
    pendingCount: 0,
    completedCount: 0,
    actions: [],
  };

  submitActionResultError: Error | null = null;

  setHandlers(
    handlers: Parameters<DesktopWindowsCompanionGatewayTransport["setHandlers"]>[0],
  ): void {
    this.handlers = handlers;
  }

  start(): void {}

  stopAndWait(): Promise<void> {
    return Promise.resolve();
  }

  async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    this.requests.push({ method, params });
    if (method === "localBridge.status") {
      return this.statusPayload as T;
    }
    if (method === "localBridge.nativeProcessEvent") {
      const payload = params as ShellLocalBridgeNativeProcessEventRequest;
      const response: ShellLocalBridgeNativeProcessEventResponse = {
        ok: true,
        nativeEventType: payload.nativeEventType,
        processHostState:
          payload.nativeEventType === "app_backgrounded" ? "background" : "foreground",
        nextWakeAt: null,
        processEventSummary: `${payload.nativeEventType} bridged`,
        nativeProcessEventSummary: `${payload.source} bridged ${payload.nativeEventType}`,
      };
      return response as T;
    }
    if (method === "localBridge.submitActionResult") {
      if (this.submitActionResultError) {
        throw this.submitActionResultError;
      }
      return {
        generatedAt: "2026-04-18T00:01:00.000Z",
      } as T;
    }
    throw new Error(`unexpected method ${method}`);
  }

  emitActionRequested(action: ShellPendingLocalAction): void {
    const payload: ShellLocalBridgeActionRequestedEvent = {
      generatedAt: "2026-04-18T00:00:00.000Z",
      transport: {
        adapterMode: "desktop",
        adapterReadiness: "ready",
        contractVersion: "v1",
      },
      action,
      nativeLocalActionTransportSource: "desktop_local_action_push",
      desktopHostPlatform: "windows",
      pendingNativeActionCount: 1,
      nativeLocalActionDeliverySummary: "windows host transport queued native local action",
    };
    this.handlers.onEvent({
      type: "event",
      event: "localBridge.action.requested",
      payload,
      seq: 1,
      stateversion: null,
    } as EventFrame);
  }

  emitSeqGap(): void {
    this.handlers.onGap({ expected: 3, received: 5 });
  }
}

function buildPendingAction(overrides: Partial<ShellPendingLocalAction> = {}): ShellPendingLocalAction {
  return {
    actionId: overrides.actionId ?? "windows-action-1",
    actionType: overrides.actionType ?? "pick_file",
    title: overrides.title ?? "Pick file",
    description: overrides.description ?? "Choose a windows file.",
    constraints: overrides.constraints,
    requestedAt: overrides.requestedAt ?? "2026-04-18T00:00:00.000Z",
    resolvedAt: overrides.resolvedAt ?? null,
    expiresAt: overrides.expiresAt ?? null,
    lifecycle: overrides.lifecycle ?? "requested",
    status: overrides.status ?? "pending",
    result: overrides.result,
    sessionKey: overrides.sessionKey,
  };
}

describe("DesktopWindowsCompanionHost", () => {
  it("bridges windows lifecycle ingress through the canonical nativeProcessEvent RPC", async () => {
    const transport = new FakeDesktopWindowsCompanionGatewayTransport();
    const host = new DesktopWindowsCompanionHost({
      transport,
      executor: async () => ({
        actionId: "unused",
        approved: true,
      }),
    });

    await host.start();
    await host.foreground();
    await host.background();
    await host.stop();

    expect(
      transport.requests
        .filter((entry) => entry.method === "localBridge.nativeProcessEvent")
        .map((entry) => (entry.params as ShellLocalBridgeNativeProcessEventRequest).nativeEventType),
    ).toEqual([
      "app_started",
      "app_foregrounded",
      "app_backgrounded",
      "app_stopped",
    ]);
  });

  it("reconciles pending actions and dedupes duplicate pushed action ids", async () => {
    const transport = new FakeDesktopWindowsCompanionGatewayTransport();
    transport.statusPayload = {
      ...transport.statusPayload,
      pendingCount: 1,
      actions: [
        buildPendingAction({
          actionId: "windows-action-reconcile-1",
          actionType: "open_file",
          constraints: {
            path: "C:/temp/generated.txt",
          },
        }),
      ],
    };
    const executorCalls: string[] = [];
    const executor = async (
      action: Pick<
        ShellPendingLocalAction,
        "actionId" | "actionType" | "title" | "description" | "constraints"
      >,
    ): Promise<ShellLocalActionExecutionResult> => {
      executorCalls.push(action.actionId);
      return {
        actionId: action.actionId,
        approved: true,
        payload: {
          path: "C:/temp/generated.txt",
          opened: true,
        },
      };
    };

    const host = new DesktopWindowsCompanionHost({ transport, executor });

    await host.start();
    await host.flush();

    transport.emitActionRequested(
      buildPendingAction({
        actionId: "windows-action-reconcile-1",
        actionType: "open_file",
        constraints: {
          path: "C:/temp/generated.txt",
        },
      }),
    );
    transport.emitActionRequested(
      buildPendingAction({
        actionId: "windows-action-reconcile-1",
        actionType: "open_file",
        constraints: {
          path: "C:/temp/generated.txt",
        },
      }),
    );
    await host.flush();
    await host.stop();

    expect(executorCalls).toEqual(["windows-action-reconcile-1"]);
    expect(
      transport.requests.filter((entry) => entry.method === "localBridge.submitActionResult"),
    ).toHaveLength(1);
  });

  it("keeps push plus reconcile handling best effort when submit fails and retries on the next reconcile", async () => {
    const transport = new FakeDesktopWindowsCompanionGatewayTransport();
    transport.statusPayload = {
      ...transport.statusPayload,
      pendingCount: 1,
      actions: [
        buildPendingAction({
          actionId: "windows-action-retry-1",
          actionType: "confirm_execution",
        }),
      ],
    };
    const executorCalls: string[] = [];
    const executor = async (
      action: Pick<
        ShellPendingLocalAction,
        "actionId" | "actionType" | "title" | "description" | "constraints"
      >,
    ): Promise<ShellLocalActionExecutionResult> => {
      executorCalls.push(action.actionId);
      return {
        actionId: action.actionId,
        approved: false,
        error: "user_rejected",
      };
    };
    const host = new DesktopWindowsCompanionHost({ transport, executor });

    transport.submitActionResultError = new Error("gateway unavailable");
    await host.start();
    await host.flush();

    transport.submitActionResultError = null;
    transport.emitSeqGap();
    await host.flush();
    await host.stop();

    expect(executorCalls).toEqual(["windows-action-retry-1", "windows-action-retry-1"]);
    expect(
      transport.requests.filter(
        (entry) =>
          entry.method === "localBridge.submitActionResult"
          && (entry.params?.actionId as string) === "windows-action-retry-1",
      ),
    ).toHaveLength(2);
  });
});
