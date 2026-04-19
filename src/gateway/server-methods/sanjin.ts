import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../../config/paths.js";
import {
  buildShellBrainAccessSurface,
  type ShellBrainAccessSourceInput,
} from "../shell-brain-access.js";
import {
  createTenantPromotionRequestRecord,
  getTenantPromotionRequestRecord,
  listTenantPromotionRequestRecords,
  resolveTenantPromotionRequestsPath,
} from "../shell-promotion-requests.js";
import { executeGovernanceWorkflow } from "../shell-governance-workflow.js";
import {
  getShellGovernanceGate,
  getShellGovernanceReview,
  listShellGovernanceAudit,
  listShellGovernanceConsole,
} from "../shell-governance-read.js";
import {
  SHELL_DRAFT_SCOPE_OPTIONS,
  SHELL_APP_METHODS,
  resolveShellLocalBridgeHealthFeedPollingDecision,
  resolveShellLocalBridgeHealthFeedSchedulerDecision,
  resolveShellLocalActionExecutionRequest,
  resolveShellLocalActionExecutionSource,
  resolveShellLocalActionExecutionSummary,
  resolveShellDesktopNativeActionCapabilityMatrix,
  resolveShellDesktopNativeActionCapabilitySummary,
  resolveShellDesktopIntegrationReviewDecision,
  resolveShellDesktopIntegrationActionLabel,
  type ShellLocalActionLifecycle,
  type ShellAuthLoginRequest,
  type ShellAuthLoginResponse,
  type ShellAuthLogoutResponse,
  type ShellAuthMeResponse,
  type ShellBrainAccessSurface,
  type ShellBrainContractGetResponse,
  type ShellGovernancePermissionModel,
  type ShellGovernancePermissionModelGetResponse,
  type ShellGovernanceExecuteRequest,
  type ShellGovernanceExecuteResponse,
  type ShellGovernanceConsoleListRequest,
  type ShellGovernanceConsoleListResponse,
  type ShellGovernanceGateGetResponse,
  type ShellGovernanceAuditListResponse,
  type ShellGovernanceReviewGetResponse,
  type ShellOnboardingState,
  type ShellLocalActionRequestResponse,
  type ShellLocalActionResult,
  type ShellLocalActionResultResponse,
  type ShellLocalBridgeActionRequestedEvent,
  type ShellLocalBridgeNativeProcessEventResponse,
  type ShellLocalBridgeNativeProcessEventRequest,
  type ShellLocalBridgeStatusResponse,
  type ShellPendingLocalAction,
  type ShellCapabilityGetResponse,
  type ShellCapabilityListEntry,
  type ShellCapabilityListResponse,
  type ShellDraftScopeLabel,
  type ShellPlannerOutcome,
  type ShellPilotFlow,
  type ShellPilotShellPayload,
  type ShellSessionCreateResponse,
  type ShellSessionGetResponse,
  type ShellSessionListEntry,
  type ShellSessionListResponse,
  type ShellSessionSendResponse,
  type ShellSessionStreamResponse,
  type ShellScriptResult,
  type ShellTenantBootstrapResponse,
  type ShellTenantMemoryBoundary,
  type ShellTenantMemoryBoundaryGetResponse,
  type ShellTenantContext,
  type ShellTenantPromotionRequestInput,
  type ShellPromotionRequestCreateResponse,
  type ShellPromotionRequestGetResponse,
  type ShellPromotionRequestListResponse,
  type ShellWorkspaceListResponse,
  type ShellWorkspaceSelectionResponse,
} from "../shell-app-contract.js";
import {
  createDesktopBridgeStubAdapter,
  type LocalBridgeAdapter,
  type LocalBridgeAdapterProvider,
  type LocalBridgeRequestInput,
} from "../shell-local-bridge-provider.js";
import { createDesktopLocalBridgeProvider } from "../shell-local-bridge-desktop-provider.stub.js";
import {
  attachLocalBridgeAdapterProvider,
  listLocalBridgeHealthEvents,
  resolveAttachedDesktopLocalBridgeAdapter,
  resolveLocalBridgeStartupPosture,
  summarizeLocalBridgeHealthFeed,
  updateLocalBridgeStartupPosture,
} from "../shell-local-bridge-provider-runtime.js";
import { summarizeDesktopShellLocalBridgeStartupFromAdapter } from "../shell-local-bridge-desktop-startup-wiring.stub.js";
import { startDesktopShellStartupModuleStub } from "../shell-local-bridge-desktop-shell-startup-module.stub.js";
import { resolveDesktopHostLifecycleIngress } from "../shell-local-bridge-desktop-host-ingress.js";
import { dispatchDesktopShellRuntimeNativeProcessEvent } from "../shell-local-bridge-desktop-runtime.native-process-events.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { sessionsHandlers } from "./sessions.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlerOptions, GatewayRequestHandlers } from "./types.js";

type JsonObject = Record<string, unknown>;

type SanjinScriptResult = ShellScriptResult;
type SanjinTenantContext = ShellTenantContext;
type SanjinPilotFlowPayload = ShellPilotFlow;

const LOCAL_BRIDGE_ACTIONS = new Map<string, ShellPendingLocalAction>();
const SHELL_SELECTED_WORKSPACES = new Map<string, string>();
const SHELL_AUTH_ACCESS = new Map<
  string,
  {
    operatorLabel: string | null;
    grantedAt: string;
  }
>();

const LOCAL_BRIDGE_ADAPTER_INFO = {
  mode: "simulated",
  readiness: "ready",
  label: "Simulated Local Bridge",
  summary: "This shell currently uses the built-in simulated local bridge. Desktop-native bridge transport can attach later without changing shell workflow semantics.",
  supports: ["request", "resolve", "focus_policy", "lifecycle_tracking"],
} as const;

const LOCAL_BRIDGE_CONTRACT = {
  version: "v1",
  requestFields: ["actionId", "actionType", "title", "description", "constraints", "sessionKey", "requestedAt", "lifecycle"],
  resultFields: ["actionId", "approved", "payload", "error", "resolvedAt", "lifecycle"],
  visibleLifecycles: ["requested", "pending", "completed", "rejected"],
  reservedLifecycles: ["stale", "expired"],
} as const;

const DESKTOP_LOCAL_ACTION_REQUESTED_EVENT = "localBridge.action.requested" as const;
const DESKTOP_RUNTIME_PROVIDER_KEY = "desktop-main" as const;
const DESKTOP_RUNTIME_LABEL = "Desktop Runtime Bridge";
const DESKTOP_STARTUP_MODULE_LABEL = "Desktop Shell Startup Module";
const DESKTOP_BRIDGE_SUPPORTS = ["request", "resolve", "focus_policy", "lifecycle_tracking"] as const;

const SIMULATED_LOCAL_BRIDGE_ADAPTER: LocalBridgeAdapter = {
  key: "simulated",
  getAdapter() {
    return LOCAL_BRIDGE_ADAPTER_INFO;
  },
  getContract() {
    return LOCAL_BRIDGE_CONTRACT;
  },
  getTransport() {
    return {
      adapterMode: LOCAL_BRIDGE_ADAPTER_INFO.mode,
      adapterReadiness: LOCAL_BRIDGE_ADAPTER_INFO.readiness,
      contractVersion: LOCAL_BRIDGE_CONTRACT.version,
    } as const;
  },
  listActions() {
    return Array.from(LOCAL_BRIDGE_ACTIONS.values()).sort((left, right) =>
      right.requestedAt.localeCompare(left.requestedAt),
    );
  },
  listActionsForSession(sessionKey: string) {
    return this.listActions().filter((action) => action.sessionKey === sessionKey);
  },
  listPendingActionsForSession(sessionKey: string) {
    return this.listActionsForSession(sessionKey).filter((action) => isPendingLocalAction(action));
  },
  requestAction(input: LocalBridgeRequestInput) {
    const action: ShellPendingLocalAction = {
      actionId: input.actionId,
      actionType: input.actionType,
      title: input.title,
      description: input.description,
      constraints: input.constraints,
      sessionKey: input.sessionKey,
      requestedAt: new Date().toISOString(),
      resolvedAt: null,
      expiresAt: null,
      lifecycle: "pending",
      status: "pending",
    };
    LOCAL_BRIDGE_ACTIONS.set(action.actionId, action);
    return action;
  },
  resolveAction(actionId: string, result: ShellLocalActionResult) {
    const existing = LOCAL_BRIDGE_ACTIONS.get(actionId);
    if (!existing) {
      throw new Error(`unknown local action: ${actionId}`);
    }
    const next: ShellPendingLocalAction = {
      ...existing,
      resolvedAt: new Date().toISOString(),
      lifecycle: result.approved ? "completed" : "rejected",
      status: result.approved ? "completed" : "rejected",
      result,
    };
    LOCAL_BRIDGE_ACTIONS.set(actionId, next);
    return next;
  },
};

const DESKTOP_LOCAL_BRIDGE_STUB_ADAPTER: LocalBridgeAdapter =
  createDesktopBridgeStubAdapter(LOCAL_BRIDGE_CONTRACT);

const LOCAL_BRIDGE_ADAPTER_REGISTRY: Record<LocalBridgeAdapter["key"], LocalBridgeAdapter> = {
  simulated: SIMULATED_LOCAL_BRIDGE_ADAPTER,
  desktop: DESKTOP_LOCAL_BRIDGE_STUB_ADAPTER,
};

export function setLocalBridgeAdapterProviderForTests(
  provider: LocalBridgeAdapterProvider | null,
): void {
  attachLocalBridgeAdapterProvider(provider);
}

function buildGatewayDesktopLocalBridgeTransport() {
  return {
    listActions() {
      return Array.from(LOCAL_BRIDGE_ACTIONS.values()).sort((left, right) =>
        right.requestedAt.localeCompare(left.requestedAt),
      );
    },
    listActionsForSession(sessionKey: string) {
      return this.listActions().filter((action) => action.sessionKey === sessionKey);
    },
    listPendingActionsForSession(sessionKey: string) {
      return this.listActionsForSession(sessionKey).filter((action) => isPendingLocalAction(action));
    },
    requestAction(input: LocalBridgeRequestInput) {
      const action: ShellPendingLocalAction = {
        actionId: input.actionId,
        actionType: input.actionType,
        title: input.title,
        description: input.description,
        constraints: input.constraints,
        sessionKey: input.sessionKey,
        requestedAt: new Date().toISOString(),
        resolvedAt: null,
        expiresAt: null,
        lifecycle: "pending",
        status: "pending",
      };
      LOCAL_BRIDGE_ACTIONS.set(action.actionId, action);
      return action;
    },
    resolveAction(actionId: string, result: ShellLocalActionResult) {
      const existing = LOCAL_BRIDGE_ACTIONS.get(actionId);
      if (!existing) {
        throw new Error(`unknown local action: ${actionId}`);
      }
      const next: ShellPendingLocalAction = {
        ...existing,
        resolvedAt: new Date().toISOString(),
        lifecycle: result.approved ? "completed" : "rejected",
        status: result.approved ? "completed" : "rejected",
        result,
      };
      LOCAL_BRIDGE_ACTIONS.set(actionId, next);
      return next;
    },
  };
}

function createGatewayDesktopLocalBridgeProvider(shellAppLabel?: string): LocalBridgeAdapterProvider {
  const normalizedShellAppLabel = shellAppLabel?.trim() || "Desktop Shell";
  return createDesktopLocalBridgeProvider({
    contract: LOCAL_BRIDGE_CONTRACT,
    transport: buildGatewayDesktopLocalBridgeTransport(),
    readiness: "ready",
    label: `${normalizedShellAppLabel} Desktop Bridge`,
    summary:
      `${normalizedShellAppLabel} attached the desktop-native local bridge transport and is ` +
      "serving the shared shell local bridge contract.",
    supports: [...DESKTOP_BRIDGE_SUPPORTS],
  });
}

function ensureNativeDesktopLocalBridgeRuntime(params: {
  shellAppLabel?: string;
  hostPlatform: "macos" | "windows";
  nativeEventIngressSource: "macos_app_lifecycle" | "windows_app_lifecycle";
}): void {
  const shellAppLabel = params.shellAppLabel?.trim() || "Desktop Shell";
  const current = resolveLocalBridgeStartupPosture();
  const attachedAdapter = resolveAttachedDesktopLocalBridgeAdapter();
  const needsDesktopStartupWiring =
    current?.startupSource !== "desktop_startup_wiring"
    || current.mode !== "desktop"
    || current.providerKey !== DESKTOP_RUNTIME_PROVIDER_KEY
    || current.providerStatus === "no_provider"
    || current.providerStatus === "missing_provider"
    || !attachedAdapter;

  if (needsDesktopStartupWiring) {
    startDesktopShellStartupModuleStub({
      env: {
        ...process.env,
        OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop",
        OPENCLAW_DESKTOP_LOCAL_BRIDGE_PROVIDER_KEY: DESKTOP_RUNTIME_PROVIDER_KEY,
      } as NodeJS.ProcessEnv,
      shellAppLabel,
      moduleLabel: DESKTOP_STARTUP_MODULE_LABEL,
      providerKey: DESKTOP_RUNTIME_PROVIDER_KEY,
      providerFactory: () => createGatewayDesktopLocalBridgeProvider(shellAppLabel),
    });
  }

  const runtimeAdapter = resolveAttachedDesktopLocalBridgeAdapter();
  updateLocalBridgeStartupPosture({
    mode: "desktop",
    attached: Boolean(runtimeAdapter),
    adapterReadiness: runtimeAdapter?.getAdapter().readiness ?? "unavailable",
    startupModeLabel: "desktop bridge startup",
    startupSource: "desktop_startup_wiring",
    runtimeLabel: DESKTOP_RUNTIME_LABEL,
    runtimeSummary:
      `${DESKTOP_RUNTIME_LABEL} started desktop bridge runtime ` +
      `(${runtimeAdapter ? "attached" : "not attached"}) using provider ${DESKTOP_RUNTIME_PROVIDER_KEY}.`,
    providerKey: DESKTOP_RUNTIME_PROVIDER_KEY,
    desktopHostPlatform: params.hostPlatform,
    nativeProcessIngressSource: params.nativeEventIngressSource,
    shellAppLabel,
    moduleLabel: current?.moduleLabel ?? DESKTOP_STARTUP_MODULE_LABEL,
  });
}

function resolveLocalBridgeAdapter(
  env: NodeJS.ProcessEnv = process.env,
): LocalBridgeAdapter {
  const runtimeStartupPosture = resolveLocalBridgeStartupPosture();
  const configured =
    env.OPENCLAW_LOCAL_BRIDGE_ADAPTER?.trim().toLowerCase()
    || env.OPENCLAW_SHELL_LOCAL_BRIDGE_ADAPTER?.trim().toLowerCase()
    || "simulated";
  const runtimeDesktopWired =
    runtimeStartupPosture?.mode === "desktop"
    && runtimeStartupPosture.startupSource === "desktop_startup_wiring";
  if (configured === "desktop" || runtimeDesktopWired) {
    return resolveAttachedDesktopLocalBridgeAdapter() ?? LOCAL_BRIDGE_ADAPTER_REGISTRY.desktop;
  }
  return LOCAL_BRIDGE_ADAPTER_REGISTRY.simulated;
}

function normalizeLocalActionLifecycle(
  action: Pick<ShellPendingLocalAction, "lifecycle" | "status">,
): ShellLocalActionLifecycle {
  if (action.lifecycle === "requested" || action.lifecycle === "pending") {
    return action.lifecycle;
  }
  if (action.lifecycle === "completed" || action.lifecycle === "rejected") {
    return action.lifecycle;
  }
  if (action.lifecycle === "stale" || action.lifecycle === "expired") {
    return action.lifecycle;
  }
  return action.status === "pending"
    ? "pending"
    : action.status === "completed"
      ? "completed"
      : "rejected";
}

function isPendingLocalAction(action: Pick<ShellPendingLocalAction, "lifecycle" | "status">): boolean {
  const lifecycle = normalizeLocalActionLifecycle(action);
  return lifecycle === "requested" || lifecycle === "pending";
}

function isResolvedLocalAction(action: Pick<ShellPendingLocalAction, "lifecycle" | "status">): boolean {
  const lifecycle = normalizeLocalActionLifecycle(action);
  return lifecycle === "completed" || lifecycle === "rejected";
}

function getShellSelectionKey(
  client: GatewayRequestHandlerOptions["client"],
  env: NodeJS.ProcessEnv = process.env,
): string {
  const clientId =
    client?.connect?.client && typeof client.connect.client === "object"
      ? stringifyValue((client.connect.client as { id?: unknown }).id || "")
      : "";
  return clientId || client?.connId || resolveWorkspaceDir(env) || "__global__";
}

function getAvailableWorkspaceIds(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.OPENCLAW_SANJIN_WORKSPACES?.trim() || "";
  const configured = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const fallback = env.OPENCLAW_SANJIN_WORKSPACE_ID?.trim() || path.basename(resolveWorkspaceDir(env)) || "default-workspace";
  const merged = configured.length ? configured : [fallback];
  return Array.from(new Set(merged));
}

function resolveShellAccessConfig(env: NodeJS.ProcessEnv = process.env) {
  const inviteCode =
    env.OPENCLAW_SANJIN_INVITE_CODE?.trim()
    || env.OPENCLAW_SHELL_INVITE_CODE?.trim()
    || "";
  return {
    required: Boolean(inviteCode),
    inviteCode,
    invitationLabel:
      env.OPENCLAW_SANJIN_INVITATION_LABEL?.trim()
      || env.OPENCLAW_SHELL_INVITATION_LABEL?.trim()
      || "Invite-only shell access",
  };
}

function buildShellAccessPayload(
  client: GatewayRequestHandlerOptions["client"] | null,
  env: NodeJS.ProcessEnv = process.env,
): ShellAuthMeResponse["shellAccess"] {
  const config = resolveShellAccessConfig(env);
  if (!config.required) {
    return {
      required: false,
      granted: true,
      mode: "gateway",
      invitationLabel: "Gateway access",
      operatorLabel: null,
      grantedAt: null,
    };
  }
  const granted = SHELL_AUTH_ACCESS.get(getShellSelectionKey(client, env));
  return {
    required: true,
    granted: Boolean(granted),
    mode: "invite_code",
    invitationLabel: config.invitationLabel,
    operatorLabel: granted?.operatorLabel ?? null,
    grantedAt: granted?.grantedAt ?? null,
  };
}

function resolveDesktopLocalActionDeliverySummary(params: {
  shellAppLabel?: string | null;
  action: Pick<ShellPendingLocalAction, "title" | "actionType" | "actionId">;
  pendingNativeActionCount: number;
  desktopHostPlatform?: ShellLocalBridgeStatusResponse["startupPosture"]["desktopHostPlatform"];
}): string {
  const shellAppLabel = params.shellAppLabel?.trim() || "Desktop Shell";
  const hostPlatform = params.desktopHostPlatform?.trim() || "desktop";
  const countLabel =
    params.pendingNativeActionCount === 1
      ? "1 pending native local action remains."
      : `${params.pendingNativeActionCount} pending native local actions remain.`;
  return `${shellAppLabel} queued native local action ${params.action.title} (${params.action.actionType}) for ${hostPlatform} host transport. ${countLabel}`;
}

function resolveDesktopLocalActionResultSummary(params: {
  shellAppLabel?: string | null;
  action: Pick<ShellPendingLocalAction, "title" | "actionType" | "actionId" | "status">;
  approved: boolean;
  pendingNativeActionCount: number;
  desktopHostPlatform?: ShellLocalBridgeStatusResponse["startupPosture"]["desktopHostPlatform"];
}): string {
  return resolveShellLocalActionExecutionSummary({
    shellAppLabel: params.shellAppLabel,
    action: params.action,
    approved: params.approved,
    hostPlatform: params.desktopHostPlatform,
    executionSource: resolveShellLocalActionExecutionSource(params.desktopHostPlatform),
    pendingNativeActionCount: params.pendingNativeActionCount,
  });
}

