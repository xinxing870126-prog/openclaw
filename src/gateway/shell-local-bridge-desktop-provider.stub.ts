import type {
  ShellLocalActionResult,
  ShellLocalBridgeStatusResponse,
  ShellPendingLocalAction,
} from "./shell-app-contract.js";
import type {
  LocalBridgeAdapter,
  LocalBridgeAdapterProvider,
  LocalBridgeRequestInput,
} from "./shell-local-bridge-provider.js";

export type DesktopLocalBridgeTransport = {
  listActions(): ShellPendingLocalAction[];
  listActionsForSession(sessionKey: string): ShellPendingLocalAction[];
  listPendingActionsForSession(sessionKey: string): ShellPendingLocalAction[];
  requestAction(input: LocalBridgeRequestInput): ShellPendingLocalAction;
  resolveAction(actionId: string, result: ShellLocalActionResult): ShellPendingLocalAction;
};

export type DesktopLocalBridgeProviderOptions = {
  contract: ShellLocalBridgeStatusResponse["contract"];
  transport: DesktopLocalBridgeTransport;
  readiness?: "ready" | "degraded" | "unavailable";
  label?: string;
  summary?: string;
  supports?: Array<"request" | "resolve" | "focus_policy" | "lifecycle_tracking">;
};

export function createDesktopLocalBridgeProvider(
  options: DesktopLocalBridgeProviderOptions,
): LocalBridgeAdapterProvider {
  const adapter: LocalBridgeAdapter = {
    key: "desktop",
    getAdapter() {
      return {
        mode: "desktop",
        readiness: options.readiness ?? "ready",
        label: options.label ?? "Desktop Bridge Provider",
        summary:
          options.summary
          ?? "Desktop-native bridge transport is attached and serving the shared shell local bridge contract.",
        supports: options.supports ?? ["request", "resolve", "focus_policy", "lifecycle_tracking"],
      };
    },
    getContract() {
      return options.contract;
    },
    getTransport() {
      return {
        adapterMode: "desktop",
        adapterReadiness: options.readiness ?? "ready",
        contractVersion: options.contract.version,
      };
    },
    listActions() {
      return options.transport.listActions();
    },
    listActionsForSession(sessionKey: string) {
      return options.transport.listActionsForSession(sessionKey);
    },
    listPendingActionsForSession(sessionKey: string) {
      return options.transport.listPendingActionsForSession(sessionKey);
    },
    requestAction(input: LocalBridgeRequestInput) {
      return options.transport.requestAction(input);
    },
    resolveAction(actionId: string, result: ShellLocalActionResult) {
      return options.transport.resolveAction(actionId, result);
    },
  };

  return {
    getDesktopAdapter: () => adapter,
  };
}
