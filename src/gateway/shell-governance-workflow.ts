import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ShellGovernanceExecuteRequest,
  ShellGovernanceExecuteResponse,
  ShellTenantPromotionRequestRecord,
} from "./shell-app-contract.js";
import {
  getTenantPromotionRequestRecord,
  updateTenantPromotionRequestRecord,
} from "./shell-promotion-requests.js";
import type { ShellTenantContext } from "./shell-app-contract.js";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLAYGROUND_ROOT = path.resolve(CURRENT_DIR, "../../..");
const GOVERNANCE_WORKFLOW_SCRIPT = path.join(
  PLAYGROUND_ROOT,
  "core",
  "goal_os_protocols",
  "run_governance_workflow.py",
);

type ShellGovernanceWorkflowStorage = {
  sanjinRoot: string;
};

type GovernanceWorkflowPayload = {
  updated_request_record?: Record<string, unknown>;
  review_record?: Record<string, unknown>;
  review_queue_item?: Record<string, unknown>;
  decision_record?: Record<string, unknown>;
  governance_queue_item?: Record<string, unknown>;
  gate_record?: Record<string, unknown>;
  shadow_record?: Record<string, unknown>;
  action_record?: Record<string, unknown>;
  audit_record?: Record<string, unknown>;
};

const PROMOTION_REQUEST_ACTIONS = [
  "intake_promotion_request",
  "reject_promotion_request_review",
  "admit_promotion_request_review_to_gate",
] as const;

const REQUEST_ORIGIN_GATE_ACTIONS = [
  "approve_gate",
  "reject_gate",
  "rollback_gate",
  "open_shadow",
] as const;

const REQUEST_ORIGIN_SHADOW_ACTIONS = [
  "submit_shadow_pass",
  "submit_shadow_fail",
] as const;

function assertPromotionRequestGovernanceAction(params: {
  request: ShellGovernanceExecuteRequest;
  actorRole: string;
  record: ShellTenantPromotionRequestRecord | null;
}): ShellTenantPromotionRequestRecord {
  if (!PROMOTION_REQUEST_ACTIONS.includes(params.request.actionLabel as (typeof PROMOTION_REQUEST_ACTIONS)[number])) {
    throw new Error(`unsupported governance action: ${params.request.actionLabel}`);
  }
  if (params.actorRole !== "brain_owner") {
    throw new Error(`Only brain_owner may execute ${params.request.actionLabel}`);
  }
  if (!params.record) {
    throw new Error(`unknown promotion request: ${params.request.targetId ?? ""}`);
  }
  if (params.request.actionLabel === "intake_promotion_request" && params.record.status !== "submitted") {
    throw new Error("only submitted promotion requests may enter brain-side intake");
  }
  if (
    [
      "reject_promotion_request_review",
      "admit_promotion_request_review_to_gate",
    ].includes(params.request.actionLabel)
    && params.record.status !== "under_review"
  ) {
    throw new Error("only under_review promotion requests may enter brain-side review decision");
  }
  if (
    [
      "reject_promotion_request_review",
      "admit_promotion_request_review_to_gate",
    ].includes(params.request.actionLabel)
    && !params.record.reviewId
  ) {
    throw new Error("reviewId is required for request-origin review decision");
  }
  return params.record;
}

function readRequestIdFromMetadata(
  request: ShellGovernanceExecuteRequest,
): string {
  const metadata = request.metadata ?? {};
  const value = metadata.requestId ?? metadata.request_id ?? "";
  return typeof value === "string" ? value.trim() : "";
}

function assertRequestOriginFollowthroughAction(params: {
  request: ShellGovernanceExecuteRequest;
  actorRole: string;
  record: ShellTenantPromotionRequestRecord | null;
}): ShellTenantPromotionRequestRecord {
  const actionLabel = params.request.actionLabel;
  if (
    !REQUEST_ORIGIN_GATE_ACTIONS.includes(actionLabel as (typeof REQUEST_ORIGIN_GATE_ACTIONS)[number])
    && !REQUEST_ORIGIN_SHADOW_ACTIONS.includes(actionLabel as (typeof REQUEST_ORIGIN_SHADOW_ACTIONS)[number])
  ) {
    throw new Error(`unsupported request-origin governance action: ${actionLabel}`);
  }
  if (params.actorRole !== "brain_owner") {
    throw new Error(`Only brain_owner may execute ${actionLabel}`);
  }
  if (!params.record) {
    throw new Error("metadata.requestId must reference a known promotion request");
  }
  if (params.record.status !== "admitted_to_gate") {
    throw new Error("only admitted_to_gate promotion requests may enter gate/shadow follow-through");
  }
  const targetId = params.request.targetId?.trim() ?? "";
  if (!targetId) {
    throw new Error("targetId is required for gate/shadow follow-through");
  }
  if (REQUEST_ORIGIN_GATE_ACTIONS.includes(actionLabel as (typeof REQUEST_ORIGIN_GATE_ACTIONS)[number])) {
    if ((params.request.targetType ?? "gate") !== "gate") {
      throw new Error(`request-origin action ${actionLabel} requires targetType=gate`);
    }
    if (!params.record.gateId || params.record.gateId !== targetId) {
      throw new Error("target gate does not match the stored promotion request linkage");
    }
  }
  if (REQUEST_ORIGIN_SHADOW_ACTIONS.includes(actionLabel as (typeof REQUEST_ORIGIN_SHADOW_ACTIONS)[number])) {
    if ((params.request.targetType ?? "shadow") !== "shadow") {
      throw new Error(`request-origin action ${actionLabel} requires targetType=shadow`);
    }
    if (!params.record.shadowId || params.record.shadowId !== targetId) {
      throw new Error("target shadow does not match the stored promotion request linkage");
    }
    if (!params.record.gateId) {
      throw new Error("request-origin shadow follow-through requires gate linkage");
    }
  }
  return params.record;
}

