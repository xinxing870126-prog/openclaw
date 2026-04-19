import type {
  ShellLocalActionRequestResponse,
  ShellLocalActionResult,
  ShellLocalBridgeStatusResponse,
  ShellPendingLocalAction,
} from "./shell-app-contract.js";

export const DEFAULT_LOCAL_BRIDGE_CONTRACT = {
  version: "v1",
  requestFields: ["actionId", "actionType", "title", "description", "constraints", "sessionKey", "requestedAt", "lifecycle"],
  resultFields: ["actionId", "approved", "payload", "error", "resolvedAt", "lifecycle"],
  visibleLifecycles: ["requested", "pending", "completed", "rejected"],
  reservedLifecycles: ["stale", "expired"],
} as const;

export type LocalBridgeRequestInput = {
  actionId: string;
  actionType: ShellPendingLocalAction["actionType"];
  title: string;
  description: string;
  constraints?: Record<string, unknown>;
  sessionKey?: string;
};

export type LocalBridgeAdapter = {
  key: "simulated" | "desktop";
  getAdapter(): ShellLocalBridgeStatusResponse["adapter"];
  getContract(): ShellLocalBridgeStatusResponse["contract"];
  getTransport(): ShellLocalActionRequestResponse["transport"];
  listActions(): ShellPendingLocalAction[];
  listActionsForSession(sessionKey: string): ShellPendingLocalAction[];
  listPendingActionsForSession(sessionKey: string): ShellPendingLocalAction[];
  requestAction(input: LocalBridgeRequestInput): ShellPendingLocalAction;
  resolveAction(actionId: string, result: ShellLocalActionResult): ShellPendingLocalAction;
};

export type LocalBridgeAdapterProvider = {
  getDesktopAdapter?: () => LocalBridgeAdapter | null;
};

export function createDesktopBridgeStubAdapter(
  contract: ShellLocalBridgeStatusResponse["contract"] = DEFAULT_LOCAL_BRIDGE_CONTRACT,
): LocalBridgeAdapter {
  return {
    key: "desktop",
    getAdapter() {
      return {
        mode: "desktop",
        readiness: "unavailable",
        label: "Desktop Bridge Stub",
        summary:
          "Desktop bridge mode is configured, but no desktop-native bridge transport is attached yet. Shell workflows still use the shared local bridge contract and are waiting for a desktop adapter implementation.",
        supports: ["request", "resolve", "focus_policy", "lifecycle_tracking"],
      };
    },
    getContract() {
      return contract;
    },
    getTransport() {
      return {
        adapterMode: "desktop",
        adapterReadiness: "unavailable",
        contractVersion: contract.version,
      };
    },
    listActions() {
      return [];
    },
    listActionsForSession() {
      return [];
    },
    listPendingActionsForSession() {
      return [];
    },
    requestAction() {
      throw new Error("desktop local bridge adapter is not attached");
    },
    resolveAction() {
      throw new Error("desktop local bridge adapter is not attached");
    },
  };
}