function enrichDesktopNativeLocalActionCapabilities(
  startupPosture: ShellLocalBridgeStatusResponse["startupPosture"],
): ShellLocalBridgeStatusResponse["startupPosture"] {
  const nativeLocalActionCapabilityMatrix = resolveShellDesktopNativeActionCapabilityMatrix(
    startupPosture?.desktopHostPlatform,
  );
  const nativeLocalActionCapabilitySummary = resolveShellDesktopNativeActionCapabilitySummary({
    hostPlatform: startupPosture?.desktopHostPlatform,
    capabilityMatrix: nativeLocalActionCapabilityMatrix,
  });
  return {
    ...startupPosture,
    nativeLocalActionCapabilityMatrix,
    nativeLocalActionCapabilitySummary,
  };
}

function buildDesktopLocalActionRequestedEventPayload(params: {
  response: ShellLocalActionRequestResponse;
  startupPosture: ShellLocalBridgeStatusResponse["startupPosture"];
  pendingNativeActionCount: number;
}): ShellLocalBridgeActionRequestedEvent {
  return {
    generatedAt: params.response.generatedAt,
    transport: params.response.transport,
    action: params.response.action,
    nativeLocalActionTransportSource: "desktop_local_action_push",
    desktopHostPlatform: params.startupPosture?.desktopHostPlatform ?? null,
    pendingNativeActionCount: params.pendingNativeActionCount,
    nativeLocalActionDeliverySummary: resolveDesktopLocalActionDeliverySummary({
      shellAppLabel: params.startupPosture?.shellAppLabel,
      action: params.response.action,
      pendingNativeActionCount: params.pendingNativeActionCount,
      desktopHostPlatform: params.startupPosture?.desktopHostPlatform,
    }),
  };
}

function buildDesktopIntegrationSummary(
  localBridgeStatus: ShellLocalBridgeStatusResponse,
) {
  return {
    title: "Desktop Bridge Integration",
    summary:
      localBridgeStatus.startupPosture?.attached
        ? `${localBridgeStatus.adapter?.label ?? "Desktop bridge"} is attached and ${localBridgeStatus.adapter?.readiness ?? "unknown"}, so native local-action transport can follow the existing shell bridge contract.`
        : `${localBridgeStatus.adapter?.label ?? "Desktop bridge"} is currently ${localBridgeStatus.adapter?.readiness ?? "unknown"}, and shell startup is still relying on ${localBridgeStatus.startupPosture?.mode ?? localBridgeStatus.adapter?.mode ?? "unknown"} bridge posture.`,
    adapterLabel: localBridgeStatus.adapter?.label ?? "Unknown Bridge Adapter",
    adapterMode: localBridgeStatus.adapter?.mode ?? "unknown",
    readiness: localBridgeStatus.adapter?.readiness ?? "unknown",
    runtimeLabel: localBridgeStatus.startupPosture?.runtimeLabel ?? null,
    runtimeSummary: localBridgeStatus.startupPosture?.runtimeSummary ?? null,
    healthSource: localBridgeStatus.startupPosture?.healthSource,
    healthStatus: localBridgeStatus.startupPosture?.healthStatus,
    healthStatusLabel: localBridgeStatus.startupPosture?.healthStatusLabel ?? null,
    healthEventSummary: localBridgeStatus.startupPosture?.healthEventSummary ?? null,
    contractVersion: localBridgeStatus.contract?.version ?? "unknown",
    supports: localBridgeStatus.adapter?.supports ?? [],
    startupSource: localBridgeStatus.startupPosture?.startupSource,
    providerStatus: localBridgeStatus.startupPosture?.providerStatus,
    providerStatusLabel: localBridgeStatus.startupPosture?.providerStatusLabel ?? null,
    shellAppLabel: localBridgeStatus.startupPosture?.shellAppLabel ?? null,
    moduleLabel: localBridgeStatus.startupPosture?.moduleLabel ?? null,
    moduleSummary: localBridgeStatus.startupPosture?.moduleSummary ?? null,
    moduleStatus: localBridgeStatus.startupPosture?.moduleStatus ?? null,
    moduleStatusLabel: localBridgeStatus.startupPosture?.moduleStatusLabel ?? null,
    providerKey: localBridgeStatus.startupPosture?.providerKey ?? null,
    recentHealthEvents: localBridgeStatus.recentHealthEvents ?? [],
    healthFeed: localBridgeStatus.healthFeed,
    runnerMode: localBridgeStatus.startupPosture?.runnerMode,
    nextRunAt: localBridgeStatus.startupPosture?.nextRunAt ?? null,
    recommendedDelayMs: localBridgeStatus.startupPosture?.recommendedDelayMs ?? null,
    retryBackoffMs: localBridgeStatus.startupPosture?.retryBackoffMs ?? null,
    runnerSummary: localBridgeStatus.startupPosture?.runnerSummary ?? null,
    driverState: localBridgeStatus.startupPosture?.driverState,
    driverSummary: localBridgeStatus.startupPosture?.driverSummary ?? null,
    timerState: localBridgeStatus.startupPosture?.timerState,
    scheduledAt: localBridgeStatus.startupPosture?.scheduledAt ?? null,
    nextTickAt: localBridgeStatus.startupPosture?.nextTickAt ?? null,
    lastTickAt: localBridgeStatus.startupPosture?.lastTickAt ?? null,
    timerSummary: localBridgeStatus.startupPosture?.timerSummary ?? null,
    runnerState: localBridgeStatus.startupPosture?.runnerState,
    nextWakeAt: localBridgeStatus.startupPosture?.nextWakeAt ?? null,
    lastTickStartedAt: localBridgeStatus.startupPosture?.lastTickStartedAt ?? null,
    lastTickCompletedAt: localBridgeStatus.startupPosture?.lastTickCompletedAt ?? null,
    runnerServiceSummary: localBridgeStatus.startupPosture?.runnerServiceSummary ?? null,
    hostState: localBridgeStatus.startupPosture?.hostState,
    serviceState: localBridgeStatus.startupPosture?.serviceState,
    serviceOwned: localBridgeStatus.startupPosture?.serviceOwned ?? false,
    serviceActive: localBridgeStatus.startupPosture?.serviceActive ?? false,
    hostStarted: localBridgeStatus.startupPosture?.hostStarted ?? false,
    hostArmed: localBridgeStatus.startupPosture?.hostArmed ?? false,
    lastWakeStartedAt: localBridgeStatus.startupPosture?.lastWakeStartedAt ?? null,
    lastWakeCompletedAt: localBridgeStatus.startupPosture?.lastWakeCompletedAt ?? null,
    hostSummary: localBridgeStatus.startupPosture?.hostSummary ?? null,
    lastAcquireAt: localBridgeStatus.startupPosture?.lastAcquireAt ?? null,
    lastReleaseAt: localBridgeStatus.startupPosture?.lastReleaseAt ?? null,
    serviceSummary: localBridgeStatus.startupPosture?.serviceSummary ?? null,
    lifecycleState: localBridgeStatus.startupPosture?.lifecycleState,
    lifecycleOwned: localBridgeStatus.startupPosture?.lifecycleOwned ?? false,
    lifecycleActive: localBridgeStatus.startupPosture?.lifecycleActive ?? false,
    lastBootAt: localBridgeStatus.startupPosture?.lastBootAt ?? null,
    lastResumeAt: localBridgeStatus.startupPosture?.lastResumeAt ?? null,
    lastSuspendAt: localBridgeStatus.startupPosture?.lastSuspendAt ?? null,
    lastShutdownAt: localBridgeStatus.startupPosture?.lastShutdownAt ?? null,
    lifecycleSummary: localBridgeStatus.startupPosture?.lifecycleSummary ?? null,
    bootstrapState: localBridgeStatus.startupPosture?.bootstrapState,
    bootstrapOwned: localBridgeStatus.startupPosture?.bootstrapOwned ?? false,
    bootstrapActive: localBridgeStatus.startupPosture?.bootstrapActive ?? false,
    appOwnerState: localBridgeStatus.startupPosture?.appOwnerState,
    appOwnerOwned: localBridgeStatus.startupPosture?.appOwnerOwned ?? false,
    appOwnerActive: localBridgeStatus.startupPosture?.appOwnerActive ?? false,
    shellOwnerState: localBridgeStatus.startupPosture?.shellOwnerState,
    shellOwnerOwned: localBridgeStatus.startupPosture?.shellOwnerOwned ?? false,
    shellOwnerActive: localBridgeStatus.startupPosture?.shellOwnerActive ?? false,
    processHostState: localBridgeStatus.startupPosture?.processHostState,
    processHostOwned: localBridgeStatus.startupPosture?.processHostOwned ?? false,
    processHostActive: localBridgeStatus.startupPosture?.processHostActive ?? false,
    processEventType: localBridgeStatus.startupPosture?.processEventType ?? null,
    processEventSource: localBridgeStatus.startupPosture?.processEventSource ?? null,
    lastProcessEventAt: localBridgeStatus.startupPosture?.lastProcessEventAt ?? null,
    nativeProcessEventType: localBridgeStatus.startupPosture?.nativeProcessEventType ?? null,
    nativeProcessEventSource: localBridgeStatus.startupPosture?.nativeProcessEventSource ?? null,
    desktopHostPlatform: localBridgeStatus.startupPosture?.desktopHostPlatform ?? null,
    nativeProcessIngressSource: localBridgeStatus.startupPosture?.nativeProcessIngressSource ?? null,
    lastNativeProcessEventAt: localBridgeStatus.startupPosture?.lastNativeProcessEventAt ?? null,
    nativeLocalActionTransportSource:
      localBridgeStatus.startupPosture?.nativeLocalActionTransportSource ?? null,
    pendingNativeActionCount: localBridgeStatus.startupPosture?.pendingNativeActionCount ?? null,
    nativeLocalActionDeliverySummary:
      localBridgeStatus.startupPosture?.nativeLocalActionDeliverySummary ?? null,
    nativeLocalActionResultSummary:
      localBridgeStatus.startupPosture?.nativeLocalActionResultSummary ?? null,
    nativeLocalActionExecutionSource:
      localBridgeStatus.startupPosture?.nativeLocalActionExecutionSource ?? null,
    lastNativeLocalActionExecutionAt:
      localBridgeStatus.startupPosture?.lastNativeLocalActionExecutionAt ?? null,
    nativeLocalActionExecutionSummary:
      localBridgeStatus.startupPosture?.nativeLocalActionExecutionSummary ?? null,
    nativeLocalActionCapabilitySummary:
      localBridgeStatus.startupPosture?.nativeLocalActionCapabilitySummary ?? null,
    nativeLocalActionCapabilityMatrix:
      localBridgeStatus.startupPosture?.nativeLocalActionCapabilityMatrix ?? null,
    lastStartAt: localBridgeStatus.startupPosture?.lastStartAt ?? null,
    lastWakeAt: localBridgeStatus.startupPosture?.lastWakeAt ?? null,
    lastForegroundAt: localBridgeStatus.startupPosture?.lastForegroundAt ?? null,
    lastBackgroundAt: localBridgeStatus.startupPosture?.lastBackgroundAt ?? null,
    lastStopAt: localBridgeStatus.startupPosture?.lastStopAt ?? null,
    bootstrapSummary: localBridgeStatus.startupPosture?.bootstrapSummary ?? null,
    appOwnerSummary: localBridgeStatus.startupPosture?.appOwnerSummary ?? null,
    shellOwnerSummary: localBridgeStatus.startupPosture?.shellOwnerSummary ?? null,
    processHostSummary: localBridgeStatus.startupPosture?.processHostSummary ?? null,
    processEventSummary: localBridgeStatus.startupPosture?.processEventSummary ?? null,
    nativeProcessEventSummary: localBridgeStatus.startupPosture?.nativeProcessEventSummary ?? null,
    startupPosture: localBridgeStatus.startupPosture ?? null,
  } as const;
}

function desktopIntegrationNeedsAttention(
  desktopIntegration: ReturnType<typeof buildDesktopIntegrationSummary>,
): boolean {
  return resolveShellDesktopIntegrationReviewDecision({
    adapterMode: desktopIntegration.adapterMode,
    startupSource: desktopIntegration.startupSource,
    moduleStatus: desktopIntegration.moduleStatus,
    providerStatus: desktopIntegration.providerStatus,
    healthStatus: desktopIntegration.healthStatus,
    stalenessStatus: desktopIntegration.healthFeed?.stalenessStatus,
    freshnessReason: desktopIntegration.healthFeed?.freshnessReason,
    attached: desktopIntegration.startupPosture?.attached,
    readiness: desktopIntegration.readiness,
  }).entryTarget === "settings";
}

function desktopIntegrationNeedsHealthReview(
  desktopIntegration: ReturnType<typeof buildDesktopIntegrationSummary>,
): boolean {
  const decision = resolveShellDesktopIntegrationReviewDecision({
    adapterMode: desktopIntegration.adapterMode,
    startupSource: desktopIntegration.startupSource,
    moduleStatus: desktopIntegration.moduleStatus,
    providerStatus: desktopIntegration.providerStatus,
    healthStatus: desktopIntegration.healthStatus,
    stalenessStatus: desktopIntegration.healthFeed?.stalenessStatus,
    freshnessReason: desktopIntegration.healthFeed?.freshnessReason,
    attached: desktopIntegration.startupPosture?.attached,
    readiness: desktopIntegration.readiness,
  });
  return decision.reviewKind === "health" && decision.entryTarget === "workbench";
}

function describeDesktopStartupOrigin(
  startupPosture: ShellLocalBridgeStatusResponse["startupPosture"] | null | undefined,
): string {
  if (!startupPosture) {
    return "bridge startup posture";
  }
  if (startupPosture.startupSource === "desktop_startup_wiring") {
    if (startupPosture.moduleLabel && startupPosture.shellAppLabel) {
      return `${startupPosture.moduleLabel} for ${startupPosture.shellAppLabel}`;
    }
    if (startupPosture.moduleLabel) {
      return startupPosture.moduleLabel;
    }
    return startupPosture.shellAppLabel
      ? `${startupPosture.shellAppLabel} startup wiring`
      : "desktop startup wiring";
  }
  return "derived bridge adapter posture";
}

function describeDesktopStartupModuleContext(
  startupPosture: ShellLocalBridgeStatusResponse["startupPosture"] | null | undefined,
): string | null {
  const summary = startupPosture?.moduleSummary?.trim() ?? "";
  return summary || null;
}

function describeDesktopStartupModuleStatusContext(
  startupPosture: ShellLocalBridgeStatusResponse["startupPosture"] | null | undefined,
): string | null {
  const label = startupPosture?.moduleStatusLabel?.trim() ?? "";
  return label ? `Current desktop startup status: ${label}.` : null;
}

function describeDesktopStartupProviderContext(
  startupPosture: ShellLocalBridgeStatusResponse["startupPosture"] | null | undefined,
): string | null {
  const providerKey = startupPosture?.providerKey?.trim() ?? "";
  return providerKey ? `Current desktop startup provider: ${providerKey}.` : null;
}

function describeDesktopStartupProviderStatusContext(
  startupPosture: ShellLocalBridgeStatusResponse["startupPosture"] | null | undefined,
): string | null {
  const label = startupPosture?.providerStatusLabel?.trim() ?? "";
  return label ? `Current desktop provider posture: ${label}.` : null;
}

function describeDesktopStartupHealthContext(
  startupPosture: ShellLocalBridgeStatusResponse["startupPosture"] | null | undefined,
): string | null {
  const label = startupPosture?.healthStatusLabel?.trim() ?? "";
  return label ? `Current desktop integration health: ${label}.` : null;
}

function describeDesktopStartupHealthFeedContext(
  healthFeed: ShellLocalBridgeStatusResponse["healthFeed"] | null | undefined,
  startupPosture: ShellLocalBridgeStatusResponse["startupPosture"] | null | undefined,
): string | null {
  const label = healthFeed?.stalenessStatusLabel?.trim() ?? "";
  const pollingDecision = resolveShellLocalBridgeHealthFeedPollingDecision(healthFeed);
  const schedulerDecision = resolveShellLocalBridgeHealthFeedSchedulerDecision({
    healthFeed,
    healthStatus: startupPosture?.healthStatus,
    attached: startupPosture?.attached,
    readiness: startupPosture?.adapterReadiness,
  });
  if (!label || pollingDecision.stalenessStatus === "fresh" || pollingDecision.stalenessStatus === "idle") {
    return null;
  }
  const ageContext =
    healthFeed.latestAgeMs !== null && healthFeed.latestAgeMs !== undefined
      ? ` Latest event age: ${Math.round(healthFeed.latestAgeMs / 60_000)}m.`
      : "";
  const missedHeartbeatContext =
    pollingDecision.missedHeartbeatCount > 0
      ? ` Missed heartbeats: ${pollingDecision.missedHeartbeatCount}.`
      : "";
  const cadenceContext =
    typeof healthFeed.expectedHeartbeatIntervalMs === "number"
      ? ` Expected heartbeat every ${Math.round(healthFeed.expectedHeartbeatIntervalMs / 60_000)}m.`
      : "";
  const pollContext =
    typeof pollingDecision.pollRecommendedAfterMs === "number"
      ? pollingDecision.pollRecommendedAfterMs <= 0
        ? " Poll recommended now."
        : ` Poll recommended in ${Math.max(1, Math.round(pollingDecision.pollRecommendedAfterMs / 60_000))}m.`
      : "";
  const reasonContext = healthFeed.freshnessReason?.trim()
    ? ` ${healthFeed.freshnessReason.trim()}.`
    : "";
  const schedulerContext = schedulerDecision.runnerSummary
    ? ` ${schedulerDecision.runnerSummary}`
    : "";
  return `Current desktop health feed freshness: ${label}.${ageContext}${missedHeartbeatContext}${cadenceContext}${pollContext}${reasonContext}${schedulerContext}`;
}

function describeDesktopStartupRuntimeContext(
  startupPosture: ShellLocalBridgeStatusResponse["startupPosture"] | null | undefined,
): string | null {
  const runtimeLabel = startupPosture?.runtimeLabel?.trim() ?? "";
  const runtimeSummary = startupPosture?.runtimeSummary?.trim() ?? "";
  if (runtimeLabel && runtimeSummary) {
    return `Current desktop runtime integration ${runtimeLabel}: ${runtimeSummary}`;
  }
  if (runtimeSummary) {
    return runtimeSummary;
  }
  if (runtimeLabel) {
    return `Current desktop runtime integration: ${runtimeLabel}.`;
  }
  return null;
}

function describeDesktopStartupDriverContext(
  startupPosture: ShellLocalBridgeStatusResponse["startupPosture"] | null | undefined,
): string | null {
  const fragments = [
    startupPosture?.driverState ? `Current desktop runtime driver state: ${startupPosture.driverState}.` : null,
    startupPosture?.driverSummary?.trim() ? startupPosture.driverSummary.trim() : null,
    startupPosture?.nextRunAt ? `Next desktop cadence run: ${startupPosture.nextRunAt}.` : null,
  ].filter((value): value is string => Boolean(value));
  return fragments.length ? fragments.join(" ") : null;
}

function describeDesktopStartupTimerContext(
  startupPosture: ShellLocalBridgeStatusResponse["startupPosture"] | null | undefined,
): string | null {
  const fragments = [
    startupPosture?.timerState ? `Current desktop runtime timer state: ${startupPosture.timerState}.` : null,
    startupPosture?.timerSummary?.trim() ? startupPosture.timerSummary.trim() : null,
    startupPosture?.scheduledAt ? `Desktop runtime timer armed at ${startupPosture.scheduledAt}.` : null,
    startupPosture?.nextTickAt ? `Next desktop runtime timer tick: ${startupPosture.nextTickAt}.` : null,
    startupPosture?.lastTickAt ? `Last desktop runtime timer tick: ${startupPosture.lastTickAt}.` : null,
  ].filter((value): value is string => Boolean(value));
  return fragments.length ? fragments.join(" ") : null;
}

