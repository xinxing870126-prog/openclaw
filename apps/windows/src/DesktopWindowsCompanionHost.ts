import type { EventFrame } from "../../../src/gateway/protocol/index.js";
import {
  executeDesktopNativeLocalAction,
  startDesktopNativeLocalActionExecutor,
  stopDesktopNativeLocalActionExecutor,
} from "../../../src/gateway/shell-local-bridge-desktop-native-local-action-executor.windows.js";
import type {
  ShellLocalActionExecutionResult,
  ShellLocalBridgeActionRequestedEvent,
  ShellLocalBridgeNativeProcessEventRequest,
  ShellLocalBridgeNativeProcessEventResponse,
  ShellLocalBridgeStatusResponse,
  ShellPendingLocalAction,
} from "../../../src/gateway/shell-app-contract.js";
import { GatewayClient, type GatewayClientOptions } from "../../../src/gateway/client.js";

type DesktopWindowsCompanionHostLogLevel = "debug" | "error";

type DesktopWindowsCompanionHostLogHandler = (
  level: DesktopWindowsCompanionHostLogLevel,
  message: string,
  error?: unknown,
) => void;

type DesktopWindowsCompanionHostExecutor = (
  action: Pick<
    ShellPendingLocalAction,
    "actionId" | "actionType" | "title" | "description" | "constraints"
  >,
) => Promise<ShellLocalActionExecutionResult>;

type DesktopWindowsCompanionGatewayHandlers = {
  onEvent: (event: EventFrame) => void;
  onGap: (info: { expected: number; received: number }) => void;
  onClose: (code: number, reason: string) => void;
};

export interface DesktopWindowsCompanionGatewayTransport {
  setHandlers(handlers: DesktopWindowsCompanionGatewayHandlers): void;
  start(): void | Promise<void>;
  stopAndWait(): Promise<void>;
  request<T>(method: string, params?: Record<string, unknown>): Promise<T>;
}

export class GatewayClientDesktopWindowsCompanionTransport
  implements DesktopWindowsCompanionGatewayTransport
{
  private readonly client: GatewayClient;
  private handlers: DesktopWindowsCompanionGatewayHandlers = {
    onEvent: () => {},
    onGap: () => {},
    onClose: () => {},
  };

  constructor(options: GatewayClientOptions = {}) {
    this.client = new GatewayClient({
      ...options,
      platform: options.platform ?? "windows",
      onEvent: (event) => {
        this.handlers.onEvent(event);
      },
      onGap: (info) => {
        this.handlers.onGap(info);
      },
      onClose: (code, reason) => {
        this.handlers.onClose(code, reason);
      },
    });
  }

  setHandlers(handlers: DesktopWindowsCompanionGatewayHandlers): void {
    this.handlers = handlers;
  }

  start(): void {
    this.client.start();
  }

  stopAndWait(): Promise<void> {
    return this.client.stopAndWait();
  }

  request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    return this.client.request<T>(method, params);
  }
}

export type DesktopWindowsCompanionHostOptions = {
  shellAppLabel?: string | null;
  transport?: DesktopWindowsCompanionGatewayTransport;
  gatewayClientOptions?: GatewayClientOptions;
  executor?: DesktopWindowsCompanionHostExecutor;
  onActionRequired?: (params: {
    actionId: string;
    sessionKey?: string | null;
    title: string;
    description: string;
    source: string;
  }) => void;
  onActionResolved?: (params: {
    actionId: string;
    sessionKey?: string | null;
    title: string;
    description: string;
    source: string;
    outcome: "completed" | "rejected";
  }) => void;
  now?: () => string;
  log?: DesktopWindowsCompanionHostLogHandler;
};

type DesktopWindowsCompanionNativeEventType =
  | "app_started"
  | "app_foregrounded"
  | "app_backgrounded"
  | "app_stopped";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPendingAction(action: Pick<ShellPendingLocalAction, "lifecycle" | "status">): boolean {
  return action.status === "pending" || action.lifecycle === "pending" || action.lifecycle === "requested";
}

