import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ShellGovernanceAuditListResponse,
  ShellGovernanceConsoleListRequest,
  ShellGovernanceConsoleListResponse,
  ShellGovernanceGateGetResponse,
  ShellGovernanceReviewGetResponse,
} from "./shell-app-contract.js";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLAYGROUND_ROOT = path.resolve(CURRENT_DIR, "../../..");
const GOVERNANCE_READ_SCRIPT = path.join(
  PLAYGROUND_ROOT,
  "core",
  "goal_os_protocols",
  "run_governance_read_surface.py",
);

type JsonObject = Record<string, unknown>;

function runGovernanceReadSurface(params: {
  sanjinRoot: string;
  input: Record<string, unknown>;
}): JsonObject {
  const result = spawnSync("python3", [GOVERNANCE_READ_SCRIPT], {
    cwd: PLAYGROUND_ROOT,
    encoding: "utf8",
    timeout: 120_000,
    input: JSON.stringify({
      project_root: params.sanjinRoot,
      ...params.input,
    }),
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `run_governance_read_surface failed (${result.status}): ${String(
        result.stderr || result.stdout || "",
      ).trim()}`,
    );
  }
  const payload = JSON.parse(result.stdout || "{}") as unknown;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("governance read surface returned a non-object payload");
  }
  return payload as JsonObject;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

export function listShellGovernanceConsole(params: {
  sanjinRoot: string;
  query?: ShellGovernanceConsoleListRequest["query"];
}): ShellGovernanceConsoleListResponse {
  const payload = runGovernanceReadSurface({
    sanjinRoot: params.sanjinRoot,
    input: {
      mode: "console_list",
      query: params.query ?? {},
    },
  });
  return {
    generatedAt: new Date().toISOString(),
    sourceFiles: toStringArray(payload.source_files ?? payload.sourceFiles),
    entries: (Array.isArray(payload.entries) ? payload.entries : []).map((item) => {
      const entry = toObject(item);
      return {
        skillId: String(entry.skillId ?? ""),
        reviewId: toNullableString(entry.reviewId),
        gateId: toNullableString(entry.gateId),
        shadowId: toNullableString(entry.shadowId),
        requestId: toNullableString(entry.requestId),
        requestOrigin: toNullableString(entry.requestOrigin),
        entryKind:
          entry.entryKind === "gate" || entry.entryKind === "shadow" ? entry.entryKind : "review",
        reviewLifecycleStatus: toNullableString(entry.reviewLifecycleStatus),
        reviewQueueStatus: toNullableString(entry.reviewQueueStatus),
        governanceQueueStatus: toNullableString(entry.governanceQueueStatus),
        gateStatus: toNullableString(entry.gateStatus),
        effectiveRolloutLabel: toNullableString(entry.effectiveRolloutLabel),
        rolloutControlSource: toNullableString(entry.rolloutControlSource),
        rolloutContextCount: toNumber(entry.rolloutContextCount),
        shadowStatus: toNullableString(entry.shadowStatus),
        availableNextActions: toStringArray(entry.availableNextActions),
        latestActionLabel: toNullableString(entry.latestActionLabel),
        latestActorRole: toNullableString(entry.latestActorRole),
        consoleSummary: toNullableString(entry.consoleSummary),
        lastUpdatedAt: toNullableString(entry.lastUpdatedAt),
      };
    }),
  };
}