function describeDesktopStartupRunnerContext(
  startupPosture: ShellLocalBridgeStatusResponse["startupPosture"] | null | undefined,
): string | null {
  const fragments = [
    startupPosture?.runnerState ? `Current desktop runtime runner state: ${startupPosture.runnerState}.` : null,
    startupPosture?.runnerServiceSummary?.trim() ? startupPosture.runnerServiceSummary.trim() : null,
    startupPosture?.nextWakeAt ? `Next desktop runtime wake: ${startupPosture.nextWakeAt}.` : null,
    startupPosture?.lastTickStartedAt ? `Last desktop runtime tick started: ${startupPosture.lastTickStartedAt}.` : null,
    startupPosture?.lastTickCompletedAt ? `Last desktop runtime tick completed: ${startupPosture.lastTickCompletedAt}.` : null,
    startupPosture?.hostState ? `Current desktop runtime host state: ${startupPosture.hostState}.` : null,
    startupPosture?.serviceState ? `Current desktop runtime service state: ${startupPosture.serviceState}.` : null,
    startupPosture?.serviceOwned === true ? "Desktop runtime service owner currently holds the cadence loop." : null,
    startupPosture?.serviceActive === true ? "Desktop runtime service owner remains active." : null,
    startupPosture?.hostStarted === true ? "Desktop runtime host is holding the main-process cadence loop." : null,
    startupPosture?.hostArmed === true ? "Desktop runtime host remains armed for the next wake." : null,
    startupPosture?.lastWakeStartedAt ? `Last desktop host wake started: ${startupPosture.lastWakeStartedAt}.` : null,
    startupPosture?.lastWakeCompletedAt ? `Last desktop host wake completed: ${startupPosture.lastWakeCompletedAt}.` : null,
    startupPosture?.hostSummary?.trim() ? startupPosture.hostSummary.trim() : null,
    startupPosture?.lastAcquireAt ? `Last desktop service acquire: ${startupPosture.lastAcquireAt}.` : null,
    startupPosture?.lastReleaseAt ? `Last desktop service release: ${startupPosture.lastReleaseAt}.` : null,
    startupPosture?.serviceSummary?.trim() ? startupPosture.serviceSummary.trim() : null,
    startupPosture?.lifecycleState ? `Current desktop runtime lifecycle state: ${startupPosture.lifecycleState}.` : null,
    startupPosture?.lifecycleOwned === true ? "Desktop runtime lifecycle owner currently owns the desktop app cadence loop." : null,
    startupPosture?.lifecycleActive === true ? "Desktop runtime lifecycle owner remains active." : null,
    startupPosture?.lastBootAt ? `Last desktop lifecycle boot: ${startupPosture.lastBootAt}.` : null,
    startupPosture?.lastResumeAt ? `Last desktop lifecycle resume: ${startupPosture.lastResumeAt}.` : null,
    startupPosture?.lastSuspendAt ? `Last desktop lifecycle suspend: ${startupPosture.lastSuspendAt}.` : null,
    startupPosture?.lastShutdownAt ? `Last desktop lifecycle shutdown: ${startupPosture.lastShutdownAt}.` : null,
    startupPosture?.lifecycleSummary?.trim() ? startupPosture.lifecycleSummary.trim() : null,
    startupPosture?.bootstrapState ? `Current desktop runtime bootstrap state: ${startupPosture.bootstrapState}.` : null,
    startupPosture?.bootstrapOwned === true ? "Desktop runtime bootstrap owner currently owns the desktop main-process bootstrap loop." : null,
    startupPosture?.bootstrapActive === true ? "Desktop runtime bootstrap owner remains active." : null,
    startupPosture?.appOwnerState ? `Current desktop runtime app-owner state: ${startupPosture.appOwnerState}.` : null,
    startupPosture?.appOwnerOwned === true ? "Desktop runtime app owner currently owns the desktop main-process facade." : null,
    startupPosture?.appOwnerActive === true ? "Desktop runtime app owner remains active." : null,
    startupPosture?.shellOwnerState ? `Current desktop runtime shell-owner state: ${startupPosture.shellOwnerState}.` : null,
    startupPosture?.shellOwnerOwned === true ? "Desktop runtime shell owner currently owns the desktop shell facade." : null,
    startupPosture?.shellOwnerActive === true ? "Desktop runtime shell owner remains active." : null,
    startupPosture?.processHostState ? `Current desktop runtime process-host state: ${startupPosture.processHostState}.` : null,
    startupPosture?.processHostOwned === true ? "Desktop runtime process host currently owns the desktop main-process event bridge." : null,
    startupPosture?.processHostActive === true ? "Desktop runtime process host remains active." : null,
    startupPosture?.processEventType ? `Last desktop process event: ${startupPosture.processEventType}.` : null,
    startupPosture?.processEventSource ? `Desktop process event source: ${startupPosture.processEventSource}.` : null,
    startupPosture?.lastProcessEventAt ? `Last desktop process event recorded at: ${startupPosture.lastProcessEventAt}.` : null,
    startupPosture?.nativeProcessEventType ? `Last native desktop process event: ${startupPosture.nativeProcessEventType}.` : null,
    startupPosture?.nativeProcessEventSource ? `Native desktop process event source: ${startupPosture.nativeProcessEventSource}.` : null,
    startupPosture?.desktopHostPlatform ? `Desktop host platform: ${startupPosture.desktopHostPlatform}.` : null,
    startupPosture?.nativeProcessIngressSource
      ? `Native desktop process ingress source: ${startupPosture.nativeProcessIngressSource}.`
      : null,
    startupPosture?.lastNativeProcessEventAt ? `Last native desktop process event recorded at: ${startupPosture.lastNativeProcessEventAt}.` : null,
    startupPosture?.nativeLocalActionTransportSource
      ? `Native desktop local-action transport source: ${startupPosture.nativeLocalActionTransportSource}.`
      : null,
    startupPosture?.nativeLocalActionExecutionSource
      ? `Native desktop local-action execution source: ${startupPosture.nativeLocalActionExecutionSource}.`
      : null,
    typeof startupPosture?.pendingNativeActionCount === "number"
      ? `Pending native local actions: ${startupPosture.pendingNativeActionCount}.`
      : null,
    startupPosture?.nativeLocalActionDeliverySummary?.trim()
      ? startupPosture.nativeLocalActionDeliverySummary.trim()
      : null,
    startupPosture?.nativeLocalActionResultSummary?.trim()
      ? startupPosture.nativeLocalActionResultSummary.trim()
      : null,
    startupPosture?.lastNativeLocalActionExecutionAt
      ? `Last native desktop local-action execution recorded at: ${startupPosture.lastNativeLocalActionExecutionAt}.`
      : null,
    startupPosture?.nativeLocalActionExecutionSummary?.trim()
      ? startupPosture.nativeLocalActionExecutionSummary.trim()
      : null,
    startupPosture?.nativeLocalActionCapabilitySummary?.trim()
      ? startupPosture.nativeLocalActionCapabilitySummary.trim()
      : null,
    startupPosture?.lastStartAt ? `Last desktop bootstrap start: ${startupPosture.lastStartAt}.` : null,
    startupPosture?.lastWakeAt ? `Last desktop bootstrap wake: ${startupPosture.lastWakeAt}.` : null,
    startupPosture?.lastForegroundAt ? `Last desktop process-host foreground: ${startupPosture.lastForegroundAt}.` : null,
    startupPosture?.lastBackgroundAt ? `Last desktop app-owner background: ${startupPosture.lastBackgroundAt}.` : null,
    startupPosture?.lastStopAt ? `Last desktop bootstrap stop: ${startupPosture.lastStopAt}.` : null,
    startupPosture?.bootstrapSummary?.trim() ? startupPosture.bootstrapSummary.trim() : null,
    startupPosture?.appOwnerSummary?.trim() ? startupPosture.appOwnerSummary.trim() : null,
    startupPosture?.shellOwnerSummary?.trim() ? startupPosture.shellOwnerSummary.trim() : null,
    startupPosture?.processHostSummary?.trim() ? startupPosture.processHostSummary.trim() : null,
    startupPosture?.processEventSummary?.trim() ? startupPosture.processEventSummary.trim() : null,
    startupPosture?.nativeProcessEventSummary?.trim() ? startupPosture.nativeProcessEventSummary.trim() : null,
  ].filter((value): value is string => Boolean(value));
  return fragments.length ? fragments.join(" ") : null;
}

function describeDesktopStartupActionLabel(
  startupPosture: ShellLocalBridgeStatusResponse["startupPosture"] | null | undefined,
  healthFeed: ShellLocalBridgeStatusResponse["healthFeed"] | null | undefined,
  mode: "review" | "inspect",
): string {
  const decision = resolveShellDesktopIntegrationReviewDecision({
    adapterMode: startupPosture?.mode,
    startupSource: startupPosture?.startupSource,
    moduleStatus: startupPosture?.moduleStatus,
    providerStatus: startupPosture?.providerStatus,
    healthStatus: startupPosture?.healthStatus,
    stalenessStatus: healthFeed?.stalenessStatus,
    freshnessReason: healthFeed?.freshnessReason,
    attached: startupPosture?.attached,
    readiness: startupPosture?.adapterReadiness,
  });
  return decision.actionMode === mode
    ? decision.actionLabel
    : resolveShellDesktopIntegrationActionLabel({
      startupSource: startupPosture?.startupSource,
      moduleStatus: startupPosture?.moduleStatus,
      healthStatus: startupPosture?.healthStatus,
      stalenessStatus: healthFeed?.stalenessStatus,
      mode,
    });
}

function describeDesktopStartupRecommendedActionContext(
  startupPosture: ShellLocalBridgeStatusResponse["startupPosture"] | null | undefined,
  healthFeed: ShellLocalBridgeStatusResponse["healthFeed"] | null | undefined,
): string | null {
  if (!startupPosture) {
    return null;
  }
  return `Next action: ${describeDesktopStartupActionLabel(
    startupPosture,
    healthFeed,
    resolveDesktopStartupActionMode(startupPosture, healthFeed),
  )}.`;
}

function resolveDesktopStartupActionMode(
  startupPosture: ShellLocalBridgeStatusResponse["startupPosture"] | null | undefined,
  healthFeed: ShellLocalBridgeStatusResponse["healthFeed"] | null | undefined,
): "review" | "inspect" {
  return resolveShellDesktopIntegrationReviewDecision({
    adapterMode: startupPosture?.mode,
    startupSource: startupPosture?.startupSource,
    moduleStatus: startupPosture?.moduleStatus,
    providerStatus: startupPosture?.providerStatus,
    healthStatus: startupPosture?.healthStatus,
    stalenessStatus: healthFeed?.stalenessStatus,
    freshnessReason: healthFeed?.freshnessReason,
    attached: startupPosture?.attached,
    readiness: startupPosture?.adapterReadiness,
  }).actionMode;
}

function buildGatewayOnboardingState(
  client: GatewayRequestHandlerOptions["client"] | null,
  tenantContext: SanjinTenantContext,
  env: NodeJS.ProcessEnv = process.env,
  localBridgeStatus: ShellLocalBridgeStatusResponse = buildLocalBridgeStatusPayload(),
): ShellOnboardingState {
  const shellAccess = buildShellAccessPayload(client, env);
  const desktopIntegration = buildDesktopIntegrationSummary(localBridgeStatus);
  if (shellAccess.required && !shellAccess.granted) {
    return {
      phase: "accessGate",
      title: "Access Gate Required",
      summary: shellAccess.operatorLabel
        ? `Gateway access is still gated for ${shellAccess.operatorLabel}. Once approved, the shell can enter workspace ${tenantContext.workspaceId}.`
        : `Gateway access is still gated. Once approved, the shell can enter workspace ${tenantContext.workspaceId}.`,
      target: {
        panel: "workbench",
      },
      desktopIntegration,
      preferredWorkspaceId: null,
      currentWorkspaceId: tenantContext.workspaceId,
      operatorLabel: shellAccess.operatorLabel ?? tenantContext.userId,
      lastExitPanel: null,
      lastExitSessionKey: null,
      lastExitFocusHint: null,
    };
  }
  if (desktopIntegrationNeedsAttention(desktopIntegration)) {
    const desktopStartupOrigin = describeDesktopStartupOrigin(localBridgeStatus.startupPosture);
    const desktopStartupModuleContext = describeDesktopStartupModuleContext(localBridgeStatus.startupPosture);
    const desktopStartupModuleStatus = describeDesktopStartupModuleStatusContext(
      localBridgeStatus.startupPosture,
    );
    const desktopStartupProvider = describeDesktopStartupProviderContext(
      localBridgeStatus.startupPosture,
    );
    const desktopStartupProviderStatus = describeDesktopStartupProviderStatusContext(
      localBridgeStatus.startupPosture,
    );
    const desktopStartupHealth = describeDesktopStartupHealthContext(
      localBridgeStatus.startupPosture,
    );
    const desktopStartupHealthFeed = describeDesktopStartupHealthFeedContext(
      localBridgeStatus.healthFeed,
      localBridgeStatus.startupPosture,
    );
    const desktopStartupRuntime = describeDesktopStartupRuntimeContext(localBridgeStatus.startupPosture);
    const desktopStartupDriver = describeDesktopStartupDriverContext(localBridgeStatus.startupPosture);
    const desktopStartupTimer = describeDesktopStartupTimerContext(localBridgeStatus.startupPosture);
    const desktopStartupRunner = describeDesktopStartupRunnerContext(localBridgeStatus.startupPosture);
    const desktopStartupNextAction = describeDesktopStartupRecommendedActionContext(
      localBridgeStatus.startupPosture,
      localBridgeStatus.healthFeed,
    );
    return {
      phase: "workbenchLanding",
      title: "Workbench Landing",
      summary: `Gateway access is ready, but ${desktopStartupOrigin} still needs desktop integration review before native local-action work surfaces should lead shell entry.${desktopStartupModuleContext ? ` ${desktopStartupModuleContext}` : ""}${desktopStartupModuleStatus ? ` ${desktopStartupModuleStatus}` : ""}${desktopStartupProvider ? ` ${desktopStartupProvider}` : ""}${desktopStartupProviderStatus ? ` ${desktopStartupProviderStatus}` : ""}${desktopStartupHealth ? ` ${desktopStartupHealth}` : ""}${desktopStartupHealthFeed ? ` ${desktopStartupHealthFeed}` : ""}${desktopStartupRuntime ? ` ${desktopStartupRuntime}` : ""}${desktopStartupDriver ? ` ${desktopStartupDriver}` : ""}${desktopStartupTimer ? ` ${desktopStartupTimer}` : ""}${desktopStartupRunner ? ` ${desktopStartupRunner}` : ""}${desktopStartupNextAction ? ` ${desktopStartupNextAction}` : ""}`,
      target: {
        panel: "settings",
      },
      desktopIntegration,
      preferredWorkspaceId: null,
      currentWorkspaceId: tenantContext.workspaceId,
      operatorLabel: shellAccess.operatorLabel ?? tenantContext.userId,
      lastExitPanel: null,
      lastExitSessionKey: null,
      lastExitFocusHint: null,
    };
  }
  if (desktopIntegrationNeedsHealthReview(desktopIntegration)) {
    const desktopStartupOrigin = describeDesktopStartupOrigin(localBridgeStatus.startupPosture);
    const desktopStartupModuleContext = describeDesktopStartupModuleContext(localBridgeStatus.startupPosture);
    const desktopStartupModuleStatus = describeDesktopStartupModuleStatusContext(
      localBridgeStatus.startupPosture,
    );
    const desktopStartupProvider = describeDesktopStartupProviderContext(
      localBridgeStatus.startupPosture,
    );
    const desktopStartupProviderStatus = describeDesktopStartupProviderStatusContext(
      localBridgeStatus.startupPosture,
    );
    const desktopStartupHealth = describeDesktopStartupHealthContext(
      localBridgeStatus.startupPosture,
    );
    const desktopStartupHealthFeed = describeDesktopStartupHealthFeedContext(
      localBridgeStatus.healthFeed,
      localBridgeStatus.startupPosture,
    );
    const desktopStartupRuntime = describeDesktopStartupRuntimeContext(localBridgeStatus.startupPosture);
    const desktopStartupDriver = describeDesktopStartupDriverContext(localBridgeStatus.startupPosture);
    const desktopStartupTimer = describeDesktopStartupTimerContext(localBridgeStatus.startupPosture);
    const desktopStartupRunner = describeDesktopStartupRunnerContext(localBridgeStatus.startupPosture);
    const desktopStartupNextAction = describeDesktopStartupRecommendedActionContext(
      localBridgeStatus.startupPosture,
      localBridgeStatus.healthFeed,
    );
    return {
      phase: "workbenchLanding",
      title: "Workbench Landing",
      summary: `Gateway access is ready for workspace ${tenantContext.workspaceId}, and ${desktopStartupOrigin} can keep work surfaces open while desktop health stays under review.${desktopStartupModuleContext ? ` ${desktopStartupModuleContext}` : ""}${desktopStartupModuleStatus ? ` ${desktopStartupModuleStatus}` : ""}${desktopStartupProvider ? ` ${desktopStartupProvider}` : ""}${desktopStartupProviderStatus ? ` ${desktopStartupProviderStatus}` : ""}${desktopStartupHealth ? ` ${desktopStartupHealth}` : ""}${desktopStartupHealthFeed ? ` ${desktopStartupHealthFeed}` : ""}${desktopStartupRuntime ? ` ${desktopStartupRuntime}` : ""}${desktopStartupDriver ? ` ${desktopStartupDriver}` : ""}${desktopStartupTimer ? ` ${desktopStartupTimer}` : ""}${desktopStartupRunner ? ` ${desktopStartupRunner}` : ""}${desktopStartupNextAction ? ` ${desktopStartupNextAction}` : ""}`,
      target: {
        panel: "workbench",
      },
      desktopIntegration,
      preferredWorkspaceId: null,
      currentWorkspaceId: tenantContext.workspaceId,
      operatorLabel: shellAccess.operatorLabel ?? tenantContext.userId,
      lastExitPanel: null,
      lastExitSessionKey: null,
      lastExitFocusHint: null,
    };
  }
  return {
    phase: "workbenchLanding",
    title: "Workbench Landing",
    summary: `Gateway access is ready for workspace ${tenantContext.workspaceId}. The shell can continue into tenant work surfaces and let client-side re-entry rules choose the exact landing target.`,
    target: {
      panel: "workbench",
    },
    desktopIntegration,
    preferredWorkspaceId: null,
    currentWorkspaceId: tenantContext.workspaceId,
    operatorLabel: shellAccess.operatorLabel ?? tenantContext.userId,
    lastExitPanel: null,
    lastExitSessionKey: null,
    lastExitFocusHint: null,
  };
}

function normalizeDraftScope(
  rawScope: string,
  tenantContext: SanjinTenantContext,
): ShellDraftScopeLabel {
  const scope = rawScope.trim().toLowerCase();
  if (!scope) {
    return "workspace";
  }
  if (
    SHELL_DRAFT_SCOPE_OPTIONS.includes(scope as ShellDraftScopeLabel)
  ) {
    return scope as ShellDraftScopeLabel;
  }
  if (scope === "project" || scope === "team") {
    return "workspace";
  }
  if (scope === "session" || scope === "local" || scope === "user") {
    return "personal";
  }
  if (scope === "managed" || scope === "tenant") {
    return "org";
  }
  return tenantContext.workspaceId ? "workspace" : "org";
}

function describeCapabilityScope(
  scopeLabel: string,
  tenantContext: SanjinTenantContext,
): string {
  const detailByScope: Record<string, string> = {
    core: "Core capabilities are globally managed and not editable from this pilot shell.",
    org: `Organization scope belongs to ${tenantContext.orgId} and can roll out inside the tenant boundary.`,
    workspace: `Workspace scope is anchored to ${tenantContext.workspaceId} and is where tenant-local capability evolution begins.`,
    personal: `Personal scope belongs to ${tenantContext.userId} and should stay isolated from shared rollout policy.`,
  };
  return (
    detailByScope[scopeLabel]
    ?? `${scopeLabel} scope is available inside the current tenant boundary.`
  );
}