function normalizeWorkflowPayload(payload: unknown): GovernanceWorkflowPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  return payload as GovernanceWorkflowPayload;
}

function toShellPromotionRequestRecord(payload: Record<string, unknown>): ShellTenantPromotionRequestRecord {
  const tenantContext = (
    payload.tenantContext
    ?? payload.tenant_context
    ?? {}
  ) as Record<string, unknown>;
  const evidence = (payload.evidence ?? {}) as Record<string, unknown>;
  return {
    requestId: String(payload.requestId ?? payload.request_id ?? ""),
    tenantContext: {
      orgId: String(tenantContext.orgId ?? tenantContext.org_id ?? ""),
      workspaceId: String(tenantContext.workspaceId ?? tenantContext.workspace_id ?? ""),
      userId: String(tenantContext.userId ?? tenantContext.user_id ?? ""),
      isolationModel: String(
        tenantContext.isolationModel
        ?? tenantContext.isolation_model
        ?? "org / workspace / user",
      ),
      writeBoundary: String(
        tenantContext.writeBoundary
        ?? tenantContext.write_boundary
        ?? "tenant_local_only",
      ),
      promotionBoundary: String(
        tenantContext.promotionBoundary
        ?? tenantContext.promotion_boundary
        ?? "governed_cross_tenant_only",
      ),
    },
    actorId: String(payload.actorId ?? payload.actor_id ?? ""),
    actorRole: String(payload.actorRole ?? payload.actor_role ?? "tenant_operator") as ShellTenantPromotionRequestRecord["actorRole"],
    requestReason: String(payload.requestReason ?? payload.request_reason ?? ""),
    status: String(payload.status ?? "submitted") as ShellTenantPromotionRequestRecord["status"],
    evidence: {
      evidenceKind: String(
        evidence.evidenceKind
        ?? evidence.evidence_kind
        ?? "execution_evidence",
      ) as ShellTenantPromotionRequestRecord["evidence"]["evidenceKind"],
      title: String(evidence.title ?? ""),
      detail: String(evidence.detail ?? ""),
      sourceRefs: Array.isArray(evidence.sourceRefs ?? evidence.source_refs)
        ? (evidence.sourceRefs ?? evidence.source_refs).filter(
            (value): value is string => typeof value === "string",
          )
        : [],
      capabilityId:
        typeof (evidence.capabilityId ?? evidence.capability_id) === "string"
          ? String(evidence.capabilityId ?? evidence.capability_id)
          : null,
      recommendedFocus:
        typeof (evidence.recommendedFocus ?? evidence.recommended_focus) === "string"
          ? String(evidence.recommendedFocus ?? evidence.recommended_focus)
          : null,
      sessionKey:
        typeof (evidence.sessionKey ?? evidence.session_key) === "string"
          ? String(evidence.sessionKey ?? evidence.session_key)
          : null,
      actionId:
        typeof (evidence.actionId ?? evidence.action_id) === "string"
          ? String(evidence.actionId ?? evidence.action_id)
          : null,
      resultActionId:
        typeof (evidence.resultActionId ?? evidence.result_action_id) === "string"
          ? String(evidence.resultActionId ?? evidence.result_action_id)
          : null,
    },
    decisionSummary:
      typeof (payload.decisionSummary ?? payload.decision_summary) === "string"
        ? String(payload.decisionSummary ?? payload.decision_summary)
        : null,
    reviewId:
      typeof (payload.reviewId ?? payload.review_id) === "string"
        ? String(payload.reviewId ?? payload.review_id)
        : null,
    reviewQueueId:
      typeof (payload.reviewQueueId ?? payload.review_queue_id) === "string"
        ? String(payload.reviewQueueId ?? payload.review_queue_id)
        : null,
    governanceQueueId:
      typeof (payload.governanceQueueId ?? payload.governance_queue_id) === "string"
        ? String(payload.governanceQueueId ?? payload.governance_queue_id)
        : null,
    governanceQueueStatus:
      typeof (payload.governanceQueueStatus ?? payload.governance_queue_status) === "string"
        ? String(payload.governanceQueueStatus ?? payload.governance_queue_status)
        : null,
    gateId:
      typeof (payload.gateId ?? payload.gate_id) === "string"
        ? String(payload.gateId ?? payload.gate_id)
        : null,
    gateStatus:
      typeof (payload.gateStatus ?? payload.gate_status) === "string"
        ? String(payload.gateStatus ?? payload.gate_status)
        : null,
    shadowId:
      typeof (payload.shadowId ?? payload.shadow_id) === "string"
        ? String(payload.shadowId ?? payload.shadow_id)
        : null,
    shadowStatus:
      typeof (payload.shadowStatus ?? payload.shadow_status) === "string"
        ? String(payload.shadowStatus ?? payload.shadow_status)
        : null,
    rolloutLabel:
      typeof (payload.rolloutLabel ?? payload.rollout_label) === "string"
        ? String(payload.rolloutLabel ?? payload.rollout_label)
        : null,
    rolloutControlId:
      typeof (payload.rolloutControlId ?? payload.rollout_control_id) === "string"
        ? String(payload.rolloutControlId ?? payload.rollout_control_id)
        : null,
    rolloutControlStatus:
      typeof (payload.rolloutControlStatus ?? payload.rollout_control_status) === "string"
        ? String(payload.rolloutControlStatus ?? payload.rollout_control_status)
        : null,
    rolloutControlSource:
      typeof (payload.rolloutControlSource ?? payload.rollout_control_source) === "string"
        ? String(payload.rolloutControlSource ?? payload.rollout_control_source)
        : null,
    rolloutContextKeys: Array.isArray(payload.rolloutContextKeys ?? payload.rollout_context_keys)
      ? (payload.rolloutContextKeys ?? payload.rollout_context_keys).filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    rolloutPreferredRoles: Array.isArray(payload.rolloutPreferredRoles ?? payload.rollout_preferred_roles)
      ? (payload.rolloutPreferredRoles ?? payload.rollout_preferred_roles).filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    rolloutControlSummary:
      typeof (payload.rolloutControlSummary ?? payload.rollout_control_summary) === "string"
        ? String(payload.rolloutControlSummary ?? payload.rollout_control_summary)
        : null,
    rolloutRollbackReason:
      typeof (payload.rolloutRollbackReason ?? payload.rollout_rollback_reason) === "string"
        ? String(payload.rolloutRollbackReason ?? payload.rollout_rollback_reason)
        : null,
    latestGovernanceActionLabel:
      typeof (payload.latestGovernanceActionLabel ?? payload.latest_governance_action_label) === "string"
        ? String(payload.latestGovernanceActionLabel ?? payload.latest_governance_action_label)
        : null,
    lastAuditSummary:
      typeof (payload.lastAuditSummary ?? payload.last_audit_summary) === "string"
        ? String(payload.lastAuditSummary ?? payload.last_audit_summary)
        : null,
    reviewStatus:
      typeof (payload.reviewStatus ?? payload.review_status) === "string"
        ? String(payload.reviewStatus ?? payload.review_status)
        : null,
    decisionActorId:
      typeof (payload.decisionActorId ?? payload.decision_actor_id) === "string"
        ? String(payload.decisionActorId ?? payload.decision_actor_id)
        : null,
    decisionActorRole:
      typeof (payload.decisionActorRole ?? payload.decision_actor_role) === "string"
        ? String(payload.decisionActorRole ?? payload.decision_actor_role)
        : null,
    decisionAt:
      typeof (payload.decisionAt ?? payload.decision_at) === "string"
        ? String(payload.decisionAt ?? payload.decision_at)
        : null,
    lastGovernanceTransitionAt:
      typeof (payload.lastGovernanceTransitionAt ?? payload.last_governance_transition_at) === "string"
        ? String(payload.lastGovernanceTransitionAt ?? payload.last_governance_transition_at)
        : null,
    createdAt: String(payload.createdAt ?? payload.created_at ?? ""),
    updatedAt: String(payload.updatedAt ?? payload.updated_at ?? ""),
  };
}

