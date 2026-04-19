import type {
  BrainAccessSnapshot,
  BrainCapabilityRecommendationSurface,
  BrainExplainSurface,
  BrainGovernanceSurface,
  BrainPlanningSurface,
  BrainReviewDecisionSurface,
  ShellBrainAccessSurface,
  ShellPilotFlow,
  ShellTenantContext,
  ShellTenantPromotionRequestRecord,
} from "./shell-app-contract.js";

type JsonObject = Record<string, unknown>;

export type ShellBrainAccessSourceInput = {
  generatedAt: string;
  tenantContext: ShellTenantContext;
  sourceFiles: string[];
  explainView?: JsonObject | null;
  observability?: JsonObject | null;
  latestGovernanceReview?: JsonObject | null;
  capabilityRegistry?: JsonObject | null;
  pilotFlows?: ShellPilotFlow[];
  promotionRequests?: ShellTenantPromotionRequestRecord[];
};

export function buildShellBrainAccessSurface(
  input: ShellBrainAccessSourceInput,
): ShellBrainAccessSurface {
  const snapshot = buildBrainAccessSnapshot(input);
  return {
    brainId: "sanjin-shared-brain",
    displayName: "Sanjin Shared Brain",
    deploymentBoundary: "server_side_shared_brain_service",
    policyBoundary: "goal_os_skill_os_governance_locked",
    serverSideLocked: true,
    summary:
      `Workspace ${input.tenantContext.workspaceId} reads planning, explain, governance, review, and recommendation state from the shared Sanjin brain surface without gaining policy rewrite authority.`,
    readSurfaces: [
      {
        surfaceId: "session_planning",
        label: "Session Planning",
        detail:
          "Team shells may read the shared brain's planning posture and stage-loop signals for the current tenant session.",
      },
      {
        surfaceId: "capability_recommendation",
        label: "Capability Recommendation",
        detail:
          "Team shells may read rollout posture and capability recommendations, but may not alter admission policy from the shell.",
      },
      {
        surfaceId: "governance_read",
        label: "Governance Read Surface",
        detail:
          "Tenant operators may inspect queue, gate, console, and audit-facing governance posture from the shared brain.",
      },
      {
        surfaceId: "review_decision",
        label: "Review Decision Surface",
        detail:
          "Team shells may read promotion/review outcomes and recommendation labels without mutating promotion policy.",
      },
    ],
    snapshot,
  };
}

export function buildBrainAccessSnapshot(
  input: ShellBrainAccessSourceInput,
): BrainAccessSnapshot {
  const capabilityEntries = Array.isArray(input.capabilityRegistry?.entries)
    ? (input.capabilityRegistry?.entries as JsonObject[])
    : [];
  const planning = buildPlanningSurface(input.explainView);
  const explain = buildExplainSurface(input.explainView, input.observability);
  const governance = buildGovernanceSurface(
    input.observability,
    input.latestGovernanceReview,
    input.promotionRequests ?? [],
  );
  const latestReviewDecision = buildReviewDecisionSurface(input.latestGovernanceReview);
  const capabilityRecommendation = buildCapabilityRecommendationSurface({
    capabilityEntries,
    pilotFlows: input.pilotFlows ?? [],
    latestGovernanceReview: input.latestGovernanceReview,
  });
  return {
    generatedAt: input.generatedAt,
    sourceFiles: input.sourceFiles,
    planning,
    explain,
    governance,
    latestReviewDecision,
    capabilityRecommendation,
  };
}

function buildPlanningSurface(
  explainView?: JsonObject | null,
): BrainPlanningSurface {
  const plannerControl = asRecord(explainView?.skill_planner_control);
  const finalStageAction =
    asString(explainView?.final_stage_action)
    || resolvePlannerStageAction(plannerControl);
  return {
    source: plannerControl ? "planner_control" : "runtime_inference",
    finalStageAction,
    controlSummary:
      asString(explainView?.skill_planner_control_summary)
      || "Planner control snapshot is not available yet.",
    allowStageProgress: asBooleanOrNull(plannerControl?.allow_stage_progress),
    holdCurrentStage: asBooleanOrNull(plannerControl?.hold_current_stage),
    requireStateRefresh: asBooleanOrNull(plannerControl?.require_state_refresh),
    requireSkillChainRebuild: asBooleanOrNull(
      plannerControl?.require_skill_chain_rebuild,
    ),
    requireStageFallback: asBooleanOrNull(plannerControl?.require_stage_fallback),
    requireStageReplan: asBooleanOrNull(plannerControl?.require_stage_replan),
  };
}