function resolveWorkspaceDir(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.OPENCLAW_WORKSPACE_DIR?.trim();
  if (explicit) {
    return explicit;
  }
  return path.join(resolveStateDir(env), "workspace");
}

function resolveSanjinRoot(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveWorkspaceDir(env), "sanjin");
}

function resolveTenantContext(
  env: NodeJS.ProcessEnv = process.env,
  client: GatewayRequestHandlerOptions["client"] | null = null,
): SanjinTenantContext {
  const workspacePool = getAvailableWorkspaceIds(env);
  const defaultWorkspaceId = workspacePool[0] ?? "default-workspace";
  const selectedWorkspaceId = SHELL_SELECTED_WORKSPACES.get(getShellSelectionKey(client, env));
  const workspaceId =
    selectedWorkspaceId && workspacePool.includes(selectedWorkspaceId)
      ? selectedWorkspaceId
      : defaultWorkspaceId;
  return {
    orgId: env.OPENCLAW_SANJIN_ORG_ID?.trim() || "local-org",
    workspaceId,
    userId: env.OPENCLAW_SANJIN_USER_ID?.trim() || "local-operator",
    isolationModel: "org / workspace / user",
    writeBoundary: "tenant_local_only",
    promotionBoundary: "governed_cross_tenant_only",
  };
}

function buildBrainAccessSurface(
  tenantContext: SanjinTenantContext,
  input?: Partial<Omit<ShellBrainAccessSourceInput, "tenantContext" | "generatedAt">> & {
    generatedAt?: string;
  },
): ShellBrainAccessSurface {
  return buildShellBrainAccessSurface({
    generatedAt: input?.generatedAt ?? new Date().toISOString(),
    tenantContext,
    sourceFiles: input?.sourceFiles ?? [],
    explainView: input?.explainView ?? null,
    observability: input?.observability ?? null,
    latestGovernanceReview: input?.latestGovernanceReview ?? null,
    capabilityRegistry: input?.capabilityRegistry ?? null,
    pilotFlows: input?.pilotFlows ?? [],
    promotionRequests: input?.promotionRequests ?? [],
  });
}

function buildTenantMemoryBoundary(
  tenantContext: SanjinTenantContext,
): ShellTenantMemoryBoundary {
  return {
    defaultWriteTarget: "tenant_local_memory",
    directBrainWriteAllowed: false,
    rawTenantMemoryReadableByBrain: false,
    promotionPathSummary: "abstract -> review -> gate -> rollout",
    summary:
      `Tenant memory for workspace ${tenantContext.workspaceId} stays local first. Only abstracted structural evidence may become a governed promotion candidate for the shared Sanjin brain.`,
    layers: [
      {
        layerId: "tenant_local_memory",
        label: "Tenant Local Memory",
        writePolicy: "default_write_target",
        readableByBrain: false,
        promotionEligible: false,
        detail:
          "Raw tenant facts, private business context, and workspace execution traces remain inside the tenant boundary and never flow directly into the shared brain.",
      },
      {
        layerId: "abstracted_structural_evidence",
        label: "Abstracted Structural Evidence",
        writePolicy: "derived_review_candidate",
        readableByBrain: true,
        promotionEligible: true,
        detail:
          "Repeated structural patterns, execution strategies, and governance-verifiable evidence can be abstracted for review without carrying raw tenant memory upward.",
      },
      {
        layerId: "sanjin_promoted_capability_knowledge",
        label: "Sanjin Promoted Capability Knowledge",
        writePolicy: "governed_promotion_only",
        readableByBrain: true,
        promotionEligible: false,
        detail:
          "Only promotion-approved capability knowledge reaches the shared Sanjin layer, after review, gate checks, and rollout control have completed.",
      },
    ],
    auditEvents: [
      {
        eventId: "tenant_write_local",
        label: "Tenant Write Local",
        detail:
          "Record when team shells write new tenant-local traces, memory, or operator artifacts that must remain scoped to the tenant.",
      },
      {
        eventId: "abstract_for_review",
        label: "Abstract For Review",
        detail:
          "Record when tenant-local experience is distilled into structural evidence for governance review.",
      },
      {
        eventId: "promotion_rejected",
        label: "Promotion Rejected",
        detail:
          "Record when a promotion candidate is blocked so the abstracted evidence does not enter shared Sanjin knowledge.",
      },
      {
        eventId: "promotion_admitted",
        label: "Promotion Admitted",
        detail:
          "Record when a candidate clears review, gate, and rollout so it may enter shared capability knowledge.",
      },
    ],
  };
}

function buildGovernancePermissionModel(
  tenantContext: SanjinTenantContext,
): ShellGovernancePermissionModel {
  return {
    summary:
      `Governance is split between brain owners, tenant admins, and tenant operators so team shells can operate within tenant scope without gaining policy rewrite authority over the shared Sanjin brain.`,
    promotionPathSummary: "tenant review -> promotion request -> brain gate -> rollout",
    roles: [
      {
        roleId: "brain_owner",
        label: "Brain Owner",
        summary:
          "Owns shared Sanjin policy, promotion semantics, and global rollout posture across tenants.",
        allowedActions: [
          "change_goal_os_policy",
          "change_skill_os_policy",
          "approve_cross_tenant_promotion",
          "manage_global_rollout",
        ],
        deniedActions: [
          "bypass_tenant_audit_trail",
        ],
      },
      {
        roleId: "tenant_admin",
        label: "Tenant Admin",
        summary:
          `Configures tenant workspace defaults, audit visibility, and shell posture for ${tenantContext.orgId} without changing shared brain policy.`,
        allowedActions: [
          "manage_tenant_workspace_binding",
          "review_tenant_audit_entries",
          "configure_tenant_shell_defaults",
        ],
        deniedActions: [
          "rewrite_brain_policy",
          "directly_promote_cross_tenant_capabilities",
        ],
      },
      {
        roleId: "tenant_operator",
        label: "Tenant Operator",
        summary:
          `Uses the shell to run work, inspect reviews, and submit promotion requests for ${tenantContext.workspaceId}.`,
        allowedActions: [
          "run_tenant_sessions",
          "review_local_results",
          "submit_promotion_request",
        ],
        deniedActions: [
          "rewrite_brain_policy",
          "bypass_governance_gate",
          "read_other_tenant_memory",
        ],
      },
    ],
    governanceSurfaces: [
      {
        surfaceId: "brain_governance",
        label: "Brain-Level Governance",
        detail:
          "Global promotion policy, capability admission, and rollout semantics stay with brain owners and are never rewritten from tenant shells.",
      },
      {
        surfaceId: "tenant_review",
        label: "Tenant-Level Review",
        detail:
          "Operators and tenant admins may inspect tenant traces, review evidence, and prepare promotion requests inside the tenant boundary.",
      },
      {
        surfaceId: "cross_tenant_promotion",
        label: "Cross-Tenant Promotion",
        detail:
          "Only abstracted, approved structural evidence may pass from tenant review into shared Sanjin capability knowledge.",
      },
    ],
  };
}

function readJsonFile(filePath: string): JsonObject | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as JsonObject;
  } catch {
    return null;
  }
}

function listFiles(dirPath: string, predicate: (name: string) => boolean): string[] {
  try {
    return fs
      .readdirSync(dirPath)
      .filter(predicate)
      .map((name) => path.join(dirPath, name))
      .sort((left, right) => {
        const leftMtime = fs.statSync(left).mtimeMs;
        const rightMtime = fs.statSync(right).mtimeMs;
        return rightMtime - leftMtime;
      });
  } catch {
    return [];
  }
}

function findLatestJson(dirPath: string, prefix: string): string | null {
  return listFiles(dirPath, (name) => name.startsWith(prefix) && name.endsWith(".json"))[0] ?? null;
}

function readLatestJson(dirPath: string, prefix: string): JsonObject | null {
  const filePath = findLatestJson(dirPath, prefix);
  return filePath ? readJsonFile(filePath) : null;
}

function latestJsonWithPath(
  dirPath: string,
  prefix: string,
): { path: string | null; payload: JsonObject | null } {
  const filePath = findLatestJson(dirPath, prefix);
  return {
    path: filePath,
    payload: filePath ? readJsonFile(filePath) : null,
  };
}

function readLatestJsonlRow(filePath: string): JsonObject | null {
  try {
    const lines = fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return null;
    }
    return JSON.parse(lines[lines.length - 1] ?? "{}") as JsonObject;
  } catch {
    return null;
  }
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value == null) {
    return "";
  }
  return JSON.stringify(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

async function invokeGatewayHandler(params: {
  handler: GatewayRequestHandlers[string];
  method: string;
  params?: Record<string, unknown>;
  req: GatewayRequestHandlerOptions["req"];
  client: GatewayRequestHandlerOptions["client"];
  isWebchatConnect: GatewayRequestHandlerOptions["isWebchatConnect"];
  context: GatewayRequestHandlerOptions["context"];
}) {
  let captured:
    | {
        ok: boolean;
        payload?: unknown;
        error?: unknown;
        meta?: Record<string, unknown>;
      }
    | undefined;
  await params.handler({
    req: {
      ...params.req,
      method: params.method,
      params: params.params ?? {},
    },
    params: params.params ?? {},
    client: params.client,
    isWebchatConnect: params.isWebchatConnect,
    respond: (ok, payload, error, meta) => {
      captured = { ok, payload, error, meta };
    },
    context: params.context,
  });
  if (!captured) {
    throw new Error(`handler did not respond: ${params.method}`);
  }
  if (!captured.ok) {
    const message =
      captured.error && typeof captured.error === "object" && "message" in captured.error
        ? stringifyValue((captured.error as { message?: unknown }).message)
        : `handler failed: ${params.method}`;
    throw new Error(message || `handler failed: ${params.method}`);
  }
  return captured;
}

function metric(label: string, value: unknown) {
  return { label, value: stringifyValue(value) };
}

function distributionItems(input: unknown): Array<{ label: string; value: string }> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return [];
  }
  return Object.entries(input as Record<string, unknown>).map(([label, value]) => metric(label, value));
}

function readCoreSources() {
  const sanjinRoot = resolveSanjinRoot();
  const reportsDir = path.join(sanjinRoot, "memory", "reports");
  const artifactsDir = path.join(sanjinRoot, "eval", "artifacts");
  const capabilitiesDir = path.join(sanjinRoot, "memory", "capabilities");
  const latestRerun = latestJsonWithPath(reportsDir, "benchmark_rerun_");
  const observability = readJsonFile(path.join(reportsDir, "observability_summary.json"));
  const observabilityPath = path.join(reportsDir, "observability_summary.json");
  const stabilityTrend = latestJsonWithPath(reportsDir, "stability_trend_panel_");
  const productionSkillTrend = latestJsonWithPath(reportsDir, "production_skill_trend_panel_");
  const goalOsExplainViewPath = path.join(reportsDir, "goal_os_explain_view.json");
  const goalOsExplainView = readJsonFile(goalOsExplainViewPath);
  const capabilityRegistryPath = path.join(capabilitiesDir, "registry.json");
  const capabilityRegistry = readJsonFile(capabilityRegistryPath);
  const governanceReviewsPath = path.join(artifactsDir, "governance_reviews.jsonl");
  const promotionRequestsPath = resolveTenantPromotionRequestsPath({ sanjinRoot });
  const latestGovernanceReview = readLatestJsonlRow(governanceReviewsPath);
  return {
    sanjinRoot,
    reportsDir,
    latestRerun,
    observability,
    observabilityPath,
    stabilityTrend,
    productionSkillTrend,
    goalOsExplainView,
    goalOsExplainViewPath,
    capabilityRegistry,
    capabilityRegistryPath,
    governanceReviewsPath,
    promotionRequestsPath,
    latestGovernanceReview,
  };
}

function sourceFiles(files: Array<string | null | undefined>) {
  return files.filter((filePath): filePath is string => Boolean(filePath));
}

function countCapabilityEntriesByStage(
  entries: Array<Record<string, unknown>>,
  stage: string,
): number {
  return entries.filter((entry) => stringifyValue(entry.admission_stage) === stage).length;
}

function resolveCapabilityScope(
  entry: Record<string, unknown>,
  tenantContext: SanjinTenantContext,
): string {
  const metadata =
    entry.metadata && typeof entry.metadata === "object"
      ? (entry.metadata as Record<string, unknown>)
      : {};
  const explicitScope = stringifyValue(entry.scope || metadata.scope);
  if (explicitScope) {
    return explicitScope;
  }
  const sourceRegistry = stringifyValue(entry.source_registry);
  if (sourceRegistry === "skill_registry") {
    return "core";
  }
  if (sourceRegistry === "subagent_registry" || sourceRegistry === "extension_catalog") {
    return "org";
  }
  if (sourceRegistry === "capability_pack") {
    return "workspace";
  }
  return tenantContext.workspaceId ? "workspace" : "tenant";
}

function buildScopeSummary(
  entries: Array<Record<string, unknown>>,
  tenantContext: SanjinTenantContext,
) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const scopeLabel = resolveCapabilityScope(entry, tenantContext);
    counts.set(scopeLabel, (counts.get(scopeLabel) ?? 0) + 1);
  }
  const order = ["workspace", "org", "core", "personal"];
  return Array.from(counts.entries())
    .sort((left, right) => {
      const leftIndex = order.indexOf(left[0]);
      const rightIndex = order.indexOf(right[0]);
      return (leftIndex === -1 ? order.length : leftIndex) - (rightIndex === -1 ? order.length : rightIndex);
    })
    .map(([scopeLabel, count]) => ({
      scopeLabel,
      count,
      detail: describeCapabilityScope(scopeLabel, tenantContext),
    }));
}

function buildPilotFlow(
  entry: Record<string, unknown>,
  tenantContext: SanjinTenantContext,
): SanjinPilotFlowPayload {
  const currentStage = stringifyValue(entry.admission_stage || "draft");
  const stageSequence = ["draft", "schema_validated", "sampled", "candidate", "limited_active"];
  const stageIndex = Math.max(stageSequence.indexOf(currentStage), 0);
  const completedSteps = Math.min(stageIndex + 1, stageSequence.length);
  const nextAction = derivePilotFlowNextAction(currentStage);
  return {
    capabilityId: stringifyValue(entry.capability_id || "unknown"),
    displayName: stringifyValue(entry.display_name || "unknown"),
    capabilityType: stringifyValue(entry.capability_type || "unknown"),
    scopeLabel: resolveCapabilityScope(entry, tenantContext),
    currentStage,
    status: stringifyValue(entry.status || "unknown"),
    progressLabel: `${completedSteps}/${stageSequence.length}`,
    stageSummary: derivePilotFlowStageSummary(currentStage),
    governanceMode: stringifyValue(entry.governance_policy || "candidate_only"),
    nextActionLabel: nextAction.label,
    nextActionMethod: nextAction.method,
  };
}

function buildCapabilityListEntry(
  entry: Record<string, unknown>,
  tenantContext: SanjinTenantContext,
): ShellCapabilityListEntry {
  return {
    capabilityId: stringifyValue(entry.capability_id || "unknown"),
    capabilityType: stringifyValue(entry.capability_type || "unknown"),
    displayName: stringifyValue(entry.display_name || "unknown"),
    scopeLabel: resolveCapabilityScope(entry, tenantContext),
    status: stringifyValue(entry.status || "unknown"),
    admissionStage: stringifyValue(entry.admission_stage || "unknown"),
    sourceRegistry: stringifyValue(entry.source_registry || "unknown"),
    preferredSubagent: stringifyValue(entry.preferred_subagent || ""),
    sampleRunCount: stringifyValue(entry.sample_run_count || 0),
  };
}

function derivePilotFlowNextAction(stage: string) {
  if (stage === "draft") {
    return {
      label: "Run Capability Schema Validation",
      method: "sanjin.runCapabilitySchemaValidation",
    };
  }
  if (stage === "schema_validated") {
    return {
      label: "Run Capability Sample Runs",
      method: "sanjin.runCapabilitySampleRuns",
    };
  }
  if (stage === "sampled") {
    return {
      label: "Promote Ready Candidates",
      method: "sanjin.runCapabilityCandidatePromotion",
    };
  }
  if (stage === "candidate") {
    return {
      label: "Promote Limited Active",
      method: "sanjin.runCapabilityLimitedActivePromotion",
    };
  }
  if (stage === "limited_active") {
    return {
      label: "Run Limited Active Observation",
      method: "sanjin.runCapabilityLimitedActiveObservation",
    };
  }
  return {
    label: "Run Capability Admission Review",
    method: "sanjin.runCapabilityAdmissionReview",
  };
}

function derivePilotFlowStageSummary(stage: string): string {
  if (stage === "draft") {
    return "Draft is still shaping its contract and has not entered validation yet.";
  }
  if (stage === "schema_validated") {
    return "Schema validation passed; the next step is proving the workflow in sample runs.";
  }
  if (stage === "sampled") {
    return "Sample runs are landing; the workflow is ready to enter candidate promotion review.";
  }
  if (stage === "candidate") {
    return "Candidate evidence exists, but rollout is still gated and tenant-local.";
  }
  if (stage === "limited_active") {
    return "Limited active rollout is open; keep it under observation before broader promotion.";
  }
  return "This workflow is already beyond the first pilot funnel.";
}

function parseJsonObject(text: string): JsonObject | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const payload = JSON.parse(trimmed) as unknown;
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      return payload as JsonObject;
    }
  } catch {
    return null;
  }
  return null;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "untitled-capability";
}

function runSanjinScript(scriptRelativePath: string, inputPayload?: Record<string, unknown>): SanjinScriptResult {
  const workspaceDir = resolveWorkspaceDir();
  const sanjinRoot = resolveSanjinRoot();
  const scriptPath = path.join(sanjinRoot, scriptRelativePath);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`missing Sanjin script: ${scriptPath}`);
  }
  const result = spawnSync("python3", [scriptPath], {
    cwd: sanjinRoot,
    encoding: "utf8",
    timeout: 120_000,
    input: inputPayload ? JSON.stringify(inputPayload) : undefined,
    env: {
      ...process.env,
      OPENCLAW_WORKSPACE_DIR: workspaceDir,
    },
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `${scriptRelativePath} failed (${result.status}): ${(result.stderr || result.stdout || "").trim()}`,
    );
  }
  const payload = parseJsonObject(result.stdout ?? "");
  return {
    script: scriptRelativePath,
    jsonPath: typeof payload?.json_path === "string" ? payload.json_path : null,
    mdPath: typeof payload?.md_path === "string" ? payload.md_path : null,
    snapshotHistoryPath:
      typeof (payload?.snapshot_history as JsonObject | undefined)?.path === "string"
        ? ((payload?.snapshot_history as JsonObject).path as string)
        : null,
    appendedSnapshot:
      typeof (payload?.snapshot_history as JsonObject | undefined)?.appended === "boolean"
        ? String((payload?.snapshot_history as JsonObject).appended)
        : null,
    sourceFiles: Array.isArray(payload?.source_files)
      ? payload.source_files.filter((value): value is string => typeof value === "string")
      : null,
    benchmarkRunId: typeof payload?.benchmark_run_id === "string" ? payload.benchmark_run_id : null,
  };
}