function runWorkflow(request: Record<string, unknown>): ShellGovernanceExecuteResponse {
  const result = spawnSync(
    "python3",
    [GOVERNANCE_WORKFLOW_SCRIPT],
    {
      cwd: PLAYGROUND_ROOT,
      encoding: "utf8",
      timeout: 120_000,
      input: JSON.stringify({
        project_root: PLAYGROUND_ROOT,
        request,
      }),
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `run_governance_workflow.py failed (${result.status}): ${(result.stderr || result.stdout || "").trim()}`,
    );
  }
  const payload = JSON.parse((result.stdout || "{}").trim()) as Record<string, unknown>;
  return {
    generatedAt: new Date().toISOString(),
    workflowStatus: String(payload.workflow_status ?? "failed") as ShellGovernanceExecuteResponse["workflowStatus"],
    actionLabel: String(payload.action_label ?? request.action_label ?? ""),
    targetId: typeof payload.target_id === "string" ? payload.target_id : null,
    targetType: String(payload.target_type ?? "gate"),
    gateId: typeof payload.gate_id === "string" ? payload.gate_id : null,
    shadowId: typeof payload.shadow_id === "string" ? payload.shadow_id : null,
    gateStatus: typeof payload.gate_status === "string" ? payload.gate_status : null,
    shadowStatus: typeof payload.shadow_status === "string" ? payload.shadow_status : null,
    rolloutLabel: typeof payload.rollout_label === "string" ? payload.rollout_label : null,
    availableNextActions: Array.isArray(payload.available_next_actions)
      ? payload.available_next_actions.filter((value): value is string => typeof value === "string")
      : [],
    consoleEntrySummary:
      payload.console_entry_summary && typeof payload.console_entry_summary === "object"
        ? (payload.console_entry_summary as Record<string, unknown>)
        : {},
    errorMessage: typeof payload.error_message === "string" ? payload.error_message : null,
    resultSummary: typeof payload.result_summary === "string" ? payload.result_summary : null,
    payload: normalizeWorkflowPayload(payload.payload),
  };
}