function buildExplainSurface(
  explainView?: JsonObject | null,
  observability?: JsonObject | null,
): BrainExplainSurface {
  const fallbackSummary = joinFragments([
    asString(explainView?.skill_chain_summary),
    asString(explainView?.skill_evaluation_summary),
    asString(explainView?.skill_validation_summary),
  ]);
  const observabilitySkillGov = asRecord(observability?.skill_governance_summary);
  const governanceDistribution = asRecord(observabilitySkillGov?.governance_distribution);
  return {
    source: explainView ? "goal_os_explain_view" : "derived",
    summary:
      fallbackSummary
      || `Explain view is not persisted yet; governance currently shows healthy=${stringifyValue(
        governanceDistribution?.healthy ?? 0,
      )} observe=${stringifyValue(governanceDistribution?.observe ?? 0)}.`,
    finalStageAction: asString(explainView?.final_stage_action) || null,
    skillGovernanceStatus:
      asString(explainView?.skill_governance_status)
      || (governanceDistribution ? "mixed" : null)
      || null,
    skillAdmissionLabel: asString(explainView?.skill_admission_label) || null,
    skillRolloutLabel: asString(explainView?.skill_rollout_label) || null,
    skillPreferredRole: asString(explainView?.skill_preferred_role) || null,
    skillPlannerControlSummary:
      asString(explainView?.skill_planner_control_summary) || null,
  };
}

function buildGovernanceSurface(
  observability?: JsonObject | null,
  latestGovernanceReview?: JsonObject | null,
  promotionRequests: ShellTenantPromotionRequestRecord[] = [],
): BrainGovernanceSurface {
  const governanceSummary = asRecord(observability?.governance_review_summary);
  const permissionGate = asRecord(observability?.permission_gate_summary);
  const runtimeRecovery = asRecord(observability?.runtime_recovery_summary);
  const pendingTenantRequests = promotionRequests.filter((entry) => entry.status === "submitted").length;
  const underReviewTenantRequests = promotionRequests.filter((entry) => entry.status === "under_review").length;
  const requestOriginReviewCount = promotionRequests.filter((entry) => entry.reviewId).length;
  const requestOriginReviewsAwaitingDecision = promotionRequests.filter(
    (entry) => entry.status === "under_review" && !entry.gateId,
  ).length;
  const requestOriginReviewsAdmittedToGate = promotionRequests.filter(
    (entry) => entry.status === "admitted_to_gate",
  ).length;
  const requestOriginReviewsRejected = promotionRequests.filter(
    (entry) => entry.status === "rejected" && Boolean(entry.reviewId),
  ).length;
  const requestOriginGatesPendingApproval = promotionRequests.filter(
    (entry) => entry.gateStatus === "pending_approval",
  ).length;
  const requestOriginShadowsPending = promotionRequests.filter(
    (entry) => entry.shadowStatus === "pending_shadow",
  ).length;
  const requestOriginRolloutsActive = promotionRequests.filter(
    (entry) => entry.status === "rolled_out" || entry.gateStatus === "approved",
  ).length;
  const requestOriginRollbacksOrFailures = promotionRequests.filter(
    (entry) =>
      entry.gateStatus === "rolled_back"
      || entry.gateStatus === "closed_rejected"
      || entry.shadowStatus === "shadow_failed",
  ).length;
  const requestOriginRolloutControlsActive = promotionRequests.filter(
    (entry) => entry.rolloutControlStatus === "active",
  ).length;
  const requestOriginRolloutControlsLimited = promotionRequests.filter(
    (entry) =>
      entry.rolloutControlStatus === "active"
      && entry.rolloutLabel === "limited_rollout",
  ).length;
  const requestOriginRolloutControlsRolledBack = promotionRequests.filter(
    (entry) => entry.rolloutControlStatus === "rolled_back",
  ).length;
  const requestOriginRolloutContextsBound = promotionRequests.filter(
    (entry) => entry.rolloutContextKeys.length > 0,
  ).length;
  return {
    source: observability ? "skill_governance" : "derived",
    status:
      asString(latestGovernanceReview?.host_governance_label)
      || asString(runtimeRecovery?.recovery_governance_label)
      || "unknown",
    queueStatus: asString(latestGovernanceReview?.queue_status) || null,
    gateStatus: asString(latestGovernanceReview?.gate_status) || null,
    consoleStatus: asString(latestGovernanceReview?.recommendation) || null,
    rolloutLabel: asString(latestGovernanceReview?.rollout_label) || null,
    pendingTenantRequests,
    underReviewTenantRequests,
    requestOriginReviewCount,
    requestOriginReviewsAwaitingDecision,
    requestOriginReviewsAdmittedToGate,
    requestOriginReviewsRejected,
    requestOriginGatesPendingApproval,
    requestOriginShadowsPending,
    requestOriginRolloutsActive,
    requestOriginRollbacksOrFailures,
    requestOriginRolloutControlsActive,
    requestOriginRolloutControlsLimited,
    requestOriginRolloutControlsRolledBack,
    requestOriginRolloutContextsBound,
    summary:
      joinFragments([
        asString(latestGovernanceReview?.review_basis)
          ? `Latest governance review basis: ${asString(
              latestGovernanceReview?.review_basis,
            )}.`
          : null,
        promotionRequests.length > 0
          ? `Tenant promotion requests: ${pendingTenantRequests} submitted, ${underReviewTenantRequests} under review, ${requestOriginReviewsAdmittedToGate} admitted to gate, ${requestOriginShadowsPending} shadow-pending, ${requestOriginRolloutsActive} rolled out. Request-origin rollout controls: ${requestOriginRolloutControlsActive} active, ${requestOriginRolloutControlsLimited} limited, ${requestOriginRolloutControlsRolledBack} rolled back, ${requestOriginRolloutContextsBound} context-bound.`
          : null,
        asString(permissionGate?.blocked_count)
          ? `Permission gate blocked ${asString(permissionGate?.blocked_count)} items.`
          : null,
        governanceSummary && Object.keys(governanceSummary).length > 0
          ? `Governance review groups: ${Object.keys(governanceSummary).length}.`
          : null,
      ]) || "Governance snapshot is not available yet.",
  };
}