function buildOverviewPayload() {
  const { sanjinRoot, latestRerun, observability, observabilityPath } = readCoreSources();
  const qualityScores = (latestRerun.payload?.quality_scores ?? {}) as Record<string, JsonObject>;
  const robustness = qualityScores.robustness ?? {};
  const antiShortcut = qualityScores.anti_shortcut ?? {};
  const observabilitySummary = observability ?? {};
  const skillGov = (observabilitySummary.skill_governance_summary ?? {}) as JsonObject;
  const permissionGate = (observabilitySummary.permission_gate_summary ?? {}) as JsonObject;
  const recovery = (observabilitySummary.runtime_recovery_summary ?? {}) as JsonObject;
  const action = (observabilitySummary.action_layer_summary ?? {}) as JsonObject;
  const governanceWindow = (observabilitySummary.governance_window ?? {}) as JsonObject;

  return {
    generatedAt: new Date().toISOString(),
    sanjinRoot,
    benchmarkRunId: latestRerun.payload?.run_id ?? null,
    sourceFiles: sourceFiles([latestRerun.path, observabilityPath]),
    cards: [
      {
        title: "Benchmark",
        metrics: [
          metric("robustness", `${robustness.passed ?? 0}/${robustness.total ?? 0}`),
          metric("anti_shortcut", `${antiShortcut.passed ?? 0}/${antiShortcut.total ?? 0}`),
          metric("latest_run", latestRerun.payload?.run_id ?? "unknown"),
        ],
      },
      {
        title: "Host Signals",
        metrics: [
          metric("permission_gate_blocked", permissionGate.blocked_count ?? 0),
          metric("runtime_recovery", recovery.recovery_governance_label ?? "unknown"),
          metric("action_layer", action.action_governance_label ?? "unknown"),
          metric("skill_healthy", (skillGov.governance_distribution as Record<string, unknown> | undefined)?.healthy ?? 0),
          metric("hook_events", (observabilitySummary.hook_event_summary as Record<string, unknown> | undefined)?.count ?? 0),
        ],
      },
      {
        title: "Governance Window",
        metrics: distributionItems(governanceWindow),
      },
    ],
    modeDistribution: distributionItems(latestRerun.payload?.new_mode_distribution),
    guardDistribution: distributionItems(latestRerun.payload?.guard_distribution),
  };
}

function buildSkillsPayload() {
  const { productionSkillTrend, observability } = readCoreSources();
  const skillGov = (observability?.skill_governance_summary ?? {}) as JsonObject;
  const window7d =
    ((productionSkillTrend.payload?.windows ?? {}) as Record<string, JsonObject>)["7d"] ?? {};
  const topSkills = (skillGov.top_skills ?? window7d.top_skills ?? []) as Array<Record<string, unknown>>;

  return {
    generatedAt: new Date().toISOString(),
    sourceFiles: sourceFiles([productionSkillTrend.path]),
    cards: [
      {
        title: "Skill Governance",
        metrics: [
          metric("scorecards", skillGov.scorecard_count ?? 0),
          metric("healthy", (skillGov.governance_distribution as Record<string, unknown> | undefined)?.healthy ?? 0),
          metric("observe", (skillGov.governance_distribution as Record<string, unknown> | undefined)?.observe ?? 0),
        ],
      },
      {
        title: "Production Skills (7d)",
        metrics: [
          metric("run_count", window7d.run_count ?? 0),
          metric("healthy", (window7d.status_distribution as Record<string, unknown> | undefined)?.healthy ?? 0),
          metric("tracked_skills", Object.keys((window7d.skill_distribution as Record<string, unknown> | undefined) ?? {}).length),
        ],
      },
    ],
    topSkills: topSkills.slice(0, 7).map((entry) => ({
      name: stringifyValue(entry.skill_name ?? entry.skillName ?? "unknown"),
      totalRuns: stringifyValue(entry.total_runs ?? 0),
      successRate: stringifyValue(entry.success_rate ?? "0"),
      governanceLabel: stringifyValue(entry.governance_label ?? "unknown"),
    })),
  };
}

function buildRuntimePayload() {
  const { observability, observabilityPath, stabilityTrend } = readCoreSources();
  const permissionGate = (observability?.permission_gate_summary ?? {}) as JsonObject;
  const recovery = (observability?.runtime_recovery_summary ?? {}) as JsonObject;
  const action = (observability?.action_layer_summary ?? {}) as JsonObject;
  const trend7d =
    (((stabilityTrend.payload?.windows ?? {}) as Record<string, JsonObject>)["7d"] ?? {}) as JsonObject;

  return {
    generatedAt: new Date().toISOString(),
    sourceFiles: sourceFiles([observabilityPath, stabilityTrend.path]),
    cards: [
      {
        title: "Permission Gate",
        metrics: [
          metric("count", permissionGate.count ?? 0),
          metric("blocked", permissionGate.blocked_count ?? 0),
        ],
        distribution: distributionItems(permissionGate.lane_distribution),
      },
      {
        title: "Runtime Recovery",
        metrics: [
          metric("label", recovery.recovery_governance_label ?? "unknown"),
          metric("traces", recovery.trace_count ?? 0),
          metric("waiting", recovery.waiting_count ?? 0),
          metric("retry", recovery.retry_count ?? 0),
          metric("replan", recovery.replan_triggered_count ?? 0),
        ],
        distribution: distributionItems(recovery.transition_distribution),
      },
      {
        title: "Action Layer",
        metrics: [
          metric("label", action.action_governance_label ?? "unknown"),
          metric("tool_failures", action.tool_failure_count ?? 0),
          metric("specialist_invalid", action.specialist_invalid_count ?? 0),
        ],
        distribution: distributionItems(action.execution_strategy_distribution),
      },
    ],
    trend7d,
  };
}

function buildGovernancePayload() {
  const {
    observability,
    observabilityPath,
    latestGovernanceReview,
    stabilityTrend,
    governanceReviewsPath,
    promotionRequestsPath,
    sanjinRoot,
  } = readCoreSources();
  const governanceWindow = (observability?.governance_window ?? {}) as JsonObject;
  const governanceReviews = (observability?.governance_review_summary ?? {}) as Record<string, JsonObject>;
  const trend7d =
    (((stabilityTrend.payload?.windows ?? {}) as Record<string, JsonObject>)["7d"] ?? {}) as JsonObject;
  const tenantContext = resolveTenantContext();
  const promotionRequests = listTenantPromotionRequestRecords({
    storage: { sanjinRoot },
    tenantContext,
  });
  const submittedCount = promotionRequests.filter((entry) => entry.status === "submitted").length;
  const underReviewCount = promotionRequests.filter((entry) => entry.status === "under_review").length;

  return {
    generatedAt: new Date().toISOString(),
    sourceFiles: sourceFiles([observabilityPath, stabilityTrend.path, governanceReviewsPath, promotionRequestsPath]),
    cards: [
      {
        title: "Governance Window",
        metrics: distributionItems(governanceWindow),
      },
      {
        title: "Latest Review",
        metrics: [
          metric("gp_name", latestGovernanceReview?.gp_name ?? "unknown"),
          metric("recommendation", latestGovernanceReview?.recommendation ?? "unknown"),
          metric("host_label", latestGovernanceReview?.host_governance_label ?? "unknown"),
          metric("review_basis", latestGovernanceReview?.review_basis ?? "unknown"),
        ],
      },
      {
        title: "Promotion Requests",
        metrics: [
          metric("submitted", submittedCount),
          metric("under_review", underReviewCount),
          metric("total", promotionRequests.length),
        ],
      },
    ],
    reviews: Object.entries(governanceReviews).map(([gpName, review]) => ({
      gpName,
      recommendation: stringifyValue(review.recommendation ?? "unknown"),
      hostLabel: stringifyValue(review.host_governance_label ?? "unknown"),
      windowSize: stringifyValue(review.window_size ?? 0),
    })),
    trend7d,
  };
}

function buildCapabilitiesPayload() {
  const { capabilityRegistry, capabilityRegistryPath, reportsDir } = readCoreSources();
  const entries = Array.isArray(capabilityRegistry?.entries)
    ? (capabilityRegistry.entries as Array<Record<string, unknown>>)
    : [];
  const tenantContext = resolveTenantContext();
  const latestAdmissionReview = latestJsonWithPath(reportsDir, "sanjin_capability_admission_review_");
  const byType = new Map<string, number>();
  const byStage = new Map<string, number>();
  const productionSkillCount = entries.filter(
    (entry) => entry.capability_type === "skill" && entry.metadata && typeof entry.metadata === "object"
      && Boolean((entry.metadata as Record<string, unknown>).production_template),
  ).length;
  const activeCount = entries.filter((entry) => entry.admission_stage === "active").length;
  for (const entry of entries) {
    const type = stringifyValue(entry.capability_type || "unknown");
    const stage = stringifyValue(entry.admission_stage || "unknown");
    byType.set(type, (byType.get(type) ?? 0) + 1);
    byStage.set(stage, (byStage.get(stage) ?? 0) + 1);
  }

  const byTypeItems = Array.from(byType.entries()).map(([label, value]) => metric(label, value));
  const byStageItems = Array.from(byStage.entries()).map(([label, value]) => metric(label, value));

  return {
    generatedAt: new Date().toISOString(),
    sourceFiles: sourceFiles([capabilityRegistryPath, latestAdmissionReview.path]),
    cards: [
      {
        title: "Capability Catalog",
        metrics: [
          metric("entries", entries.length),
          metric("active", activeCount),
          metric("production_skills", productionSkillCount),
        ],
      },
      {
        title: "By Type",
        metrics: byTypeItems,
      },
      {
        title: "Admission Stages",
        metrics: byStageItems,
      },
      {
        title: "Latest Admission Review",
        metrics: [
          metric("entry_count", latestAdmissionReview.payload?.entry_count ?? entries.length),
          metric("candidate_count", Array.isArray(latestAdmissionReview.payload?.candidates) ? latestAdmissionReview.payload.candidates.length : 0),
          metric("watch_count", Array.isArray(latestAdmissionReview.payload?.active_watch) ? latestAdmissionReview.payload.active_watch.length : 0),
        ],
      },
    ],
    entries: entries.slice(0, 16).map((entry) => ({
      ...buildCapabilityListEntry(entry, tenantContext),
    })),
  };
}

function buildTenantBootstrapPayload(
  client: GatewayRequestHandlerOptions["client"] | null = null,
): ShellTenantBootstrapResponse {
  const tenantContext = resolveTenantContext(process.env, client);
  const {
    capabilityRegistry,
    capabilityRegistryPath,
    observability,
    observabilityPath,
    goalOsExplainView,
    goalOsExplainViewPath,
    governanceReviewsPath,
    latestGovernanceReview,
    sanjinRoot,
  } =
    readCoreSources();
  const promotionRequests = listTenantPromotionRequestRecords({
    storage: { sanjinRoot },
    tenantContext,
  });
  const brainAccess = buildBrainAccessSurface(tenantContext, {
    sourceFiles: sourceFiles([
      goalOsExplainView ? goalOsExplainViewPath : null,
      observabilityPath,
      governanceReviewsPath,
      capabilityRegistryPath,
    ]),
    explainView: goalOsExplainView,
    observability,
    latestGovernanceReview,
    capabilityRegistry,
    promotionRequests,
  });
  const memoryBoundary = buildTenantMemoryBoundary(tenantContext);
  const governancePermissionModel = buildGovernancePermissionModel(tenantContext);
  return {
    generatedAt: new Date().toISOString(),
    org: {
      orgId: tenantContext.orgId,
      displayName: tenantContext.orgId,
    },
    workspaces: buildWorkspaceListPayload(client),
    user: {
      userId: tenantContext.userId,
      displayName: tenantContext.userId,
    },
    tenantContext,
    brainAccess,
    memoryBoundary,
    governancePermissionModel,
    onboardingState: buildGatewayOnboardingState(client, tenantContext),
  };
}

function buildAuthMePayload(
  client: GatewayRequestHandlerOptions["client"],
): ShellAuthMeResponse {
  const tenantContext = resolveTenantContext(process.env, client);
  const {
    capabilityRegistry,
    capabilityRegistryPath,
    observability,
    observabilityPath,
    goalOsExplainView,
    goalOsExplainViewPath,
    governanceReviewsPath,
    latestGovernanceReview,
    sanjinRoot,
  } =
    readCoreSources();
  const promotionRequests = listTenantPromotionRequestRecords({
    storage: { sanjinRoot },
    tenantContext,
  });
  const brainAccess = buildBrainAccessSurface(tenantContext, {
    sourceFiles: sourceFiles([
      goalOsExplainView ? goalOsExplainViewPath : null,
      observabilityPath,
      governanceReviewsPath,
      capabilityRegistryPath,
    ]),
    explainView: goalOsExplainView,
    observability,
    latestGovernanceReview,
    capabilityRegistry,
    promotionRequests,
  });
  const memoryBoundary = buildTenantMemoryBoundary(tenantContext);
  const governancePermissionModel = buildGovernancePermissionModel(tenantContext);
  return {
    generatedAt: new Date().toISOString(),
    auth: {
      connId: client?.connId,
      role: stringifyValue(client?.connect?.role || "operator"),
      scopes: Array.isArray(client?.connect?.scopes) ? client.connect.scopes : [],
      clientId:
        client?.connect?.client && typeof client.connect.client === "object"
          ? stringifyValue((client.connect.client as { id?: unknown }).id || "")
          : undefined,
    },
    user: {
      userId: tenantContext.userId,
      displayName: tenantContext.userId,
    },
    tenantContext,
    brainAccess,
    memoryBoundary,
    governancePermissionModel,
    onboardingState: buildGatewayOnboardingState(client, tenantContext),
    shellAccess: buildShellAccessPayload(client),
  };
}

function buildAuthLogoutPayload(
  client: GatewayRequestHandlerOptions["client"],
): ShellAuthLogoutResponse {
  SHELL_AUTH_ACCESS.delete(getShellSelectionKey(client));
  const tenantContext = resolveTenantContext(process.env, client);
  return {
    generatedAt: new Date().toISOString(),
    shellAccess: buildShellAccessPayload(client),
    onboardingState: buildGatewayOnboardingState(client, tenantContext),
  };
}

function buildAuthLoginPayload(
  params: Record<string, unknown>,
  client: GatewayRequestHandlerOptions["client"],
): ShellAuthLoginResponse {
  const config = resolveShellAccessConfig(process.env);
  if (!config.required) {
    return buildAuthMePayload(client);
  }
  const inviteCode = stringifyValue((params as ShellAuthLoginRequest).inviteCode).trim();
  if (!inviteCode) {
    throw new Error("inviteCode is required");
  }
  if (inviteCode !== config.inviteCode) {
    throw new Error("invite code is invalid");
  }
  const operatorLabel = stringifyValue((params as ShellAuthLoginRequest).operatorLabel).trim() || null;
  SHELL_AUTH_ACCESS.set(getShellSelectionKey(client), {
    operatorLabel,
    grantedAt: new Date().toISOString(),
  });
  return buildAuthMePayload(client);
}

function buildWorkspaceListPayload(
  client: GatewayRequestHandlerOptions["client"] | null = null,
): ShellWorkspaceListResponse["workspaces"] {
  const tenantContext = resolveTenantContext(process.env, client);
  return getAvailableWorkspaceIds().map((workspaceId) => ({
    workspaceId,
    displayName: workspaceId,
    role: workspaceId === tenantContext.workspaceId ? "govern" : "configure",
  }));
}

function selectWorkspacePayload(
  params: Record<string, unknown>,
  client: GatewayRequestHandlerOptions["client"] | null = null,
): ShellWorkspaceSelectionResponse {
  const workspaceId = stringifyValue(params.workspaceId || params.workspace_id);
  if (!workspaceId) {
    throw new Error("workspaceId is required");
  }
  const workspaceIds = getAvailableWorkspaceIds();
  if (!workspaceIds.includes(workspaceId)) {
    throw new Error(`workspace not available in current shell: ${workspaceId}`);
  }
  SHELL_SELECTED_WORKSPACES.set(getShellSelectionKey(client), workspaceId);
  const tenantContext = resolveTenantContext(process.env, client);
  const {
    capabilityRegistry,
    capabilityRegistryPath,
    observability,
    observabilityPath,
    goalOsExplainView,
    goalOsExplainViewPath,
    governanceReviewsPath,
    latestGovernanceReview,
    sanjinRoot,
  } =
    readCoreSources();
  const promotionRequests = listTenantPromotionRequestRecords({
    storage: { sanjinRoot },
    tenantContext,
  });
  const brainAccess = buildBrainAccessSurface(tenantContext, {
    sourceFiles: sourceFiles([
      goalOsExplainView ? goalOsExplainViewPath : null,
      observabilityPath,
      governanceReviewsPath,
      capabilityRegistryPath,
    ]),
    explainView: goalOsExplainView,
    observability,
    latestGovernanceReview,
    capabilityRegistry,
    promotionRequests,
  });
  const memoryBoundary = buildTenantMemoryBoundary(tenantContext);
  const governancePermissionModel = buildGovernancePermissionModel(tenantContext);
  return {
    generatedAt: new Date().toISOString(),
    workspace: {
      workspaceId,
      displayName: workspaceId,
      role: "govern",
    },
    tenantContext,
    brainAccess,
    memoryBoundary,
    governancePermissionModel,
    onboardingState: buildGatewayOnboardingState(client, tenantContext),
  };
}

function buildBrainContractPayload(
  client: GatewayRequestHandlerOptions["client"] | null = null,
): ShellBrainContractGetResponse {
  const tenantContext = resolveTenantContext(process.env, client);
  const {
    capabilityRegistry,
    capabilityRegistryPath,
    observability,
    observabilityPath,
    goalOsExplainView,
    goalOsExplainViewPath,
    governanceReviewsPath,
    latestGovernanceReview,
    sanjinRoot,
  } =
    readCoreSources();
  const promotionRequests = listTenantPromotionRequestRecords({
    storage: { sanjinRoot },
    tenantContext,
  });
  return {
    generatedAt: new Date().toISOString(),
    tenantContext,
    brainAccess: buildBrainAccessSurface(tenantContext, {
      sourceFiles: sourceFiles([
        goalOsExplainView ? goalOsExplainViewPath : null,
        observabilityPath,
        governanceReviewsPath,
        capabilityRegistryPath,
      ]),
      explainView: goalOsExplainView,
      observability,
      latestGovernanceReview,
      capabilityRegistry,
      promotionRequests,
    }),
  };
}

function buildTenantMemoryBoundaryPayload(
  client: GatewayRequestHandlerOptions["client"] | null = null,
): ShellTenantMemoryBoundaryGetResponse {
  const tenantContext = resolveTenantContext(process.env, client);
  return {
    generatedAt: new Date().toISOString(),
    tenantContext,
    memoryBoundary: buildTenantMemoryBoundary(tenantContext),
  };
}

function buildGovernancePermissionModelPayload(
  client: GatewayRequestHandlerOptions["client"] | null = null,
): ShellGovernancePermissionModelGetResponse {
  const tenantContext = resolveTenantContext(process.env, client);
  return {
    generatedAt: new Date().toISOString(),
    tenantContext,
    governancePermissionModel: buildGovernancePermissionModel(tenantContext),
  };
}

function resolveGatewayClientRole(
  client: GatewayRequestHandlerOptions["client"] | null = null,
): string {
  return stringifyValue(client?.connect?.role || "operator");
}

function assertBrainOwnerGovernanceReadAccess(
  client: GatewayRequestHandlerOptions["client"] | null = null,
): void {
  if (resolveGatewayClientRole(client) !== "brain_owner") {
    throw new Error("brain_owner role is required for shared governance console access");
  }
}

function buildGovernanceConsoleListPayload(
  params: Record<string, unknown>,
  client: GatewayRequestHandlerOptions["client"] | null = null,
): ShellGovernanceConsoleListResponse {
  assertBrainOwnerGovernanceReadAccess(client);
  const { sanjinRoot } = readCoreSources();
  const query =
    params.query && typeof params.query === "object" && !Array.isArray(params.query)
      ? (params.query as ShellGovernanceConsoleListRequest["query"])
      : undefined;
  const response = listShellGovernanceConsole({ sanjinRoot, query });
  return {
    ...response,
    generatedAt: new Date().toISOString(),
  };
}

function buildGovernanceGateGetPayload(
  params: Record<string, unknown>,
  client: GatewayRequestHandlerOptions["client"] | null = null,
): ShellGovernanceGateGetResponse {
  assertBrainOwnerGovernanceReadAccess(client);
  const { sanjinRoot } = readCoreSources();
  const gateId = stringifyValue(params.gateId || params.gate_id);
  if (!gateId) {
    throw new Error("gateId is required");
  }
  const response = getShellGovernanceGate({ sanjinRoot, gateId });
  return {
    ...response,
    generatedAt: new Date().toISOString(),
  };
}

