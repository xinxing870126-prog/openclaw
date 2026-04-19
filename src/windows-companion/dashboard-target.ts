import { dashboardCommand } from "../commands/dashboard.js";
import { defaultRuntime, type RuntimeEnv } from "../runtime.js";
import type { WindowsCompanionTrayAction, WindowsCompanionTrayHealthState } from "./tray.js";

export type WindowsCompanionDashboardTargetReason =
  | "action_required"
  | "degraded"
  | "repair_needed"
  | null;

export type WindowsCompanionDashboardTarget = {
  shellPanel: "workbench" | "selectWorkspace" | "sessions" | "capabilities" | "settings";
  shellSession: string | null;
  shellFocus: "pendingAction" | "timeline" | null;
  actionId: string | null;
  resultActionId: string | null;
  controlUiPath: string;
  reason: WindowsCompanionDashboardTargetReason;
  primaryAction: WindowsCompanionTrayAction;
  primaryActionLabel: string;
  reviewDesktopHealthVisible: boolean;
};

function buildShellControlUiPath(target: Pick<
  WindowsCompanionDashboardTarget,
  "shellPanel" | "shellSession" | "shellFocus" | "actionId" | "resultActionId"
>): string {
  let path = "/shell";
  switch (target.shellPanel) {
    case "selectWorkspace":
      path = "/shell/select-workspace";
      break;
    case "sessions":
      path = target.shellSession
        ? `/shell/sessions/${encodeURIComponent(target.shellSession)}`
        : "/shell/sessions";
      break;
    case "capabilities":
      path = "/shell/capabilities";
      break;
    case "settings":
      path = "/shell/settings";
      break;
    case "workbench":
    default:
      path = "/shell";
      break;
  }
  if (target.shellPanel === "sessions" && target.shellFocus) {
    const params = new URLSearchParams();
    params.set("shellFocus", target.shellFocus);
    if (target.shellFocus === "pendingAction" && target.actionId) {
      params.set("shellAction", target.actionId);
    }
    if (target.shellFocus === "timeline" && target.resultActionId) {
      params.set("shellResultAction", target.resultActionId);
    }
    return `${path}?${params.toString()}`;
  }
  return path;
}

export function resolveWindowsCompanionDashboardTarget(params: {
  healthState: WindowsCompanionTrayHealthState;
  pendingNativeActionCount?: number | null;
  pendingActionSessionKey?: string | null;
  pendingActionId?: string | null;
  resolvedActionSessionKey?: string | null;
  resolvedActionId?: string | null;
  resolvedActionOutcome?: "completed" | "rejected" | null;
}): WindowsCompanionDashboardTarget {
  const pendingNativeActionCount =
    typeof params.pendingNativeActionCount === "number" ? params.pendingNativeActionCount : 0;
  const pendingActionSessionKey = params.pendingActionSessionKey?.trim() || null;
  const pendingActionId = params.pendingActionId?.trim() || null;
  const resolvedActionSessionKey = params.resolvedActionSessionKey?.trim() || null;
  const resolvedActionId = params.resolvedActionId?.trim() || null;
  if (params.healthState === "repair_needed") {
    const target: WindowsCompanionDashboardTarget = {
      shellPanel: "settings",
      shellSession: null,
      shellFocus: null,
      actionId: null,
      resultActionId: null,
      controlUiPath: "",
      reason: "repair_needed",
      primaryAction: "repair_openclaw",
      primaryActionLabel: "Repair OpenClaw",
      reviewDesktopHealthVisible: true,
    };
    target.controlUiPath = buildShellControlUiPath(target);
    return target;
  }
  if (pendingNativeActionCount > 0) {
    const target: WindowsCompanionDashboardTarget = {
      shellPanel: "sessions",
      shellSession: pendingActionSessionKey,
      shellFocus: "pendingAction",
      actionId: pendingActionId,
      resultActionId: null,
      controlUiPath: "",
      reason: "action_required",
      primaryAction: "open_dashboard",
      primaryActionLabel: "Open Pending Action",
      reviewDesktopHealthVisible: false,
    };
    target.controlUiPath = buildShellControlUiPath(target);
    return target;
  }
  if (resolvedActionSessionKey && resolvedActionId) {
    const target: WindowsCompanionDashboardTarget = {
      shellPanel: "sessions",
      shellSession: resolvedActionSessionKey,
      shellFocus: "timeline",
      actionId: null,
      resultActionId: resolvedActionId,
      controlUiPath: "",
      reason: null,
      primaryAction: "open_dashboard",
      primaryActionLabel: "Open Latest Local Action Result",
      reviewDesktopHealthVisible: false,
    };
    target.controlUiPath = buildShellControlUiPath(target);
    return target;
  }
  if (params.healthState === "degraded") {
    const target: WindowsCompanionDashboardTarget = {
      shellPanel: "settings",
      shellSession: null,
      shellFocus: null,
      actionId: null,
      resultActionId: null,
      controlUiPath: "",
      reason: "degraded",
      primaryAction: "open_dashboard",
      primaryActionLabel: "Review Desktop Health",
      reviewDesktopHealthVisible: false,
    };
    target.controlUiPath = buildShellControlUiPath(target);
    return target;
  }
  const target: WindowsCompanionDashboardTarget = {
    shellPanel: "workbench",
    shellSession: null,
    shellFocus: null,
    actionId: null,
    resultActionId: null,
    controlUiPath: "",
    reason: null,
    primaryAction: "open_dashboard",
    primaryActionLabel: "Open Dashboard",
    reviewDesktopHealthVisible: false,
  };
  target.controlUiPath = buildShellControlUiPath(target);
  return target;
}

export async function openWindowsCompanionDashboardTarget(
  target: WindowsCompanionDashboardTarget,
  runtime: RuntimeEnv = defaultRuntime,
): Promise<void> {
  await dashboardCommand(runtime, {
    shellPanel: target.shellPanel,
    shellSession: target.shellSession,
    shellFocus: target.shellFocus,
    shellAction: target.actionId,
    shellResultAction: target.resultActionId,
  });
}
