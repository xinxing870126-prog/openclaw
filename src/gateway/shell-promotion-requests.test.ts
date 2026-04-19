import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createTenantPromotionRequestRecord,
  getTenantPromotionRequestRecord,
  listTenantPromotionRequestRecords,
  resolveTenantPromotionRequestsPath,
  updateTenantPromotionRequestRecord,
} from "./shell-promotion-requests.js";

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

function tenantContext(workspaceId = "workspace-a") {
  return {
    orgId: "local-org",
    workspaceId,
    userId: "local-operator",
    isolationModel: "org / workspace / user",
    writeBoundary: "tenant_local_only",
    promotionBoundary: "governed_cross_tenant_only",
  } as const;
}

async function createStorage() {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "promotion-requests-"));
  const sanjinRoot = path.join(tempDir, "workspace", "sanjin");
  return { sanjinRoot };
}

describe("shell promotion requests", () => {
  it("creates and retrieves tenant-scoped promotion requests", async () => {
    const storage = await createStorage();
    const record = createTenantPromotionRequestRecord({
      storage,
      tenantContext: tenantContext(),
      actorId: "local-operator",
      now: "2026-04-18T00:00:00.000Z",
      input: {
        actorRole: "tenant_operator",
        requestReason: "Ready for governed review.",
        evidence: {
          evidenceKind: "capability_candidate",
          title: "Weekly Memory Digest candidate shows repeatable structure",
          detail: "Stable evidence without raw tenant memory.",
          sourceRefs: ["/tmp/evidence.json"],
          capabilityId: "draft:workflow:weekly-memory-digest",
          recommendedFocus: "Weekly Memory Digest",
        },
      },
    });

    expect(resolveTenantPromotionRequestsPath(storage)).toContain("tenant_promotion_requests.jsonl");
    expect(record.status).toBe("submitted");

    const listed = listTenantPromotionRequestRecords({
      storage,
      tenantContext: tenantContext(),
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.requestId).toBe(record.requestId);

    const fetched = getTenantPromotionRequestRecord({
      storage,
      tenantContext: tenantContext(),
      requestId: record.requestId,
    });
    expect(fetched?.evidence.capabilityId).toBe("draft:workflow:weekly-memory-digest");
  });

  it("rejects promotion requests without evidence references or candidate locators", async () => {
    const storage = await createStorage();
    expect(() =>
      createTenantPromotionRequestRecord({
        storage,
        tenantContext: tenantContext(),
        actorId: "local-operator",
        input: {
          actorRole: "tenant_operator",
          requestReason: "Missing evidence locator.",
          evidence: {
            evidenceKind: "execution_evidence",
            title: "No locator",
            detail: "This should fail.",
            sourceRefs: [],
          },
        },
      })
    ).toThrow(/at least one sourceRef or candidate\/action\/session locator/);
  });

  it("filters promotion requests by tenant workspace", async () => {
    const storage = await createStorage();
    createTenantPromotionRequestRecord({
      storage,
      tenantContext: tenantContext("workspace-a"),
      actorId: "local-operator",
      input: {
        actorRole: "tenant_operator",
        requestReason: "Workspace A request.",
        evidence: {
          evidenceKind: "structural_pattern",
          title: "Workspace A structural pattern",
          detail: "A-specific evidence.",
          sourceRefs: ["ref:a"],
        },
      },
    });
    createTenantPromotionRequestRecord({
      storage,
      tenantContext: tenantContext("workspace-b"),
      actorId: "local-operator",
      input: {
        actorRole: "tenant_operator",
        requestReason: "Workspace B request.",
        evidence: {
          evidenceKind: "structural_pattern",
          title: "Workspace B structural pattern",
          detail: "B-specific evidence.",
          sourceRefs: ["ref:b"],
        },
      },
    });

    expect(
      listTenantPromotionRequestRecords({
        storage,
        tenantContext: tenantContext("workspace-a"),
      })
    ).toHaveLength(1);
    expect(
      listTenantPromotionRequestRecords({
        storage,
        tenantContext: tenantContext("workspace-b"),
      })
    ).toHaveLength(1);
  });

  it("updates request linkage after governance intake", async () => {
    const storage = await createStorage();
    const record = createTenantPromotionRequestRecord({
      storage,
      tenantContext: tenantContext(),
      actorId: "local-operator",
      input: {
        actorRole: "tenant_operator",
        requestReason: "Ready for governed review.",
        evidence: {
          evidenceKind: "capability_candidate",
          title: "Weekly Memory Digest candidate shows repeatable structure",
          detail: "Stable evidence without raw tenant memory.",
          sourceRefs: ["/tmp/evidence.json"],
          capabilityId: "draft:workflow:weekly-memory-digest",
        },
      },
    });

    const updated = updateTenantPromotionRequestRecord({
      storage,
      tenantContext: tenantContext(),
      requestId: record.requestId,
      updater: (current) => ({
        ...current,
        status: "under_review",
        reviewId: "review-1",
        reviewQueueId: "review-queue-1",
        decisionSummary: "Brain-side governance admitted this tenant request into cross-tenant review.",
        lastGovernanceTransitionAt: "2026-04-18T01:00:00.000Z",
        updatedAt: "2026-04-18T01:00:00.000Z",
      }),
    });

    expect(updated.status).toBe("under_review");
    expect(updated.reviewQueueId).toBe("review-queue-1");
    expect(updated.lastGovernanceTransitionAt).toBe("2026-04-18T01:00:00.000Z");
  });
});