function buildGovernanceReviewGetPayload(
  params: Record<string, unknown>,
  client: GatewayRequestHandlerOptions["client"] | null = null,
): ShellGovernanceReviewGetResponse {
  assertBrainOwnerGovernanceReadAccess(client);
  const { sanjinRoot } = readCoreSources();
  const reviewId = stringifyValue(params.reviewId || params.review_id) || undefined;
  const requestId = stringifyValue(params.requestId || params.request_id) || undefined;
  if (!reviewId && !requestId) {
    throw new Error("reviewId or requestId is required");
  }
  const response = getShellGovernanceReview({ sanjinRoot, reviewId, requestId });
  return {
    ...response,
    generatedAt: new Date().toISOString(),
  };
}

function buildGovernanceAuditListPayload(
  params: Record<string, unknown>,
  client: GatewayRequestHandlerOptions["client"] | null = null,
): ShellGovernanceAuditListResponse {
  assertBrainOwnerGovernanceReadAccess(client);
  const { sanjinRoot } = readCoreSources();
  const response = listShellGovernanceAudit({
    sanjinRoot,
    gateId: stringifyValue(params.gateId || params.gate_id) || undefined,
    requestId: stringifyValue(params.requestId || params.request_id) || undefined,
    reviewId: stringifyValue(params.reviewId || params.review_id) || undefined,
    shadowId: stringifyValue(params.shadowId || params.shadow_id) || undefined,
  });
  return {
    ...response,
    generatedAt: new Date().toISOString(),
  };
}

function buildPromotionRequestListPayload(
  client: GatewayRequestHandlerOptions["client"] | null = null,
): ShellPromotionRequestListResponse {
  const tenantContext = resolveTenantContext(process.env, client);
  const { sanjinRoot, promotionRequestsPath } = readCoreSources();
  return {
    generatedAt: new Date().toISOString(),
    sourceFiles: sourceFiles([promotionRequestsPath]),
    records: listTenantPromotionRequestRecords({
      storage: { sanjinRoot },
      tenantContext,
    }),
  };
}

function buildPromotionRequestGetPayload(
  params: Record<string, unknown>,
  client: GatewayRequestHandlerOptions["client"] | null = null,
): ShellPromotionRequestGetResponse {
  const requestId = stringifyValue(params.requestId || params.request_id);
  if (!requestId) {
    throw new Error("requestId is required");
  }
  const tenantContext = resolveTenantContext(process.env, client);
  const { sanjinRoot, promotionRequestsPath } = readCoreSources();
  const record = getTenantPromotionRequestRecord({
    storage: { sanjinRoot },
    tenantContext,
    requestId,
  });
  if (!record) {
    throw new Error(`unknown tenant promotion request: ${requestId}`);
  }
  return {
    generatedAt: new Date().toISOString(),
    sourceFiles: sourceFiles([promotionRequestsPath]),
    record,
  };
}

function buildGovernanceExecutePayload(
  opts: GatewayRequestHandlerOptions,
): ShellGovernanceExecuteResponse {
  const params = opts.params as Record<string, unknown>;
  const request = params as unknown as ShellGovernanceExecuteRequest;
  const tenantContext = resolveTenantContext(process.env, opts.client);
  const { sanjinRoot, promotionRequestsPath } = readCoreSources();
  const actorId =
    stringifyValue(request.actorId || "")
    || tenantContext.userId;
  const actorRole =
    stringifyValue(request.actorRole || opts.client?.connect?.role || "")
    || "operator";
  const response = executeGovernanceWorkflow({
    storage: { sanjinRoot },
    tenantContext,
    actorId,
    actorRole,
    request,
  });
  return {
    ...response,
    generatedAt: new Date().toISOString(),
    payload: {
      ...response.payload,
      sourceFiles: sourceFiles([promotionRequestsPath]),
    },
  };
}

function buildPromotionRequestCreatePayload(
  params: Record<string, unknown>,
  client: GatewayRequestHandlerOptions["client"] | null = null,
): ShellPromotionRequestCreateResponse {
  const tenantContext = resolveTenantContext(process.env, client);
  const { sanjinRoot } = readCoreSources();
  const input = params as unknown as ShellTenantPromotionRequestInput;
  const record = createTenantPromotionRequestRecord({
    storage: { sanjinRoot },
    tenantContext,
    actorId: tenantContext.userId,
    input,
  });
  return {
    generatedAt: new Date().toISOString(),
    record,
  };
}

function buildCapabilityListPayload(
  client: GatewayRequestHandlerOptions["client"] | null = null,
): ShellCapabilityListResponse {
  const { capabilityRegistryPath } = readCoreSources();
  const tenantContext = resolveTenantContext(process.env, client);
  return {
    generatedAt: new Date().toISOString(),
    sourceFiles: sourceFiles([capabilityRegistryPath]),
    entries: readCapabilityRegistryEntries().map((entry) =>
      buildCapabilityListEntry(entry, tenantContext),
    ),
  };
}

function buildCapabilityGetPayload(
  params: Record<string, unknown>,
  client: GatewayRequestHandlerOptions["client"] | null = null,
): ShellCapabilityGetResponse {
  const capabilityId = stringifyValue(params.capabilityId || params.capability_id);
  if (!capabilityId) {
    throw new Error("capabilityId is required");
  }
  const { capabilityRegistryPath } = readCoreSources();
  const tenantContext = resolveTenantContext(process.env, client);
  const entry = readCapabilityRegistryEntries().find(
    (candidate) => stringifyValue(candidate.capability_id) === capabilityId,
  );
  if (!entry) {
    throw new Error(`unknown capability: ${capabilityId}`);
  }
  const metadata =
    entry.metadata && typeof entry.metadata === "object"
      ? (entry.metadata as Record<string, unknown>)
      : {};
  return {
    generatedAt: new Date().toISOString(),
    sourceFiles: sourceFiles([capabilityRegistryPath]),
    entry: {
      ...buildCapabilityListEntry(entry, tenantContext),
      description: stringifyValue(metadata.draft_description || ""),
      governanceMode: stringifyValue(entry.governance_policy || "candidate_only"),
      metadata,
    },
  };
}

function mapShellSessionListEntry(row: Record<string, unknown>): ShellSessionListEntry {
  return {
    key: stringifyValue(row.key),
    sessionId: stringifyValue(row.sessionId || "") || undefined,
    title:
      stringifyValue(row.displayName || row.label || row.derivedTitle || "") || undefined,
    status: stringifyValue(row.status || "") || undefined,
    updatedAt:
      typeof row.updatedAt === "number" && Number.isFinite(row.updatedAt) ? row.updatedAt : null,
    model: stringifyValue(row.model || "") || undefined,
    modelProvider: stringifyValue(row.modelProvider || "") || undefined,
  };
}

function deriveShellPlannerOutcome(params: {
  status: string | undefined;
  pendingActionCount: number;
}): ShellPlannerOutcome {
  const normalizedStatus = stringifyValue(params.status || "").toLowerCase() || "unknown";
  const pendingActionCount = Math.max(0, params.pendingActionCount);

  if (["failed", "error", "cancelled"].includes(normalizedStatus)) {
    return {
      source: "runtime_inference",
      stageAction: "fallback",
      attentionLevel: "critical",
      controlSummary: "Latest shell run failed, so the planner should hold the current stage and prepare a fallback path.",
      operatorSummary: "Inspect the timeline first, then retry refresh or switch to a safer fallback path.",
      nextActionLabel: "Inspect Timeline",
      signals: {
        allowStageProgress: false,
        holdCurrentStage: true,
        requireStateRefresh: false,
        requireSkillChainRebuild: false,
        requireStageFallback: true,
        requireStageReplan: false,
        fallbackMode: "stage_fallback",
      },
    };
  }

  if (pendingActionCount > 0) {
    return {
      source: "runtime_inference",
      stageAction: "hold",
      attentionLevel: "warning",
      controlSummary: "Execution is blocked on a local action, so the planner should hold the current stage until operator input arrives.",
      operatorSummary: pendingActionCount === 1
        ? "Open the pending action, approve or reject it, then resume the timeline."
        : `Resolve the ${pendingActionCount} pending local actions, then resume the timeline.`,
      nextActionLabel: "Open Pending Action",
      signals: {
        allowStageProgress: false,
        holdCurrentStage: true,
        requireStateRefresh: false,
        requireSkillChainRebuild: false,
        requireStageFallback: false,
        requireStageReplan: false,
      },
    };
  }

  if (!["idle", "completed"].includes(normalizedStatus)) {
    return {
      source: "runtime_inference",
      stageAction: "hold",
      attentionLevel: "info",
      controlSummary: "A live run is still in flight, so the planner should hold the current stage and keep the operator on the active execution surface.",
      operatorSummary: "Stay on the live run, keep polling, and wait for either fresh output or a new blocking action.",
      nextActionLabel: "Open Live Run",
      signals: {
        allowStageProgress: false,
        holdCurrentStage: true,
        requireStateRefresh: false,
        requireSkillChainRebuild: false,
        requireStageFallback: false,
        requireStageReplan: false,
      },
    };
  }

  return {
    source: "runtime_inference",
    stageAction: "progress",
    attentionLevel: "info",
    controlSummary: "The active run is settled without blocking actions, so the planner can count this path as ready for stage progression.",
    operatorSummary: "Review the latest timeline and continue the next task from a stable execution state.",
    nextActionLabel: "Inspect Timeline",
    signals: {
      allowStageProgress: true,
      holdCurrentStage: false,
      requireStateRefresh: false,
      requireSkillChainRebuild: false,
      requireStageFallback: false,
      requireStageReplan: false,
    },
  };
}

async function buildShellSessionCreatePayload(
  opts: GatewayRequestHandlerOptions,
): Promise<ShellSessionCreateResponse> {
  const tenantContext = resolveTenantContext(process.env, opts.client);
  const workspaceId = stringifyValue(opts.params.workspaceId || opts.params.workspace_id);
  if (!workspaceId) {
    throw new Error("workspaceId is required");
  }
  if (workspaceId !== tenantContext.workspaceId) {
    throw new Error(`workspace not available in current shell: ${workspaceId}`);
  }
  const title = stringifyValue(opts.params.title || opts.params.label || "");
  const result = await invokeGatewayHandler({
    handler: sessionsHandlers["sessions.create"],
    method: "sessions.create",
    params: title ? { label: title } : {},
    req: opts.req,
    client: opts.client,
    isWebchatConnect: opts.isWebchatConnect,
    context: opts.context,
  });
  const payload = (result.payload ?? {}) as Record<string, unknown>;
  return {
    generatedAt: new Date().toISOString(),
    key: stringifyValue(payload.key),
    sessionId: stringifyValue(payload.sessionId),
    createdAt: new Date().toISOString(),
    workspaceId,
    title: title || stringifyValue((payload.entry as Record<string, unknown> | undefined)?.label || ""),
    status: stringifyValue((payload.entry as Record<string, unknown> | undefined)?.status || "") || undefined,
  };
}

async function buildShellSessionListPayload(
  opts: GatewayRequestHandlerOptions,
): Promise<ShellSessionListResponse> {
  const result = await invokeGatewayHandler({
    handler: sessionsHandlers["sessions.list"],
    method: "sessions.list",
    params: {},
    req: opts.req,
    client: opts.client,
    isWebchatConnect: opts.isWebchatConnect,
    context: opts.context,
  });
  const payload = (result.payload ?? {}) as Record<string, unknown>;
  const sessions = Array.isArray(payload.sessions)
    ? payload.sessions.map((row) => mapShellSessionListEntry((row ?? {}) as Record<string, unknown>))
    : [];
  return {
    generatedAt: new Date().toISOString(),
    count: sessions.length,
    sessions,
  };
}

async function resolveShellSessionKey(
  opts: GatewayRequestHandlerOptions,
): Promise<string> {
  const key = stringifyValue(opts.params.key || "");
  if (key) {
    return key;
  }
  const sessionId = stringifyValue(opts.params.sessionId || opts.params.session_id || "");
  if (!sessionId) {
    throw new Error("key or sessionId is required");
  }
  const result = await invokeGatewayHandler({
    handler: sessionsHandlers["sessions.resolve"],
    method: "sessions.resolve",
    params: { sessionId },
    req: opts.req,
    client: opts.client,
    isWebchatConnect: opts.isWebchatConnect,
    context: opts.context,
  });
  return stringifyValue(((result.payload ?? {}) as Record<string, unknown>).key);
}

async function buildShellSessionGetPayload(
  opts: GatewayRequestHandlerOptions,
): Promise<ShellSessionGetResponse> {
  const key = await resolveShellSessionKey(opts);
  const [sessionListResult, sessionMessagesResult] = await Promise.all([
    invokeGatewayHandler({
      handler: sessionsHandlers["sessions.list"],
      method: "sessions.list",
      params: {},
      req: opts.req,
      client: opts.client,
      isWebchatConnect: opts.isWebchatConnect,
      context: opts.context,
    }),
    invokeGatewayHandler({
      handler: sessionsHandlers["sessions.get"],
      method: "sessions.get",
      params: { key },
      req: opts.req,
      client: opts.client,
      isWebchatConnect: opts.isWebchatConnect,
      context: opts.context,
    }),
  ]);
  const listPayload = (sessionListResult.payload ?? {}) as Record<string, unknown>;
  const matchingRow = Array.isArray(listPayload.sessions)
    ? listPayload.sessions.find(
        (row) => stringifyValue((row as Record<string, unknown>).key) === key,
      )
    : undefined;
  const mapped = matchingRow
    ? mapShellSessionListEntry(matchingRow as Record<string, unknown>)
    : { key };
  const messages = Array.isArray(((sessionMessagesResult.payload ?? {}) as Record<string, unknown>).messages)
    ? ((((sessionMessagesResult.payload ?? {}) as Record<string, unknown>).messages) as unknown[])
    : [];
  const localActions = resolveLocalBridgeAdapter(process.env).listActionsForSession(key);
  const plannerOutcome = deriveShellPlannerOutcome({
    status: mapped.status,
    pendingActionCount: localActions.filter((action) => isPendingLocalAction(action)).length,
  });
  return {
    generatedAt: new Date().toISOString(),
    key,
    sessionId: mapped.sessionId,
    title: mapped.title,
    status: mapped.status,
    updatedAt: mapped.updatedAt,
    model: mapped.model,
    modelProvider: mapped.modelProvider,
    messageCount: messages.length,
    localActionCount: localActions.length,
    localActions,
    timeline: [
      ...messages.map((message, index) => buildShellMessageTimelineEntry(message, index)),
      ...localActions.map((action) => buildShellLocalActionTimelineEntry(action)),
    ],
    plannerOutcome,
    messages,
  };
}

async function buildShellSessionSendPayload(
  opts: GatewayRequestHandlerOptions,
): Promise<ShellSessionSendResponse> {
  const key = await resolveShellSessionKey(opts);
  const message = stringifyValue(opts.params.message);
  if (!message) {
    throw new Error("message is required");
  }
  const result = await invokeGatewayHandler({
    handler: sessionsHandlers["sessions.send"],
    method: "sessions.send",
    params: {
      key,
      message,
      ...(Array.isArray(opts.params.attachments) ? { attachments: opts.params.attachments } : {}),
    },
    req: opts.req,
    client: opts.client,
    isWebchatConnect: opts.isWebchatConnect,
    context: opts.context,
  });
  const payload = (result.payload ?? {}) as Record<string, unknown>;
  return {
    generatedAt: new Date().toISOString(),
    key,
    runId: stringifyValue(payload.runId || "") || undefined,
    messageSeq:
      typeof payload.messageSeq === "number" && Number.isFinite(payload.messageSeq)
        ? payload.messageSeq
        : undefined,
    status: stringifyValue(payload.status || "") || undefined,
    interruptedActiveRun:
      typeof payload.interruptedActiveRun === "boolean"
        ? payload.interruptedActiveRun
        : undefined,
  };
}

async function buildShellSessionStreamPayload(
  opts: GatewayRequestHandlerOptions,
): Promise<ShellSessionStreamResponse> {
  const session = await buildShellSessionGetPayload(opts);
  const list = await buildShellSessionListPayload(opts);
  const matching = list.sessions.find((entry) => entry.key === session.key);
  const pendingLocalActions = resolveLocalBridgeAdapter(process.env).listPendingActionsForSession(session.key);
  return {
    generatedAt: new Date().toISOString(),
    key: session.key,
    sessionId: session.sessionId,
    messages: session.messages,
    status: matching?.status,
    pendingLocalActions,
    nextPollAfterMs: 1500,
    plannerOutcome: deriveShellPlannerOutcome({
      status: matching?.status ?? session.status,
      pendingActionCount: pendingLocalActions.length,
    }),
  };
}

function buildLocalBridgeStatusPayload(): ShellLocalBridgeStatusResponse {
  const localBridgeAdapter = resolveLocalBridgeAdapter(process.env);
  const adapterInfo = localBridgeAdapter.getAdapter();
  const contract = localBridgeAdapter.getContract();
  const actions = localBridgeAdapter.listActions();
  const derivedStartupPosture = summarizeDesktopShellLocalBridgeStartupFromAdapter({
    adapter: adapterInfo,
    contractVersion: contract.version,
  });
  const runtimeStartupPosture = resolveLocalBridgeStartupPosture();
  const baseStartupPosture =
    runtimeStartupPosture && runtimeStartupPosture.mode === adapterInfo.mode
      ? runtimeStartupPosture
      : {
    ...derivedStartupPosture,
    startupSource: "derived_adapter" as const,
    healthSource: "startup_posture" as const,
    healthEventSummary: null,
    shellAppLabel: null,
  };
  const startupPosture = enrichDesktopNativeLocalActionCapabilities(baseStartupPosture);
  return {
    generatedAt: new Date().toISOString(),
    status: "ready",
    adapter: adapterInfo,
    contract,
    startupPosture,
    recentHealthEvents: listLocalBridgeHealthEvents(),
    healthFeed: summarizeLocalBridgeHealthFeed(),
    pendingCount: actions.filter((action) => isPendingLocalAction(action)).length,
    completedCount: actions.filter((action) => isResolvedLocalAction(action)).length,
    actions,
  };
}

function summarizeShellTimelineMessage(message: unknown): string {
  if (!message || typeof message !== "object") {
    return String(message ?? "");
  }
  const entry = message as { content?: unknown };
  if (Array.isArray(entry.content)) {
    const text = entry.content
      .map((item) => {
        if (!item || typeof item !== "object") {
          return "";
        }
        const record = item as { text?: unknown; type?: unknown };
        return typeof record.text === "string"
          ? record.text
          : typeof record.type === "string"
            ? `[${record.type}]`
            : "";
      })
      .filter(Boolean)
      .join(" ");
    return text || "[structured content]";
  }
  return JSON.stringify(message);
}

function buildShellMessageTimelineEntry(
  message: unknown,
  index: number,
): ShellSessionGetResponse["timeline"][number] {
  const entry = (message ?? {}) as { role?: unknown };
  const role = typeof entry.role === "string" ? entry.role : "message";
  return {
    entryId: `message:${index + 1}`,
    entryType: "message",
    title: role,
    detail: summarizeShellTimelineMessage(message),
    occurredAt: null,
  };
}

function buildShellLocalActionTimelineEntry(
  action: ShellPendingLocalAction,
): ShellSessionGetResponse["timeline"][number] {
  return {
    entryId: `local_action:${action.actionId}`,
    entryType: "local_action",
    title: action.title,
    detail: action.description,
    status: action.status,
    occurredAt: action.requestedAt,
  };
}