export function getShellGovernanceReview(params: {
  sanjinRoot: string;
  reviewId?: string;
  requestId?: string;
}): ShellGovernanceReviewGetResponse {
  const payload = runGovernanceReadSurface({
    sanjinRoot: params.sanjinRoot,
    input: {
      mode: "review_detail",
      review_id: params.reviewId,
      request_id: params.requestId,
    },
  });
  const detail = toObject(payload);
  const review = toObject(detail.review);
  const reviewQueueLinkage = toObject(detail.review_queue_linkage ?? detail.reviewQueueLinkage);
  const governanceLinkage = toObject(detail.governance_linkage ?? detail.governanceLinkage);
  return {
    generatedAt: new Date().toISOString(),
    sourceFiles: toStringArray(detail.source_files ?? detail.sourceFiles),
    detail: {
      review: {
        reviewId: toNullableString(review.reviewId),
        skillId: String(review.skillId ?? ""),
        requestId: toNullableString(review.requestId),
        requestOrigin: toNullableString(review.requestOrigin),
        lifecycleStatus: toNullableString(review.lifecycleStatus),
        candidateStatus: toNullableString(review.candidateStatus),
        reviewSummary: toNullableString(review.reviewSummary),
        reviewLayer: toNullableString(review.reviewLayer),
        lastActorId: toNullableString(review.lastActorId),
        lastActorRole: toNullableString(review.lastActorRole),
        actedAt: toNullableString(review.actedAt),
        createdAt: toNullableString(review.createdAt),
      },
      requestRecord: (detail.request_record ?? detail.requestRecord ?? null) as ShellGovernanceReviewGetResponse["detail"]["requestRecord"],
      reviewQueueLinkage: {
        reviewQueueId: toNullableString(reviewQueueLinkage.reviewQueueId),
        reviewQueueStatus: toNullableString(reviewQueueLinkage.reviewQueueStatus),
      },
      governanceLinkage: {
        governanceQueueId: toNullableString(governanceLinkage.governanceQueueId),
        governanceQueueStatus: toNullableString(governanceLinkage.governanceQueueStatus),
        gateId: toNullableString(governanceLinkage.gateId),
        gateStatus: toNullableString(governanceLinkage.gateStatus),
      },
      latestDecisionSummary: toNullableString(detail.latest_decision_summary ?? detail.latestDecisionSummary),
      availableNextActions: toStringArray(detail.available_next_actions ?? detail.availableNextActions),
    },
  };
}

export function getShellGovernanceGate(params: {
  sanjinRoot: string;
  gateId: string;
}): ShellGovernanceGateGetResponse {
  const payload = runGovernanceReadSurface({
    sanjinRoot: params.sanjinRoot,
    input: {
      mode: "gate_detail",
      gate_id: params.gateId,
    },
  });
  const detail = toObject(payload);
  const gate = toObject(detail.gate);
  const reviewLinkage = toObject(detail.review_linkage ?? detail.reviewLinkage);
  const rolloutLinkage = toObject(detail.rollout_linkage ?? detail.rolloutLinkage);
  return {
    generatedAt: new Date().toISOString(),
    sourceFiles: toStringArray(detail.source_files ?? detail.sourceFiles),
    detail: {
      gate: {
        gateId: String(gate.gateId ?? ""),
        reviewId: String(gate.reviewId ?? ""),
        skillId: String(gate.skillId ?? ""),
        requestId: toNullableString(gate.requestId),
        requestOrigin: toNullableString(gate.requestOrigin),
        gateStatus: String(gate.gateStatus ?? "unknown"),
        gateAction: toNullableString(gate.gateAction),
        rolloutGateLabel: toNullableString(gate.rolloutGateLabel),
        effectiveRolloutLabel: toNullableString(gate.effectiveRolloutLabel),
        validationLayer: String(gate.validationLayer ?? "unknown"),
        approvalRequired: Boolean(gate.approvalRequired),
        rollbackReady: Boolean(gate.rollbackReady),
        rollbackPlanLabel: toNullableString(gate.rollbackPlanLabel),
        lastActionLabel: toNullableString(gate.lastActionLabel),
        lastActorId: toNullableString(gate.lastActorId),
        lastActorRole: toNullableString(gate.lastActorRole),
        actedAt: toNullableString(gate.actedAt),
        gateSummary: toNullableString(gate.gateSummary),
        createdAt: toNullableString(gate.createdAt),
      },
      requestRecord: (detail.request_record ?? detail.requestRecord ?? null) as ShellGovernanceGateGetResponse["detail"]["requestRecord"],
      reviewLinkage: {
        reviewId: toNullableString(reviewLinkage.reviewId),
        requestId: toNullableString(reviewLinkage.requestId),
        requestOrigin: toNullableString(reviewLinkage.requestOrigin),
      },
      rolloutLinkage: {
        effectiveRolloutLabel: toNullableString(rolloutLinkage.effectiveRolloutLabel),
        rolloutGateLabel: toNullableString(rolloutLinkage.rolloutGateLabel),
        rolloutLane: toNullableString(rolloutLinkage.rolloutLane),
        rolloutControls: (Array.isArray(rolloutLinkage.rolloutControls)
          ? rolloutLinkage.rolloutControls
          : []
        ).map((item) => {
          const control = toObject(item);
          return {
            skillId: String(control.skillId ?? ""),
            rolloutLabel: String(control.rolloutLabel ?? "unknown"),
            controlSource: toNullableString(control.controlSource),
            governanceGateId: toNullableString(control.governanceGateId),
            governanceGateStatus: toNullableString(control.governanceGateStatus),
            allowedContextKeys: toStringArray(control.allowedContextKeys),
            preferredRoles: toStringArray(control.preferredRoles),
            controlSummary: toNullableString(control.controlSummary),
            updatedAt: toNullableString(control.updatedAt),
          };
        }),
      },
      shadowLinkage: (Array.isArray(detail.shadow_linkage ?? detail.shadowLinkage)
        ? (detail.shadow_linkage ?? detail.shadowLinkage)
        : []
      ).map((item) => {
        const shadow = toObject(item);
        return {
          shadowId: String(shadow.shadowId ?? ""),
          gateId: String(shadow.gateId ?? ""),
          reviewId: String(shadow.reviewId ?? ""),
          requestId: toNullableString(shadow.requestId),
          requestOrigin: toNullableString(shadow.requestOrigin),
          shadowStatus: String(shadow.shadowStatus ?? "unknown"),
          expectedRolloutLabel: toNullableString(shadow.expectedRolloutLabel),
          observedSuccessRate: toNumber(shadow.observedSuccessRate),
          observedRiskRate: toNumber(shadow.observedRiskRate),
          recommendedAction: toNullableString(shadow.recommendedAction),
          shadowSummary: toNullableString(shadow.shadowSummary),
          createdAt: toNullableString(shadow.createdAt),
          updatedAt: toNullableString(shadow.updatedAt),
        };
      }),
      latestAction: (() => {
        const action = toObject(detail.latest_action ?? detail.latestAction);
        if (!Object.keys(action).length) {
          return null;
        }
        return {
          actionId: String(action.actionId ?? ""),
          gateId: String(action.gateId ?? ""),
          reviewId: String(action.reviewId ?? ""),
          actionLabel: String(action.actionLabel ?? "unknown"),
          actorId: toNullableString(action.actorId),
          actorRole: toNullableString(action.actorRole),
          actionReason: toNullableString(action.actionReason),
          actionSummary: toNullableString(action.actionSummary),
          createdAt: toNullableString(action.createdAt),
        };
      })(),
      latestAudit: (() => {
        const audit = toObject(detail.latest_audit ?? detail.latestAudit);
        if (!Object.keys(audit).length) {
          return null;
        }
        return {
          auditId: String(audit.auditId ?? ""),
          gateId: String(audit.gateId ?? ""),
          reviewId: String(audit.reviewId ?? ""),
          actionLabel: String(audit.actionLabel ?? "unknown"),
          previousGateStatus: toNullableString(audit.previousGateStatus),
          newGateStatus: toNullableString(audit.newGateStatus),
          previousRolloutLabel: toNullableString(audit.previousRolloutLabel),
          newRolloutLabel: toNullableString(audit.newRolloutLabel),
          actorId: toNullableString(audit.actorId),
          actorRole: toNullableString(audit.actorRole),
          auditSummary: toNullableString(audit.auditSummary),
          createdAt: toNullableString(audit.createdAt),
        };
      })(),
      availableNextActions: toStringArray(detail.available_next_actions ?? detail.availableNextActions),
    },
  };
}