export function executeGovernanceWorkflow(params: {
  storage: ShellGovernanceWorkflowStorage;
  tenantContext: ShellTenantContext;
  actorId: string;
  actorRole: string;
  request: ShellGovernanceExecuteRequest;
}): ShellGovernanceExecuteResponse {
  const requestId =
    (params.request.targetType === "promotion_request"
      ? params.request.targetId?.trim()
      : readRequestIdFromMetadata(params.request))
    ?? "";
  const record = requestId
    ? getTenantPromotionRequestRecord({
        storage: params.storage,
        tenantContext: params.tenantContext,
        requestId,
      })
    : null;
  const directPromotionRequestAction = PROMOTION_REQUEST_ACTIONS.includes(
    params.request.actionLabel as (typeof PROMOTION_REQUEST_ACTIONS)[number],
  );
  const requestOriginFollowthroughAction =
    REQUEST_ORIGIN_GATE_ACTIONS.includes(
      params.request.actionLabel as (typeof REQUEST_ORIGIN_GATE_ACTIONS)[number],
    )
    || REQUEST_ORIGIN_SHADOW_ACTIONS.includes(
      params.request.actionLabel as (typeof REQUEST_ORIGIN_SHADOW_ACTIONS)[number],
    );
  const resolvedRecord = directPromotionRequestAction
    ? assertPromotionRequestGovernanceAction({
        request: params.request,
        actorRole: params.actorRole,
        record,
      })
    : requestOriginFollowthroughAction && requestId
      ? assertRequestOriginFollowthroughAction({
          request: params.request,
          actorRole: params.actorRole,
          record,
        })
      : null;
  const workflowTargetId = params.request.targetId?.trim() ?? "";
  const workflowTargetType = directPromotionRequestAction
    ? (params.request.targetType ?? "promotion_request")
    : (params.request.targetType ?? "gate");
  const workflowResult = runWorkflow({
    action_label: params.request.actionLabel,
    target_id: workflowTargetId,
    target_type: workflowTargetType,
    actor_id: params.actorId,
    actor_role: params.actorRole,
    action_reason: params.request.actionReason ?? null,
    validation_payload: params.request.validationPayload ?? null,
    shadow_payload: params.request.shadowPayload ?? null,
    metadata: {
      ...(params.request.metadata ?? {}),
      ...(resolvedRecord
        ? {
            promotion_request_record: resolvedRecord,
            request_id: resolvedRecord.requestId,
            review_id: resolvedRecord.reviewId,
            gate_id:
              workflowTargetType === "shadow"
                ? resolvedRecord.gateId
                : (params.request.metadata?.gate_id ?? params.request.metadata?.gateId),
          }
        : {}),
    },
  });
  const updatedRecordPayload = workflowResult.payload.updated_request_record;
  if (workflowResult.workflowStatus === "succeeded" && updatedRecordPayload && resolvedRecord) {
    const updatedRecord = toShellPromotionRequestRecord(updatedRecordPayload);
    updateTenantPromotionRequestRecord({
      storage: params.storage,
      tenantContext: params.tenantContext,
      requestId: updatedRecord.requestId,
      updater: () => updatedRecord,
    });
    workflowResult.payload.updated_request_record = updatedRecord;
  }
  return workflowResult;
}