function readActionRequestedEvent(payload: unknown): ShellLocalBridgeActionRequestedEvent | null {
  if (!isRecord(payload) || !isRecord(payload.action)) {
    return null;
  }
  const { action } = payload;
  if (
    typeof action.actionId !== "string"
    || typeof action.actionType !== "string"
    || typeof action.title !== "string"
    || typeof action.description !== "string"
  ) {
    return null;
  }
  return payload as ShellLocalBridgeActionRequestedEvent;
}

export class DesktopWindowsCompanionHost {
  private readonly shellAppLabel: string;
  private readonly transport: DesktopWindowsCompanionGatewayTransport;
  private readonly executor: DesktopWindowsCompanionHostExecutor;
  private readonly onActionRequired?: DesktopWindowsCompanionHostOptions["onActionRequired"];
  private readonly onActionResolved?: DesktopWindowsCompanionHostOptions["onActionResolved"];
  private readonly now: () => string;
  private readonly log: DesktopWindowsCompanionHostLogHandler;
  private started = false;
  private foregrounded = false;
  private workQueue: Promise<void> = Promise.resolve();
  private readonly inFlightActionIds = new Set<string>();
  private readonly completedActionIds = new Set<string>();
  private readonly completedActionOrder: string[] = [];

  constructor(options: DesktopWindowsCompanionHostOptions = {}) {
    this.shellAppLabel = options.shellAppLabel?.trim() || "OpenClaw Windows Companion";
    this.transport =
      options.transport ?? new GatewayClientDesktopWindowsCompanionTransport(options.gatewayClientOptions);
    this.executor = options.executor ?? executeDesktopNativeLocalAction;
    this.onActionRequired = options.onActionRequired;
    this.onActionResolved = options.onActionResolved;
    this.now = options.now ?? (() => new Date().toISOString());
    this.log =
      options.log
      ?? ((level, message, error) => {
        const prefix = `[DesktopWindowsCompanionHost:${level}]`;
        if (level === "error") {
          console.error(prefix, message, error ?? "");
          return;
        }
        console.debug(prefix, message, error ?? "");
      });
    this.transport.setHandlers({
      onEvent: (event) => {
        this.handleEvent(event);
      },
      onGap: () => {
        this.scheduleReconcile("seq-gap");
      },
      onClose: (_code, _reason) => {},
    });
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    startDesktopNativeLocalActionExecutor();
    await Promise.resolve(this.transport.start());
    await this.sendNativeProcessEvent("app_started");
    this.scheduleReconcile("startup");
  }

  async foreground(): Promise<void> {
    if (!this.started || this.foregrounded) {
      return;
    }
    this.foregrounded = true;
    await this.sendNativeProcessEvent("app_foregrounded");
  }

  async background(): Promise<void> {
    if (!this.started || !this.foregrounded) {
      return;
    }
    this.foregrounded = false;
    await this.sendNativeProcessEvent("app_backgrounded");
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.foregrounded = false;
    try {
      await this.sendNativeProcessEvent("app_stopped");
      await this.transport.stopAndWait();
    } finally {
      stopDesktopNativeLocalActionExecutor();
      this.inFlightActionIds.clear();
      this.completedActionIds.clear();
      this.completedActionOrder.length = 0;
    }
  }

  async flush(): Promise<void> {
    await this.workQueue;
  }

  private handleEvent(event: EventFrame): void {
    if (!this.started || event.event !== "localBridge.action.requested") {
      return;
    }
    const payload = readActionRequestedEvent(event.payload);
    if (!payload) {
      this.log("error", "failed to decode windows desktop local-action push payload");
      this.scheduleReconcile("decode-fallback");
      return;
    }
    this.enqueueAction(payload.action, payload.nativeLocalActionTransportSource);
  }

  private scheduleReconcile(reason: string): void {
    this.enqueueWork(async () => {
      await this.reconcile(reason);
    });
  }

  private enqueueAction(action: ShellPendingLocalAction, source: string): void {
    this.enqueueWork(async () => {
      await this.process(action, source);
    });
  }