function buildReviewDecisionSurface(
  latestGovernanceReview?: JsonObject | null,
): BrainReviewDecisionSurface {
  const recommendation = asString(latestGovernanceReview?.recommendation) || "none";
  const reviewBasis = asString(latestGovernanceReview?.review_basis);
  return {
    source: latestGovernanceReview ? "governance_review" : "derived",
    recommendation,
    reviewStatus: asString(latestGovernanceReview?.queue_status) || null,
    decisionLabel: recommendation || null,
    rolloutGateLabel: asString(latestGovernanceReview?.rollout_label) || null,
    summary:
      recommendation === "none"
        ? "No governance review decision has been recorded yet."
        : joinFragments([
            `Latest review recommendation: ${recommendation}.`,
            reviewBasis ? `Basis: ${reviewBasis}.` : null,
            asString(latestGovernanceReview?.host_governance_label)
              ? `Host label: ${asString(latestGovernanceReview?.host_governance_label)}.`
              : null,
          ]) || "Latest review decision is available.",
  };
}

function buildCapabilityRecommendationSurface(params: {
  capabilityEntries: JsonObject[];
  pilotFlows: ShellPilotFlow[];
  latestGovernanceReview?: JsonObject | null;
}): BrainCapabilityRecommendationSurface {
  const activeCount = countEntriesByStage(params.capabilityEntries, "active");
  const limitedActiveCount = countEntriesByStage(
    params.capabilityEntries,
    "limited_active",
  );
  const candidateCount = countEntriesByStage(params.capabilityEntries, "candidate");
  const draftCount = countEntriesByStage(params.capabilityEntries, "draft");
  const recommendedFlow = params.pilotFlows[0] ?? null;
  return {
    source:
      params.capabilityEntries.length > 0 ? "capability_registry" : "derived",
    admissionLabel: asString(params.latestGovernanceReview?.recommendation) || null,
    preferredRole: null,
    rolloutLabel: recommendedFlow?.governanceMode ?? null,
    summary:
      recommendedFlow
        ? `${recommendedFlow.displayName} is the current leading workflow candidate with next action ${recommendedFlow.nextActionLabel}.`
        : "No workflow recommendation is available yet.",
    recommendedFocus: recommendedFlow?.displayName ?? null,
    nextActionLabel: recommendedFlow?.nextActionLabel ?? null,
    nextActionMethod: recommendedFlow?.nextActionMethod ?? null,
    candidateCount,
    limitedActiveCount,
    activeCount,
    draftCount,
  };
}

function resolvePlannerStageAction(
  plannerControl?: JsonObject | null,
): string | null {
  if (!plannerControl) {
    return null;
  }
  if (plannerControl.require_stage_replan === true) {
    return "replan";
  }
  if (plannerControl.require_skill_chain_rebuild === true) {
    return "rebuild";
  }
  if (plannerControl.require_state_refresh === true) {
    return "refresh";
  }
  if (plannerControl.require_stage_fallback === true) {
    return "fallback";
  }
  if (plannerControl.hold_current_stage === true) {
    return "hold";
  }
  if (plannerControl.allow_stage_progress === true) {
    return "progress";
  }
  return null;
}

function countEntriesByStage(entries: JsonObject[], stage: string): number {
  return entries.filter(
    (entry) => asString(entry.admission_stage) === stage,
  ).length;
}

function asRecord(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function asBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function joinFragments(fragments: Array<string | null | undefined>): string | null {
  const normalized = fragments.map((item) => item?.trim()).filter(Boolean) as string[];
  return normalized.length ? normalized.join(" ") : null;
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