async function requestLocalBridgeActionPayload(
  opts: GatewayRequestHandlerOptions,
): Promise<ShellLocalActionRequestResponse> {
  const actionId = stringifyValue(opts.params.actionId || opts.params.action_id);
  const actionType = stringifyValue(opts.params.actionType || opts.params.action_type);
  const title = stringifyValue(opts.params.title);
  const description = stringifyValue(opts.params.description);
  if (!actionId) {
    throw new Error("actionId is required");
  }
  if (!actionType) {
    throw new Error("actionType is required");
  }
  if (!title) {
    throw new Error("title is required");
  }
  if (!description) {
    throw new Error("description is required");
  }
  const key = stringifyValue(opts.params.key || "");
  const sessionId = stringifyValue(opts.params.sessionId || opts.params.session_id || "");
  let sessionKey: string | undefined;
  if (key || sessionId) {
    sessionKey = await resolveShellSessionKey({
      ...opts,
      params: key ? { key } : { sessionId },
    });
  }
  const localBridgeAdapter = resolveLocalBridgeAdapter(process.env);
  const action = localBridgeAdapter.requestAction({
    actionId,
    actionType: actionType as ShellPendingLocalAction["actionType"],
    title,
    description,
    constraints: asRecord(opts.params.constraints),
    sessionKey,
  });
  const response = {
    generatedAt: new Date().toISOString(),
    transport: localBridgeAdapter.getTransport(),
    action: {
      ...action,
      lifecycle: "requested",
    },
  };
  if (response.transport.adapterMode === "desktop") {
    const localBridgeStatus = buildLocalBridgeStatusPayload();
    const eventPayload = buildDesktopLocalActionRequestedEventPayload({
      response,
      startupPosture: localBridgeStatus.startupPosture,
      pendingNativeActionCount: localBridgeStatus.pendingCount,
    });
    updateLocalBridgeStartupPosture({
      nativeLocalActionTransportSource: eventPayload.nativeLocalActionTransportSource,
      pendingNativeActionCount: eventPayload.pendingNativeActionCount,
      nativeLocalActionDeliverySummary: eventPayload.nativeLocalActionDeliverySummary,
    });
    opts.context.broadcast?.(DESKTOP_LOCAL_ACTION_REQUESTED_EVENT, eventPayload, {
      dropIfSlow: true,
    });
  }
  return response;
}

function submitLocalBridgeActionResultPayload(
  opts: GatewayRequestHandlerOptions,
): ShellLocalActionResultResponse {
  const actionId = stringifyValue(opts.params.actionId || opts.params.action_id);
  if (!actionId) {
    throw new Error("actionId is required");
  }
  if (typeof opts.params.approved !== "boolean") {
    throw new Error("approved is required");
  }
  const result: ShellLocalActionResult = {
    actionId,
    approved: opts.params.approved,
    payload: asRecord(opts.params.payload),
    error: stringifyValue(opts.params.error || "") || undefined,
  };
  const localBridgeAdapter = resolveLocalBridgeAdapter(process.env);
  const next = localBridgeAdapter.resolveAction(actionId, result);
  const response = {
    generatedAt: new Date().toISOString(),
    transport: localBridgeAdapter.getTransport(),
    action: next,
  };
  if (response.transport.adapterMode === "desktop") {
    const localBridgeStatus = buildLocalBridgeStatusPayload();
    const nativeLocalActionExecutionSource =
      resolveShellLocalActionExecutionSource(localBridgeStatus.startupPosture?.desktopHostPlatform);
    const executionRequest = resolveShellLocalActionExecutionRequest({
      action: response.action,
      hostPlatform: localBridgeStatus.startupPosture?.desktopHostPlatform,
    });
    updateLocalBridgeStartupPosture({
      nativeLocalActionTransportSource: "desktop_local_action_result_submit",
      pendingNativeActionCount: localBridgeStatus.pendingCount,
      nativeLocalActionResultSummary: resolveDesktopLocalActionResultSummary({
        shellAppLabel: localBridgeStatus.startupPosture?.shellAppLabel,
        action: response.action,
        approved: result.approved,
        pendingNativeActionCount: localBridgeStatus.pendingCount,
        desktopHostPlatform: localBridgeStatus.startupPosture?.desktopHostPlatform,
      }),
      nativeLocalActionExecutionSource,
      lastNativeLocalActionExecutionAt:
        nativeLocalActionExecutionSource ? response.generatedAt : null,
      nativeLocalActionExecutionSummary:
        nativeLocalActionExecutionSource
          ? resolveShellLocalActionExecutionSummary({
              shellAppLabel: localBridgeStatus.startupPosture?.shellAppLabel,
              action: {
                actionId: executionRequest.actionId,
                actionType: executionRequest.actionType,
                title: executionRequest.title,
              },
              approved: result.approved,
              hostPlatform: localBridgeStatus.startupPosture?.desktopHostPlatform,
              executionSource: nativeLocalActionExecutionSource,
              pendingNativeActionCount: localBridgeStatus.pendingCount,
            })
          : null,
    });
  }
  return response;
}

function submitLocalBridgeNativeProcessEventPayload(
  opts: GatewayRequestHandlerOptions,
): ShellLocalBridgeNativeProcessEventResponse {
  const nativeEventType = stringifyValue(opts.params.nativeEventType || opts.params.native_event_type);
  const source = stringifyValue(opts.params.source || "");
  const hostPlatform = stringifyValue(opts.params.hostPlatform || opts.params.host_platform || "");
  const occurredAt = stringifyValue(opts.params.occurredAt || opts.params.occurred_at || "");
  const shellAppLabel = stringifyValue(opts.params.shellAppLabel || opts.params.shell_app_label || "");
  if (
    nativeEventType !== "app_started"
    && nativeEventType !== "app_foregrounded"
    && nativeEventType !== "app_backgrounded"
    && nativeEventType !== "app_stopped"
  ) {
    throw new Error("nativeEventType must be one of app_started, app_foregrounded, app_backgrounded, app_stopped");
  }
  if (source !== "macos_app_lifecycle" && source !== "windows_app_lifecycle") {
    throw new Error("source must be one of macos_app_lifecycle, windows_app_lifecycle");
  }
  if (hostPlatform !== "macos" && hostPlatform !== "windows") {
    throw new Error("hostPlatform must be one of macos, windows");
  }
  const resolvedIngress = resolveDesktopHostLifecycleIngress({
    hostPlatform,
    source,
  });
  const now =
    occurredAt.length > 0
      ? Date.parse(occurredAt)
      : Date.now();
  if (!Number.isFinite(now)) {
    throw new Error("occurredAt must be a valid ISO timestamp");
  }

  ensureNativeDesktopLocalBridgeRuntime({
    shellAppLabel,
    hostPlatform: resolvedIngress.hostPlatform,
    nativeEventIngressSource: resolvedIngress.source,
  });

  const localBridgeStatus = buildLocalBridgeStatusPayload();
  const startupPosture = localBridgeStatus.startupPosture;
  const event = dispatchDesktopShellRuntimeNativeProcessEvent({
    nativeEventType: nativeEventType as ShellLocalBridgeNativeProcessEventRequest["nativeEventType"],
    runtimeLabel: startupPosture.runtimeLabel ?? startupPosture.startupModeLabel ?? "Desktop bridge runtime",
    shellAppLabel: shellAppLabel || startupPosture.shellAppLabel || "Desktop Shell",
    moduleLabel: startupPosture.moduleLabel ?? "Desktop Shell Startup Module",
    attached: startupPosture.attached,
    adapterReadiness: startupPosture.adapterReadiness ?? localBridgeStatus.adapter.readiness,
    hostStarted: startupPosture.hostStarted,
    runnerStarted:
      startupPosture.runnerState !== undefined
        ? startupPosture.runnerState !== "stopped"
        : undefined,
    timerArmed:
      startupPosture.timerState !== undefined
        ? startupPosture.timerState === "armed" || startupPosture.timerState === "tick_now"
        : undefined,
    serviceOwned: startupPosture.serviceOwned,
    lifecycleOwned: startupPosture.lifecycleOwned,
    bootstrapOwned: startupPosture.bootstrapOwned,
    shellOwnerOwned: startupPosture.shellOwnerOwned,
    processHostOwned: startupPosture.processHostOwned,
    lastTickAt:
      startupPosture.lastTickAt
      && Number.isFinite(Date.parse(startupPosture.lastTickAt))
        ? Date.parse(startupPosture.lastTickAt)
        : null,
    nativeEventIngressSource: resolvedIngress.source,
    hostPlatform: resolvedIngress.hostPlatform,
    now,
  });
  return {
    ok: true,
    nativeEventType: event.nativeProcessEventType,
    processHostState: event.processHostState,
    nextWakeAt: event.nextWakeAt,
    processEventSummary: event.processEventSummary,
    nativeProcessEventSummary: event.nativeProcessEventSummary,
  };
}

function buildPilotShellPayload(
  client: GatewayRequestHandlerOptions["client"] | null = null,
): ShellPilotShellPayload {
  const {
    observability,
    observabilityPath,
    goalOsExplainView,
    goalOsExplainViewPath,
    governanceReviewsPath,
    capabilityRegistry,
    capabilityRegistryPath,
    promotionRequestsPath,
    sanjinRoot,
  } = readCoreSources();
  const entries = Array.isArray(capabilityRegistry?.entries)
    ? (capabilityRegistry.entries as Array<Record<string, unknown>>)
    : [];
  const skillGov = (observability?.skill_governance_summary ?? {}) as JsonObject;
  const runtimeRecovery = (observability?.runtime_recovery_summary ?? {}) as JsonObject;
  const permissionGate = (observability?.permission_gate_summary ?? {}) as JsonObject;
  const latestReview = readCoreSources().latestGovernanceReview ?? {};
  const activeCount = countCapabilityEntriesByStage(entries, "active");
  const limitedActiveCount = countCapabilityEntriesByStage(entries, "limited_active");
  const candidateCount = countCapabilityEntriesByStage(entries, "candidate");
  const draftCount = countCapabilityEntriesByStage(entries, "draft");
  const tenantContext = resolveTenantContext(process.env, client);
  const promotionRequests = listTenantPromotionRequestRecords({
    storage: { sanjinRoot },
    tenantContext,
  });
  const pilotFlowEntries = entries
    .filter(
      (entry) =>
        stringifyValue(entry.capability_type) === "workflow"
        && stringifyValue(entry.source_registry) === "capability_pack",
    )
    .map((entry) => buildPilotFlow(entry, tenantContext));
  const brainAccess = buildBrainAccessSurface(tenantContext, {
    sourceFiles: sourceFiles([
      goalOsExplainView ? goalOsExplainViewPath : null,
      observabilityPath,
      governanceReviewsPath,
      capabilityRegistryPath,
    ]),
    explainView: goalOsExplainView,
    observability,
    latestGovernanceReview: latestReview as JsonObject,
    capabilityRegistry,
    pilotFlows: pilotFlowEntries,
    promotionRequests,
  });
  const memoryBoundary = buildTenantMemoryBoundary(tenantContext);
  const governancePermissionModel = buildGovernancePermissionModel(tenantContext);
  const submittedPromotionRequestCount = promotionRequests.filter((entry) => entry.status === "submitted").length;
  const underReviewPromotionRequestCount = promotionRequests.filter((entry) => entry.status === "under_review").length;
  const qualityScores = (readCoreSources().latestRerun.payload?.quality_scores ?? {}) as Record<
    string,
    JsonObject
  >;
  const robustness = qualityScores.robustness ?? {};
  const localBridgeStatus = buildLocalBridgeStatusPayload();
  const onboardingState = buildGatewayOnboardingState(client, tenantContext, process.env, localBridgeStatus);
  const desktopIntegration = buildDesktopIntegrationSummary(localBridgeStatus);
  const desktopStartupOrigin = describeDesktopStartupOrigin(localBridgeStatus.startupPosture);
  const desktopStartupModuleContext = describeDesktopStartupModuleContext(localBridgeStatus.startupPosture);
  const desktopStartupModuleStatus = describeDesktopStartupModuleStatusContext(
    localBridgeStatus.startupPosture,
  );
  const desktopStartupProvider = describeDesktopStartupProviderContext(
    localBridgeStatus.startupPosture,
  );
  const desktopStartupProviderStatus = describeDesktopStartupProviderStatusContext(
    localBridgeStatus.startupPosture,
  );
  const desktopStartupHealth = describeDesktopStartupHealthContext(
    localBridgeStatus.startupPosture,
  );
  const desktopStartupHealthFeed = describeDesktopStartupHealthFeedContext(
    localBridgeStatus.healthFeed,
    localBridgeStatus.startupPosture,
  );
  const desktopStartupRunner = describeDesktopStartupRunnerContext(localBridgeStatus.startupPosture);
  const desktopStartupTimer = describeDesktopStartupTimerContext(localBridgeStatus.startupPosture);
  const desktopStartupNextAction = describeDesktopStartupRecommendedActionContext(
    localBridgeStatus.startupPosture,
    localBridgeStatus.healthFeed,
  );
  const desktopBridgeQueueItem =
    localBridgeStatus.startupPosture?.mode === "desktop" && !localBridgeStatus.startupPosture.attached
      ? {
          title: "Attach Desktop Bridge",
          count: 1,
          detail: `${desktopStartupOrigin} is configured for desktop mode, but no desktop provider is attached yet. Attach desktop bridge transport before relying on native local actions.${desktopStartupModuleContext ? ` ${desktopStartupModuleContext}` : ""}${desktopStartupModuleStatus ? ` ${desktopStartupModuleStatus}` : ""}${desktopStartupProvider ? ` ${desktopStartupProvider}` : ""}${desktopStartupProviderStatus ? ` ${desktopStartupProviderStatus}` : ""}${desktopStartupHealth ? ` ${desktopStartupHealth}` : ""}${desktopStartupHealthFeed ? ` ${desktopStartupHealthFeed}` : ""}${desktopStartupTimer ? ` ${desktopStartupTimer}` : ""}${desktopStartupRunner ? ` ${desktopStartupRunner}` : ""}${desktopStartupNextAction ? ` ${desktopStartupNextAction}` : ""}`,
          actionLabel: describeDesktopStartupActionLabel(
            localBridgeStatus.startupPosture,
            localBridgeStatus.healthFeed,
            "review",
          ),
          actionMethod: "localBridge.status",
        }
      : localBridgeStatus.startupPosture?.mode === "desktop"
        ? {
            title: "Confirm Desktop Bridge Attach",
            count: 1,
            detail: `${desktopStartupOrigin} is attached and ready. Confirm the current adapter posture before widening local-action reliance.${desktopStartupModuleContext ? ` ${desktopStartupModuleContext}` : ""}${desktopStartupModuleStatus ? ` ${desktopStartupModuleStatus}` : ""}${desktopStartupProvider ? ` ${desktopStartupProvider}` : ""}${desktopStartupProviderStatus ? ` ${desktopStartupProviderStatus}` : ""}${desktopStartupHealth ? ` ${desktopStartupHealth}` : ""}${desktopStartupHealthFeed ? ` ${desktopStartupHealthFeed}` : ""}${desktopStartupTimer ? ` ${desktopStartupTimer}` : ""}${desktopStartupRunner ? ` ${desktopStartupRunner}` : ""}${desktopStartupNextAction ? ` ${desktopStartupNextAction}` : ""}`,
            actionLabel: describeDesktopStartupActionLabel(
              localBridgeStatus.startupPosture,
              localBridgeStatus.healthFeed,
              resolveDesktopStartupActionMode(
                localBridgeStatus.startupPosture,
                localBridgeStatus.healthFeed,
              ),
            ),
            actionMethod: "localBridge.status",
          }
        : {
            title: "Review Desktop Bridge Startup",
            count: 1,
            detail: `Shell is still running through the simulated local bridge path from ${desktopStartupOrigin}. Review startup wiring before expecting desktop-native local actions.${desktopStartupModuleContext ? ` ${desktopStartupModuleContext}` : ""}${desktopStartupModuleStatus ? ` ${desktopStartupModuleStatus}` : ""}${desktopStartupProvider ? ` ${desktopStartupProvider}` : ""}${desktopStartupProviderStatus ? ` ${desktopStartupProviderStatus}` : ""}${desktopStartupHealth ? ` ${desktopStartupHealth}` : ""}${desktopStartupHealthFeed ? ` ${desktopStartupHealthFeed}` : ""}${desktopStartupTimer ? ` ${desktopStartupTimer}` : ""}${desktopStartupRunner ? ` ${desktopStartupRunner}` : ""}${desktopStartupNextAction ? ` ${desktopStartupNextAction}` : ""}`,
            actionLabel: describeDesktopStartupActionLabel(
              localBridgeStatus.startupPosture,
              localBridgeStatus.healthFeed,
              "review",
            ),
            actionMethod: "localBridge.status",
          };
  const onboardingQueueItem =
    onboardingState.phase === "accessGate"
      ? {
          title: "Unlock Shell Entry",
          count: 1,
          detail: "Invite-only shell access still blocks tenant work surfaces. Approve shell access before routing the operator into workbench, sessions, or rollout.",
          actionLabel: "Open Shell Access Gate",
          actionMethod: "auth.login",
        }
      : onboardingState.phase === "workspaceRestore"
        ? {
            title: "Restore Preferred Workspace",
            count: 1,
            detail: `Shell should restore workspace ${onboardingState.preferredWorkspaceId ?? tenantContext.workspaceId} before broader tenant work resumes.`,
            actionLabel: "Open Workspace Setup",
            actionMethod: "tenant.selectWorkspace",
          }
        : onboardingState.target.panel === "sessions" && onboardingState.target.sessionKey
          ? {
              title: "Resume Entry Session",
              count: 1,
              detail: `Shell entry posture wants to resume ${onboardingState.target.sessionKey} before widening attention to the rest of the workbench.`,
              actionLabel: onboardingState.target.focusHint === "pendingAction" ? "Open Pending Action" : "Open Entry Session",
              actionMethod: "shell.session.get",
            }
          : {
              title: "Confirm Workbench Entry",
              count: 1,
              detail: "Gateway posture is already stable, so the operator can confirm the workbench entry state and continue into active work.",
              actionLabel: "Open Workbench",
              actionMethod: "shell.pilotShell.get",
            };
  const onboardingBoundaryRule =
    onboardingState.phase === "accessGate"
      ? {
          title: "Access Before Tenant Entry",
          detail: "Invite approval must complete before the shell can read tenant state or open session work surfaces.",
        }
      : onboardingState.phase === "workspaceRestore"
        ? {
            title: "Workspace Before Work",
            detail: "Preferred workspace restore happens before broader shell routing so tenant work resumes inside the correct boundary.",
          }
        : {
            title: "Entry Posture First",
            detail: "Gateway onboarding posture establishes the first shell landing before attention and session routing enrich it on the client.",
          };
  const desktopBridgeBoundaryRule =
    localBridgeStatus.startupPosture?.mode === "desktop" && !localBridgeStatus.startupPosture.attached
      ? {
          title: "Desktop Bridge Before Native Actions",
          detail: `${desktopStartupOrigin} selected desktop mode, but native local-action transport is still unattached. The shell should stay cautious until the desktop bridge provider is wired in.${desktopStartupModuleContext ? ` ${desktopStartupModuleContext}` : ""}${desktopStartupModuleStatus ? ` ${desktopStartupModuleStatus}` : ""}${desktopStartupProvider ? ` ${desktopStartupProvider}` : ""}${desktopStartupProviderStatus ? ` ${desktopStartupProviderStatus}` : ""}${desktopStartupHealth ? ` ${desktopStartupHealth}` : ""}${desktopStartupTimer ? ` ${desktopStartupTimer}` : ""}${desktopStartupRunner ? ` ${desktopStartupRunner}` : ""}${desktopStartupNextAction ? ` ${desktopStartupNextAction}` : ""}`,
        }
      : localBridgeStatus.startupPosture?.mode === "desktop"
        ? {
            title: "Desktop Bridge Attached",
            detail: `${desktopStartupOrigin} has attached desktop local-action transport, so native bridge workflows can proceed under the existing shell bridge contract.${desktopStartupModuleContext ? ` ${desktopStartupModuleContext}` : ""}${desktopStartupModuleStatus ? ` ${desktopStartupModuleStatus}` : ""}${desktopStartupProvider ? ` ${desktopStartupProvider}` : ""}${desktopStartupProviderStatus ? ` ${desktopStartupProviderStatus}` : ""}${desktopStartupHealth ? ` ${desktopStartupHealth}` : ""}${desktopStartupTimer ? ` ${desktopStartupTimer}` : ""}${desktopStartupRunner ? ` ${desktopStartupRunner}` : ""}${desktopStartupNextAction ? ` ${desktopStartupNextAction}` : ""}`,
          }
        : {
          title: "Simulated Bridge Until Attach",
            detail: `The shell is still using the simulated bridge path from ${desktopStartupOrigin}. Desktop-native local actions should not be assumed until a desktop provider attaches.${desktopStartupModuleContext ? ` ${desktopStartupModuleContext}` : ""}${desktopStartupModuleStatus ? ` ${desktopStartupModuleStatus}` : ""}${desktopStartupProvider ? ` ${desktopStartupProvider}` : ""}${desktopStartupProviderStatus ? ` ${desktopStartupProviderStatus}` : ""}${desktopStartupHealth ? ` ${desktopStartupHealth}` : ""}${desktopStartupTimer ? ` ${desktopStartupTimer}` : ""}${desktopStartupRunner ? ` ${desktopStartupRunner}` : ""}${desktopStartupNextAction ? ` ${desktopStartupNextAction}` : ""}`,
          };

  return {
    generatedAt: new Date().toISOString(),
    sourceFiles: sourceFiles([observabilityPath, governanceReviewsPath, capabilityRegistryPath, promotionRequestsPath]),
    tenantContext,
    brainAccess,
    memoryBoundary,
    governancePermissionModel,
    onboardingState,
    activeScopeLabel: `${tenantContext.orgId} / ${tenantContext.workspaceId} / ${tenantContext.userId}`,
    tenantModelLabel: "org / workspace / user",
    benchmarkScore: `${robustness.passed ?? 0}/${robustness.total ?? 0}`,
    latestRecommendation: stringifyValue(latestReview.recommendation ?? "unknown"),
    scopeSummary: buildScopeSummary(entries, tenantContext),
    pilotFlows: pilotFlowEntries,
    desktopIntegration,
    focusItems: [
      {
        title: "Entry Posture",
        status: onboardingState.phase,
        summary: onboardingState.summary,
      },
      {
        title: "Desktop Bridge Startup",
        status: localBridgeStatus.startupPosture?.startupModeLabel ?? "startup unknown",
        summary:
          localBridgeStatus.startupPosture
            ? `${localBridgeStatus.startupPosture.startupSummary} Source: ${describeDesktopStartupOrigin(localBridgeStatus.startupPosture)}.`
            : "Desktop bridge startup posture is not currently available.",
      },
      {
        title: "Execution Spine",
        status: stringifyValue(runtimeRecovery.recovery_governance_label ?? "unknown"),
        summary: `${stringifyValue(permissionGate.blocked_count ?? 0)} blocked gates still visible in host runtime.`,
      },
      {
        title: "Governance Inbox",
        status: stringifyValue(latestReview.recommendation ?? "unknown"),
        summary: `${stringifyValue(latestReview.gp_name ?? "unknown")} is the current lead review signal.`,
      },
      {
        title: "Capability Rollout",
        status: `${activeCount} active / ${limitedActiveCount} limited`,
        summary: `${candidateCount} candidate and ${draftCount} draft capabilities are waiting in the funnel.`,
      },
      {
        title: "Learning Boundary",
        status: "candidate-only",
        summary: `${stringifyValue((skillGov.governance_distribution as Record<string, unknown> | undefined)?.healthy ?? 0)} healthy skill signals are visible, but promotion still stays behind governance.`,
      },
      {
        title: "Promotion Requests",
        status: `${submittedPromotionRequestCount} submitted / ${underReviewPromotionRequestCount} under review`,
        summary: promotionRequests.length > 0
          ? `${promotionRequests[0]?.evidence.title ?? "Latest request"} is the newest tenant promotion request in this workspace.`
          : "No tenant promotion requests have been submitted from this workspace yet.",
      },
    ],
    operatorQueue: [
      onboardingQueueItem,
      desktopBridgeQueueItem,
      {
        title: "Review Promotion Requests",
        count: promotionRequests.length,
        detail: promotionRequests.length > 0
          ? `${submittedPromotionRequestCount} submitted and ${underReviewPromotionRequestCount} under review. Promotion requests stay tenant-scoped until brain governance admits them.`
          : "No tenant promotion requests are in flight yet. Submit abstracted structural evidence before asking for cross-tenant promotion.",
        actionLabel: "Open Promotion Requests",
        actionMethod: "governance.promotionRequest.list",
      },
      {
        title: "Shape Draft Capabilities",
        count: draftCount,
        detail: "Draft capabilities should finish schema validation before they enter sample runs.",
        actionLabel: "Run Capability Schema Validation",
        actionMethod: "sanjin.runCapabilitySchemaValidation",
      },
      {
        title: "Advance Candidate Workflows",
        count: candidateCount,
        detail: "Candidate capabilities can move into limited active once their sample evidence looks stable.",
        actionLabel: "Promote Limited Active",
        actionMethod: "sanjin.runCapabilityLimitedActivePromotion",
      },
      {
        title: "Watch Limited Rollouts",
        count: limitedActiveCount,
        detail: "Limited active capabilities should stay under observation before broader promotion.",
        actionLabel: "Run Limited Active Observation",
        actionMethod: "sanjin.runCapabilityLimitedActiveObservation",
      },
    ],
    boundaryRules: [
      onboardingBoundaryRule,
      desktopBridgeBoundaryRule,
      {
        title: "Core Locked",
        detail: "Operators can use and observe the system, but cannot rewrite Goal OS, Skill OS, or promotion policy from the shell.",
      },
      {
        title: "Tenant-Scoped Memory",
        detail: "Organization, workspace, and personal traces stay isolated; the shell exposes rollout state, not raw tenant memory.",
      },
      {
        title: "Abstracted Learning",
        detail: "Only repeated structural evidence should flow upward. Raw tenant knowledge stays local to the pilot workspace.",
      },
    ],
    promotionRequests,
  };
}

