export const SHELL_APP_ROUTES = {
  login: "/login",
  selectWorkspace: "/select-workspace",
  workbench: "/workbench",
  sessions: "/sessions",
  capabilities: "/capabilities",
  governance: "/governance",
  settings: "/settings",
} as const;

export const SHELL_APP_METHODS = {
  auth: {
    login: "auth.login",
    logout: "auth.logout",
    refreshToken: "auth.refreshToken",
    me: "auth.me",
  },
  tenant: {
    bootstrap: "tenant.bootstrap",
    listWorkspaces: "tenant.listWorkspaces",
    selectWorkspace: "tenant.selectWorkspace",
    memoryBoundaryGet: "tenant.memoryBoundary.get",
  },
  shell: {
    pilotShellGet: "shell.pilotShell.get",
    brainContractGet: "shell.brainContract.get",
    sessionCreate: "shell.session.create",
    sessionList: "shell.session.list",
    sessionGet: "shell.session.get",
    sessionSend: "shell.session.send",
    sessionStream: "shell.session.stream",
  },
  capability: {
    list: "capability.list",
    get: "capability.get",
    createDraft: "capability.createDraft",
    advancePilotFlow: "capability.advancePilotFlow",
  },
  governance: {
    consoleList: "governance.console.list",
    permissionModelGet: "governance.permissionModel.get",
    promotionRequestCreate: "governance.promotionRequest.create",
    promotionRequestList: "governance.promotionRequest.list",
    promotionRequestGet: "governance.promotionRequest.get",
    execute: "governance.execute",
    reviewGet: "governance.getReview",
    gateGet: "governance.getGate",
    auditList: "governance.getAudit",
  },
  localBridge: {
    status: "localBridge.status",
    nativeProcessEvent: "localBridge.nativeProcessEvent",
    requestAction: "localBridge.requestAction",
    submitActionResult: "localBridge.submitActionResult",
  },
  sanjin: {
    pilotShell: "sanjin.pilotShell",
    advancePilotFlow: "sanjin.advancePilotFlow",
    createCapabilityDraft: "sanjin.createCapabilityDraft",
  },
} as const;

export const SHELL_SCOPE_OPTIONS = ["personal", "workspace", "org", "core"] as const;
export const SHELL_DRAFT_SCOPE_OPTIONS = ["personal", "workspace", "org"] as const;
export const SHELL_WORKFLOW_PANELS = [
  "workbench",
  "selectWorkspace",
  "sessions",
  "capabilities",
  "settings",
] as const;
export const SHELL_WORKFLOW_FOCUS_HINTS = ["pendingAction", "timeline"] as const;
export const SHELL_ONBOARDING_PHASES = [
  "accessGate",
  "workspaceRestore",
  "reentryRestore",
  "attentionLanding",
  "workbenchLanding",
] as const;
export const SHELL_LOCAL_ACTION_LIFECYCLES = [
  "requested",
  "pending",
  "completed",
  "rejected",
  "stale",
  "expired",
] as const;

export type ShellScopeLabel = (typeof SHELL_SCOPE_OPTIONS)[number];
export type ShellDraftScopeLabel = (typeof SHELL_DRAFT_SCOPE_OPTIONS)[number];
export type ShellWorkflowPanel = (typeof SHELL_WORKFLOW_PANELS)[number];
export type ShellWorkflowFocusHint = (typeof SHELL_WORKFLOW_FOCUS_HINTS)[number];
export type ShellOnboardingPhase = (typeof SHELL_ONBOARDING_PHASES)[number];
export type ShellLocalActionLifecycle = (typeof SHELL_LOCAL_ACTION_LIFECYCLES)[number];
export type ShellWorkflowTarget = {
  panel: ShellWorkflowPanel;
  sessionKey?: string;
  focusHint?: ShellWorkflowFocusHint | null;
  actionId?: string | null;
  resultActionId?: string | null;
};

export type ShellOnboardingState = {
  phase: ShellOnboardingPhase;
  title: string;
  summary: string;
  target: ShellWorkflowTarget;
  desktopIntegration?: ShellDesktopIntegrationSummary | null;
  preferredWorkspaceId: string | null;
  currentWorkspaceId: string | null;
  operatorLabel: string | null;
  lastExitPanel: ShellWorkflowPanel | null;
  lastExitSessionKey: string | null;
  lastExitFocusHint: ShellWorkflowFocusHint | null;
};

export type ShellScriptResult = {
  script: string;
  jsonPath: string | null;
  mdPath: string | null;
  snapshotHistoryPath: string | null;
  appendedSnapshot: string | null;
  sourceFiles?: string[] | null;
  benchmarkRunId?: string | null;
};

export type ShellTenantContext = {
  orgId: string;
  workspaceId: string;
  userId: string;
  isolationModel: string;
  writeBoundary: string;
  promotionBoundary: string;
};

export const SHELL_BRAIN_READ_SURFACES = [
  "session_planning",
  "capability_recommendation",
  "governance_read",
  "review_decision",
] as const;

export const SHELL_GOVERNANCE_ROLE_IDS = [
  "brain_owner",
  "tenant_admin",
  "tenant_operator",
] as const;
export const SHELL_PROMOTION_REQUEST_STATUSES = [
  "drafted",
  "submitted",
  "under_review",
  "rejected",
  "admitted_to_gate",
  "rolled_out",
] as const;
export const SHELL_PROMOTION_EVIDENCE_KINDS = [
  "capability_candidate",
  "structural_pattern",
  "execution_evidence",
] as const;

export type ShellBrainReadSurfaceId = (typeof SHELL_BRAIN_READ_SURFACES)[number];
export type ShellGovernanceRoleId = (typeof SHELL_GOVERNANCE_ROLE_IDS)[number];
export type ShellPromotionRequestStatus = (typeof SHELL_PROMOTION_REQUEST_STATUSES)[number];
export type ShellPromotionEvidenceKind = (typeof SHELL_PROMOTION_EVIDENCE_KINDS)[number];

export type ShellBrainReadSurface = {
  surfaceId: ShellBrainReadSurfaceId;
  label: string;
  detail: string;
};

export type BrainPlanningSurface = {
  source: "planner_control" | "runtime_inference";
  finalStageAction: string | null;
  controlSummary: string;
  allowStageProgress: boolean | null;
  holdCurrentStage: boolean | null;
  requireStateRefresh: boolean | null;
  requireSkillChainRebuild: boolean | null;
  requireStageFallback: boolean | null;
  requireStageReplan: boolean | null;
};

export type BrainExplainSurface = {
  source: "goal_os_explain_view" | "derived";
  summary: string;
  finalStageAction: string | null;
  skillGovernanceStatus: string | null;
  skillAdmissionLabel: string | null;
  skillRolloutLabel: string | null;
  skillPreferredRole: string | null;
  skillPlannerControlSummary: string | null;
};

export type BrainGovernanceSurface = {
  source: "skill_governance" | "derived";
  status: string;
  queueStatus: string | null;
  gateStatus: string | null;
  consoleStatus: string | null;
  rolloutLabel: string | null;
  pendingTenantRequests: number;
  underReviewTenantRequests: number;
  requestOriginReviewCount: number;
  requestOriginReviewsAwaitingDecision: number;
  requestOriginReviewsAdmittedToGate: number;
  requestOriginReviewsRejected: number;
  requestOriginGatesPendingApproval: number;
  requestOriginShadowsPending: number;
  requestOriginRolloutsActive: number;
  requestOriginRollbacksOrFailures: number;
  requestOriginRolloutControlsActive: number;
  requestOriginRolloutControlsLimited: number;
  requestOriginRolloutControlsRolledBack: number;
  requestOriginRolloutContextsBound: number;
  summary: string;
};

export type BrainReviewDecisionSurface = {
  source: "promotion_review" | "governance_review" | "derived";
  recommendation: string;
  reviewStatus: string | null;
  decisionLabel: string | null;
  rolloutGateLabel: string | null;
  summary: string;
};

export type BrainCapabilityRecommendationSurface = {
  source: "runtime_metadata" | "capability_registry" | "derived";
  admissionLabel: string | null;
  preferredRole: string | null;
  rolloutLabel: string | null;
  summary: string;
  recommendedFocus: string | null;
  nextActionLabel: string | null;
  nextActionMethod: string | null;
  candidateCount: number;
  limitedActiveCount: number;
  activeCount: number;
  draftCount: number;
};

export type BrainAccessSnapshot = {
  generatedAt: string;
  sourceFiles: string[];
  planning: BrainPlanningSurface;
  explain: BrainExplainSurface;
  governance: BrainGovernanceSurface;
  latestReviewDecision: BrainReviewDecisionSurface;
  capabilityRecommendation: BrainCapabilityRecommendationSurface;
};

export type ShellBrainAccessSurface = {
  brainId: string;
  displayName: string;
  deploymentBoundary: string;
  policyBoundary: string;
  serverSideLocked: boolean;
  summary: string;
  readSurfaces: ShellBrainReadSurface[];
  snapshot: BrainAccessSnapshot;
};

export type ShellTenantMemoryLayer = {
  layerId:
    | "tenant_local_memory"
    | "abstracted_structural_evidence"
    | "sanjin_promoted_capability_knowledge";
  label: string;
  writePolicy: string;
  readableByBrain: boolean;
  promotionEligible: boolean;
  detail: string;
};

export type ShellTenantMemoryAuditEvent = {
  eventId:
    | "tenant_write_local"
    | "abstract_for_review"
    | "promotion_rejected"
    | "promotion_admitted";
  label: string;
  detail: string;
};

export type ShellTenantMemoryBoundary = {
  defaultWriteTarget: "tenant_local_memory";
  directBrainWriteAllowed: boolean;
  rawTenantMemoryReadableByBrain: boolean;
  promotionPathSummary: string;
  summary: string;
  layers: ShellTenantMemoryLayer[];
  auditEvents: ShellTenantMemoryAuditEvent[];
};

export type ShellGovernancePermissionRole = {
  roleId: ShellGovernanceRoleId;
  label: string;
  summary: string;
  allowedActions: string[];
  deniedActions: string[];
};

export type ShellGovernanceSurface = {
  surfaceId:
    | "brain_governance"
    | "tenant_review"
    | "cross_tenant_promotion";
  label: string;
  detail: string;
};

export type ShellGovernancePermissionModel = {
  summary: string;
  promotionPathSummary: string;
  roles: ShellGovernancePermissionRole[];
  governanceSurfaces: ShellGovernanceSurface[];
};

export type ShellTenantPromotionEvidenceSummary = {
  evidenceKind: ShellPromotionEvidenceKind;
  title: string;
  detail: string;
  sourceRefs: string[];
  capabilityId?: string | null;
  recommendedFocus?: string | null;
  sessionKey?: string | null;
  actionId?: string | null;
  resultActionId?: string | null;
};

