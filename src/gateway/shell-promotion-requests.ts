import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  ShellTenantContext,
  ShellTenantPromotionRequestInput,
  ShellTenantPromotionRequestRecord,
} from "./shell-app-contract.js";

type TenantPromotionRequestStorage = {
  sanjinRoot: string;
};

function normalizeSourceRefs(sourceRefs: string[]): string[] {
  return sourceRefs
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeOptional(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function assertPromotionRequestInput(input: ShellTenantPromotionRequestInput): void {
  const reason = input.requestReason.trim();
  if (!reason) {
    throw new Error("requestReason is required");
  }
  const actorRole = input.actorRole ?? "tenant_operator";
  if (actorRole !== "tenant_operator" && actorRole !== "tenant_admin") {
    throw new Error("actorRole must be tenant_operator or tenant_admin");
  }
  const title = input.evidence.title.trim();
  const detail = input.evidence.detail.trim();
  if (!title) {
    throw new Error("evidence.title is required");
  }
  if (!detail) {
    throw new Error("evidence.detail is required");
  }
  const refs = normalizeSourceRefs(input.evidence.sourceRefs);
  const hasEvidenceLocator =
    refs.length > 0
    || Boolean(normalizeOptional(input.evidence.capabilityId))
    || Boolean(normalizeOptional(input.evidence.sessionKey))
    || Boolean(normalizeOptional(input.evidence.actionId))
    || Boolean(normalizeOptional(input.evidence.resultActionId))
    || Boolean(normalizeOptional(input.evidence.recommendedFocus));
  if (!hasEvidenceLocator) {
    throw new Error(
      "promotion request evidence must include at least one sourceRef or candidate/action/session locator",
    );
  }
}

export function resolveTenantPromotionRequestsPath(
  storage: TenantPromotionRequestStorage,
): string {
  return path.join(storage.sanjinRoot, "eval", "artifacts", "tenant_promotion_requests.jsonl");
}

export function readTenantPromotionRequestRecords(
  storage: TenantPromotionRequestStorage,
): ShellTenantPromotionRequestRecord[] {
  const filePath = resolveTenantPromotionRequestsPath(storage);
  try {
    return fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ShellTenantPromotionRequestRecord);
  } catch {
    return [];
  }
}

function writeTenantPromotionRequestRecords(
  storage: TenantPromotionRequestStorage,
  records: ShellTenantPromotionRequestRecord[],
): void {
  const filePath = resolveTenantPromotionRequestsPath(storage);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = records.map((record) => JSON.stringify(record)).join("\n");
  fs.writeFileSync(filePath, content ? `${content}\n` : "", "utf8");
}

export function listTenantPromotionRequestRecords(params: {
  storage: TenantPromotionRequestStorage;
  tenantContext: ShellTenantContext;
}): ShellTenantPromotionRequestRecord[] {
  return readTenantPromotionRequestRecords(params.storage)
    .filter(
      (record) =>
        record.tenantContext.orgId === params.tenantContext.orgId
        && record.tenantContext.workspaceId === params.tenantContext.workspaceId,
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getTenantPromotionRequestRecord(params: {
  storage: TenantPromotionRequestStorage;
  tenantContext: ShellTenantContext;
  requestId: string;
}): ShellTenantPromotionRequestRecord | null {
  const requestId = params.requestId.trim();
  if (!requestId) {
    throw new Error("requestId is required");
  }
  return listTenantPromotionRequestRecords(params).find((record) => record.requestId === requestId) ?? null;
}

export function updateTenantPromotionRequestRecord(params: {
  storage: TenantPromotionRequestStorage;
  tenantContext: ShellTenantContext;
  requestId: string;
  updater: (record: ShellTenantPromotionRequestRecord) => ShellTenantPromotionRequestRecord;
}): ShellTenantPromotionRequestRecord {
  const requestId = params.requestId.trim();
  if (!requestId) {
    throw new Error("requestId is required");
  }
  const records = readTenantPromotionRequestRecords(params.storage);
  let updatedRecord: ShellTenantPromotionRequestRecord | null = null;
  const nextRecords = records.map((record) => {
    if (
      record.requestId !== requestId
      || record.tenantContext.orgId !== params.tenantContext.orgId
      || record.tenantContext.workspaceId !== params.tenantContext.workspaceId
    ) {
      return record;
    }
    updatedRecord = params.updater(record);
    return updatedRecord;
  });
  if (!updatedRecord) {
    throw new Error(`unknown promotion request: ${requestId}`);
  }
  writeTenantPromotionRequestRecords(params.storage, nextRecords);
  return updatedRecord;
}

export function createTenantPromotionRequestRecord(params: {
  storage: TenantPromotionRequestStorage;
  tenantContext: ShellTenantContext;
  actorId: string;
  input: ShellTenantPromotionRequestInput;
  now?: string;
}): ShellTenantPromotionRequestRecord {
  assertPromotionRequestInput(params.input);
  const now = params.now ?? new Date().toISOString();
  const record: ShellTenantPromotionRequestRecord = {
    requestId: `promotion-request:${randomUUID()}`,
    tenantContext: params.tenantContext,
    actorId: params.actorId.trim() || params.tenantContext.userId,
    actorRole: params.input.actorRole ?? "tenant_operator",
    requestReason: params.input.requestReason.trim(),
    status: "submitted",
    evidence: {
      evidenceKind: params.input.evidence.evidenceKind,
      title: params.input.evidence.title.trim(),
      detail: params.input.evidence.detail.trim(),
      sourceRefs: normalizeSourceRefs(params.input.evidence.sourceRefs),
      capabilityId: normalizeOptional(params.input.evidence.capabilityId),
      recommendedFocus: normalizeOptional(params.input.evidence.recommendedFocus),
      sessionKey: normalizeOptional(params.input.evidence.sessionKey),
      actionId: normalizeOptional(params.input.evidence.actionId),
      resultActionId: normalizeOptional(params.input.evidence.resultActionId),
    },
    decisionSummary: null,
    reviewId: null,
    reviewQueueId: null,
    governanceQueueId: null,
    governanceQueueStatus: "submitted",
    gateId: null,
    gateStatus: null,
    shadowId: null,
    shadowStatus: null,
    rolloutLabel: null,
    rolloutControlId: null,
    rolloutControlStatus: null,
    rolloutControlSource: null,
    rolloutContextKeys: [],
    rolloutPreferredRoles: [],
    rolloutControlSummary: null,
    rolloutRollbackReason: null,
    latestGovernanceActionLabel: null,
    lastAuditSummary: null,
    reviewStatus: null,
    decisionActorId: null,
    decisionActorRole: null,
    decisionAt: null,
    lastGovernanceTransitionAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const filePath = resolveTenantPromotionRequestsPath(params.storage);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}