export function listShellGovernanceAudit(params: {
  sanjinRoot: string;
  gateId?: string;
  requestId?: string;
  reviewId?: string;
  shadowId?: string;
}): ShellGovernanceAuditListResponse {
  const payload = runGovernanceReadSurface({
    sanjinRoot: params.sanjinRoot,
    input: {
      mode: "audit_list",
      gate_id: params.gateId,
      request_id: params.requestId,
      review_id: params.reviewId,
      shadow_id: params.shadowId,
    },
  });
  return {
    generatedAt: new Date().toISOString(),
    sourceFiles: toStringArray(payload.source_files ?? payload.sourceFiles),
    requestId: toNullableString(payload.request_id ?? payload.requestId),
    reviewId: toNullableString(payload.review_id ?? payload.reviewId),
    gateId: toNullableString(payload.gate_id ?? payload.gateId),
    shadowId: toNullableString(payload.shadow_id ?? payload.shadowId),
    entries: (Array.isArray(payload.entries) ? payload.entries : []).map((item) => {
      const entry = toObject(item);
      return {
        kind: String(entry.kind ?? "governance_audit") as ShellGovernanceAuditListResponse["entries"][number]["kind"],
        summary: String(entry.summary ?? ""),
        actorId: toNullableString(entry.actorId),
        actorRole: toNullableString(entry.actorRole),
        requestId: toNullableString(entry.requestId),
        reviewId: toNullableString(entry.reviewId),
        gateId: toNullableString(entry.gateId),
        shadowId: toNullableString(entry.shadowId),
        occurredAt: toNullableString(entry.occurredAt),
      };
    }),
  };
}