export type ShellTenantPromotionRequestRecord = {
  requestId: string;
  tenantContext: ShellTenantContext;
  actorId: string;
  actorRole: Extract<ShellGovernanceRoleId, "tenant_admin" | "tenant_operator">;
  requestReason: string;
  status: ShellPromotionRequestStatus;
  evidence: ShellTenantPromotionEvidenceSummary;
  decisionSummary: string | null;
  reviewId: string | null;
  reviewQueueId: string | null;
  governanceQueueId: string | null;
  governanceQueueStatus: string | null;
  gateId: string | null;
  gateStatus: string | null;
  shadowId: string | null;
  shadowStatus: string | null;
  rolloutLabel: string | null;
  rolloutControlId: string | null;
  rolloutControlStatus: string | null;
  rolloutControlSource: string | null;
  rolloutContextKeys: string[];
  rolloutPreferredRoles: string[];
  rolloutControlSummary: string | null;
  rolloutRollbackReason: string | null;
  latestGovernanceActionLabel: string | null;
  lastAuditSummary: string | null;
  reviewStatus: string | null;
  decisionActorId: string | null;
  decisionActorRole: string | null;
  decisionAt: string | null;
  lastGovernanceTransitionAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ShellTenantPromotionRequestInput = {
  actorRole?: Extract<ShellGovernanceRoleId, "tenant_admin" | "tenant_operator">;
  requestReason: string;
  evidence: ShellTenantPromotionEvidenceSummary;
};

export type ShellTenantBootstrapResponse = {
  generatedAt: string;
  org: {
    orgId: string;
    displayName: string;
  };
  workspaces: Array<{
    workspaceId: string;
    displayName: string;
    role: "use" | "configure" | "govern";
  }>;
  user: {
    userId: string;
    displayName: string;
  };
  tenantContext: ShellTenantContext;
  brainAccess: ShellBrainAccessSurface;
  memoryBoundary: ShellTenantMemoryBoundary;
  governancePermissionModel: ShellGovernancePermissionModel;
  onboardingState: ShellOnboardingState;
};

export type ShellWorkspaceSelectionResponse = {
  generatedAt: string;
  workspace: {
    workspaceId: string;
    displayName: string;
    role: "use" | "configure" | "govern";
  };
  tenantContext: ShellTenantContext;
  brainAccess: ShellBrainAccessSurface;
  memoryBoundary: ShellTenantMemoryBoundary;
  governancePermissionModel: ShellGovernancePermissionModel;
  onboardingState: ShellOnboardingState;
};

export type ShellWorkspaceListResponse = {
  generatedAt: string;
  workspaces: ShellTenantBootstrapResponse["workspaces"];
};

export type ShellScopeSummaryEntry = {
  scopeLabel: ShellScopeLabel;
  count: number;
  detail: string;
};

export type ShellPilotFlow = {
  capabilityId: string;
  displayName: string;
  capabilityType: string;
  scopeLabel: ShellScopeLabel;
  currentStage: string;
  status: string;
  progressLabel: string;
  stageSummary: string;
  governanceMode: string;
  nextActionLabel: string;
  nextActionMethod: string;
};

export type ShellFocusItem = {
  title: string;
  status: string;
  summary: string;
};

export type ShellOperatorQueueItem = {
  title: string;
  count: number;
  detail: string;
  actionLabel: string;
  actionMethod: string;
};

export type ShellBoundaryRule = {
  title: string;
  detail: string;
};

export type ShellDesktopIntegrationActionMode = "review" | "inspect";

export type ShellDesktopIntegrationSummary = {
  title: string;
  summary: string;
  adapterLabel: string;
  adapterMode: string;
  readiness: string;
  runtimeLabel?: string | null;
  runtimeSummary?: string | null;
  healthSource?: ShellLocalBridgeStartupPosture["healthSource"];
  healthStatus?: ShellLocalBridgeStartupPosture["healthStatus"];
  healthStatusLabel?: string | null;
  healthEventSummary?: string | null;
  contractVersion: string;
  supports: string[];
  startupSource?: ShellLocalBridgeStartupPosture["startupSource"];
  providerStatus?: ShellLocalBridgeStartupPosture["providerStatus"];
  providerStatusLabel?: string | null;
  shellAppLabel?: string | null;
  moduleLabel?: string | null;
  moduleSummary?: string | null;
  moduleStatus?:
    | "registered_pending_attach"
    | "registered_attached"
    | "reused_pending_attach"
    | "reused_attached"
    | null;
  moduleStatusLabel?: string | null;
  providerKey?: string | null;
  recentHealthEvents?: ShellLocalBridgeHealthEvent[];
  healthFeed?: ShellLocalBridgeHealthFeedSummary;
  runnerMode?: ShellLocalBridgeStartupPosture["runnerMode"];
  nextRunAt?: string | null;
  recommendedDelayMs?: number | null;
  retryBackoffMs?: number | null;
  runnerSummary?: string | null;
  driverState?: ShellLocalBridgeStartupPosture["driverState"];
  driverSummary?: string | null;
  timerState?: ShellLocalBridgeStartupPosture["timerState"];
  scheduledAt?: string | null;
  nextTickAt?: string | null;
  lastTickAt?: string | null;
  timerSummary?: string | null;
  runnerState?: ShellLocalBridgeStartupPosture["runnerState"];
  nextWakeAt?: string | null;
  lastTickStartedAt?: string | null;
  lastTickCompletedAt?: string | null;
  runnerServiceSummary?: string | null;
  hostState?: ShellLocalBridgeStartupPosture["hostState"];
  serviceState?: ShellLocalBridgeStartupPosture["serviceState"];
  serviceOwned?: boolean;
  serviceActive?: boolean;
  hostStarted?: boolean;
  hostArmed?: boolean;
  lastWakeStartedAt?: string | null;
  lastWakeCompletedAt?: string | null;
  hostSummary?: string | null;
  lastAcquireAt?: string | null;
  lastReleaseAt?: string | null;
  serviceSummary?: string | null;
  lifecycleState?: ShellLocalBridgeStartupPosture["lifecycleState"];
  lifecycleOwned?: boolean;
  lifecycleActive?: boolean;
  lastBootAt?: string | null;
  lastResumeAt?: string | null;
  lastSuspendAt?: string | null;
  lastShutdownAt?: string | null;
  lifecycleSummary?: string | null;
  bootstrapState?: ShellLocalBridgeStartupPosture["bootstrapState"];
  bootstrapOwned?: boolean;
  bootstrapActive?: boolean;
  appOwnerState?: ShellLocalBridgeStartupPosture["appOwnerState"];
  appOwnerOwned?: boolean;
  appOwnerActive?: boolean;
  shellOwnerState?: ShellLocalBridgeStartupPosture["shellOwnerState"];
  shellOwnerOwned?: boolean;
  shellOwnerActive?: boolean;
  processHostState?: ShellLocalBridgeStartupPosture["processHostState"];
  processHostOwned?: boolean;
  processHostActive?: boolean;
  lastStartAt?: string | null;
  lastWakeAt?: string | null;
  lastForegroundAt?: string | null;
  lastBackgroundAt?: string | null;
  lastStopAt?: string | null;
  processEventType?: ShellLocalBridgeStartupPosture["processEventType"];
  processEventSource?: ShellLocalBridgeStartupPosture["processEventSource"];
  lastProcessEventAt?: string | null;
  nativeProcessEventType?: ShellLocalBridgeStartupPosture["nativeProcessEventType"];
  nativeProcessEventSource?: ShellLocalBridgeStartupPosture["nativeProcessEventSource"];
  desktopHostPlatform?: ShellLocalBridgeStartupPosture["desktopHostPlatform"];
  nativeProcessIngressSource?: ShellLocalBridgeStartupPosture["nativeProcessIngressSource"];
  lastNativeProcessEventAt?: string | null;
  nativeLocalActionTransportSource?: ShellLocalBridgeStartupPosture["nativeLocalActionTransportSource"];
  pendingNativeActionCount?: number | null;
  nativeLocalActionDeliverySummary?: string | null;
  nativeLocalActionResultSummary?: string | null;
  nativeLocalActionExecutionSource?: ShellLocalBridgeStartupPosture["nativeLocalActionExecutionSource"];
  lastNativeLocalActionExecutionAt?: string | null;
  nativeLocalActionExecutionSummary?: string | null;
  nativeLocalActionCapabilitySummary?: string | null;
  nativeLocalActionCapabilityMatrix?: ShellDesktopNativeActionCapabilityMatrix | null;
  bootstrapSummary?: string | null;
  appOwnerSummary?: string | null;
  shellOwnerSummary?: string | null;
  processHostSummary?: string | null;
  processEventSummary?: string | null;
  nativeProcessEventSummary?: string | null;
  startupPosture: ShellLocalBridgeStartupPosture | null;
};

export type ShellPilotShellPayload = {
  generatedAt: string;
  sourceFiles: string[];
  tenantContext: ShellTenantContext;
  brainAccess: ShellBrainAccessSurface;
  memoryBoundary: ShellTenantMemoryBoundary;
  governancePermissionModel: ShellGovernancePermissionModel;
  onboardingState: ShellOnboardingState;
  activeScopeLabel: string;
  tenantModelLabel: string;
  benchmarkScore: string;
  latestRecommendation: string;
  scopeSummary: ShellScopeSummaryEntry[];
  pilotFlows: ShellPilotFlow[];
  desktopIntegration: ShellDesktopIntegrationSummary | null;
  focusItems: ShellFocusItem[];
  operatorQueue: ShellOperatorQueueItem[];
  boundaryRules: ShellBoundaryRule[];
  promotionRequests: ShellTenantPromotionRequestRecord[];
};

export type ShellCapabilityListEntry = {
  capabilityId: string;
  capabilityType: string;
  displayName: string;
  scopeLabel: ShellScopeLabel;
  status: string;
  admissionStage: string;
  sourceRegistry: string;
  preferredSubagent: string;
  sampleRunCount: string;
};

export type ShellCapabilityListResponse = {
  generatedAt: string;
  sourceFiles: string[];
  entries: ShellCapabilityListEntry[];
};

export type ShellCapabilityGetResponse = {
  generatedAt: string;
  sourceFiles: string[];
  entry: ShellCapabilityListEntry & {
    description: string;
    governanceMode: string;
    metadata: Record<string, unknown>;
  };
};

export type ShellActionPayload = {
  generatedAt: string;
  message: string;
  result: ShellScriptResult;
};

export type ShellCapabilityDraftRequest = {
  capabilityType: string;
  displayName: string;
  description: string;
  scope: ShellDraftScopeLabel;
  preferredSubagent: string;
};

export type ShellCapabilityDraftResponse = ShellActionPayload & {
  result: ShellScriptResult & {
    capability_id?: string;
    display_name?: string;
    capability_type?: string;
    admission_stage?: string;
    status?: string;
    scope_label?: ShellDraftScopeLabel;
    scope_detail?: string;
  };
};

export type ShellAdvancePilotFlowResponse = {
  generatedAt: string;
  capabilityId: string;
  previousStage: string;
  triggeredActionLabel: string;
  triggeredActionMethod: string;
  message: string;
  result: ShellScriptResult;
  updatedFlow: ShellPilotFlow | null;
};

export type ShellSessionCreateRequest = {
  workspaceId: string;
  title?: string;
};

export type ShellSessionCreateResponse = {
  generatedAt: string;
  key: string;
  sessionId: string;
  createdAt: string;
  workspaceId: string;
  title?: string;
  status?: string;
};

export type ShellSessionListEntry = {
  key: string;
  sessionId?: string;
  title?: string;
  status?: string;
  updatedAt: number | null;
  model?: string;
  modelProvider?: string;
};

export type ShellSessionListResponse = {
  generatedAt: string;
  count: number;
  sessions: ShellSessionListEntry[];
};

export type ShellPlannerOutcome = {
  source: "runtime_inference" | "planner_control" | "primitive_outcome";
  stageAction: "progress" | "hold" | "refresh" | "rebuild" | "fallback" | "replan";
  attentionLevel: "info" | "warning" | "critical";
  controlSummary: string;
  operatorSummary: string;
  nextActionLabel: string;
  signals: {
    allowStageProgress: boolean;
    holdCurrentStage: boolean;
    requireStateRefresh: boolean;
    requireSkillChainRebuild: boolean;
    requireStageFallback: boolean;
    requireStageReplan: boolean;
    fallbackMode?: string;
  };
};

export type ShellSessionGetResponse = {
  generatedAt: string;
  key: string;
  sessionId?: string;
  title?: string;
  status?: string;
  updatedAt: number | null;
  model?: string;
  modelProvider?: string;
  messageCount: number;
  localActionCount: number;
  localActions: ShellPendingLocalAction[];
  timeline: ShellSessionTimelineEntry[];
  plannerOutcome: ShellPlannerOutcome;
  messages: unknown[];
};

export type ShellSessionTimelineEntry = {
  entryId: string;
  entryType: "message" | "local_action";
  title: string;
  detail: string;
  status?: string;
  occurredAt: string | null;
};

export type ShellPendingLocalAction = ShellLocalActionRequest & {
  sessionKey?: string;
  requestedAt: string;
  resolvedAt?: string | null;
  expiresAt?: string | null;
  lifecycle: ShellLocalActionLifecycle;
  status: "pending" | "completed" | "rejected";
  result?: ShellLocalActionResult;
};

export type ShellSessionSendRequest = {
  sessionId?: string;
  key?: string;
  message: string;
  attachments?: Array<{
    kind: "file" | "image" | "link";
    value: string;
  }>;
};

export type ShellSessionSendResponse = {
  generatedAt: string;
  key: string;
  runId?: string;
  messageSeq?: number;
  status?: string;
  interruptedActiveRun?: boolean;
};

export type ShellSessionStreamResponse = {
  generatedAt: string;
  key: string;
  sessionId?: string;
  messages: unknown[];
  status?: string;
  pendingLocalActions: ShellPendingLocalAction[];
  nextPollAfterMs: number;
  plannerOutcome: ShellPlannerOutcome;
};

export type ShellAuthMeResponse = {
  generatedAt: string;
  auth: {
    connId?: string;
    role: string;
    scopes: string[];
    clientId?: string;
  };
  user: {
    userId: string;
    displayName: string;
  };
  tenantContext: ShellTenantContext;
  brainAccess: ShellBrainAccessSurface;
  memoryBoundary: ShellTenantMemoryBoundary;
  governancePermissionModel: ShellGovernancePermissionModel;
  onboardingState: ShellOnboardingState;
  shellAccess: {
    required: boolean;
    granted: boolean;
    mode: "gateway" | "invite_code";
    invitationLabel: string;
    operatorLabel: string | null;
    grantedAt: string | null;
  };
};

export type ShellAuthLoginRequest = {
  inviteCode: string;
  operatorLabel?: string;
};

export type ShellAuthLoginResponse = ShellAuthMeResponse;

export type ShellAuthLogoutResponse = {
  generatedAt: string;
  shellAccess: ShellAuthMeResponse["shellAccess"];
  onboardingState: ShellOnboardingState;
};

export type ShellBrainContractGetResponse = {
  generatedAt: string;
  tenantContext: ShellTenantContext;
  brainAccess: ShellBrainAccessSurface;
};

export type ShellTenantMemoryBoundaryGetResponse = {
  generatedAt: string;
  tenantContext: ShellTenantContext;
  memoryBoundary: ShellTenantMemoryBoundary;
};

export type ShellGovernancePermissionModelGetResponse = {
  generatedAt: string;
  tenantContext: ShellTenantContext;
  governancePermissionModel: ShellGovernancePermissionModel;
};

export type ShellPromotionRequestCreateResponse = {
  generatedAt: string;
  record: ShellTenantPromotionRequestRecord;
};

export type ShellPromotionRequestListResponse = {
  generatedAt: string;
  sourceFiles: string[];
  records: ShellTenantPromotionRequestRecord[];
};

export type ShellPromotionRequestGetResponse = {
  generatedAt: string;
  sourceFiles: string[];
  record: ShellTenantPromotionRequestRecord;
};

export type ShellGovernanceConsoleListRequest = {
  query?: {
    scope_type?: string;
    scope_id?: string;
    owner_id?: string;
    org_id?: string;
    workspace_id?: string;
    user_id?: string;
    skill_ids?: string[];
    gate_statuses?: string[];
    shadow_statuses?: string[];
    rollout_labels?: string[];
    review_queue_statuses?: string[];
    governance_queue_statuses?: string[];
    latest_action_labels?: string[];
    actionable_only?: boolean;
    limit?: number;
  };
};

export type ShellGovernanceConsoleEntry = {
  skillId: string;
  reviewId: string | null;
  gateId: string | null;
  shadowId: string | null;
  requestId: string | null;
  requestOrigin: string | null;
  entryKind: "review" | "gate" | "shadow";
  reviewLifecycleStatus: string | null;
  reviewQueueStatus: string | null;
  governanceQueueStatus: string | null;
  gateStatus: string | null;
  effectiveRolloutLabel: string | null;
  rolloutControlSource: string | null;
  rolloutContextCount: number;
  shadowStatus: string | null;
  availableNextActions: string[];
  latestActionLabel: string | null;
  latestActorRole: string | null;
  consoleSummary: string | null;
  lastUpdatedAt: string | null;
};

export type ShellGovernanceConsoleListResponse = {
  generatedAt: string;
  sourceFiles: string[];
  entries: ShellGovernanceConsoleEntry[];
};

export type ShellGovernanceReviewDetail = {
  review: {
    reviewId: string | null;
    skillId: string;
    requestId: string | null;
    requestOrigin: string | null;
    lifecycleStatus: string | null;
    candidateStatus: string | null;
    reviewSummary: string | null;
    reviewLayer: string | null;
    lastActorId: string | null;
    lastActorRole: string | null;
    actedAt: string | null;
    createdAt: string | null;
  };
  requestRecord: ShellTenantPromotionRequestRecord | null;
  reviewQueueLinkage: {
    reviewQueueId: string | null;
    reviewQueueStatus: string | null;
  };
  governanceLinkage: {
    governanceQueueId: string | null;
    governanceQueueStatus: string | null;
    gateId: string | null;
    gateStatus: string | null;
  };
  latestDecisionSummary: string | null;
  availableNextActions: string[];
};

export type ShellGovernanceReviewGetResponse = {
  generatedAt: string;
  sourceFiles: string[];
  detail: ShellGovernanceReviewDetail;
};

export type ShellGovernanceGateDetail = {
  gate: {
    gateId: string;
    reviewId: string;
    skillId: string;
    requestId: string | null;
    requestOrigin: string | null;
    gateStatus: string;
    gateAction: string | null;
    rolloutGateLabel: string | null;
    effectiveRolloutLabel: string | null;
    validationLayer: string;
    approvalRequired: boolean;
    rollbackReady: boolean;
    rollbackPlanLabel: string | null;
    lastActionLabel: string | null;
    lastActorId: string | null;
    lastActorRole: string | null;
    actedAt: string | null;
    gateSummary: string | null;
    createdAt: string | null;
  };
  requestRecord: ShellTenantPromotionRequestRecord | null;
  reviewLinkage: {
    reviewId: string | null;
    requestId: string | null;
    requestOrigin: string | null;
  };
  rolloutLinkage: {
    effectiveRolloutLabel: string | null;
    rolloutGateLabel: string | null;
    rolloutLane: string | null;
    rolloutControls: Array<{
      skillId: string;
      rolloutLabel: string;
      controlSource: string | null;
      governanceGateId: string | null;
      governanceGateStatus: string | null;
      allowedContextKeys: string[];
      preferredRoles: string[];
      controlSummary: string | null;
      updatedAt: string | null;
    }>;
  };
  shadowLinkage: Array<{
    shadowId: string;
    gateId: string;
    reviewId: string;
    requestId: string | null;
    requestOrigin: string | null;
    shadowStatus: string;
    expectedRolloutLabel: string | null;
    observedSuccessRate: number;
    observedRiskRate: number;
    recommendedAction: string | null;
    shadowSummary: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
  latestAction: {
    actionId: string;
    gateId: string;
    reviewId: string;
    actionLabel: string;
    actorId: string | null;
    actorRole: string | null;
    actionReason: string | null;
    actionSummary: string | null;
    createdAt: string | null;
  } | null;
  latestAudit: {
    auditId: string;
    gateId: string;
    reviewId: string;
    actionLabel: string;
    previousGateStatus: string | null;
    newGateStatus: string | null;
    previousRolloutLabel: string | null;
    newRolloutLabel: string | null;
    actorId: string | null;
    actorRole: string | null;
    auditSummary: string | null;
    createdAt: string | null;
  } | null;
  availableNextActions: string[];
};

export type ShellGovernanceGateGetResponse = {
  generatedAt: string;
  sourceFiles: string[];
  detail: ShellGovernanceGateDetail;
};

export type ShellGovernanceAuditEntry = {
  kind:
    | "promotion_request_submitted"
    | "promotion_request_intake"
    | "promotion_request_review_decision"
    | "gate_state"
    | "shadow_state"
    | "governance_action"
    | "governance_audit";
  summary: string;
  actorId: string | null;
  actorRole: string | null;
  requestId: string | null;
  reviewId: string | null;
  gateId: string | null;
  shadowId: string | null;
  occurredAt: string | null;
};

export type ShellGovernanceAuditListResponse = {
  generatedAt: string;
  sourceFiles: string[];
  entries: ShellGovernanceAuditEntry[];
  requestId: string | null;
  reviewId: string | null;
  gateId: string | null;
  shadowId: string | null;
};

export type ShellGovernanceExecuteRequest = {
  actionLabel: string;
  targetId?: string;
  targetType?: string;
  actorId?: string;
  actorRole?: string;
  actionReason?: string;
  validationPayload?: Record<string, unknown>;
  shadowPayload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type ShellGovernanceExecuteResponse = {
  generatedAt: string;
  workflowStatus: "succeeded" | "failed";
  actionLabel: string;
  targetId: string | null;
  targetType: string;
  gateId: string | null;
  shadowId: string | null;
  gateStatus: string | null;
  shadowStatus: string | null;
  rolloutLabel: string | null;
  availableNextActions: string[];
  consoleEntrySummary: Record<string, unknown>;
  errorMessage: string | null;
  resultSummary: string | null;
  payload: Record<string, unknown>;
};

export type ShellLocalActionRequest = {
  actionId: string;
  actionType: "pick_file" | "pick_folder" | "open_file" | "confirm_execution";
  title: string;
  description: string;
  constraints?: Record<string, unknown>;
};

export type ShellLocalActionResult = {
  actionId: string;
  approved: boolean;
  payload?: Record<string, unknown>;
  error?: string;
};

export type ShellLocalActionExecutionSource =
  | "macos_local_action_executor"
  | "windows_local_action_executor";

export type ShellLocalActionExecutionRequest = {
  actionId: string;
  actionType: ShellLocalActionRequest["actionType"];
  title: string;
  description: string;
  constraints?: Record<string, unknown>;
  hostPlatform?: ShellLocalBridgeStartupPosture["desktopHostPlatform"];
  executionMode:
    | "file_picker"
    | "folder_picker"
    | "default_file_open"
    | "confirmation_dialog";
  requiredPath?: string | null;
  expectedPayloadShape: "{ path }" | "{ path, opened: true }" | null;
};

export type ShellLocalActionExecutionResult = {
  actionId: string;
  approved: boolean;
  payload?: Record<string, unknown>;
  error?: string;
  executionSource?: ShellLocalActionExecutionSource | null;
  executedAt?: string | null;
};

export type ShellDesktopNativeActionCapability = {
  actionType: ShellLocalActionRequest["actionType"];
  supported: boolean;
  hostPlatform: "macos" | "windows";
  executionMode: ShellLocalActionExecutionRequest["executionMode"];
  summary: string;
};

export type ShellDesktopNativeActionCapabilityMatrix = Record<
  ShellLocalActionRequest["actionType"],
  ShellDesktopNativeActionCapability
>;

export type ShellLocalBridgeContract = {
  version: "v1";
  requestFields: Array<
    | "actionId"
    | "actionType"
    | "title"
    | "description"
    | "constraints"
    | "sessionKey"
    | "requestedAt"
    | "lifecycle"
  >;
  resultFields: Array<
    | "actionId"
    | "approved"
    | "payload"
    | "error"
    | "resolvedAt"
    | "lifecycle"
  >;
  visibleLifecycles: Array<"requested" | "pending" | "completed" | "rejected">;
  reservedLifecycles: Array<"stale" | "expired">;
};

export type ShellLocalBridgeAdapter = {
  mode: "simulated" | "desktop";
  readiness: "ready" | "degraded" | "unavailable";
  label: string;
  summary: string;
  supports: Array<"request" | "resolve" | "focus_policy" | "lifecycle_tracking">;
};

export type ShellLocalBridgeTransport = {
  adapterMode: ShellLocalBridgeAdapter["mode"];
  adapterReadiness: ShellLocalBridgeAdapter["readiness"];
  contractVersion: ShellLocalBridgeContract["version"];
};

export type ShellLocalBridgeStartupPosture = {
  mode: ShellLocalBridgeAdapter["mode"];
  attached: boolean;
  adapterReadiness?: ShellLocalBridgeAdapter["readiness"];
  runtimeLabel?: string | null;
  runtimeSummary?: string | null;
  healthSource?: "startup_posture" | "runtime_heartbeat";
  healthStatus?:
    | "simulated"
    | "awaiting_attach"
    | "healthy"
    | "degraded"
    | "unavailable";
  healthStatusLabel?: string | null;
  healthEventSummary?: string | null;
  startupModeLabel: string;
  startupSummary: string;
  startupSource?: "derived_adapter" | "desktop_startup_wiring";
  providerStatus?:
    | "direct_transport"
    | "registry_provider"
    | "missing_provider"
    | "no_provider";
  providerStatusLabel?: string | null;
  shellAppLabel?: string | null;
  moduleLabel?: string | null;
  moduleSummary?: string | null;
  moduleStatus?:
    | "registered_pending_attach"
    | "registered_attached"
    | "reused_pending_attach"
    | "reused_attached"
    | null;
  moduleStatusLabel?: string | null;
  providerKey?: string | null;
  runnerMode?:
    | "awaiting_first_heartbeat"
    | "healthy_cadence"
    | "degraded_cadence"
    | "retry_unavailable"
    | "freshness_recovery";
  nextRunAt?: string | null;
  recommendedDelayMs?: number | null;
  retryBackoffMs?: number | null;
  runnerSummary?: string | null;
  driverState?: "idle" | "scheduled" | "run_now" | "retry_backoff";
  driverSummary?: string | null;
  timerState?: "idle" | "armed" | "tick_now" | "backoff_wait";
  scheduledAt?: string | null;
  nextTickAt?: string | null;
  lastTickAt?: string | null;
  timerSummary?: string | null;
  runnerState?: "stopped" | "armed" | "ticking" | "backoff_wait";
  nextWakeAt?: string | null;
  lastTickStartedAt?: string | null;
  lastTickCompletedAt?: string | null;
  runnerServiceSummary?: string | null;
  hostState?: "stopped" | "armed" | "waking" | "backoff_wait";
  serviceState?: "released" | "acquired" | "waking" | "backoff_wait";
  serviceOwned?: boolean;
  serviceActive?: boolean;
  hostStarted?: boolean;
  hostArmed?: boolean;
  lastWakeStartedAt?: string | null;
  lastWakeCompletedAt?: string | null;
  hostSummary?: string | null;
  lastAcquireAt?: string | null;
  lastReleaseAt?: string | null;
  serviceSummary?: string | null;
  lifecycleState?: "inactive" | "booting" | "active" | "suspended" | "backoff_wait";
  lifecycleOwned?: boolean;
  lifecycleActive?: boolean;
  lastBootAt?: string | null;
  lastResumeAt?: string | null;
  lastSuspendAt?: string | null;
  lastShutdownAt?: string | null;
  lifecycleSummary?: string | null;
  bootstrapState?: "stopped" | "starting" | "active" | "suspended" | "backoff_wait";
  bootstrapOwned?: boolean;
  bootstrapActive?: boolean;
  appOwnerState?: "stopped" | "starting" | "active" | "background" | "backoff_wait";
  appOwnerOwned?: boolean;
  appOwnerActive?: boolean;
  shellOwnerState?: "stopped" | "starting" | "active" | "background" | "backoff_wait";
  shellOwnerOwned?: boolean;
  shellOwnerActive?: boolean;
  processHostState?: "stopped" | "starting" | "foreground" | "background" | "backoff_wait";
  processHostOwned?: boolean;
  processHostActive?: boolean;
  lastStartAt?: string | null;
  lastWakeAt?: string | null;
  lastForegroundAt?: string | null;
  lastBackgroundAt?: string | null;
  lastStopAt?: string | null;
  processEventType?: "start" | "foreground" | "background" | "stop" | null;
  processEventSource?: "desktop_main_process_event_bridge" | null;
  lastProcessEventAt?: string | null;
  nativeProcessEventType?: "app_started" | "app_foregrounded" | "app_backgrounded" | "app_stopped" | null;
  nativeProcessEventSource?: "desktop_native_main_process_bridge" | null;
  desktopHostPlatform?: "macos" | "windows" | null;
  nativeProcessIngressSource?: "macos_app_lifecycle" | "windows_app_lifecycle" | null;
  lastNativeProcessEventAt?: string | null;
  nativeLocalActionTransportSource?:
    | "desktop_local_action_push"
    | "desktop_local_action_result_submit"
    | null;
  pendingNativeActionCount?: number | null;
  nativeLocalActionDeliverySummary?: string | null;
  nativeLocalActionResultSummary?: string | null;
  nativeLocalActionExecutionSource?: ShellLocalActionExecutionSource | null;
  lastNativeLocalActionExecutionAt?: string | null;
  nativeLocalActionExecutionSummary?: string | null;
  nativeLocalActionCapabilitySummary?: string | null;
  nativeLocalActionCapabilityMatrix?: ShellDesktopNativeActionCapabilityMatrix | null;
  bootstrapSummary?: string | null;
  appOwnerSummary?: string | null;
  shellOwnerSummary?: string | null;
  processHostSummary?: string | null;
  processEventSummary?: string | null;
  nativeProcessEventSummary?: string | null;
};

export type ShellLocalBridgeHealthEvent = {
  occurredAt: string;
  source: NonNullable<ShellLocalBridgeStartupPosture["healthSource"]>;
  healthStatus: NonNullable<ShellLocalBridgeStartupPosture["healthStatus"]>;
  healthStatusLabel: string;
  summary: string;
  shellAppLabel?: string | null;
  moduleLabel?: string | null;
  providerKey?: string | null;
};

export type ShellLocalBridgeHealthFeedSummary = {
  eventCount: number;
  latestOccurredAt: string | null;
  latestAgeMs: number | null;
  staleAfterMs: number;
  nextStaleAt: string | null;
  expectedHeartbeatIntervalMs: number;
  pollRecommendedAfterMs: number | null;
  missedHeartbeatCount: number;
  freshnessReason: string;
  latestSource: ShellLocalBridgeHealthEvent["source"] | null;
  latestHealthStatus: ShellLocalBridgeHealthEvent["healthStatus"] | null;
  latestHealthStatusLabel: string | null;
  stalenessStatus: "idle" | "fresh" | "stale";
  stalenessStatusLabel: string;
};

export type ShellLocalBridgeHealthFeedPollingDecision = {
  stalenessStatus: ShellLocalBridgeHealthFeedSummary["stalenessStatus"];
  shouldPollNow: boolean;
  pollRecommendedAfterMs: number | null;
  missedHeartbeatCount: number;
  freshnessReason: string | null;
  cadenceSummary: string;
};

export type ShellLocalBridgeHealthFeedSchedulerDecision = {
  shouldRunNow: boolean;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  nextRunAt: string | null;
  runnerMode:
    | "awaiting_first_heartbeat"
    | "healthy_cadence"
    | "degraded_cadence"
    | "retry_unavailable"
    | "freshness_recovery";
  runnerSummary: string;
};

export type ShellLocalBridgeHealthFeedDriverDecision = {
  driverState: "idle" | "scheduled" | "run_now" | "retry_backoff";
  shouldRunNow: boolean;
  nextRunAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  driverSummary: string;
};

export type ShellLocalBridgeHealthFeedTimerDecision = {
  timerState: "idle" | "armed" | "tick_now" | "backoff_wait";
  shouldArmTimer: boolean;
  shouldTickNow: boolean;
  scheduledAt: string | null;
  nextTickAt: string | null;
  lastTickAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  timerSummary: string;
};

export type ShellLocalBridgeRuntimeRunnerDecision = {
  runnerState: "stopped" | "armed" | "ticking" | "backoff_wait";
  shouldKeepRunning: boolean;
  armed: boolean;
  shouldTickNow: boolean;
  nextWakeAt: string | null;
  lastTickStartedAt: string | null;
  lastTickCompletedAt: string | null;
  runnerSummary: string;
};

export type ShellLocalBridgeRuntimeHostDecision = {
  hostState: "stopped" | "armed" | "waking" | "backoff_wait";
  hostStarted: boolean;
  hostArmed: boolean;
  shouldWakeNow: boolean;
  nextWakeAt: string | null;
  lastWakeStartedAt: string | null;
  lastWakeCompletedAt: string | null;
  hostSummary: string;
};

export type ShellLocalBridgeRuntimeServiceDecision = {
  serviceState: "released" | "acquired" | "waking" | "backoff_wait";
  serviceOwned: boolean;
  serviceActive: boolean;
  shouldWakeNow: boolean;
  nextWakeAt: string | null;
  lastAcquireAt: string | null;
  lastReleaseAt: string | null;
  serviceSummary: string;
};

export type ShellLocalBridgeRuntimeLifecycleDecision = {
  lifecycleState: "inactive" | "booting" | "active" | "suspended" | "backoff_wait";
  lifecycleOwned: boolean;
  lifecycleActive: boolean;
  shouldBootNow: boolean;
  shouldResumeNow: boolean;
  shouldSuspendNow: boolean;
  nextWakeAt: string | null;
  lastBootAt: string | null;
  lastResumeAt: string | null;
  lastSuspendAt: string | null;
  lastShutdownAt: string | null;
  lifecycleSummary: string;
};

export type ShellLocalBridgeRuntimeBootstrapDecision = {
  bootstrapState: "stopped" | "starting" | "active" | "suspended" | "backoff_wait";
  bootstrapOwned: boolean;
  bootstrapActive: boolean;
  shouldStartNow: boolean;
  shouldWakeNow: boolean;
  shouldSuspendNow: boolean;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastWakeAt: string | null;
  lastSuspendAt: string | null;
  lastStopAt: string | null;
  bootstrapSummary: string;
};

export type ShellLocalBridgeRuntimeAppOwnerDecision = {
  appOwnerState: "stopped" | "starting" | "active" | "background" | "backoff_wait";
  appOwnerOwned: boolean;
  appOwnerActive: boolean;
  shouldStartNow: boolean;
  shouldWakeNow: boolean;
  shouldBackgroundNow: boolean;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastWakeAt: string | null;
  lastBackgroundAt: string | null;
  lastStopAt: string | null;
  appOwnerSummary: string;
};

export type ShellLocalBridgeRuntimeShellOwnerDecision = {
  shellOwnerState: "stopped" | "starting" | "active" | "background" | "backoff_wait";
  shellOwnerOwned: boolean;
  shellOwnerActive: boolean;
  shouldStartNow: boolean;
  shouldWakeNow: boolean;
  shouldBackgroundNow: boolean;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastWakeAt: string | null;
  lastBackgroundAt: string | null;
  lastStopAt: string | null;
  shellOwnerSummary: string;
};

export type ShellLocalBridgeRuntimeProcessHostDecision = {
  processHostState: "stopped" | "starting" | "foreground" | "background" | "backoff_wait";
  processHostOwned: boolean;
  processHostActive: boolean;
  shouldStartNow: boolean;
  shouldForegroundNow: boolean;
  shouldBackgroundNow: boolean;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastForegroundAt: string | null;
  lastBackgroundAt: string | null;
  lastStopAt: string | null;
  processHostSummary: string;
};

export type ShellDesktopIntegrationReviewDecision = {
  reviewKind: "attach" | "health" | "freshness" | "none";
  entryTarget: "settings" | "workbench" | "none";
  actionMode: ShellDesktopIntegrationActionMode;
  actionLabel: string;
  reasonSummary: string;
};

export function resolveShellLocalBridgeHealthFeedPollingDecision(
  feed: ShellLocalBridgeHealthFeedSummary | null | undefined,
): ShellLocalBridgeHealthFeedPollingDecision {
  const stalenessStatus = feed?.stalenessStatus ?? "idle";
  const pollRecommendedAfterMs = feed?.pollRecommendedAfterMs ?? null;
  const shouldPollNow =
    stalenessStatus === "stale"
    || stalenessStatus === "idle"
    || pollRecommendedAfterMs === 0;
  const freshnessReason = feed?.freshnessReason?.trim() || null;
  const missedHeartbeatCount = feed?.missedHeartbeatCount ?? 0;
  const cadenceSummary =
    stalenessStatus === "idle"
      ? freshnessReason ?? "Desktop health feed is still waiting for the first runtime heartbeat."
      : stalenessStatus === "stale"
        ? freshnessReason
          ?? "Desktop runtime polling should refresh health feed freshness before native local-action entry is trusted."
        : shouldPollNow
          ? freshnessReason
            ?? "Desktop runtime polling is due now even though the feed still remains fresh."
          : freshnessReason
            ?? "Desktop runtime heartbeat cadence is still within the expected freshness window.";
  return {
    stalenessStatus,
    shouldPollNow,
    pollRecommendedAfterMs,
    missedHeartbeatCount,
    freshnessReason,
    cadenceSummary,
  };
}

export function resolveShellLocalBridgeHealthFeedSchedulerDecision(params: {
  healthFeed: ShellLocalBridgeHealthFeedSummary | null | undefined;
  healthStatus?: ShellLocalBridgeStartupPosture["healthStatus"];
  attached?: boolean;
  readiness?: ShellLocalBridgeAdapter["readiness"] | string | null;
  now?: number;
}): ShellLocalBridgeHealthFeedSchedulerDecision {
  const feed = params.healthFeed;
  const now = params.now ?? Date.now();
  const pollingDecision = resolveShellLocalBridgeHealthFeedPollingDecision(feed);
  const attached = params.attached === true;
  const healthStatus = params.healthStatus;
  const readiness = params.readiness ?? null;
  const isUnavailable =
    !attached
    || readiness === "unavailable"
    || healthStatus === "unavailable";
  const isDegraded =
    !isUnavailable
    && (readiness === "degraded" || healthStatus === "degraded");
  const isStale = pollingDecision.stalenessStatus === "stale";
  const runnerMode: ShellLocalBridgeHealthFeedSchedulerDecision["runnerMode"] =
    pollingDecision.stalenessStatus === "idle"
      ? "awaiting_first_heartbeat"
      : isStale
        ? "freshness_recovery"
        : isUnavailable
          ? "retry_unavailable"
          : isDegraded
            ? "degraded_cadence"
            : "healthy_cadence";
  const recommendedDelayMs =
    runnerMode === "awaiting_first_heartbeat"
      ? 0
      : runnerMode === "freshness_recovery"
        ? 0
        : runnerMode === "retry_unavailable"
          ? 15_000
          : runnerMode === "degraded_cadence"
            ? 30_000
            : feed?.pollRecommendedAfterMs ?? 60_000;
  const retryBackoffMs =
    runnerMode === "retry_unavailable"
      ? 15_000
      : runnerMode === "freshness_recovery"
        ? 0
        : runnerMode === "degraded_cadence"
          ? 30_000
          : null;
  const shouldRunNow = recommendedDelayMs === 0 || pollingDecision.shouldPollNow;
  const nextRunAt =
    shouldRunNow
      ? new Date(now).toISOString()
      : typeof recommendedDelayMs === "number"
        ? new Date(now + recommendedDelayMs).toISOString()
        : null;
  const runnerSummary =
    runnerMode === "awaiting_first_heartbeat"
      ? "Desktop runtime scheduler is waiting for the first heartbeat before steady cadence can begin."
      : runnerMode === "freshness_recovery"
        ? pollingDecision.freshnessReason
          ? `Desktop runtime scheduler is re-driving freshness recovery now because ${pollingDecision.freshnessReason}.`
          : "Desktop runtime scheduler is re-driving freshness recovery now because the health feed is stale."
        : runnerMode === "retry_unavailable"
          ? "Desktop runtime scheduler is retrying aggressively because desktop integration is unavailable or still unattached."
          : runnerMode === "degraded_cadence"
            ? "Desktop runtime scheduler keeps cadence active while desktop integration health stays under review."
            : "Desktop runtime scheduler remains on the healthy cadence.";
  return {
    shouldRunNow,
    recommendedDelayMs,
    retryBackoffMs,
    nextRunAt,
    runnerMode,
    runnerSummary,
  };
}

export function resolveShellLocalBridgeHealthFeedDriverDecision(params: {
  schedulerDecision: ShellLocalBridgeHealthFeedSchedulerDecision;
  healthFeed: ShellLocalBridgeHealthFeedSummary | null | undefined;
  healthStatus?: ShellLocalBridgeStartupPosture["healthStatus"];
  attached?: boolean;
  readiness?: ShellLocalBridgeAdapter["readiness"] | string | null;
  now?: number;
}): ShellLocalBridgeHealthFeedDriverDecision {
  const now = params.now ?? Date.now();
  const attached = params.attached === true;
  const readiness = params.readiness ?? null;
  const healthStatus = params.healthStatus ?? null;
  const stalenessStatus = params.healthFeed?.stalenessStatus ?? "idle";
  const isUnavailable =
    !attached
    || readiness === "unavailable"
    || healthStatus === "unavailable";
  const isStale = stalenessStatus === "stale";
  const isIdle = stalenessStatus === "idle";
  const isDegraded =
    !isUnavailable
    && !isStale
    && !isIdle
    && (readiness === "degraded" || healthStatus === "degraded");
  const driverState: ShellLocalBridgeHealthFeedDriverDecision["driverState"] =
    isIdle
      ? "run_now"
      : isStale
        ? "run_now"
        : isUnavailable
          ? "retry_backoff"
          : "scheduled";
  const shouldRunNow = driverState === "run_now";
  const recommendedDelayMs =
    driverState === "run_now"
      ? 0
      : params.schedulerDecision.recommendedDelayMs;
  const retryBackoffMs =
    driverState === "retry_backoff"
      ? params.schedulerDecision.retryBackoffMs ?? params.schedulerDecision.recommendedDelayMs
      : params.schedulerDecision.retryBackoffMs;
  const nextRunAt =
    driverState === "run_now"
      ? new Date(now).toISOString()
      : driverState === "retry_backoff"
        ? typeof retryBackoffMs === "number"
          ? new Date(now + retryBackoffMs).toISOString()
          : params.schedulerDecision.nextRunAt
        : params.schedulerDecision.nextRunAt;
  const driverSummary =
    isIdle
      ? "Desktop runtime driver will run now because the first heartbeat is still missing."
      : isStale
        ? "Desktop runtime driver will run now to recover desktop health feed freshness."
        : isUnavailable
          ? "Desktop runtime driver is in retry backoff because desktop integration is unavailable or still unattached."
          : isDegraded
            ? "Desktop runtime driver stays scheduled while desktop integration health remains under review."
            : "Desktop runtime driver stays on the scheduled healthy cadence.";
  return {
    driverState,
    shouldRunNow,
    nextRunAt,
    recommendedDelayMs,
    retryBackoffMs,
    driverSummary,
  };
}

export function resolveShellLocalBridgeHealthFeedTimerDecision(params: {
  driverDecision: ShellLocalBridgeHealthFeedDriverDecision;
  healthFeed: ShellLocalBridgeHealthFeedSummary | null | undefined;
  healthStatus?: ShellLocalBridgeStartupPosture["healthStatus"];
  attached?: boolean;
  readiness?: ShellLocalBridgeAdapter["readiness"] | string | null;
  now?: number;
  lastTickAt?: number | null;
  timerArmed?: boolean;
}): ShellLocalBridgeHealthFeedTimerDecision {
  const now = params.now ?? Date.now();
  const attached = params.attached === true;
  const readiness = params.readiness ?? null;
  const healthStatus = params.healthStatus ?? null;
  const stalenessStatus = params.healthFeed?.stalenessStatus ?? "idle";
  const isUnavailable =
    !attached
    || readiness === "unavailable"
    || healthStatus === "unavailable";
  const isStale = stalenessStatus === "stale";
  const isIdle = stalenessStatus === "idle";
  const isDegraded =
    !isUnavailable
    && !isStale
    && !isIdle
    && (readiness === "degraded" || healthStatus === "degraded");
  const timerState: ShellLocalBridgeHealthFeedTimerDecision["timerState"] =
    isIdle
      ? "tick_now"
      : isStale
        ? "tick_now"
        : isUnavailable || params.driverDecision.driverState === "retry_backoff"
          ? "backoff_wait"
          : params.driverDecision.driverState === "scheduled"
            ? "armed"
            : params.timerArmed
              ? "armed"
              : "idle";
  const shouldTickNow = timerState === "tick_now";
  const recommendedDelayMs =
    timerState === "tick_now"
      ? 0
      : params.driverDecision.recommendedDelayMs;
  const retryBackoffMs =
    timerState === "backoff_wait"
      ? params.driverDecision.retryBackoffMs ?? params.driverDecision.recommendedDelayMs
      : params.driverDecision.retryBackoffMs;
  const scheduledAt =
    timerState === "armed" || timerState === "backoff_wait"
      ? new Date(now).toISOString()
      : shouldTickNow
        ? new Date(now).toISOString()
        : null;
  const nextTickAt =
    shouldTickNow
      ? new Date(now).toISOString()
      : timerState === "backoff_wait"
        ? typeof retryBackoffMs === "number"
          ? new Date(now + retryBackoffMs).toISOString()
          : params.driverDecision.nextRunAt
        : timerState === "armed"
          ? params.driverDecision.nextRunAt
          : null;
  const shouldArmTimer = timerState === "armed" || timerState === "backoff_wait";
  const lastTickAt =
    typeof params.lastTickAt === "number" && Number.isFinite(params.lastTickAt)
      ? new Date(params.lastTickAt).toISOString()
      : null;
  const timerSummary =
    isIdle
      ? "Desktop runtime timer will trigger immediately because desktop cadence has not started yet."
      : isStale
        ? "Desktop runtime timer will trigger immediately to recover desktop health feed freshness."
        : isUnavailable
          ? "Desktop runtime timer stays in backoff while desktop integration remains unavailable or unattached."
          : isDegraded
            ? "Desktop runtime timer remains armed while desktop integration health stays under review."
            : shouldArmTimer
              ? "Desktop runtime timer remains armed on the healthy cadence."
              : "Desktop runtime timer is currently idle.";
  return {
    timerState,
    shouldArmTimer,
    shouldTickNow,
    scheduledAt,
    nextTickAt,
    lastTickAt,
    recommendedDelayMs,
    retryBackoffMs,
    timerSummary,
  };
}

export function resolveShellLocalBridgeRuntimeRunnerDecision(params: {
  timerDecision: ShellLocalBridgeHealthFeedTimerDecision;
  healthFeed: ShellLocalBridgeHealthFeedSummary | null | undefined;
  healthStatus?: ShellLocalBridgeStartupPosture["healthStatus"];
  attached?: boolean;
  readiness?: ShellLocalBridgeAdapter["readiness"] | string | null;
  now?: number;
  runnerStarted?: boolean;
  lastTickAt?: number | null;
}): ShellLocalBridgeRuntimeRunnerDecision {
  const now = params.now ?? Date.now();
  const attached = params.attached === true;
  const readiness = params.readiness ?? null;
  const healthStatus = params.healthStatus ?? null;
  const stalenessStatus = params.healthFeed?.stalenessStatus ?? "idle";
  const isUnavailable =
    !attached
    || readiness === "unavailable"
    || healthStatus === "unavailable";
  const isStale = stalenessStatus === "stale";
  const isIdle = stalenessStatus === "idle";
  const runnerStarted = params.runnerStarted === true;
  const runnerState: ShellLocalBridgeRuntimeRunnerDecision["runnerState"] =
    !runnerStarted
      ? "stopped"
      : params.timerDecision.timerState === "tick_now" || isStale || isIdle
          ? "ticking"
        : params.timerDecision.timerState === "backoff_wait" || isUnavailable
          ? "backoff_wait"
          : params.timerDecision.timerState === "armed"
            ? "armed"
            : "stopped";
  const shouldKeepRunning = runnerState !== "stopped";
  const armed = runnerState === "armed" || runnerState === "backoff_wait";
  const shouldTickNow = runnerState === "ticking";
  const nextWakeAt =
    shouldTickNow
      ? new Date(now).toISOString()
      : armed
        ? params.timerDecision.nextTickAt
        : null;
  const lastTickStartedAt =
    shouldTickNow
      ? new Date(now).toISOString()
      : typeof params.lastTickAt === "number" && Number.isFinite(params.lastTickAt)
        ? new Date(params.lastTickAt).toISOString()
        : null;
  const lastTickCompletedAt =
    !shouldTickNow && typeof params.lastTickAt === "number" && Number.isFinite(params.lastTickAt)
      ? new Date(params.lastTickAt).toISOString()
      : null;
  const runnerSummary =
    !runnerStarted
      ? "Desktop runtime runner is stopped until the desktop main-process loop starts."
      : runnerState === "backoff_wait"
        ? "Desktop runtime runner remains in backoff while desktop integration is unavailable."
        : runnerState === "ticking"
          ? isStale
            ? "Desktop runtime runner is ticking now to recover stale desktop health feed freshness."
            : isIdle
              ? "Desktop runtime runner is ticking now because desktop cadence has not started yet."
              : "Desktop runtime runner is ticking now."
          : "Desktop runtime runner remains armed for the next scheduled cadence wake.";
  return {
    runnerState,
    shouldKeepRunning,
    armed,
    shouldTickNow,
    nextWakeAt,
    lastTickStartedAt,
    lastTickCompletedAt,
    runnerSummary,
  };
}

export function resolveShellLocalBridgeRuntimeHostDecision(params: {
  runnerState?: ShellLocalBridgeRuntimeRunnerDecision["runnerState"];
  nextWakeAt?: string | null;
  healthFeed: ShellLocalBridgeHealthFeedSummary | null | undefined;
  healthStatus?: ShellLocalBridgeStartupPosture["healthStatus"];
  attached?: boolean;
  readiness?: ShellLocalBridgeAdapter["readiness"] | string | null;
  hostStarted?: boolean;
  now?: number;
}): ShellLocalBridgeRuntimeHostDecision {
  const now = params.now ?? Date.now();
  const attached = params.attached === true;
  const readiness = params.readiness ?? null;
  const healthStatus = params.healthStatus ?? null;
  const stalenessStatus = params.healthFeed?.stalenessStatus ?? "idle";
  const isUnavailable =
    !attached
    || readiness === "unavailable"
    || healthStatus === "unavailable";
  const isStale = stalenessStatus === "stale";
  const isIdle = stalenessStatus === "idle";
  const hostStarted = params.hostStarted === true;
  const hostState: ShellLocalBridgeRuntimeHostDecision["hostState"] =
    !hostStarted
      ? "stopped"
      : params.runnerState === "ticking" || isStale || isIdle
        ? "waking"
        : params.runnerState === "backoff_wait" || isUnavailable
          ? "backoff_wait"
          : params.runnerState === "armed"
            ? "armed"
            : "stopped";
  const hostArmed = hostState === "armed" || hostState === "backoff_wait";
  const shouldWakeNow = hostState === "waking";
  const nextWakeAt =
    shouldWakeNow
      ? new Date(now).toISOString()
      : hostArmed
        ? params.nextWakeAt ?? null
        : null;
  const lastWakeStartedAt = shouldWakeNow ? new Date(now).toISOString() : null;
  const lastWakeCompletedAt = !shouldWakeNow ? new Date(now).toISOString() : null;
  const hostSummary =
    !hostStarted
      ? "Desktop runtime host is stopped until the desktop main process starts the cadence loop."
      : hostState === "backoff_wait"
        ? "Desktop runtime host remains in backoff while desktop integration is unavailable."
        : hostState === "waking"
          ? isStale
            ? "Desktop runtime host is waking now to recover stale desktop cadence freshness."
            : isIdle
              ? "Desktop runtime host is waking now because desktop cadence has not started yet."
              : "Desktop runtime host is waking now."
          : "Desktop runtime host remains armed for the next desktop main-process wake.";
  return {
    hostState,
    hostStarted,
    hostArmed,
    shouldWakeNow,
    nextWakeAt,
    lastWakeStartedAt,
    lastWakeCompletedAt,
    hostSummary,
  };
}

export function resolveShellLocalBridgeRuntimeServiceDecision(params: {
  hostState?: ShellLocalBridgeRuntimeHostDecision["hostState"];
  nextWakeAt?: string | null;
  healthFeed: ShellLocalBridgeHealthFeedSummary | null | undefined;
  healthStatus?: ShellLocalBridgeStartupPosture["healthStatus"];
  attached?: boolean;
  readiness?: ShellLocalBridgeAdapter["readiness"] | string | null;
  serviceOwned?: boolean;
  now?: number;
}): ShellLocalBridgeRuntimeServiceDecision {
  const now = params.now ?? Date.now();
  const attached = params.attached === true;
  const readiness = params.readiness ?? null;
  const healthStatus = params.healthStatus ?? null;
  const stalenessStatus = params.healthFeed?.stalenessStatus ?? "idle";
  const isUnavailable =
    !attached
    || readiness === "unavailable"
    || healthStatus === "unavailable";
  const isStale = stalenessStatus === "stale";
  const isIdle = stalenessStatus === "idle";
  const serviceOwned = params.serviceOwned === true;
  const serviceState: ShellLocalBridgeRuntimeServiceDecision["serviceState"] =
    !serviceOwned
      ? "released"
      : params.hostState === "waking" || isStale || isIdle
        ? "waking"
        : params.hostState === "backoff_wait" || isUnavailable
          ? "backoff_wait"
          : params.hostState === "armed"
            ? "acquired"
            : "released";
  const serviceActive = serviceState !== "released";
  const shouldWakeNow = serviceState === "waking";
  const nextWakeAt =
    shouldWakeNow
      ? new Date(now).toISOString()
      : serviceActive
        ? params.nextWakeAt ?? null
        : null;
  const lastAcquireAt = serviceOwned ? new Date(now).toISOString() : null;
  const lastReleaseAt = !serviceOwned ? new Date(now).toISOString() : null;
  const serviceSummary =
    !serviceOwned
      ? "Desktop runtime service owner is released until the desktop main process acquires the cadence loop again."
      : serviceState === "backoff_wait"
        ? "Desktop runtime service owner remains active but waiting in backoff while desktop integration is unavailable."
        : serviceState === "waking"
          ? isStale
            ? "Desktop runtime service owner is waking now to recover stale desktop cadence freshness."
            : isIdle
              ? "Desktop runtime service owner is waking now because desktop cadence has not started yet."
              : "Desktop runtime service owner is waking now."
          : "Desktop runtime service owner remains acquired for the next desktop main-process wake.";
  return {
    serviceState,
    serviceOwned,
    serviceActive,
    shouldWakeNow,
    nextWakeAt,
    lastAcquireAt,
    lastReleaseAt,
    serviceSummary,
  };
}

export function resolveShellLocalBridgeRuntimeLifecycleDecision(params: {
  serviceState?: ShellLocalBridgeRuntimeServiceDecision["serviceState"];
  nextWakeAt?: string | null;
  healthFeed: ShellLocalBridgeHealthFeedSummary | null | undefined;
  healthStatus?: ShellLocalBridgeStartupPosture["healthStatus"];
  attached?: boolean;
  readiness?: ShellLocalBridgeAdapter["readiness"] | string | null;
  lifecycleOwned?: boolean;
  now?: number;
}): ShellLocalBridgeRuntimeLifecycleDecision {
  const now = params.now ?? Date.now();
  const attached = params.attached === true;
  const readiness = params.readiness ?? null;
  const healthStatus = params.healthStatus ?? null;
  const stalenessStatus = params.healthFeed?.stalenessStatus ?? "idle";
  const isUnavailable =
    !attached
    || readiness === "unavailable"
    || healthStatus === "unavailable";
  const isStale = stalenessStatus === "stale";
  const isIdle = stalenessStatus === "idle";
  const lifecycleOwned = params.lifecycleOwned === true;
  const lifecycleState: ShellLocalBridgeRuntimeLifecycleDecision["lifecycleState"] =
    !lifecycleOwned
      ? "inactive"
      : params.serviceState === "waking" || isStale || isIdle
        ? "booting"
        : params.serviceState === "backoff_wait" || isUnavailable
          ? "backoff_wait"
          : params.serviceState === "acquired"
            ? "active"
            : "inactive";
  const lifecycleActive =
    lifecycleState === "active"
    || lifecycleState === "booting"
    || lifecycleState === "backoff_wait";
  const shouldBootNow = lifecycleState === "booting";
  const shouldResumeNow = lifecycleState === "booting";
  const shouldSuspendNow = lifecycleState === "suspended";
  const nextWakeAt =
    lifecycleState === "booting"
      ? new Date(now).toISOString()
      : lifecycleActive
        ? params.nextWakeAt ?? null
        : null;
  const lifecycleSummary =
    !lifecycleOwned
      ? "Desktop runtime lifecycle owner is inactive until the desktop main process boots the cadence loop again."
      : lifecycleState === "backoff_wait"
        ? "Desktop runtime lifecycle owner remains active but waiting in backoff while desktop integration is unavailable."
        : lifecycleState === "booting"
          ? isStale
            ? "Desktop runtime lifecycle owner is booting now to recover stale desktop cadence freshness."
            : isIdle
              ? "Desktop runtime lifecycle owner is booting now because desktop cadence has not started yet."
              : "Desktop runtime lifecycle owner is booting now."
          : lifecycleState === "suspended"
            ? "Desktop runtime lifecycle owner remains suspended until the desktop main process resumes the cadence loop."
            : "Desktop runtime lifecycle owner remains active for the next desktop app wake.";
  return {
    lifecycleState,
    lifecycleOwned,
    lifecycleActive,
    shouldBootNow,
    shouldResumeNow,
    shouldSuspendNow,
    nextWakeAt,
    lastBootAt: null,
    lastResumeAt: null,
    lastSuspendAt: null,
    lastShutdownAt: null,
    lifecycleSummary,
  };
}

export function resolveShellLocalBridgeRuntimeBootstrapDecision(params: {
  lifecycleState?: ShellLocalBridgeRuntimeLifecycleDecision["lifecycleState"];
  nextWakeAt?: string | null;
  healthFeed: ShellLocalBridgeHealthFeedSummary | null | undefined;
  healthStatus?: ShellLocalBridgeStartupPosture["healthStatus"];
  attached?: boolean;
  readiness?: ShellLocalBridgeAdapter["readiness"] | string | null;
  bootstrapOwned?: boolean;
  now?: number;
}): ShellLocalBridgeRuntimeBootstrapDecision {
  const now = params.now ?? Date.now();
  const attached = params.attached === true;
  const readiness = params.readiness ?? null;
  const healthStatus = params.healthStatus ?? null;
  const stalenessStatus = params.healthFeed?.stalenessStatus ?? "idle";
  const isUnavailable =
    !attached
    || readiness === "unavailable"
    || healthStatus === "unavailable";
  const isStale = stalenessStatus === "stale";
  const isIdle = stalenessStatus === "idle";
  const bootstrapOwned = params.bootstrapOwned === true;
  const bootstrapState: ShellLocalBridgeRuntimeBootstrapDecision["bootstrapState"] =
    !bootstrapOwned
      ? "stopped"
      : params.lifecycleState === "booting" || isStale || isIdle
        ? "starting"
        : params.lifecycleState === "backoff_wait" || isUnavailable
          ? "backoff_wait"
          : params.lifecycleState === "suspended"
            ? "suspended"
            : params.lifecycleState === "active"
              ? "active"
              : "stopped";
  const bootstrapActive =
    bootstrapState === "active"
    || bootstrapState === "starting"
    || bootstrapState === "backoff_wait";
  const shouldStartNow = bootstrapState === "starting";
  const shouldWakeNow = bootstrapState === "starting";
  const shouldSuspendNow = bootstrapState === "suspended";
  const nextWakeAt =
    bootstrapState === "starting"
      ? new Date(now).toISOString()
      : bootstrapActive
        ? params.nextWakeAt ?? null
        : null;
  const bootstrapSummary =
    !bootstrapOwned
      ? "Desktop runtime bootstrap owner is stopped until the desktop main process starts the cadence stack again."
      : bootstrapState === "backoff_wait"
        ? "Desktop runtime bootstrap owner remains active but waiting in backoff while desktop integration is unavailable."
        : bootstrapState === "starting"
          ? isStale
            ? "Desktop runtime bootstrap owner is starting now to recover stale desktop cadence freshness."
            : isIdle
              ? "Desktop runtime bootstrap owner is starting now because desktop cadence has not started yet."
              : "Desktop runtime bootstrap owner is starting now."
          : bootstrapState === "suspended"
            ? "Desktop runtime bootstrap owner remains suspended until the desktop main process wakes the cadence stack again."
            : "Desktop runtime bootstrap owner remains active for the next desktop app wake.";
  return {
    bootstrapState,
    bootstrapOwned,
    bootstrapActive,
    shouldStartNow,
    shouldWakeNow,
    shouldSuspendNow,
    nextWakeAt,
    lastStartAt: null,
    lastWakeAt: null,
    lastSuspendAt: null,
    lastStopAt: null,
    bootstrapSummary,
  };
}

export function resolveShellLocalBridgeRuntimeAppOwnerDecision(params: {
  bootstrapState?: ShellLocalBridgeRuntimeBootstrapDecision["bootstrapState"];
  nextWakeAt?: string | null;
  healthFeed: ShellLocalBridgeHealthFeedSummary | null | undefined;
  healthStatus?: ShellLocalBridgeStartupPosture["healthStatus"];
  attached?: boolean;
  readiness?: ShellLocalBridgeAdapter["readiness"] | string | null;
  appOwnerOwned?: boolean;
  now?: number;
}): ShellLocalBridgeRuntimeAppOwnerDecision {
  const now = params.now ?? Date.now();
  const attached = params.attached === true;
  const readiness = params.readiness ?? null;
  const healthStatus = params.healthStatus ?? null;
  const stalenessStatus = params.healthFeed?.stalenessStatus ?? "idle";
  const isUnavailable =
    !attached
    || readiness === "unavailable"
    || healthStatus === "unavailable";
  const isStale = stalenessStatus === "stale";
  const isIdle = stalenessStatus === "idle";
  const appOwnerOwned = params.appOwnerOwned === true;
  const appOwnerState: ShellLocalBridgeRuntimeAppOwnerDecision["appOwnerState"] =
    !appOwnerOwned
      ? "stopped"
      : params.bootstrapState === "starting" || isStale || isIdle
        ? "starting"
        : params.bootstrapState === "backoff_wait" || isUnavailable
          ? "backoff_wait"
          : params.bootstrapState === "suspended"
            ? "background"
            : params.bootstrapState === "active"
              ? "active"
              : "stopped";
  const appOwnerActive =
    appOwnerState === "active"
    || appOwnerState === "starting"
    || appOwnerState === "backoff_wait";
  const shouldStartNow = appOwnerState === "starting";
  const shouldWakeNow = appOwnerState === "starting";
  const shouldBackgroundNow = appOwnerState === "background";
  const nextWakeAt =
    appOwnerState === "starting"
      ? new Date(now).toISOString()
      : appOwnerActive
        ? params.nextWakeAt ?? null
        : null;
  const appOwnerSummary =
    !appOwnerOwned
      ? "Desktop runtime app owner is stopped until the desktop main process starts the cadence stack again."
      : appOwnerState === "backoff_wait"
        ? "Desktop runtime app owner remains active but waiting in backoff while desktop integration is unavailable."
        : appOwnerState === "starting"
          ? isStale
            ? "Desktop runtime app owner is starting now to recover stale desktop cadence freshness."
            : isIdle
              ? "Desktop runtime app owner is starting now because desktop cadence has not started yet."
              : "Desktop runtime app owner is starting now."
          : appOwnerState === "background"
            ? "Desktop runtime app owner remains in the background until the desktop main process wakes the cadence stack again."
            : "Desktop runtime app owner remains active for the next desktop app wake.";
  return {
    appOwnerState,
    appOwnerOwned,
    appOwnerActive,
    shouldStartNow,
    shouldWakeNow,
    shouldBackgroundNow,
    nextWakeAt,
    lastStartAt: null,
    lastWakeAt: null,
    lastBackgroundAt: null,
    lastStopAt: null,
    appOwnerSummary,
  };
}

export function resolveShellLocalBridgeRuntimeShellOwnerDecision(params: {
  appOwnerState?: ShellLocalBridgeRuntimeAppOwnerDecision["appOwnerState"];
  nextWakeAt?: string | null;
  healthFeed: ShellLocalBridgeHealthFeedSummary | null | undefined;
  healthStatus?: ShellLocalBridgeStartupPosture["healthStatus"];
  attached?: boolean;
  readiness?: ShellLocalBridgeAdapter["readiness"] | string | null;
  shellOwnerOwned?: boolean;
  now?: number;
}): ShellLocalBridgeRuntimeShellOwnerDecision {
  const now = params.now ?? Date.now();
  const attached = params.attached === true;
  const readiness = params.readiness ?? null;
  const healthStatus = params.healthStatus ?? null;
  const stalenessStatus = params.healthFeed?.stalenessStatus ?? "idle";
  const isUnavailable =
    !attached
    || readiness === "unavailable"
    || healthStatus === "unavailable";
  const isStale = stalenessStatus === "stale";
  const isIdle = stalenessStatus === "idle";
  const shellOwnerOwned = params.shellOwnerOwned === true;
  const shellOwnerState: ShellLocalBridgeRuntimeShellOwnerDecision["shellOwnerState"] =
    !shellOwnerOwned
      ? "stopped"
      : params.appOwnerState === "starting" || isStale || isIdle
        ? "starting"
        : params.appOwnerState === "backoff_wait" || isUnavailable
          ? "backoff_wait"
          : params.appOwnerState === "background"
            ? "background"
            : params.appOwnerState === "active"
              ? "active"
              : "stopped";
  const shellOwnerActive =
    shellOwnerState === "active"
    || shellOwnerState === "starting"
    || shellOwnerState === "backoff_wait";
  const shouldStartNow = shellOwnerState === "starting";
  const shouldWakeNow = shellOwnerState === "starting";
  const shouldBackgroundNow = shellOwnerState === "background";
  const nextWakeAt =
    shellOwnerState === "starting"
      ? new Date(now).toISOString()
      : shellOwnerActive
        ? params.nextWakeAt ?? null
        : null;
  const shellOwnerSummary =
    !shellOwnerOwned
      ? "Desktop runtime shell owner is stopped until the desktop main process starts the shell facade again."
      : shellOwnerState === "backoff_wait"
        ? "Desktop runtime shell owner remains active but waiting in backoff while desktop shell facade wake is unavailable."
        : shellOwnerState === "starting"
          ? isStale
            ? "Desktop runtime shell owner is starting now to recover stale desktop cadence freshness."
            : isIdle
              ? "Desktop runtime shell owner is starting now because desktop cadence has not started yet."
              : "Desktop runtime shell owner is starting now."
          : shellOwnerState === "background"
            ? "Desktop runtime shell owner remains in the background until the desktop main process wakes the shell facade again."
            : "Desktop runtime shell owner remains active for the next desktop shell wake.";
  return {
    shellOwnerState,
    shellOwnerOwned,
    shellOwnerActive,
    shouldStartNow,
    shouldWakeNow,
    shouldBackgroundNow,
    nextWakeAt,
    lastStartAt: null,
    lastWakeAt: null,
    lastBackgroundAt: null,
    lastStopAt: null,
    shellOwnerSummary,
  };
}

export function resolveShellLocalBridgeRuntimeProcessHostDecision(params: {
  shellOwnerState?: ShellLocalBridgeRuntimeShellOwnerDecision["shellOwnerState"];
  nextWakeAt?: string | null;
  healthFeed: ShellLocalBridgeHealthFeedSummary | null | undefined;
  healthStatus?: ShellLocalBridgeStartupPosture["healthStatus"];
  attached?: boolean;
  readiness?: ShellLocalBridgeAdapter["readiness"] | string | null;
  processHostOwned?: boolean;
  now?: number;
}): ShellLocalBridgeRuntimeProcessHostDecision {
  const now = params.now ?? Date.now();
  const attached = params.attached === true;
  const readiness = params.readiness ?? null;
  const healthStatus = params.healthStatus ?? null;
  const stalenessStatus = params.healthFeed?.stalenessStatus ?? "idle";
  const isUnavailable =
    !attached
    || readiness === "unavailable"
    || healthStatus === "unavailable";
  const isStale = stalenessStatus === "stale";
  const isIdle = stalenessStatus === "idle";
  const processHostOwned = params.processHostOwned === true;
  const processHostState: ShellLocalBridgeRuntimeProcessHostDecision["processHostState"] =
    !processHostOwned
      ? "stopped"
      : params.shellOwnerState === "starting" || isStale || isIdle
        ? "starting"
        : params.shellOwnerState === "backoff_wait" || isUnavailable
          ? "backoff_wait"
          : params.shellOwnerState === "background"
            ? "background"
            : params.shellOwnerState === "active"
              ? "foreground"
              : "stopped";
  const processHostActive =
    processHostState === "foreground"
    || processHostState === "starting"
    || processHostState === "backoff_wait";
  const shouldStartNow = processHostState === "starting";
  const shouldForegroundNow = processHostState === "starting" || processHostState === "foreground";
  const shouldBackgroundNow = processHostState === "background";
  const nextWakeAt =
    processHostState === "starting"
      ? new Date(now).toISOString()
      : processHostActive
        ? params.nextWakeAt ?? null
        : null;
  const processHostSummary =
    !processHostOwned
      ? "Desktop runtime process host is stopped until the desktop main process reacquires the shell facade."
      : processHostState === "backoff_wait"
        ? "Desktop runtime process host remains active but waiting in backoff while desktop process wake is unavailable."
        : processHostState === "starting"
          ? isStale
            ? "Desktop runtime process host is starting now to recover stale desktop cadence freshness."
            : isIdle
              ? "Desktop runtime process host is starting now because desktop cadence has not started yet."
              : "Desktop runtime process host is starting now."
          : processHostState === "background"
            ? "Desktop runtime process host remains backgrounded until the desktop main process foregrounds the shell facade again."
            : "Desktop runtime process host remains in the foreground for the next desktop shell wake.";
  return {
    processHostState,
    processHostOwned,
    processHostActive,
    shouldStartNow,
    shouldForegroundNow,
    shouldBackgroundNow,
    nextWakeAt,
    lastStartAt: null,
    lastForegroundAt: null,
    lastBackgroundAt: null,
    lastStopAt: null,
    processHostSummary,
  };
}

export type ShellLocalBridgeStatusResponse = {
  generatedAt: string;
  status: "ready";
  adapter: ShellLocalBridgeAdapter;
  contract: ShellLocalBridgeContract;
  startupPosture: ShellLocalBridgeStartupPosture;
  recentHealthEvents?: ShellLocalBridgeHealthEvent[];
  healthFeed?: ShellLocalBridgeHealthFeedSummary;
  pendingCount: number;
  completedCount: number;
  actions: ShellPendingLocalAction[];
};

function buildShellDesktopIntegrationActionLabel(params: {
  startupSource?: ShellLocalBridgeStartupPosture["startupSource"];
  moduleStatus?: ShellLocalBridgeStartupPosture["moduleStatus"];
  healthStatus?: ShellLocalBridgeStartupPosture["healthStatus"];
  stalenessStatus?: ShellLocalBridgeHealthFeedSummary["stalenessStatus"];
  mode: ShellDesktopIntegrationActionMode;
}): string {
  if (params.stalenessStatus === "stale") {
    if (params.startupSource === "desktop_startup_wiring") {
      switch (params.moduleStatus) {
        case "registered_pending_attach":
        case "registered_attached":
          return "Review Startup Module Feed Freshness";
        case "reused_pending_attach":
        case "reused_attached":
          return "Review Reused Desktop Feed Freshness";
        default:
          return "Review Desktop Startup Feed Freshness";
      }
    }
    return "Review Derived Bridge Feed Freshness";
  }
  const healthPrefix =
    params.healthStatus === "degraded"
      ? "Degraded "
      : params.healthStatus === "unavailable"
        ? "Unavailable "
        : "";
  if (params.startupSource === "desktop_startup_wiring") {
    switch (params.moduleStatus) {
      case "registered_pending_attach":
      case "registered_attached":
        return params.mode === "inspect"
          ? `Inspect ${healthPrefix}Startup Module ${healthPrefix ? "Health" : "Attach"}`
          : `Review ${healthPrefix}Startup Module ${healthPrefix ? "Health" : "Attach"}`;
      case "reused_pending_attach":
      case "reused_attached":
        return params.mode === "inspect"
          ? `Inspect ${healthPrefix}Reused Desktop ${healthPrefix ? "Health" : "Attach"}`
          : `Review ${healthPrefix}Reused Desktop ${healthPrefix ? "Health" : "Attach"}`;
      default:
        return params.mode === "inspect"
          ? `Inspect ${healthPrefix}Desktop Startup ${healthPrefix ? "Health" : "Wiring"}`
          : `Review ${healthPrefix}Desktop Startup ${healthPrefix ? "Health" : "Wiring"}`;
    }
  }
  return params.mode === "inspect"
    ? `Inspect ${healthPrefix}Derived Bridge ${healthPrefix ? "Health" : "Posture"}`
    : `Review ${healthPrefix}Derived Bridge ${healthPrefix ? "Health" : "Posture"}`;
}

export function resolveShellDesktopIntegrationReviewDecision(params: {
  adapterMode?: string | null;
  startupSource?: ShellLocalBridgeStartupPosture["startupSource"];
  moduleStatus?: ShellLocalBridgeStartupPosture["moduleStatus"];
  providerStatus?: ShellLocalBridgeStartupPosture["providerStatus"];
  healthStatus?: ShellLocalBridgeStartupPosture["healthStatus"];
  stalenessStatus?: ShellLocalBridgeHealthFeedSummary["stalenessStatus"];
  freshnessReason?: string | null;
  attached?: boolean;
  readiness?: string | null;
}): ShellDesktopIntegrationReviewDecision {
  const isDesktop = params.adapterMode === "desktop";
  const isAttached = params.attached === true;
  const isStale = params.stalenessStatus === "stale";
  const isUnavailable =
    params.readiness === "unavailable" || params.healthStatus === "unavailable";
  const isDegraded =
    !isStale
    && isAttached
    && (params.readiness === "degraded" || params.healthStatus === "degraded");

  if (isStale) {
    return {
      reviewKind: "freshness",
      entryTarget: isDesktop ? "settings" : "none",
      actionMode: "review",
      actionLabel: buildShellDesktopIntegrationActionLabel({
        startupSource: params.startupSource,
        moduleStatus: params.moduleStatus,
        healthStatus: params.healthStatus,
        stalenessStatus: params.stalenessStatus,
        mode: "review",
      }),
      reasonSummary:
        params.freshnessReason?.trim()
        || "Desktop health feed freshness now outranks native local-action entry until runtime polling confirms a fresh heartbeat.",
    };
  }

  if (!isAttached) {
    return {
      reviewKind: "attach",
      entryTarget: isDesktop ? "settings" : "none",
      actionMode: "review",
      actionLabel: buildShellDesktopIntegrationActionLabel({
        startupSource: params.startupSource,
        moduleStatus: params.moduleStatus,
        healthStatus: params.healthStatus,
        stalenessStatus: params.stalenessStatus,
        mode: "review",
      }),
      reasonSummary:
        isDesktop
          ? "Desktop bridge attach/readiness still outranks session attention before native local actions should be trusted."
          : "Shell is still running on a non-desktop bridge path, so desktop attach review stays secondary.",
    };
  }

  if (isUnavailable) {
    return {
      reviewKind: "health",
      entryTarget: isDesktop ? "settings" : "none",
      actionMode: "review",
      actionLabel: buildShellDesktopIntegrationActionLabel({
        startupSource: params.startupSource,
        moduleStatus: params.moduleStatus,
        healthStatus: params.healthStatus,
        stalenessStatus: params.stalenessStatus,
        mode: "review",
      }),
      reasonSummary:
        "Desktop bridge health is unavailable, so shell should return to desktop integration settings before trusting native local actions.",
    };
  }

  if (isDegraded) {
    return {
      reviewKind: "health",
      entryTarget: "workbench",
      actionMode: "review",
      actionLabel: buildShellDesktopIntegrationActionLabel({
        startupSource: params.startupSource,
        moduleStatus: params.moduleStatus,
        healthStatus: params.healthStatus,
        stalenessStatus: params.stalenessStatus,
        mode: "review",
      }),
      reasonSummary:
        "Desktop bridge health stays under review while shell resumes work surfaces.",
    };
  }

  const actionMode: ShellDesktopIntegrationActionMode =
    isAttached && params.healthStatus === "healthy" ? "inspect" : "review";
  return {
    reviewKind: "none",
    entryTarget: "none",
    actionMode,
    actionLabel: buildShellDesktopIntegrationActionLabel({
      startupSource: params.startupSource,
      moduleStatus: params.moduleStatus,
      healthStatus: params.healthStatus,
      stalenessStatus: params.stalenessStatus,
      mode: actionMode,
    }),
    reasonSummary:
      "Desktop integration does not currently outrank existing work surfaces.",
  };
}

export function resolveShellDesktopIntegrationActionLabel(params: {
  startupSource?: ShellLocalBridgeStartupPosture["startupSource"];
  moduleStatus?: ShellLocalBridgeStartupPosture["moduleStatus"];
  healthStatus?: ShellLocalBridgeStartupPosture["healthStatus"];
  stalenessStatus?: ShellLocalBridgeHealthFeedSummary["stalenessStatus"];
  mode: ShellDesktopIntegrationActionMode;
}): string {
  return buildShellDesktopIntegrationActionLabel(params);
}

export type ShellLocalActionRequestResponse = {
  generatedAt: string;
  transport: ShellLocalBridgeTransport;
  action: ShellPendingLocalAction;
};

export type ShellLocalBridgeActionRequestedEvent = {
  generatedAt: string;
  transport: ShellLocalBridgeTransport;
  action: ShellPendingLocalAction;
  nativeLocalActionTransportSource: "desktop_local_action_push";
  desktopHostPlatform?: ShellLocalBridgeStartupPosture["desktopHostPlatform"];
  pendingNativeActionCount: number;
  nativeLocalActionDeliverySummary: string;
};

export type ShellLocalActionResultResponse = {
  generatedAt: string;
  transport: ShellLocalBridgeTransport;
  action: ShellPendingLocalAction;
};

export type ShellLocalBridgeNativeProcessEventRequest = {
  nativeEventType: NonNullable<ShellLocalBridgeStartupPosture["nativeProcessEventType"]>;
  source: NonNullable<ShellLocalBridgeStartupPosture["nativeProcessIngressSource"]>;
  hostPlatform: NonNullable<ShellLocalBridgeStartupPosture["desktopHostPlatform"]>;
  occurredAt?: string;
  shellAppLabel?: string;
};

export type ShellLocalBridgeNativeProcessEventResponse = {
  ok: true;
  nativeEventType: NonNullable<ShellLocalBridgeStartupPosture["nativeProcessEventType"]>;
  processHostState: NonNullable<ShellLocalBridgeStartupPosture["processHostState"]>;
  nextWakeAt: string | null;
  processEventSummary: string | null;
  nativeProcessEventSummary: string | null;
};

export function resolveShellLocalActionExecutionSource(
  hostPlatform?: ShellLocalBridgeStartupPosture["desktopHostPlatform"] | null,
): ShellLocalActionExecutionSource | null {
  return hostPlatform === "windows"
    ? "windows_local_action_executor"
    : hostPlatform === "macos"
      ? "macos_local_action_executor"
      : null;
}

export function resolveShellLocalActionExecutionRequest(params: {
  action: Pick<
    ShellPendingLocalAction,
    "actionId" | "actionType" | "title" | "description" | "constraints"
  >;
  hostPlatform?: ShellLocalBridgeStartupPosture["desktopHostPlatform"] | null;
}): ShellLocalActionExecutionRequest {
  const requiredPath =
    params.action.actionType === "open_file"
      ? typeof params.action.constraints?.path === "string"
        ? params.action.constraints.path
        : null
      : null;
  if (params.action.actionType === "pick_file") {
    return {
      actionId: params.action.actionId,
      actionType: params.action.actionType,
      title: params.action.title,
      description: params.action.description,
      constraints: params.action.constraints,
      hostPlatform: params.hostPlatform ?? null,
      executionMode: "file_picker",
      requiredPath: null,
      expectedPayloadShape: "{ path }",
    };
  }
  if (params.action.actionType === "pick_folder") {
    return {
      actionId: params.action.actionId,
      actionType: params.action.actionType,
      title: params.action.title,
      description: params.action.description,
      constraints: params.action.constraints,
      hostPlatform: params.hostPlatform ?? null,
      executionMode: "folder_picker",
      requiredPath: null,
      expectedPayloadShape: "{ path }",
    };
  }
  if (params.action.actionType === "open_file") {
    return {
      actionId: params.action.actionId,
      actionType: params.action.actionType,
      title: params.action.title,
      description: params.action.description,
      constraints: params.action.constraints,
      hostPlatform: params.hostPlatform ?? null,
      executionMode: "default_file_open",
      requiredPath,
      expectedPayloadShape: "{ path, opened: true }",
    };
  }
  return {
    actionId: params.action.actionId,
    actionType: params.action.actionType,
    title: params.action.title,
    description: params.action.description,
    constraints: params.action.constraints,
    hostPlatform: params.hostPlatform ?? null,
    executionMode: "confirmation_dialog",
    requiredPath: null,
    expectedPayloadShape: null,
  };
}

export function resolveShellLocalActionExecutionSummary(params: {
  shellAppLabel?: string | null;
  action: Pick<ShellPendingLocalAction, "title" | "actionType" | "actionId">;
  approved: boolean;
  hostPlatform?: ShellLocalBridgeStartupPosture["desktopHostPlatform"] | null;
  executionSource?: ShellLocalActionExecutionSource | null;
  pendingNativeActionCount?: number | null;
}): string {
  const shellAppLabel = params.shellAppLabel?.trim() || "Desktop Shell";
  const hostPlatform = params.hostPlatform?.trim() || "desktop";
  const executionSource = params.executionSource?.trim() || "desktop_local_action_executor";
  const resolution = params.approved ? "executed" : "declined";
  const pendingNativeActionCount = params.pendingNativeActionCount ?? 0;
  const countLabel =
    pendingNativeActionCount === 1
      ? "1 pending native local action remains."
      : `${pendingNativeActionCount} pending native local actions remain.`;
  return `${shellAppLabel} ${resolution} native local action ${params.action.title} (${params.action.actionType}) through ${executionSource} on ${hostPlatform}. ${countLabel}`;
}

const DESKTOP_NATIVE_ACTION_EXECUTION_MODES: Record<
  ShellLocalActionRequest["actionType"],
  ShellLocalActionExecutionRequest["executionMode"]
> = {
  pick_file: "file_picker",
  pick_folder: "folder_picker",
  open_file: "default_file_open",
  confirm_execution: "confirmation_dialog",
};

function resolveShellDesktopNativeActionCapability(
  actionType: ShellLocalActionRequest["actionType"],
  hostPlatform: "macos" | "windows",
): ShellDesktopNativeActionCapability {
  const executionMode = DESKTOP_NATIVE_ACTION_EXECUTION_MODES[actionType];
  return {
    actionType,
    supported: true,
    hostPlatform,
    executionMode,
    summary: `${hostPlatform} host provides concrete native execution for ${actionType} through ${executionMode} semantics under the shared native local-action executor contract.`,
  };
}

export function resolveShellDesktopNativeActionCapabilityMatrix(
  hostPlatform?: ShellLocalBridgeStartupPosture["desktopHostPlatform"] | null,
): ShellDesktopNativeActionCapabilityMatrix | null {
  if (hostPlatform !== "macos" && hostPlatform !== "windows") {
    return null;
  }
  return {
    pick_file: resolveShellDesktopNativeActionCapability("pick_file", hostPlatform),
    pick_folder: resolveShellDesktopNativeActionCapability("pick_folder", hostPlatform),
    open_file: resolveShellDesktopNativeActionCapability("open_file", hostPlatform),
    confirm_execution: resolveShellDesktopNativeActionCapability("confirm_execution", hostPlatform),
  };
}

export function resolveShellDesktopNativeActionCapabilitySummary(params: {
  hostPlatform?: ShellLocalBridgeStartupPosture["desktopHostPlatform"] | null;
  capabilityMatrix?: ShellDesktopNativeActionCapabilityMatrix | null;
}): string | null {
  const capabilityMatrix =
    params.capabilityMatrix ?? resolveShellDesktopNativeActionCapabilityMatrix(params.hostPlatform);
  if (!capabilityMatrix) {
    return null;
  }
  const capabilityEntries = Object.values(capabilityMatrix);
  if (!capabilityEntries.length) {
    return null;
  }
  const hostPlatform = capabilityEntries[0]?.hostPlatform ?? params.hostPlatform;
  const supported = capabilityEntries
    .filter((entry) => entry.supported)
    .map((entry) => `${entry.actionType} (${entry.executionMode})`);
  const unsupported = capabilityEntries
    .filter((entry) => !entry.supported)
    .map((entry) => entry.actionType);
  const supportedLabel = supported.length
    ? `${hostPlatform} host native local-action capability matrix supports ${supported.join(", ")}.`
    : `${hostPlatform} host native local-action capability matrix currently declares no supported native local actions.`;
  if (!unsupported.length) {
    return supportedLabel;
  }
  return `${supportedLabel} Explicitly unsupported actions: ${unsupported.join(", ")}.`;
}