function readCapabilityRegistryEntries() {
  const { capabilityRegistry } = readCoreSources();
  return Array.isArray(capabilityRegistry?.entries)
    ? (capabilityRegistry.entries as Array<Record<string, unknown>>)
    : [];
}

function findPilotCapabilityEntry(capabilityId: string) {
  return readCapabilityRegistryEntries().find(
    (entry) => stringifyValue(entry.capability_id) === capabilityId,
  );
}

function resolvePilotAdvanceAction(stage: string) {
  const action = derivePilotFlowNextAction(stage);
  if (!action.method) {
    throw new Error(`no advance action available for pilot stage: ${stage}`);
  }
  return action;
}

function runCapabilityActionPayload(actionMethod: string) {
  switch (actionMethod) {
    case "sanjin.runCapabilitySchemaValidation":
      return runCapabilitySchemaValidationPayload();
    case "sanjin.runCapabilitySampleRuns":
      return runCapabilitySampleRunsPayload();
    case "sanjin.runCapabilityCandidatePromotion":
      return runCapabilityCandidatePromotionPayload();
    case "sanjin.runCapabilityLimitedActivePromotion":
      return runCapabilityLimitedActivePromotionPayload();
    case "sanjin.runCapabilityLimitedActiveObservation":
      return runCapabilityLimitedActiveObservationPayload();
    case "sanjin.runCapabilityActivePromotion":
      return runCapabilityActivePromotionPayload();
    case "sanjin.runCapabilityActiveObservation":
      return runCapabilityActiveObservationPayload();
    case "sanjin.runCapabilityPostActiveMonitoringWindow":
      return runCapabilityPostActiveMonitoringWindowPayload();
    case "sanjin.runCapabilityAdmissionReview":
      return runCapabilityAdmissionReviewPayload();
    default:
      throw new Error(`unsupported pilot advance action: ${actionMethod}`);
  }
}

function advancePilotFlowPayload(params: Record<string, unknown>) {
  const capabilityId = stringifyValue(params.capabilityId || params.capability_id);
  if (!capabilityId) {
    throw new Error("capabilityId is required");
  }
  const entry = findPilotCapabilityEntry(capabilityId);
  if (!entry) {
    throw new Error(`unknown pilot capability: ${capabilityId}`);
  }
  const tenantContext = resolveTenantContext();
  const previousFlow = buildPilotFlow(entry, tenantContext);
  const nextAction = resolvePilotAdvanceAction(previousFlow.currentStage);
  const actionResult = runCapabilityActionPayload(nextAction.method);
  const updatedEntry = findPilotCapabilityEntry(capabilityId);
  const updatedFlow = updatedEntry ? buildPilotFlow(updatedEntry, tenantContext) : null;
  return {
    generatedAt: new Date().toISOString(),
    capabilityId,
    previousStage: previousFlow.currentStage,
    triggeredActionLabel: nextAction.label,
    triggeredActionMethod: nextAction.method,
    message: `${nextAction.label} completed for ${previousFlow.displayName}.`,
    result: actionResult.result,
    updatedFlow,
  };
}

function refreshTrendPanelsPayload() {
  const results = [
    runSanjinScript("eval/stability_trend_panel.py"),
    runSanjinScript("eval/production_skill_trend_panel.py"),
  ];
  return {
    refreshedAt: new Date().toISOString(),
    message: `Refreshed ${results.length} Sanjin trend panels.`,
    results,
  };
}

function generateSystemReviewPayload() {
  const result = runSanjinScript("eval/generate_system_review.py");
  return {
    generatedAt: new Date().toISOString(),
    message: "Generated Sanjin system review.",
    result,
  };
}

function runGovernanceReviewPayload() {
  const result = runSanjinScript("eval/run_governance_review.py");
  return {
    generatedAt: new Date().toISOString(),
    message: "Ran Sanjin governance review.",
    result,
  };
}

function runCapabilityAdmissionReviewPayload() {
  const result = runSanjinScript("eval/run_capability_admission_review.py");
  return {
    generatedAt: new Date().toISOString(),
    message: "Ran Sanjin capability admission review.",
    result,
  };
}

function runCapabilitySchemaValidationPayload() {
  const result = runSanjinScript("eval/run_capability_schema_validation.py");
  return {
    generatedAt: new Date().toISOString(),
    message: "Ran Sanjin capability schema validation.",
    result,
  };
}

function runCapabilitySampleRunsPayload() {
  const result = runSanjinScript("eval/run_capability_sample_runs.py");
  return {
    generatedAt: new Date().toISOString(),
    message: "Ran Sanjin capability sample runs.",
    result,
  };
}

function runCapabilityCandidatePromotionPayload() {
  const result = runSanjinScript("eval/run_capability_promote_candidates.py");
  return {
    generatedAt: new Date().toISOString(),
    message: "Promoted Sanjin capability candidates.",
    result,
  };
}

function runCapabilityLimitedActivePromotionPayload() {
  const result = runSanjinScript("eval/run_capability_promote_limited_active.py");
  return {
    generatedAt: new Date().toISOString(),
    message: "Promoted Sanjin limited active workflows.",
    result,
  };
}

function runCapabilityLimitedActiveObservationPayload() {
  const result = runSanjinScript("eval/run_capability_limited_active_observation.py");
  return {
    generatedAt: new Date().toISOString(),
    message: "Ran Sanjin limited active observation.",
    result,
  };
}

function runCapabilityActivePromotionPayload() {
  const result = runSanjinScript("eval/run_capability_promote_active.py");
  return {
    generatedAt: new Date().toISOString(),
    message: "Promoted Sanjin ready capabilities to active.",
    result,
  };
}

function runCapabilityActiveObservationPayload() {
  const result = runSanjinScript("eval/run_capability_active_observation.py");
  return {
    generatedAt: new Date().toISOString(),
    message: "Ran Sanjin active observation.",
    result,
  };
}

function runCapabilityPostActiveMonitoringWindowPayload() {
  const result = runSanjinScript("eval/run_capability_post_active_monitoring_window.py");
  return {
    generatedAt: new Date().toISOString(),
    message: "Ran Sanjin post-active monitoring window.",
    result,
  };
}

function createCapabilityDraftPayload(
  params: Record<string, unknown>,
  client: GatewayRequestHandlerOptions["client"] | null = null,
) {
  const tenantContext = resolveTenantContext(process.env, client);
  const capabilityType = stringifyValue(params.capabilityType || params.capability_type || "workflow");
  const displayName = stringifyValue(params.displayName || params.display_name || "Untitled Capability");
  const scopeLabel = normalizeDraftScope(stringifyValue(params.scope), tenantContext);
  const inputPayload = {
    ...params,
    scope: scopeLabel,
  };
  const result = runSanjinScript("eval/create_capability_draft.py", inputPayload);
  const capabilityId = `draft:${capabilityType}:${slugify(displayName)}`;
  return {
    generatedAt: new Date().toISOString(),
    message: "Created Sanjin capability draft.",
    result: {
      ...result,
      capability_id: capabilityId,
      display_name: displayName,
      capability_type: capabilityType,
      admission_stage: "draft",
      status: "draft",
      scope_label: scopeLabel,
      scope_detail: describeCapabilityScope(scopeLabel, tenantContext),
    },
  };
}

export const sanjinHandlers: GatewayRequestHandlers = {
  [SHELL_APP_METHODS.auth.login]: ({ client, params, respond }) => {
    try {
      respond(true, buildAuthLoginPayload(params as Record<string, unknown>, client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.auth.logout]: ({ client, respond }) => {
    try {
      respond(true, buildAuthLogoutPayload(client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.auth.me]: ({ client, respond }) => {
    try {
      respond(true, buildAuthMePayload(client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.tenant.bootstrap]: ({ client, respond }) => {
    try {
      respond(true, buildTenantBootstrapPayload(client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.tenant.listWorkspaces]: ({ client, respond }) => {
    try {
      respond(
        true,
        { generatedAt: new Date().toISOString(), workspaces: buildWorkspaceListPayload(client) },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.tenant.memoryBoundaryGet]: ({ client, respond }) => {
    try {
      respond(true, buildTenantMemoryBoundaryPayload(client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.tenant.selectWorkspace]: ({ client, params, respond }) => {
    try {
      respond(true, selectWorkspacePayload(params as Record<string, unknown>, client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.shell.brainContractGet]: ({ client, respond }) => {
    try {
      respond(true, buildBrainContractPayload(client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.shell.pilotShellGet]: ({ client, respond }) => {
    try {
      respond(true, buildPilotShellPayload(client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.shell.sessionCreate]: async (opts) => {
    try {
      opts.respond(true, await buildShellSessionCreatePayload(opts), undefined);
    } catch (err) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.shell.sessionList]: async (opts) => {
    try {
      opts.respond(true, await buildShellSessionListPayload(opts), undefined);
    } catch (err) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.shell.sessionGet]: async (opts) => {
    try {
      opts.respond(true, await buildShellSessionGetPayload(opts), undefined);
    } catch (err) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.shell.sessionSend]: async (opts) => {
    try {
      opts.respond(true, await buildShellSessionSendPayload(opts), undefined);
    } catch (err) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.shell.sessionStream]: async (opts) => {
    try {
      opts.respond(true, await buildShellSessionStreamPayload(opts), undefined);
    } catch (err) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.capability.list]: ({ client, respond }) => {
    try {
      respond(true, buildCapabilityListPayload(client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.capability.get]: ({ client, params, respond }) => {
    try {
      respond(true, buildCapabilityGetPayload(params as Record<string, unknown>, client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.capability.createDraft]: ({ client, params, respond }) => {
    try {
      respond(true, createCapabilityDraftPayload(params as Record<string, unknown>, client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.capability.advancePilotFlow]: ({ params, respond }) => {
    try {
      respond(true, advancePilotFlowPayload(params as Record<string, unknown>), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.governance.permissionModelGet]: ({ client, respond }) => {
    try {
      respond(true, buildGovernancePermissionModelPayload(client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.governance.consoleList]: ({ client, params, respond }) => {
    try {
      respond(true, buildGovernanceConsoleListPayload(params as Record<string, unknown>, client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.governance.promotionRequestCreate]: ({ client, params, respond }) => {
    try {
      respond(true, buildPromotionRequestCreatePayload(params as Record<string, unknown>, client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.governance.promotionRequestList]: ({ client, respond }) => {
    try {
      respond(true, buildPromotionRequestListPayload(client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.governance.promotionRequestGet]: ({ client, params, respond }) => {
    try {
      respond(true, buildPromotionRequestGetPayload(params as Record<string, unknown>, client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.governance.execute]: (opts) => {
    try {
      opts.respond(true, buildGovernanceExecutePayload(opts), undefined);
    } catch (err) {
      opts.respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.governance.reviewGet]: ({ client, params, respond }) => {
    try {
      respond(true, buildGovernanceReviewGetPayload(params as Record<string, unknown>, client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.governance.gateGet]: ({ client, params, respond }) => {
    try {
      respond(true, buildGovernanceGateGetPayload(params as Record<string, unknown>, client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.governance.auditList]: ({ client, params, respond }) => {
    try {
      respond(true, buildGovernanceAuditListPayload(params as Record<string, unknown>, client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.localBridge.status]: ({ respond }) => {
    try {
      respond(true, buildLocalBridgeStatusPayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.localBridge.nativeProcessEvent]: (opts) => {
    try {
      opts.respond(true, submitLocalBridgeNativeProcessEventPayload(opts), undefined);
    } catch (err) {
      opts.respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.localBridge.requestAction]: async (opts) => {
    try {
      opts.respond(true, await requestLocalBridgeActionPayload(opts), undefined);
    } catch (err) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  [SHELL_APP_METHODS.localBridge.submitActionResult]: (opts) => {
    try {
      opts.respond(true, submitLocalBridgeActionResultPayload(opts), undefined);
    } catch (err) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.pilotShell": ({ client, respond }) => {
    try {
      respond(true, buildPilotShellPayload(client), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.overview": ({ respond }) => {
    try {
      respond(true, buildOverviewPayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.skills": ({ respond }) => {
    try {
      respond(true, buildSkillsPayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.runtime": ({ respond }) => {
    try {
      respond(true, buildRuntimePayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.governance": ({ respond }) => {
    try {
      respond(true, buildGovernancePayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.capabilities": ({ respond }) => {
    try {
      respond(true, buildCapabilitiesPayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.refreshTrends": ({ respond }) => {
    try {
      respond(true, refreshTrendPanelsPayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.generateSystemReview": ({ respond }) => {
    try {
      respond(true, generateSystemReviewPayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.runGovernanceReview": ({ respond }) => {
    try {
      respond(true, runGovernanceReviewPayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.runCapabilityAdmissionReview": ({ respond }) => {
    try {
      respond(true, runCapabilityAdmissionReviewPayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.runCapabilitySchemaValidation": ({ respond }) => {
    try {
      respond(true, runCapabilitySchemaValidationPayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.runCapabilitySampleRuns": ({ respond }) => {
    try {
      respond(true, runCapabilitySampleRunsPayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.runCapabilityCandidatePromotion": ({ respond }) => {
    try {
      respond(true, runCapabilityCandidatePromotionPayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.runCapabilityLimitedActivePromotion": ({ respond }) => {
    try {
      respond(true, runCapabilityLimitedActivePromotionPayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.runCapabilityLimitedActiveObservation": ({ respond }) => {
    try {
      respond(true, runCapabilityLimitedActiveObservationPayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.runCapabilityActivePromotion": ({ respond }) => {
    try {
      respond(true, runCapabilityActivePromotionPayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.runCapabilityActiveObservation": ({ respond }) => {
    try {
      respond(true, runCapabilityActiveObservationPayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.runCapabilityPostActiveMonitoringWindow": ({ respond }) => {
    try {
      respond(true, runCapabilityPostActiveMonitoringWindowPayload(), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.createCapabilityDraft": ({ params, respond }) => {
    try {
      respond(true, createCapabilityDraftPayload(params as Record<string, unknown>), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
  "sanjin.advancePilotFlow": ({ params, respond }) => {
    try {
      respond(true, advancePilotFlowPayload(params as Record<string, unknown>), undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
    }
  },
};