  private enqueueWork(operation: () => Promise<void>): void {
    this.workQueue = this.workQueue.then(async () => {
      if (!this.started) {
        return;
      }
      await operation();
    });
  }

  private async reconcile(reason: string): Promise<void> {
    if (!this.started) {
      return;
    }
    try {
      const status = await this.transport.request<ShellLocalBridgeStatusResponse>("localBridge.status");
      const pending = status.actions
        .filter((action) => isPendingAction(action))
        .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt));
      this.log("debug", `windows companion reconcile reason=${reason} pending=${pending.length}`);
      for (const action of pending) {
        await this.process(action, "desktop_local_action_status_reconcile");
      }
    } catch (error) {
      this.log("error", `windows companion reconcile failed reason=${reason}`, error);
    }
  }

  private async process(action: ShellPendingLocalAction, source: string): Promise<void> {
    if (!this.started || !isPendingAction(action)) {
      return;
    }
    if (this.inFlightActionIds.has(action.actionId) || this.completedActionIds.has(action.actionId)) {
      return;
    }
    this.inFlightActionIds.add(action.actionId);
    this.onActionRequired?.({
      actionId: action.actionId,
      sessionKey: action.sessionKey ?? null,
      title: action.title,
      description: action.description,
      source,
    });
    try {
      const result = await this.executor(action);
      await this.transport.request("localBridge.submitActionResult", {
        actionId: action.actionId,
        approved: result.approved,
        payload: result.payload,
        error: result.error,
      });
      this.onActionResolved?.({
        actionId: action.actionId,
        sessionKey: action.sessionKey ?? null,
        title: action.title,
        description: action.description,
        source,
        outcome: result.approved === false ? "rejected" : "completed",
      });
      this.markCompleted(action.actionId);
      this.log(
        "debug",
        `windows companion resolved actionId=${action.actionId} source=${source} approved=${String(result.approved)}`,
      );
    } catch (error) {
      this.log("error", `windows companion failed to resolve actionId=${action.actionId}`, error);
    } finally {
      this.inFlightActionIds.delete(action.actionId);
    }
  }

  private markCompleted(actionId: string): void {
    if (this.completedActionIds.has(actionId)) {
      return;
    }
    this.completedActionIds.add(actionId);
    this.completedActionOrder.push(actionId);
    while (this.completedActionOrder.length > 256) {
      const oldest = this.completedActionOrder.shift();
      if (oldest) {
        this.completedActionIds.delete(oldest);
      }
    }
  }

  private async sendNativeProcessEvent(
    nativeEventType: DesktopWindowsCompanionNativeEventType,
  ): Promise<ShellLocalBridgeNativeProcessEventResponse | undefined> {
    const params: ShellLocalBridgeNativeProcessEventRequest = {
      nativeEventType,
      source: "windows_app_lifecycle",
      hostPlatform: "windows",
      occurredAt: this.now(),
      shellAppLabel: this.shellAppLabel,
    };
    try {
      return await this.transport.request<ShellLocalBridgeNativeProcessEventResponse>(
        "localBridge.nativeProcessEvent",
        params,
      );
    } catch (error) {
      this.log("error", `windows companion failed to send ${nativeEventType}`, error);
      return undefined;
    }
  }
}

let desktopWindowsCompanionHostSingleton: DesktopWindowsCompanionHost | null = null;

export async function startDesktopWindowsCompanionHost(
  options: DesktopWindowsCompanionHostOptions = {},
): Promise<DesktopWindowsCompanionHost> {
  if (!desktopWindowsCompanionHostSingleton) {
    desktopWindowsCompanionHostSingleton = new DesktopWindowsCompanionHost(options);
  }
  await desktopWindowsCompanionHostSingleton.start();
  return desktopWindowsCompanionHostSingleton;
}

export async function stopDesktopWindowsCompanionHost(): Promise<void> {
  if (!desktopWindowsCompanionHostSingleton) {
    return;
  }
  const host = desktopWindowsCompanionHostSingleton;
  desktopWindowsCompanionHostSingleton = null;
  await host.stop();
}
