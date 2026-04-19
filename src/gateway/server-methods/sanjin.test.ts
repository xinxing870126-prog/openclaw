import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../protocol/index.js";
import {
  reportDesktopShellStartupModuleHealth,
  startDesktopShellStartupModuleStub,
} from "../shell-local-bridge-desktop-shell-startup-module.stub.js";
import { initializeDesktopShellRuntimeIntegration } from "../shell-local-bridge-desktop-runtime.integration.js";
import { updateLocalBridgeStartupPosture } from "../shell-local-bridge-provider-runtime.js";
import { wireDesktopShellLocalBridgeStartup } from "../shell-local-bridge-desktop-startup-wiring.stub.js";
import { sanjinHandlers, setLocalBridgeAdapterProviderForTests } from "./sanjin.js";
import { sessionsHandlers } from "./sessions.js";
import type { ShellPendingLocalAction } from "../shell-app-contract.js";
import type { GatewayRequestHandlerOptions } from "./types.js";

const ORIGINAL_WORKSPACE_DIR = process.env.OPENCLAW_WORKSPACE_DIR;
const ORIGINAL_SANJIN_ORG_ID = process.env.OPENCLAW_SANJIN_ORG_ID;
const ORIGINAL_SANJIN_WORKSPACE_ID = process.env.OPENCLAW_SANJIN_WORKSPACE_ID;
const ORIGINAL_SANJIN_WORKSPACES = process.env.OPENCLAW_SANJIN_WORKSPACES;
const ORIGINAL_SANJIN_USER_ID = process.env.OPENCLAW_SANJIN_USER_ID;

function createOptions(
  method: keyof typeof sanjinHandlers,
  params: Record<string, unknown> = {},
  client: GatewayRequestHandlerOptions["client"] = null,
): GatewayRequestHandlerOptions {
  return {
    req: { type: "req", id: "req-sanjin-1", method, params },
    params,
    client,
    isWebchatConnect: () => false,
    respond: vi.fn(),
    context: {
      broadcast: vi.fn(),
      logGateway: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
    },
  } as unknown as GatewayRequestHandlerOptions;
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function writeJsonl(filePath: string, rows: unknown[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`,
    "utf8",
  );
}

async function writeText(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function createSanjinFixture(): Promise<{ rootDir: string; workspaceDir: string }> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-sanjin-"));
  const workspaceDir = path.join(rootDir, "workspace");
  const sanjinRoot = path.join(workspaceDir, "sanjin");
  const reportsDir = path.join(sanjinRoot, "memory", "reports");
  const artifactsDir = path.join(sanjinRoot, "eval", "artifacts");
  const capabilitiesDir = path.join(sanjinRoot, "memory", "capabilities");
  const evalDir = path.join(sanjinRoot, "eval");

  await writeJson(path.join(reportsDir, "benchmark_rerun_test.json"), {
    run_id: "test-run-001",
    quality_scores: {
      robustness: { passed: 6, total: 6 },
      anti_shortcut: { passed: 7, total: 7 },
    },
    new_mode_distribution: {
      soft_policy: 7,
      hard_policy: 3,
    },
    guard_distribution: {
      bounded_exploration_allowed: 1,
      none: 12,
    },
  });

  await writeJson(path.join(reportsDir, "observability_summary.json"), {
    hook_event_summary: { count: 428 },
    permission_gate_summary: {
      count: 5,
      blocked_count: 2,
      lane_distribution: { session_summary: 2, digest: 2, information_query: 1 },
    },
    runtime_recovery_summary: {
      trace_count: 30,
      recovery_governance_label: "healthy",
      waiting_count: 1,
      retry_count: 1,
      replan_triggered_count: 2,
      transition_distribution: { continue: 21, waiting: 1, retry: 1 },
    },
    action_layer_summary: {
      action_governance_label: "healthy",
      tool_failure_count: 1,
      specialist_invalid_count: 1,
      execution_strategy_distribution: {
        direct_action: 19,
        tool_first: 3,
        tool_then_specialist: 2,
        specialist_first: 2,
      },
    },
    skill_governance_summary: {
      scorecard_count: 14,
      governance_distribution: { healthy: 12, observe: 2 },
      top_skills: [
        {
          skill_name: "workflow-to-skill",
          total_runs: 4,
          success_rate: "1.00",
          governance_label: "healthy",
        },
        {
          skill_name: "end-to-end-verifier",
          total_runs: 4,
          success_rate: "1.00",
          governance_label: "healthy",
        },
      ],
    },
    governance_window: {
      dependency_check_v1_window_samples: 149,
      verify_before_act_v1_window_samples: 12,
    },
    governance_review_summary: {
      gp_dependency_check_v1: {
        recommendation: "needs_more_window",
        host_governance_label: "healthy",
        window_size: 149,
      },
      gp_verify_before_act_v1: {
        recommendation: "promote_or_keep_active",
        host_governance_label: "healthy",
        window_size: 12,
      },
    },
  });

  await writeJson(path.join(reportsDir, "stability_trend_panel_test.json"), {
    windows: {
      "7d": {
        permission_gate: { count: 5, blocked_count: 2 },
        runtime_recovery: { trace_count: 30, label: "healthy" },
        action_layer: { trace_count: 30, label: "healthy" },
      },
    },
  });

  await writeJson(path.join(reportsDir, "production_skill_trend_panel_test.json"), {
    windows: {
      "7d": {
        run_count: 28,
        status_distribution: { healthy: 7 },
        skill_distribution: {
          "workflow-to-skill": 4,
          "end-to-end-verifier": 4,
        },
        top_skills: [
          {
            skill_name: "workflow-to-skill",
            total_runs: 4,
            success_rate: "1.00",
            governance_label: "healthy",
          },
        ],
      },
    },
  });

      await writeJson(path.join(capabilitiesDir, "registry.json"), {
    updated_at: "2026-04-09T00:00:00.000Z",
    entries: [
      {
        capability_id: "skill:workflow-to-skill",
        capability_type: "skill",
        display_name: "Workflow To Skill",
        status: "active",
        admission_stage: "active",
        source_registry: "skill_registry",
        preferred_subagent: "skill_architect",
        sample_run_count: 4,
        metadata: { production_template: true, scope: "core" },
      },
      {
        capability_id: "subagent:verifier",
        capability_type: "subagent",
        display_name: "Verifier",
        status: "active",
        admission_stage: "active",
        source_registry: "subagent_registry",
        preferred_subagent: "",
        sample_run_count: 0,
        metadata: { scope: "org" },
      },
      {
        capability_id: "connector:mcp_placeholder",
        capability_type: "connector",
        display_name: "mcp_placeholder",
        status: "candidate",
        admission_stage: "candidate",
        source_registry: "extension_catalog",
        preferred_subagent: "",
        sample_run_count: 0,
        metadata: { scope: "org" },
      },
      {
        capability_id: "draft:workflow:weekly-memory-digest",
        capability_type: "workflow",
        display_name: "Weekly Memory Digest",
        status: "draft",
        admission_stage: "draft",
        source_registry: "capability_pack",
        preferred_subagent: "watch_operator",
        sample_run_count: 0,
        metadata: { scope: "workspace" },
      },
    ],
  });

  await writeJsonl(path.join(artifactsDir, "governance_reviews.jsonl"), [
    {
      gp_name: "gp_dependency_check_v1",
      recommendation: "needs_more_window",
      host_governance_label: "healthy",
      review_basis: "shadow_window+host_observability",
    },
    {
      gp_name: "gp_verify_before_act_v1",
      recommendation: "promote_or_keep_active",
      host_governance_label: "healthy",
      review_basis: "shadow_window+host_observability",
    },
  ]);

  await writeText(
    path.join(evalDir, "run_capability_schema_validation.py"),
    `import json
from datetime import datetime
from pathlib import Path

root = Path(__file__).resolve().parents[1]
registry_path = root / "memory" / "capabilities" / "registry.json"
reports_dir = root / "memory" / "reports"
payload = json.loads(registry_path.read_text())
validated_count = 0
failed_count = 0
for entry in payload.get("entries", []):
    if entry.get("source_registry") != "capability_pack":
        continue
    metadata = entry.setdefault("metadata", {})
    metadata["schema_validation"] = {
        "validated_at": datetime.utcnow().isoformat() + "Z",
        "ok": True,
        "errors": [],
        "warnings": [],
    }
    entry["admission_stage"] = "schema_validated"
    entry["status"] = "schema_validated"
    validated_count += 1
registry_path.write_text(json.dumps(payload, indent=2))
json_path = reports_dir / "sanjin_capability_schema_validation_2026-04-09.json"
md_path = reports_dir / "sanjin_capability_schema_validation_2026-04-09.md"
report = {
    "generated_at": "2026-04-09T00:00:00.000Z",
    "validated_count": validated_count,
    "failed_count": failed_count,
    "source_files": [str(registry_path)],
    "rows": [],
}
json_path.write_text(json.dumps(report, indent=2))
md_path.write_text("# schema validation\\n")
print(json.dumps({
    "json_path": str(json_path),
    "md_path": str(md_path),
    "source_files": [str(registry_path)],
}))
`,
  );

  await writeText(
    path.join(evalDir, "run_capability_sample_runs.py"),
    `import json
from datetime import datetime
from pathlib import Path

root = Path(__file__).resolve().parents[1]
registry_path = root / "memory" / "capabilities" / "registry.json"
reports_dir = root / "memory" / "reports"
payload = json.loads(registry_path.read_text())
sampled_count = 0
for entry in payload.get("entries", []):
    if entry.get("source_registry") != "capability_pack":
        continue
    metadata = entry.setdefault("metadata", {})
    validation = metadata.get("schema_validation", {})
    if not validation.get("ok"):
        continue
    entry["sample_run_count"] = int(entry.get("sample_run_count", 0)) + 1
    entry["admission_stage"] = "sampled"
    entry["status"] = "sampled"
    metadata["sample_run"] = {
        "last_sampled_at": datetime.utcnow().isoformat() + "Z",
        "sample_status": "ok",
        "sample_mode": "simulated_contract_probe",
    }
    sampled_count += 1
registry_path.write_text(json.dumps(payload, indent=2))
json_path = reports_dir / "sanjin_capability_sample_runs_2026-04-09.json"
md_path = reports_dir / "sanjin_capability_sample_runs_2026-04-09.md"
report = {
    "generated_at": "2026-04-09T00:00:00.000Z",
    "sampled_count": sampled_count,
    "ready_for_candidate_count": sampled_count,
    "source_files": [str(registry_path)],
    "rows": [],
}
json_path.write_text(json.dumps(report, indent=2))
md_path.write_text("# sample runs\\n")
print(json.dumps({
    "json_path": str(json_path),
    "md_path": str(md_path),
    "source_files": [str(registry_path)],
}))
`,
  );

  await writeText(
    path.join(evalDir, "run_capability_promote_candidates.py"),
    `import json
from datetime import datetime
from pathlib import Path

root = Path(__file__).resolve().parents[1]
registry_path = root / "memory" / "capabilities" / "registry.json"
reports_dir = root / "memory" / "reports"
payload = json.loads(registry_path.read_text())
promoted_count = 0
for entry in payload.get("entries", []):
    if entry.get("source_registry") != "capability_pack":
        continue
    metadata = entry.setdefault("metadata", {})
    validation = metadata.get("schema_validation", {})
    if entry.get("admission_stage") != "sampled":
        continue
    if not validation.get("ok"):
        continue
    if int(entry.get("sample_run_count", 0)) < 1:
        continue
    entry["admission_stage"] = "candidate"
    entry["status"] = "candidate"
    metadata["candidate_promotion"] = {
        "promoted_at": datetime.utcnow().isoformat() + "Z",
        "reason": "sampled_ready_for_candidate",
    }
    promoted_count += 1
registry_path.write_text(json.dumps(payload, indent=2))
json_path = reports_dir / "sanjin_capability_candidate_promotion_2026-04-09.json"
md_path = reports_dir / "sanjin_capability_candidate_promotion_2026-04-09.md"
report = {
    "generated_at": "2026-04-09T00:00:00.000Z",
    "promoted_count": promoted_count,
    "candidate_count": promoted_count,
    "source_files": [str(registry_path)],
    "rows": [],
}
json_path.write_text(json.dumps(report, indent=2))
md_path.write_text("# candidate promotion\\n")
print(json.dumps({
    "json_path": str(json_path),
    "md_path": str(md_path),
    "source_files": [str(registry_path)],
}))
`,
  );

  await writeText(
    path.join(evalDir, "run_capability_promote_limited_active.py"),
    `import json
from datetime import datetime
from pathlib import Path

root = Path(__file__).resolve().parents[1]
registry_path = root / "memory" / "capabilities" / "registry.json"
reports_dir = root / "memory" / "reports"
payload = json.loads(registry_path.read_text())
promoted_count = 0
for entry in payload.get("entries", []):
    if entry.get("source_registry") != "capability_pack":
        continue
    if entry.get("capability_type") != "workflow":
        continue
    if entry.get("admission_stage") != "candidate":
        continue
    if int(entry.get("sample_run_count", 0)) < 1:
        continue
    metadata = entry.setdefault("metadata", {})
    entry["admission_stage"] = "limited_active"
    entry["status"] = "limited_active"
    entry["enabled"] = True
    entry["governance_policy"] = "shadow_only"
    metadata["limited_activation"] = {
        "activated_at": datetime.utcnow().isoformat() + "Z",
        "reason": "candidate_ready_for_limited_active",
        "activation_mode": "shadow_only",
    }
    promoted_count += 1
registry_path.write_text(json.dumps(payload, indent=2))
json_path = reports_dir / "sanjin_capability_limited_active_promotion_2026-04-09.json"
md_path = reports_dir / "sanjin_capability_limited_active_promotion_2026-04-09.md"
report = {
    "generated_at": "2026-04-09T00:00:00.000Z",
    "promoted_count": promoted_count,
    "limited_active_count": promoted_count,
    "source_files": [str(registry_path)],
    "rows": [],
}
json_path.write_text(json.dumps(report, indent=2))
md_path.write_text("# limited active promotion\\n")
print(json.dumps({
    "json_path": str(json_path),
    "md_path": str(md_path),
    "source_files": [str(registry_path)],
}))
`,
  );

  await writeText(
    path.join(evalDir, "run_capability_limited_active_observation.py"),
    `import json
from datetime import datetime
from pathlib import Path

root = Path(__file__).resolve().parents[1]
registry_path = root / "memory" / "capabilities" / "registry.json"
reports_dir = root / "memory" / "reports"
payload = json.loads(registry_path.read_text())
observed_count = 0
ready_for_active_count = 0
for entry in payload.get("entries", []):
    if entry.get("source_registry") != "capability_pack":
        continue
    if entry.get("capability_type") != "workflow":
        continue
    if entry.get("admission_stage") != "limited_active":
        continue
    metadata = entry.setdefault("metadata", {})
    observation = metadata.get("limited_active_observation", {})
    observation_count = int(observation.get("observation_count", 0)) + 1
    entry["sample_run_count"] = int(entry.get("sample_run_count", 0)) + 1
    metadata["limited_active_observation"] = {
        "observed_at": datetime.utcnow().isoformat() + "Z",
        "observation_count": observation_count,
        "shadow_status": "passed",
        "effective_sample_run_count": entry["sample_run_count"],
    }
    observed_count += 1
    if entry["sample_run_count"] >= 2 and observation_count >= 1:
        ready_for_active_count += 1
registry_path.write_text(json.dumps(payload, indent=2))
json_path = reports_dir / "sanjin_capability_limited_active_observation_2026-04-09.json"
md_path = reports_dir / "sanjin_capability_limited_active_observation_2026-04-09.md"
report = {
    "generated_at": "2026-04-09T00:00:00.000Z",
    "observed_count": observed_count,
    "ready_for_active_count": ready_for_active_count,
    "source_files": [str(registry_path)],
    "rows": [],
}
json_path.write_text(json.dumps(report, indent=2))
md_path.write_text("# limited active observation\\n")
print(json.dumps({
    "json_path": str(json_path),
    "md_path": str(md_path),
    "source_files": [str(registry_path)],
}))
`,
  );

  await writeText(
    path.join(evalDir, "run_capability_promote_active.py"),
    `import json
from datetime import datetime
from pathlib import Path

root = Path(__file__).resolve().parents[1]
registry_path = root / "memory" / "capabilities" / "registry.json"
reports_dir = root / "memory" / "reports"
payload = json.loads(registry_path.read_text())
promoted_count = 0
active_count = 0
for entry in payload.get("entries", []):
    if entry.get("source_registry") != "capability_pack":
        continue
    if entry.get("capability_type") != "workflow":
        continue
    if entry.get("admission_stage") != "limited_active":
        continue
    metadata = entry.setdefault("metadata", {})
    observation = metadata.get("limited_active_observation", {})
    if int(entry.get("sample_run_count", 0)) < 3:
        continue
    if int(observation.get("observation_count", 0)) < 2:
        continue
    entry["admission_stage"] = "active"
    entry["status"] = "active"
    entry["enabled"] = True
    entry["governance_policy"] = "active_monitoring"
    metadata["active_promotion"] = {
        "promoted_at": datetime.utcnow().isoformat() + "Z",
        "reason": "limited_active_observed_ready_for_active",
        "required_sample_run_count": 3,
        "required_observation_count": 2,
    }
    promoted_count += 1
    active_count += 1
registry_path.write_text(json.dumps(payload, indent=2))
json_path = reports_dir / "sanjin_capability_active_promotion_2026-04-10.json"
md_path = reports_dir / "sanjin_capability_active_promotion_2026-04-10.md"
report = {
    "generated_at": "2026-04-10T00:00:00.000Z",
    "promoted_count": promoted_count,
    "active_count": active_count,
    "source_files": [str(registry_path)],
    "rows": [],
}
json_path.write_text(json.dumps(report, indent=2))
md_path.write_text("# active promotion\\n")
print(json.dumps({
    "json_path": str(json_path),
    "md_path": str(md_path),
    "source_files": [str(registry_path)],
}))
`,
  );

  await writeText(
    path.join(evalDir, "run_capability_active_observation.py"),
    `import json
from datetime import datetime
from pathlib import Path

root = Path(__file__).resolve().parents[1]
registry_path = root / "memory" / "capabilities" / "registry.json"
reports_dir = root / "memory" / "reports"
payload = json.loads(registry_path.read_text())
observed_count = 0
stable_count = 0
for entry in payload.get("entries", []):
    if entry.get("source_registry") != "capability_pack":
        continue
    if entry.get("capability_type") != "workflow":
        continue
    if entry.get("admission_stage") != "active":
        continue
    metadata = entry.setdefault("metadata", {})
    if not metadata.get("active_promotion"):
        continue
    observation = metadata.get("active_observation", {})
    observation_count = int(observation.get("observation_count", 0)) + 1
    metadata["active_observation"] = {
        "observed_at": datetime.utcnow().isoformat() + "Z",
        "observation_count": observation_count,
        "active_status": "healthy",
        "observation_window": "validation_active_monitoring",
    }
    observed_count += 1
    if observation_count >= 1:
        stable_count += 1
registry_path.write_text(json.dumps(payload, indent=2))
json_path = reports_dir / "sanjin_capability_active_observation_2026-04-10.json"
md_path = reports_dir / "sanjin_capability_active_observation_2026-04-10.md"
report = {
    "generated_at": "2026-04-10T00:00:00.000Z",
    "observed_count": observed_count,
    "stable_count": stable_count,
    "source_files": [str(registry_path)],
    "rows": [],
}
json_path.write_text(json.dumps(report, indent=2))
md_path.write_text("# active observation\\n")
print(json.dumps({
    "json_path": str(json_path),
    "md_path": str(md_path),
    "source_files": [str(registry_path)],
}))
`,
  );

  await writeText(
    path.join(evalDir, "run_capability_post_active_monitoring_window.py"),
    `import json
from datetime import datetime
from pathlib import Path

root = Path(__file__).resolve().parents[1]
registry_path = root / "memory" / "capabilities" / "registry.json"
reports_dir = root / "memory" / "reports"
payload = json.loads(registry_path.read_text())
observed_count = 0
ready_for_production_shell_count = 0
for entry in payload.get("entries", []):
    if entry.get("source_registry") != "capability_pack":
        continue
    if entry.get("capability_type") != "workflow":
        continue
    if entry.get("admission_stage") != "active":
        continue
    metadata = entry.setdefault("metadata", {})
    if not metadata.get("active_observation"):
        continue
    monitoring = metadata.get("post_active_monitoring", {})
    window_count = int(monitoring.get("window_count", 0)) + 1
    metadata["post_active_monitoring"] = {
        "observed_at": datetime.utcnow().isoformat() + "Z",
        "window_count": window_count,
        "window_status": "healthy",
        "acceptance_label": "ready_for_production_shell",
        "acceptance_window": "validation_post_active_monitoring",
    }
    observed_count += 1
    if window_count >= 1:
        ready_for_production_shell_count += 1
registry_path.write_text(json.dumps(payload, indent=2))
json_path = reports_dir / "sanjin_capability_post_active_monitoring_window_2026-04-10.json"
md_path = reports_dir / "sanjin_capability_post_active_monitoring_window_2026-04-10.md"
report = {
    "generated_at": "2026-04-10T00:00:00.000Z",
    "observed_count": observed_count,
    "ready_for_production_shell_count": ready_for_production_shell_count,
    "source_files": [str(registry_path)],
    "rows": [],
}
json_path.write_text(json.dumps(report, indent=2))
md_path.write_text("# post active monitoring\\n")
print(json.dumps({
    "json_path": str(json_path),
    "md_path": str(md_path),
    "source_files": [str(registry_path)],
}))
`,
  );

  await writeText(
    path.join(evalDir, "create_capability_draft.py"),
    `import json
import re
import sys
from datetime import datetime
from pathlib import Path

root = Path(__file__).resolve().parents[1]
registry_path = root / "memory" / "capabilities" / "registry.json"
payload = json.loads(registry_path.read_text())
input_payload = json.loads(sys.stdin.read() or "{}")
display_name = str(input_payload.get("displayName") or input_payload.get("display_name") or "Untitled Capability")
capability_type = str(input_payload.get("capabilityType") or input_payload.get("capability_type") or "workflow")
preferred_subagent = str(input_payload.get("preferredSubagent") or input_payload.get("preferred_subagent") or "")
scope = str(input_payload.get("scope") or "workspace")
slug = re.sub(r"[^a-z0-9]+", "-", display_name.lower()).strip("-") or "untitled-capability"
capability_id = f"draft:{capability_type}:{slug}"
entry = {
    "capability_id": capability_id,
    "capability_type": capability_type,
    "display_name": display_name,
    "status": "draft",
    "admission_stage": "draft",
    "source_registry": "capability_pack",
    "preferred_subagent": preferred_subagent,
    "sample_run_count": 0,
    "metadata": {
        "scope": scope,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "draft_description": str(input_payload.get("description") or ""),
    },
}
payload.setdefault("entries", []).append(entry)
registry_path.write_text(json.dumps(payload, indent=2))
print(json.dumps({
    "capability_id": capability_id,
    "display_name": display_name,
    "capability_type": capability_type,
    "admission_stage": "draft",
    "status": "draft",
    "scope_label": scope,
    "source_files": [str(registry_path)],
}))
`,
  );

  return { rootDir, workspaceDir };
}

afterEach(async () => {
  if (ORIGINAL_WORKSPACE_DIR) {
    process.env.OPENCLAW_WORKSPACE_DIR = ORIGINAL_WORKSPACE_DIR;
  } else {
    delete process.env.OPENCLAW_WORKSPACE_DIR;
  }
  if (ORIGINAL_SANJIN_ORG_ID) {
    process.env.OPENCLAW_SANJIN_ORG_ID = ORIGINAL_SANJIN_ORG_ID;
  } else {
    delete process.env.OPENCLAW_SANJIN_ORG_ID;
  }
  if (ORIGINAL_SANJIN_WORKSPACE_ID) {
    process.env.OPENCLAW_SANJIN_WORKSPACE_ID = ORIGINAL_SANJIN_WORKSPACE_ID;
  } else {
    delete process.env.OPENCLAW_SANJIN_WORKSPACE_ID;
  }
  if (ORIGINAL_SANJIN_WORKSPACES) {
    process.env.OPENCLAW_SANJIN_WORKSPACES = ORIGINAL_SANJIN_WORKSPACES;
  } else {
    delete process.env.OPENCLAW_SANJIN_WORKSPACES;
  }
  if (ORIGINAL_SANJIN_USER_ID) {
    process.env.OPENCLAW_SANJIN_USER_ID = ORIGINAL_SANJIN_USER_ID;
  } else {
    delete process.env.OPENCLAW_SANJIN_USER_ID;
  }
  delete process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER;
  delete process.env.OPENCLAW_SHELL_LOCAL_BRIDGE_ADAPTER;
  wireDesktopShellLocalBridgeStartup({
    env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "simulated" } as NodeJS.ProcessEnv,
  });
  setLocalBridgeAdapterProviderForTests(null);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("sanjinHandlers", () => {
  it("returns shaped payloads for the populated Sanjin workbench sections", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      const pilotShell = createOptions("sanjin.pilotShell");
      sanjinHandlers["sanjin.pilotShell"](pilotShell);
      expect(pilotShell.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          tenantContext: expect.objectContaining({
            orgId: "local-org",
            workspaceId: "workspace",
            userId: "local-operator",
            isolationModel: "org / workspace / user",
            writeBoundary: "tenant_local_only",
            promotionBoundary: "governed_cross_tenant_only",
          }),
          onboardingState: expect.objectContaining({
            phase: "workbenchLanding",
            currentWorkspaceId: "workspace",
            target: expect.objectContaining({
              panel: "workbench",
            }),
          }),
          activeScopeLabel: "local-org / workspace / local-operator",
          tenantModelLabel: "org / workspace / user",
          benchmarkScore: "6/6",
          desktopIntegration: expect.objectContaining({
            title: "Desktop Bridge Integration",
            adapterLabel: "Simulated Local Bridge",
            adapterMode: "simulated",
            readiness: "ready",
            contractVersion: "v1",
            startupPosture: expect.objectContaining({
              mode: "simulated",
              attached: false,
            }),
          }),
          scopeSummary: expect.arrayContaining([
            expect.objectContaining({ scopeLabel: "workspace", count: 1 }),
            expect.objectContaining({ scopeLabel: "org", count: 2 }),
            expect.objectContaining({ scopeLabel: "core", count: 1 }),
          ]),
          pilotFlows: expect.arrayContaining([
            expect.objectContaining({
              capabilityId: "draft:workflow:weekly-memory-digest",
              scopeLabel: "workspace",
              currentStage: "draft",
              nextActionMethod: "sanjin.runCapabilitySchemaValidation",
              progressLabel: "1/5",
            }),
          ]),
          focusItems: expect.arrayContaining([
            expect.objectContaining({ title: "Entry Posture" }),
            expect.objectContaining({
              title: "Desktop Bridge Startup",
              status: "simulated bridge startup",
              summary:
                "Desktop Shell is starting with the simulated local bridge path. Source: derived bridge adapter posture.",
            }),
            expect.objectContaining({ title: "Execution Spine" }),
            expect.objectContaining({ title: "Governance Inbox" }),
          ]),
          operatorQueue: expect.arrayContaining([
            expect.objectContaining({
              title: "Review Desktop Bridge Startup",
              actionLabel: "Review Derived Bridge Posture",
              actionMethod: "localBridge.status",
            }),
            expect.objectContaining({
              title: "Confirm Workbench Entry",
              actionMethod: "shell.pilotShell.get",
            }),
            expect.objectContaining({
              title: "Shape Draft Capabilities",
              actionMethod: "sanjin.runCapabilitySchemaValidation",
            }),
          ]),
          boundaryRules: expect.arrayContaining([
            expect.objectContaining({ title: "Simulated Bridge Until Attach" }),
            expect.objectContaining({ title: "Entry Posture First" }),
            expect.objectContaining({ title: "Core Locked" }),
          ]),
        }),
        undefined,
      );

      const overview = createOptions("sanjin.overview");
      sanjinHandlers["sanjin.overview"](overview);
      expect(overview.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          benchmarkRunId: "test-run-001",
          sourceFiles: expect.arrayContaining([
            expect.stringContaining("benchmark_rerun_test.json"),
            expect.stringContaining("observability_summary.json"),
          ]),
          cards: expect.arrayContaining([
            expect.objectContaining({ title: "Benchmark" }),
            expect.objectContaining({ title: "Host Signals" }),
          ]),
        }),
        undefined,
      );

      const skills = createOptions("sanjin.skills");
      sanjinHandlers["sanjin.skills"](skills);
      expect(skills.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          sourceFiles: expect.arrayContaining([
            expect.stringContaining("production_skill_trend_panel_test.json"),
          ]),
          topSkills: expect.arrayContaining([
            expect.objectContaining({
              name: "workflow-to-skill",
              totalRuns: "4",
              governanceLabel: "healthy",
            }),
          ]),
        }),
        undefined,
      );

      const runtime = createOptions("sanjin.runtime");
      sanjinHandlers["sanjin.runtime"](runtime);
      expect(runtime.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          sourceFiles: expect.arrayContaining([
            expect.stringContaining("observability_summary.json"),
            expect.stringContaining("stability_trend_panel_test.json"),
          ]),
          cards: expect.arrayContaining([
            expect.objectContaining({ title: "Permission Gate" }),
            expect.objectContaining({ title: "Runtime Recovery" }),
            expect.objectContaining({ title: "Action Layer" }),
          ]),
          trend7d: expect.objectContaining({
            permission_gate: expect.any(Object),
          }),
        }),
        undefined,
      );

      const governance = createOptions("sanjin.governance");
      sanjinHandlers["sanjin.governance"](governance);
      expect(governance.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          sourceFiles: expect.arrayContaining([
            expect.stringContaining("observability_summary.json"),
            expect.stringContaining("stability_trend_panel_test.json"),
            expect.stringContaining("governance_reviews.jsonl"),
          ]),
          reviews: expect.arrayContaining([
            expect.objectContaining({
              gpName: "gp_dependency_check_v1",
              recommendation: "needs_more_window",
            }),
            expect.objectContaining({
              gpName: "gp_verify_before_act_v1",
              recommendation: "promote_or_keep_active",
            }),
          ]),
        }),
        undefined,
      );

      const capabilities = createOptions("sanjin.capabilities");
      sanjinHandlers["sanjin.capabilities"](capabilities);
      expect(capabilities.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          sourceFiles: expect.arrayContaining([
            expect.stringContaining("memory/capabilities/registry.json"),
          ]),
          cards: expect.arrayContaining([
            expect.objectContaining({ title: "Capability Catalog" }),
            expect.objectContaining({ title: "Admission Stages" }),
          ]),
          entries: expect.arrayContaining([
            expect.objectContaining({
              capabilityId: "skill:workflow-to-skill",
              capabilityType: "skill",
              displayName: "Workflow To Skill",
              admissionStage: "active",
            }),
          ]),
        }),
        undefined,
      );

      const advance = createOptions("sanjin.advancePilotFlow", {
        capabilityId: "draft:workflow:weekly-memory-digest",
      });
      sanjinHandlers["sanjin.advancePilotFlow"](advance);
      expect(advance.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          capabilityId: "draft:workflow:weekly-memory-digest",
          previousStage: "draft",
          triggeredActionMethod: "sanjin.runCapabilitySchemaValidation",
          updatedFlow: expect.objectContaining({
            currentStage: "schema_validated",
            nextActionMethod: "sanjin.runCapabilitySampleRuns",
          }),
        }),
        undefined,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("returns runtime integration posture and health-feed freshness metadata from localBridge.status", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));
    process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER = "desktop";

    initializeDesktopShellRuntimeIntegration({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      runtimeLabel: "Desktop Runtime Bridge",
      providerKey: "desktop-main",
      transport: {
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
          throw new Error("not implemented");
        },
        resolveAction() {
          throw new Error("not implemented");
        },
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });

    const localBridgeStatus = createOptions("localBridge.status");
    sanjinHandlers["localBridge.status"](localBridgeStatus);
    expect(localBridgeStatus.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        startupPosture: expect.objectContaining({
          runtimeLabel: "Desktop Runtime Bridge",
          runtimeSummary:
            "Desktop Runtime Bridge started desktop bridge runtime (attached) using provider desktop-main.",
        }),
        healthFeed: expect.objectContaining({
          staleAfterMs: 300_000,
          nextStaleAt: expect.any(String),
          stalenessStatus: "fresh",
        }),
      }),
      undefined,
    );
    vi.useRealTimers();
  });

  it("ingests macOS lifecycle events through localBridge.nativeProcessEvent and updates desktop integration posture", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));
    process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER = "desktop";

    startDesktopShellStartupModuleStub({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      moduleLabel: "Desktop Shell Startup Module",
      providerKey: "desktop-main",
      transport: {
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
          throw new Error("not implemented");
        },
        resolveAction() {
          throw new Error("not implemented");
        },
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });
    reportDesktopShellStartupModuleHealth({ attached: true, adapterReadiness: "ready" });

    const nativeIngress = createOptions("localBridge.nativeProcessEvent", {
      nativeEventType: "app_started",
      source: "macos_app_lifecycle",
      hostPlatform: "macos",
      occurredAt: "2026-04-17T00:01:02.000Z",
      shellAppLabel: "OpenClaw Desktop",
    });
    sanjinHandlers["localBridge.nativeProcessEvent"](nativeIngress);
    expect(nativeIngress.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        nativeEventType: "app_started",
        processHostState: "foreground",
        processEventSummary: expect.stringContaining("desktop main-process start"),
        nativeProcessEventSummary: expect.stringContaining("from macos_app_lifecycle"),
      }),
      undefined,
    );

    const bridgeStatus = createOptions("localBridge.status");
    sanjinHandlers["localBridge.status"](bridgeStatus);
    expect(bridgeStatus.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        startupPosture: expect.objectContaining({
          processHostState: "foreground",
          processEventType: "start",
          nativeProcessEventType: "app_started",
          desktopHostPlatform: "macos",
          nativeProcessIngressSource: "macos_app_lifecycle",
          nativeProcessEventSummary: expect.stringContaining("macos_app_lifecycle"),
        }),
      }),
      undefined,
    );

    const pilotShell = createOptions("shell.pilotShell.get");
    sanjinHandlers["shell.pilotShell.get"](pilotShell);
    expect(pilotShell.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        desktopIntegration: expect.objectContaining({
          processHostState: "foreground",
          processEventType: "start",
          nativeProcessEventType: "app_started",
          desktopHostPlatform: "macos",
          nativeProcessIngressSource: "macos_app_lifecycle",
          nativeProcessEventSummary: expect.stringContaining("macos_app_lifecycle"),
        }),
      }),
      undefined,
    );
    vi.useRealTimers();
  });

  it("promotes simulated gateway bridge state into desktop startup wiring when macOS lifecycle ingress arrives", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));
    delete process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER;

    const nativeIngress = createOptions("localBridge.nativeProcessEvent", {
      nativeEventType: "app_started",
      source: "macos_app_lifecycle",
      hostPlatform: "macos",
      occurredAt: "2026-04-17T00:01:02.000Z",
      shellAppLabel: "OpenClaw Desktop",
    });
    sanjinHandlers["localBridge.nativeProcessEvent"](nativeIngress);
    expect(nativeIngress.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        nativeEventType: "app_started",
        processHostState: "foreground",
        nativeProcessEventSummary: expect.stringContaining("macos_app_lifecycle"),
      }),
      undefined,
    );

    const bridgeStatus = createOptions("localBridge.status");
    sanjinHandlers["localBridge.status"](bridgeStatus);
    expect(bridgeStatus.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        adapter: expect.objectContaining({
          mode: "desktop",
          readiness: "ready",
          label: "OpenClaw Desktop Desktop Bridge",
        }),
        startupPosture: expect.objectContaining({
          mode: "desktop",
          attached: true,
          startupSource: "desktop_startup_wiring",
          providerKey: "desktop-main",
          providerStatus: "registry_provider",
          desktopHostPlatform: "macos",
          nativeProcessIngressSource: "macos_app_lifecycle",
          shellAppLabel: "OpenClaw Desktop",
          runtimeLabel: "Desktop Runtime Bridge",
        }),
      }),
      undefined,
    );

    const pilotShell = createOptions("shell.pilotShell.get");
    sanjinHandlers["shell.pilotShell.get"](pilotShell);
    expect(pilotShell.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        desktopIntegration: expect.objectContaining({
          adapterMode: "desktop",
          startupSource: "desktop_startup_wiring",
          providerKey: "desktop-main",
          desktopHostPlatform: "macos",
          nativeProcessIngressSource: "macos_app_lifecycle",
        }),
      }),
      undefined,
    );
    vi.useRealTimers();
  });

  it("preserves stale freshness recovery semantics when localBridge.nativeProcessEvent foregrounds the desktop app", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));
    process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER = "desktop";

    startDesktopShellStartupModuleStub({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      moduleLabel: "Desktop Shell Startup Module",
      providerKey: "desktop-main",
      transport: {
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
          throw new Error("not implemented");
        },
        resolveAction() {
          throw new Error("not implemented");
        },
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });
    reportDesktopShellStartupModuleHealth({ attached: true, adapterReadiness: "ready" });
    vi.setSystemTime(new Date("2026-04-17T00:06:00.000Z"));

    const nativeIngress = createOptions("localBridge.nativeProcessEvent", {
      nativeEventType: "app_foregrounded",
      source: "macos_app_lifecycle",
      hostPlatform: "macos",
      occurredAt: "2026-04-17T00:06:00.000Z",
      shellAppLabel: "OpenClaw Desktop",
    });
    sanjinHandlers["localBridge.nativeProcessEvent"](nativeIngress);
    expect(nativeIngress.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        nativeEventType: "app_foregrounded",
        processHostState: "starting",
        nativeProcessEventSummary: expect.stringContaining("macos_app_lifecycle"),
      }),
      undefined,
    );

    const bridgeStatus = createOptions("localBridge.status");
    sanjinHandlers["localBridge.status"](bridgeStatus);
    expect(bridgeStatus.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        startupPosture: expect.objectContaining({
          processHostState: "starting",
          processEventType: "foreground",
          nativeProcessEventType: "app_foregrounded",
          desktopHostPlatform: "macos",
          nativeProcessIngressSource: "macos_app_lifecycle",
          processHostSummary: expect.stringContaining("recover stale desktop cadence freshness"),
        }),
        healthFeed: expect.objectContaining({
          stalenessStatus: "fresh",
        }),
      }),
      undefined,
    );
    vi.useRealTimers();
  });

  it("accepts windows host lifecycle ingress without forking process-host semantics", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));
    process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER = "desktop";

    startDesktopShellStartupModuleStub({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      moduleLabel: "Desktop Shell Startup Module",
      providerKey: "desktop-main",
      transport: {
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
          throw new Error("not implemented");
        },
        resolveAction() {
          throw new Error("not implemented");
        },
      },
      readiness: "ready",
      label: "Runtime Integration Desktop Bridge",
    });
    reportDesktopShellStartupModuleHealth({ attached: true, adapterReadiness: "ready" });

    const nativeIngress = createOptions("localBridge.nativeProcessEvent", {
      nativeEventType: "app_backgrounded",
      source: "windows_app_lifecycle",
      hostPlatform: "windows",
      occurredAt: "2026-04-17T00:01:02.000Z",
      shellAppLabel: "OpenClaw Desktop",
    });
    sanjinHandlers["localBridge.nativeProcessEvent"](nativeIngress);
    expect(nativeIngress.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        nativeEventType: "app_backgrounded",
        processHostState: "background",
        nativeProcessEventSummary: expect.stringContaining("windows_app_lifecycle"),
      }),
      undefined,
    );

    const bridgeStatus = createOptions("localBridge.status");
    sanjinHandlers["localBridge.status"](bridgeStatus);
    expect(bridgeStatus.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        startupPosture: expect.objectContaining({
          processHostState: "background",
          nativeProcessEventType: "app_backgrounded",
          desktopHostPlatform: "windows",
          nativeProcessIngressSource: "windows_app_lifecycle",
        }),
      }),
      undefined,
    );
    vi.useRealTimers();
  });

  it("returns tenant bootstrap and workspace selection payloads for the shell app contract", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;
    process.env.OPENCLAW_SANJIN_WORKSPACES = "workspace,growth-workspace";

    try {
      const bootstrap = createOptions("tenant.bootstrap");
      sanjinHandlers["tenant.bootstrap"](bootstrap);
      expect(bootstrap.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          org: expect.objectContaining({ orgId: "local-org" }),
          user: expect.objectContaining({ userId: "local-operator" }),
          workspaces: [
            expect.objectContaining({
              workspaceId: "workspace",
              role: "govern",
            }),
            expect.objectContaining({
              workspaceId: "growth-workspace",
              role: "configure",
            }),
          ],
          tenantContext: expect.objectContaining({
            workspaceId: "workspace",
          }),
          onboardingState: expect.objectContaining({
            phase: "workbenchLanding",
            currentWorkspaceId: "workspace",
            target: expect.objectContaining({
              panel: "workbench",
            }),
          }),
        }),
        undefined,
      );

      const listWorkspaces = createOptions("tenant.listWorkspaces");
      sanjinHandlers["tenant.listWorkspaces"](listWorkspaces);
      expect(listWorkspaces.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          workspaces: expect.arrayContaining([
            expect.objectContaining({
              workspaceId: "workspace",
            }),
            expect.objectContaining({
              workspaceId: "growth-workspace",
            }),
          ]),
        }),
        undefined,
      );

      const selectWorkspace = createOptions("tenant.selectWorkspace", {
        workspaceId: "growth-workspace",
      });
      sanjinHandlers["tenant.selectWorkspace"](selectWorkspace);
      expect(selectWorkspace.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          workspace: expect.objectContaining({
            workspaceId: "growth-workspace",
          }),
          tenantContext: expect.objectContaining({
            workspaceId: "growth-workspace",
          }),
          brainAccess: expect.objectContaining({
            brainId: "sanjin-shared-brain",
            serverSideLocked: true,
          }),
          memoryBoundary: expect.objectContaining({
            defaultWriteTarget: "tenant_local_memory",
            directBrainWriteAllowed: false,
          }),
          governancePermissionModel: expect.objectContaining({
            roles: expect.arrayContaining([
              expect.objectContaining({ roleId: "brain_owner" }),
              expect.objectContaining({ roleId: "tenant_admin" }),
              expect.objectContaining({ roleId: "tenant_operator" }),
            ]),
          }),
          onboardingState: expect.objectContaining({
            phase: "workbenchLanding",
            currentWorkspaceId: "growth-workspace",
          }),
        }),
        undefined,
      );

      const pilotShell = createOptions("shell.pilotShell.get");
      sanjinHandlers["shell.pilotShell.get"](pilotShell);
      expect(pilotShell.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          tenantContext: expect.objectContaining({
            workspaceId: "growth-workspace",
          }),
          brainAccess: expect.objectContaining({
            brainId: "sanjin-shared-brain",
          }),
          memoryBoundary: expect.objectContaining({
            promotionPathSummary: "abstract -> review -> gate -> rollout",
          }),
          governancePermissionModel: expect.objectContaining({
            promotionPathSummary: "tenant review -> promotion request -> brain gate -> rollout",
          }),
          onboardingState: expect.objectContaining({
            phase: "workbenchLanding",
            currentWorkspaceId: "growth-workspace",
          }),
        }),
        undefined,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("returns auth.me payload for the shell app contract", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      const me = createOptions("auth.me");
      me.client = {
        connId: "conn-shell-1",
        connect: {
          role: "operator",
          scopes: ["operator.read", "operator.write"],
          client: { id: "control-ui" },
        },
      } as GatewayRequestHandlerOptions["client"];
      sanjinHandlers["auth.me"](me);
      expect(me.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          auth: expect.objectContaining({
            connId: "conn-shell-1",
            role: "operator",
            scopes: ["operator.read", "operator.write"],
            clientId: "control-ui",
          }),
          user: expect.objectContaining({
            userId: "local-operator",
          }),
          tenantContext: expect.objectContaining({
            workspaceId: "workspace",
          }),
          brainAccess: expect.objectContaining({
            serverSideLocked: true,
            readSurfaces: expect.arrayContaining([
              expect.objectContaining({ surfaceId: "session_planning" }),
              expect.objectContaining({ surfaceId: "governance_read" }),
            ]),
            snapshot: expect.objectContaining({
              planning: expect.objectContaining({
                controlSummary: expect.any(String),
              }),
              governance: expect.objectContaining({
                status: expect.any(String),
              }),
            }),
          }),
          memoryBoundary: expect.objectContaining({
            rawTenantMemoryReadableByBrain: false,
            layers: expect.arrayContaining([
              expect.objectContaining({ layerId: "tenant_local_memory" }),
              expect.objectContaining({ layerId: "abstracted_structural_evidence" }),
            ]),
          }),
          governancePermissionModel: expect.objectContaining({
            roles: expect.arrayContaining([
              expect.objectContaining({ roleId: "brain_owner" }),
              expect.objectContaining({ roleId: "tenant_admin" }),
              expect.objectContaining({ roleId: "tenant_operator" }),
            ]),
          }),
          onboardingState: expect.objectContaining({
            phase: "workbenchLanding",
            currentWorkspaceId: "workspace",
            operatorLabel: "local-operator",
          }),
          shellAccess: expect.objectContaining({
            required: false,
            granted: true,
            mode: "gateway",
          }),
        }),
        undefined,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("grants invite-only shell access through auth.login", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;
    process.env.OPENCLAW_SANJIN_INVITE_CODE = "SHELL-INVITE";

    try {
      const login = createOptions("auth.login", {
        inviteCode: "SHELL-INVITE",
        operatorLabel: "Night Shift",
      });
      login.client = {
        connId: "conn-shell-2",
        connect: {
          role: "operator",
          scopes: ["operator.read", "operator.write"],
          client: { id: "control-ui" },
        },
      } as GatewayRequestHandlerOptions["client"];
      sanjinHandlers["auth.login"](login);
      expect(login.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          onboardingState: expect.objectContaining({
            phase: "workbenchLanding",
            currentWorkspaceId: "workspace",
            operatorLabel: "Night Shift",
          }),
          shellAccess: expect.objectContaining({
            required: true,
            granted: true,
            mode: "invite_code",
            invitationLabel: "Invite-only shell access",
            operatorLabel: "Night Shift",
          }),
        }),
        undefined,
      );
    } finally {
      delete process.env.OPENCLAW_SANJIN_INVITE_CODE;
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("returns an access-gate onboarding posture after auth.logout", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;
    process.env.OPENCLAW_SANJIN_INVITE_CODE = "SHELL-INVITE";

    try {
      const client = {
        connId: "conn-shell-logout",
        connect: {
          role: "operator",
          scopes: ["operator.read", "operator.write"],
          client: { id: "control-ui" },
        },
      } as GatewayRequestHandlerOptions["client"];
      const login = createOptions("auth.login", {
        inviteCode: "SHELL-INVITE",
        operatorLabel: "Night Shift",
      });
      login.client = client;
      sanjinHandlers["auth.login"](login);

      const logout = createOptions("auth.logout");
      logout.client = client;
      sanjinHandlers["auth.logout"](logout);
      expect(logout.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          onboardingState: expect.objectContaining({
            phase: "accessGate",
            currentWorkspaceId: "workspace",
          }),
          shellAccess: expect.objectContaining({
            required: true,
            granted: false,
            mode: "invite_code",
          }),
        }),
        undefined,
      );
    } finally {
      delete process.env.OPENCLAW_SANJIN_INVITE_CODE;
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("keeps onboarding posture aligned across shell entry payloads", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;
    process.env.OPENCLAW_SANJIN_INVITE_CODE = "SHELL-INVITE";
    process.env.OPENCLAW_SANJIN_WORKSPACES = "workspace,growth-workspace";

    try {
      const client = {
        connId: "conn-shell-onboarding",
        connect: {
          role: "operator",
          scopes: ["operator.read", "operator.write"],
          client: { id: "control-ui" },
        },
      } as GatewayRequestHandlerOptions["client"];

      const selectWorkspace = createOptions("tenant.selectWorkspace", {
        workspaceId: "growth-workspace",
      });
      selectWorkspace.client = client;
      sanjinHandlers["tenant.selectWorkspace"](selectWorkspace);

      const bootstrap = createOptions("tenant.bootstrap");
      bootstrap.client = client;
      sanjinHandlers["tenant.bootstrap"](bootstrap);

      const me = createOptions("auth.me");
      me.client = client;
      sanjinHandlers["auth.me"](me);

      const pilotShell = createOptions("shell.pilotShell.get");
      pilotShell.client = client;
      sanjinHandlers["shell.pilotShell.get"](pilotShell);

      for (const call of [selectWorkspace, bootstrap, me, pilotShell]) {
        expect(call.respond).toHaveBeenCalledWith(
          true,
          expect.objectContaining({
            onboardingState: expect.objectContaining({
              phase: "accessGate",
              title: "Access Gate Required",
              currentWorkspaceId: "growth-workspace",
            }),
          }),
          undefined,
        );
      }
    } finally {
      delete process.env.OPENCLAW_SANJIN_INVITE_CODE;
      delete process.env.OPENCLAW_SANJIN_WORKSPACES;
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("returns shell pilot shell and capability contract payloads", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      const pilotShell = createOptions("shell.pilotShell.get");
      sanjinHandlers["shell.pilotShell.get"](pilotShell);
      expect(pilotShell.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          tenantContext: expect.objectContaining({
            workspaceId: "workspace",
          }),
          brainAccess: expect.objectContaining({
            displayName: "Sanjin Shared Brain",
            snapshot: expect.objectContaining({
              explain: expect.objectContaining({
                summary: expect.any(String),
              }),
              capabilityRecommendation: expect.objectContaining({
                candidateCount: expect.any(Number),
                draftCount: expect.any(Number),
              }),
            }),
          }),
          memoryBoundary: expect.objectContaining({
            summary: expect.stringContaining("Tenant memory"),
          }),
          governancePermissionModel: expect.objectContaining({
            governanceSurfaces: expect.arrayContaining([
              expect.objectContaining({ surfaceId: "brain_governance" }),
              expect.objectContaining({ surfaceId: "tenant_review" }),
            ]),
          }),
          onboardingState: expect.objectContaining({
            phase: "workbenchLanding",
            currentWorkspaceId: "workspace",
          }),
          pilotFlows: expect.arrayContaining([
            expect.objectContaining({
              capabilityId: "draft:workflow:weekly-memory-digest",
            }),
          ]),
        }),
        undefined,
      );

      const capabilityList = createOptions("capability.list");
      sanjinHandlers["capability.list"](capabilityList);
      expect(capabilityList.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          entries: expect.arrayContaining([
            expect.objectContaining({
              capabilityId: "draft:workflow:weekly-memory-digest",
              scopeLabel: "workspace",
            }),
            expect.objectContaining({
              capabilityId: "skill:workflow-to-skill",
              scopeLabel: "core",
            }),
          ]),
        }),
        undefined,
      );

      const capabilityGet = createOptions("capability.get", {
        capabilityId: "draft:workflow:weekly-memory-digest",
      });
      sanjinHandlers["capability.get"](capabilityGet);
      expect(capabilityGet.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          entry: expect.objectContaining({
            capabilityId: "draft:workflow:weekly-memory-digest",
            scopeLabel: "workspace",
            governanceMode: "candidate_only",
          }),
        }),
        undefined,
      );

      const brainContract = createOptions("shell.brainContract.get");
      sanjinHandlers["shell.brainContract.get"](brainContract);
      expect(brainContract.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          tenantContext: expect.objectContaining({
            workspaceId: "workspace",
          }),
          brainAccess: expect.objectContaining({
            brainId: "sanjin-shared-brain",
            serverSideLocked: true,
            snapshot: expect.objectContaining({
              planning: expect.objectContaining({
                source: expect.stringMatching(/planner_control|runtime_inference/),
              }),
              latestReviewDecision: expect.objectContaining({
                recommendation: expect.any(String),
              }),
            }),
          }),
        }),
        undefined,
      );

      const memoryBoundary = createOptions("tenant.memoryBoundary.get");
      sanjinHandlers["tenant.memoryBoundary.get"](memoryBoundary);
      expect(memoryBoundary.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          tenantContext: expect.objectContaining({
            workspaceId: "workspace",
          }),
          memoryBoundary: expect.objectContaining({
            defaultWriteTarget: "tenant_local_memory",
            directBrainWriteAllowed: false,
          }),
        }),
        undefined,
      );

      const permissionModel = createOptions("governance.permissionModel.get");
      sanjinHandlers["governance.permissionModel.get"](permissionModel);
      expect(permissionModel.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          tenantContext: expect.objectContaining({
            workspaceId: "workspace",
          }),
          governancePermissionModel: expect.objectContaining({
            roles: expect.arrayContaining([
              expect.objectContaining({ roleId: "brain_owner" }),
              expect.objectContaining({ roleId: "tenant_admin" }),
              expect.objectContaining({ roleId: "tenant_operator" }),
            ]),
          }),
        }),
        undefined,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("uses explicit tenant env overrides for the pilot shell context", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;
    process.env.OPENCLAW_SANJIN_ORG_ID = "acme-org";
    process.env.OPENCLAW_SANJIN_WORKSPACE_ID = "growth-workspace";
    process.env.OPENCLAW_SANJIN_USER_ID = "operator-7";

    try {
      const pilotShell = createOptions("sanjin.pilotShell");
      sanjinHandlers["sanjin.pilotShell"](pilotShell);
      expect(pilotShell.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          tenantContext: expect.objectContaining({
            orgId: "acme-org",
            workspaceId: "growth-workspace",
            userId: "operator-7",
          }),
          onboardingState: expect.objectContaining({
            phase: "workbenchLanding",
            currentWorkspaceId: "growth-workspace",
          }),
        }),
        undefined,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("degrades gracefully when the Sanjin reports directory is present but sparse", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-sanjin-empty-"));
    const workspaceDir = path.join(rootDir, "workspace");
    await fs.mkdir(path.join(workspaceDir, "sanjin"), { recursive: true });
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      const overview = createOptions("sanjin.overview");
      sanjinHandlers["sanjin.overview"](overview);
      expect(overview.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          benchmarkRunId: null,
          cards: expect.any(Array),
        }),
        undefined,
      );

      const governance = createOptions("sanjin.governance");
      sanjinHandlers["sanjin.governance"](governance);
      expect(governance.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          reviews: [],
        }),
        undefined,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("creates a capability draft with normalized scope and exposes it in the pilot shell", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      const createDraft = createOptions("sanjin.createCapabilityDraft", {
        capabilityType: "workflow",
        displayName: "Local Inbox Sorter",
        description: "Sort personal inbox items into a local digest.",
        scope: "local",
        preferredSubagent: "watch_operator",
      });
      await sanjinHandlers["sanjin.createCapabilityDraft"](createDraft);
      expect(createDraft.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          message: "Created Sanjin capability draft.",
          result: expect.objectContaining({
            capability_id: "draft:workflow:local-inbox-sorter",
            scope_label: "personal",
          }),
        }),
        undefined,
      );

      const registry = JSON.parse(
        await fs.readFile(path.join(workspaceDir, "sanjin", "memory", "capabilities", "registry.json"), "utf8"),
      );
      const draft = registry.entries.find(
        (entry: { capability_id: string }) =>
          entry.capability_id === "draft:workflow:local-inbox-sorter",
      );
      expect(draft.metadata.scope).toBe("personal");

      const pilotShell = createOptions("sanjin.pilotShell");
      sanjinHandlers["sanjin.pilotShell"](pilotShell);
      expect(pilotShell.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          scopeSummary: expect.arrayContaining([
            expect.objectContaining({ scopeLabel: "personal", count: 1 }),
          ]),
          pilotFlows: expect.arrayContaining([
            expect.objectContaining({
              capabilityId: "draft:workflow:local-inbox-sorter",
              scopeLabel: "personal",
            }),
          ]),
        }),
        undefined,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("supports shell-app capability create and advance wrappers", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      const createDraft = createOptions("capability.createDraft", {
        capabilityType: "workflow",
        displayName: "Shared Intake Router",
        description: "Route tenant inbox items into a shared intake lane.",
        scope: "org",
        preferredSubagent: "watch_operator",
      });
      await sanjinHandlers["capability.createDraft"](createDraft);
      expect(createDraft.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          result: expect.objectContaining({
            capability_id: "draft:workflow:shared-intake-router",
            scope_label: "org",
          }),
        }),
        undefined,
      );

      const advance = createOptions("capability.advancePilotFlow", {
        capabilityId: "draft:workflow:weekly-memory-digest",
      });
      await sanjinHandlers["capability.advancePilotFlow"](advance);
      expect(advance.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          triggeredActionMethod: "sanjin.runCapabilitySchemaValidation",
          updatedFlow: expect.objectContaining({
            capabilityId: "draft:workflow:weekly-memory-digest",
            currentStage: "schema_validated",
          }),
        }),
        undefined,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("supports shell-app session wrappers via the shared session runtime", async () => {
    vi.spyOn(sessionsHandlers, "sessions.create").mockImplementation(async ({ respond }) => {
      respond(
        true,
        {
          ok: true,
          key: "agent:main:dashboard:sess-1",
          sessionId: "sess-1",
          entry: {
            label: "Pilot Session",
            status: "running",
          },
        },
        undefined,
      );
    });
    vi.spyOn(sessionsHandlers, "sessions.list").mockImplementation(({ respond }) => {
      respond(
        true,
        {
          sessions: [
            {
              key: "agent:main:dashboard:sess-1",
              sessionId: "sess-1",
              displayName: "Pilot Session",
              status: "running",
              updatedAt: 1713000000000,
              model: "gpt-5.4",
              modelProvider: "openai",
            },
          ],
        },
        undefined,
      );
    });
    vi.spyOn(sessionsHandlers, "sessions.get").mockImplementation(({ respond }) => {
      respond(
        true,
        {
          messages: [
            { role: "user", content: [{ type: "input_text", text: "hello" }] },
          ],
        },
        undefined,
      );
    });
    vi.spyOn(sessionsHandlers, "sessions.resolve").mockImplementation(({ respond }) => {
      respond(
        true,
        {
          ok: true,
          key: "agent:main:dashboard:sess-1",
        },
        undefined,
      );
    });
    vi.spyOn(sessionsHandlers, "sessions.send").mockImplementation(({ respond }) => {
      respond(
        true,
        {
          runId: "run-1",
          messageSeq: 3,
          status: "started",
        },
        undefined,
      );
    });

    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      const createSession = createOptions("shell.session.create", {
        workspaceId: "workspace",
        title: "Pilot Session",
      });
      await sanjinHandlers["shell.session.create"](createSession);
      expect(createSession.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          key: "agent:main:dashboard:sess-1",
          sessionId: "sess-1",
          workspaceId: "workspace",
          title: "Pilot Session",
        }),
        undefined,
      );

      const listSessions = createOptions("shell.session.list");
      await sanjinHandlers["shell.session.list"](listSessions);
      expect(listSessions.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          count: 1,
          sessions: [
            expect.objectContaining({
              key: "agent:main:dashboard:sess-1",
              sessionId: "sess-1",
              title: "Pilot Session",
            }),
          ],
        }),
        undefined,
      );

      const getSession = createOptions("shell.session.get", {
        sessionId: "sess-1",
      });
      await sanjinHandlers["shell.session.get"](getSession);
      expect(getSession.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          key: "agent:main:dashboard:sess-1",
          sessionId: "sess-1",
          localActionCount: 0,
          plannerOutcome: expect.objectContaining({
            stageAction: "hold",
            source: "runtime_inference",
            nextActionLabel: "Open Live Run",
          }),
          timeline: [
            expect.objectContaining({
              entryType: "message",
            }),
          ],
          messages: [
            expect.objectContaining({
              role: "user",
            }),
          ],
        }),
        undefined,
      );

      const sendSession = createOptions("shell.session.send", {
        sessionId: "sess-1",
        message: "continue",
      });
      await sanjinHandlers["shell.session.send"](sendSession);
      expect(sendSession.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          key: "agent:main:dashboard:sess-1",
          runId: "run-1",
          messageSeq: 3,
          status: "started",
        }),
        undefined,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("surfaces pending local bridge actions through shell.session.stream and localBridge.status", async () => {
    vi.spyOn(sessionsHandlers, "sessions.list").mockImplementation(({ respond }) => {
      respond(
        true,
        {
          sessions: [
            {
              key: "agent:main:dashboard:sess-1",
              sessionId: "sess-1",
              displayName: "Pilot Session",
              status: "running",
              updatedAt: 1713000000000,
            },
          ],
        },
        undefined,
      );
    });
    vi.spyOn(sessionsHandlers, "sessions.get").mockImplementation(({ respond }) => {
      respond(
        true,
        {
          messages: [
            { role: "assistant", content: [{ type: "output_text", text: "waiting for local action" }] },
          ],
        },
        undefined,
      );
    });
    vi.spyOn(sessionsHandlers, "sessions.resolve").mockImplementation(({ respond }) => {
      respond(
        true,
        {
          ok: true,
          key: "agent:main:dashboard:sess-1",
        },
        undefined,
      );
    });

    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      const requestAction = createOptions("localBridge.requestAction", {
        actionId: "action-1",
        sessionId: "sess-1",
        actionType: "pick_file",
        title: "Choose source file",
        description: "Pick the file to import into the session.",
      });
      await sanjinHandlers["localBridge.requestAction"](requestAction);
      expect(requestAction.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          transport: expect.objectContaining({
            adapterMode: "simulated",
            adapterReadiness: "ready",
            contractVersion: "v1",
          }),
          action: expect.objectContaining({
            actionId: "action-1",
            sessionKey: "agent:main:dashboard:sess-1",
            lifecycle: "requested",
            status: "pending",
          }),
        }),
        undefined,
      );

      const stream = createOptions("shell.session.stream", {
        sessionId: "sess-1",
      });
      await sanjinHandlers["shell.session.stream"](stream);
      expect(stream.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          key: "agent:main:dashboard:sess-1",
          status: "running",
          plannerOutcome: expect.objectContaining({
            stageAction: "hold",
            nextActionLabel: "Open Pending Action",
          }),
          pendingLocalActions: [
            expect.objectContaining({
              actionId: "action-1",
              lifecycle: "pending",
              status: "pending",
            }),
          ],
          nextPollAfterMs: 1500,
        }),
        undefined,
      );

      const bridgeStatus = createOptions("localBridge.status");
      sanjinHandlers["localBridge.status"](bridgeStatus);
      expect(bridgeStatus.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          status: "ready",
          adapter: expect.objectContaining({
            mode: "simulated",
            readiness: "ready",
            label: "Simulated Local Bridge",
          }),
          contract: expect.objectContaining({
            version: "v1",
            requestFields: expect.arrayContaining(["actionId", "sessionKey", "requestedAt", "lifecycle"]),
            resultFields: expect.arrayContaining(["actionId", "approved", "resolvedAt", "lifecycle"]),
            reservedLifecycles: ["stale", "expired"],
          }),
          startupPosture: expect.objectContaining({
            mode: "simulated",
            attached: false,
            startupModeLabel: "simulated bridge startup",
          }),
          pendingCount: 1,
          completedCount: 0,
        }),
        undefined,
      );

      const getSession = createOptions("shell.session.get", {
        sessionId: "sess-1",
      });
      await sanjinHandlers["shell.session.get"](getSession);
      expect(getSession.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          key: "agent:main:dashboard:sess-1",
          localActionCount: 1,
          plannerOutcome: expect.objectContaining({
            stageAction: "hold",
            nextActionLabel: "Open Pending Action",
          }),
          localActions: [
            expect.objectContaining({
              actionId: "action-1",
              lifecycle: "pending",
              status: "pending",
            }),
          ],
          timeline: expect.arrayContaining([
            expect.objectContaining({
              entryType: "message",
            }),
            expect.objectContaining({
              entryType: "local_action",
              status: "pending",
            }),
          ]),
        }),
        undefined,
      );

      const submitResult = createOptions("localBridge.submitActionResult", {
        actionId: "action-1",
        approved: true,
        payload: {
          path: "/tmp/source.md",
        },
      });
      sanjinHandlers["localBridge.submitActionResult"](submitResult);
      expect(submitResult.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          transport: expect.objectContaining({
            adapterMode: "simulated",
            adapterReadiness: "ready",
            contractVersion: "v1",
          }),
          action: expect.objectContaining({
            actionId: "action-1",
            lifecycle: "completed",
            status: "completed",
            result: expect.objectContaining({
              approved: true,
            }),
          }),
        }),
        undefined,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("broadcasts dedicated desktop local-action push payloads and updates transport summaries when desktop transport is attached", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;
    process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER = "desktop";
    const actions = new Map<string, ShellPendingLocalAction>();
    startDesktopShellStartupModuleStub({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      moduleLabel: "Desktop Shell Startup Module",
      providerKey: "desktop-main",
      transport: {
        listActions() {
          return Array.from(actions.values()).sort((left, right) =>
            right.requestedAt.localeCompare(left.requestedAt),
          );
        },
        listActionsForSession(sessionKey) {
          return Array.from(actions.values()).filter((action) => action.sessionKey === sessionKey);
        },
        listPendingActionsForSession(sessionKey) {
          return Array.from(actions.values()).filter(
            (action) => action.sessionKey === sessionKey && action.lifecycle === "pending",
          );
        },
        requestAction(input) {
          const action: ShellPendingLocalAction = {
            actionId: input.actionId,
            actionType: input.actionType as ShellPendingLocalAction["actionType"],
            title: input.title,
            description: input.description,
            constraints: input.constraints,
            sessionKey: input.sessionKey,
            requestedAt: "2026-04-17T00:00:00.000Z",
            resolvedAt: null,
            expiresAt: null,
            lifecycle: "pending",
            status: "pending",
          };
          actions.set(input.actionId, action);
          return action;
        },
        resolveAction(actionId, result) {
          const existing = actions.get(actionId);
          if (!existing) {
            throw new Error(`missing desktop harness action: ${actionId}`);
          }
          const next: ShellPendingLocalAction = {
            ...existing,
            resolvedAt: "2026-04-17T00:01:00.000Z",
            lifecycle: result.approved ? "completed" : "rejected",
            status: result.approved ? "completed" : "rejected",
            result,
          };
          actions.set(actionId, next);
          return next;
        },
      },
      readiness: "ready",
      label: "Attached Desktop Bridge",
      summary: "Desktop-native bridge transport is attached and ready to serve the shared shell local bridge contract.",
      supports: ["request", "resolve", "focus_policy", "lifecycle_tracking"],
    });

    try {
      updateLocalBridgeStartupPosture({
        desktopHostPlatform: "macos",
        nativeProcessIngressSource: "macos_app_lifecycle",
      });

      const requestAction = createOptions("localBridge.requestAction", {
        actionId: "desktop-action-1",
        actionType: "pick_file",
        title: "Choose desktop file",
        description: "Pick a local desktop file.",
      });
      await sanjinHandlers["localBridge.requestAction"](requestAction);
      expect(requestAction.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          transport: expect.objectContaining({
            adapterMode: "desktop",
            adapterReadiness: "ready",
          }),
          action: expect.objectContaining({
            actionId: "desktop-action-1",
            lifecycle: "requested",
            status: "pending",
          }),
        }),
        undefined,
      );
      expect(requestAction.context.broadcast).toHaveBeenCalledWith(
        "localBridge.action.requested",
        expect.objectContaining({
          action: expect.objectContaining({
            actionId: "desktop-action-1",
            lifecycle: "requested",
            status: "pending",
          }),
          nativeLocalActionTransportSource: "desktop_local_action_push",
          pendingNativeActionCount: 1,
          nativeLocalActionDeliverySummary: expect.stringContaining("queued native local action"),
        }),
        expect.objectContaining({
          dropIfSlow: true,
        }),
      );

      const statusAfterRequest = createOptions("localBridge.status");
      sanjinHandlers["localBridge.status"](statusAfterRequest);
      expect(statusAfterRequest.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          pendingCount: 1,
          startupPosture: expect.objectContaining({
            nativeLocalActionTransportSource: "desktop_local_action_push",
            pendingNativeActionCount: 1,
            nativeLocalActionDeliverySummary: expect.stringContaining("queued native local action"),
          }),
        }),
        undefined,
      );

      const submitResult = createOptions("localBridge.submitActionResult", {
        actionId: "desktop-action-1",
        approved: true,
        payload: {
          path: "/tmp/desktop.txt",
        },
      });
      sanjinHandlers["localBridge.submitActionResult"](submitResult);
      expect(submitResult.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          action: expect.objectContaining({
            actionId: "desktop-action-1",
            lifecycle: "completed",
            status: "completed",
          }),
        }),
        undefined,
      );

      const statusAfterResolve = createOptions("localBridge.status");
      sanjinHandlers["localBridge.status"](statusAfterResolve);
      expect(statusAfterResolve.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          pendingCount: 0,
          startupPosture: expect.objectContaining({
            nativeLocalActionTransportSource: "desktop_local_action_result_submit",
            pendingNativeActionCount: 0,
            nativeLocalActionResultSummary: expect.stringContaining("executed native local action"),
            nativeLocalActionExecutionSource: "macos_local_action_executor",
            lastNativeLocalActionExecutionAt: expect.any(String),
            nativeLocalActionExecutionSummary: expect.stringContaining("macos_local_action_executor on macos"),
          }),
        }),
        undefined,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("keeps desktop local-action push payloads canonical when windows host metadata is active", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;
    process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER = "desktop";
    const actions = new Map<string, ShellPendingLocalAction>();
    startDesktopShellStartupModuleStub({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      moduleLabel: "Desktop Shell Startup Module",
      providerKey: "desktop-main",
      transport: {
        listActions() {
          return Array.from(actions.values()).sort((left, right) =>
            right.requestedAt.localeCompare(left.requestedAt),
          );
        },
        listActionsForSession(sessionKey) {
          return Array.from(actions.values()).filter((action) => action.sessionKey === sessionKey);
        },
        listPendingActionsForSession(sessionKey) {
          return Array.from(actions.values()).filter(
            (action) => action.sessionKey === sessionKey && action.lifecycle === "pending",
          );
        },
        requestAction(input) {
          const action: ShellPendingLocalAction = {
            actionId: input.actionId,
            actionType: input.actionType as ShellPendingLocalAction["actionType"],
            title: input.title,
            description: input.description,
            constraints: input.constraints,
            sessionKey: input.sessionKey,
            requestedAt: "2026-04-18T00:00:00.000Z",
            resolvedAt: null,
            expiresAt: null,
            lifecycle: "pending",
            status: "pending",
          };
          actions.set(input.actionId, action);
          return action;
        },
        resolveAction(actionId, result) {
          const existing = actions.get(actionId);
          if (!existing) {
            throw new Error(`missing desktop harness action: ${actionId}`);
          }
          const next: ShellPendingLocalAction = {
            ...existing,
            resolvedAt: "2026-04-18T00:01:00.000Z",
            lifecycle: result.approved ? "completed" : "rejected",
            status: result.approved ? "completed" : "rejected",
            result,
          };
          actions.set(actionId, next);
          return next;
        },
      },
      readiness: "ready",
      label: "Attached Desktop Bridge",
      summary: "Desktop-native bridge transport is attached and ready to serve the shared shell local bridge contract.",
      supports: ["request", "resolve", "focus_policy", "lifecycle_tracking"],
    });

    try {
      updateLocalBridgeStartupPosture({
        desktopHostPlatform: "windows",
        nativeProcessIngressSource: "windows_app_lifecycle",
      });

      const requestAction = createOptions("localBridge.requestAction", {
        actionId: "desktop-action-windows-1",
        actionType: "confirm_execution",
        title: "Confirm windows desktop step",
        description: "Approve the windows desktop action.",
      });
      await sanjinHandlers["localBridge.requestAction"](requestAction);

      expect(requestAction.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          transport: expect.objectContaining({
            adapterMode: "desktop",
            adapterReadiness: "ready",
          }),
          action: expect.objectContaining({
            actionId: "desktop-action-windows-1",
            lifecycle: "requested",
            status: "pending",
          }),
        }),
        undefined,
      );
      expect(requestAction.context.broadcast).toHaveBeenCalledWith(
        "localBridge.action.requested",
        expect.objectContaining({
          action: expect.objectContaining({
            actionId: "desktop-action-windows-1",
            lifecycle: "requested",
            status: "pending",
          }),
          desktopHostPlatform: "windows",
          nativeLocalActionTransportSource: "desktop_local_action_push",
          pendingNativeActionCount: 1,
          nativeLocalActionDeliverySummary: expect.stringContaining("windows host transport"),
        }),
        expect.objectContaining({
          dropIfSlow: true,
        }),
      );

      const bridgeStatus = createOptions("localBridge.status");
      sanjinHandlers["localBridge.status"](bridgeStatus);
      expect(bridgeStatus.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          pendingCount: 1,
          startupPosture: expect.objectContaining({
            desktopHostPlatform: "windows",
            nativeProcessIngressSource: "windows_app_lifecycle",
            nativeLocalActionTransportSource: "desktop_local_action_push",
            pendingNativeActionCount: 1,
            nativeLocalActionDeliverySummary: expect.stringContaining("windows host transport"),
          }),
        }),
        undefined,
      );

      const submitResult = createOptions("localBridge.submitActionResult", {
        actionId: "desktop-action-windows-1",
        approved: false,
        error: "user_rejected",
      });
      sanjinHandlers["localBridge.submitActionResult"](submitResult);

      const statusAfterResolve = createOptions("localBridge.status");
      sanjinHandlers["localBridge.status"](statusAfterResolve);
      expect(statusAfterResolve.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          pendingCount: 0,
          startupPosture: expect.objectContaining({
            desktopHostPlatform: "windows",
            nativeLocalActionExecutionSource: "windows_local_action_executor",
            lastNativeLocalActionExecutionAt: expect.any(String),
            nativeLocalActionExecutionSummary: expect.stringContaining("windows_local_action_executor on windows"),
          }),
        }),
        undefined,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("tracks canonical execution metadata for open_file desktop actions without forking transport semantics", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;
    process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER = "desktop";
    const actions = new Map<string, ShellPendingLocalAction>();
    startDesktopShellStartupModuleStub({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      moduleLabel: "Desktop Shell Startup Module",
      providerKey: "desktop-main",
      transport: {
        listActions() {
          return Array.from(actions.values()).sort((left, right) =>
            right.requestedAt.localeCompare(left.requestedAt),
          );
        },
        listActionsForSession(sessionKey) {
          return Array.from(actions.values()).filter((action) => action.sessionKey === sessionKey);
        },
        listPendingActionsForSession(sessionKey) {
          return Array.from(actions.values()).filter(
            (action) => action.sessionKey === sessionKey && action.lifecycle === "pending",
          );
        },
        requestAction(input) {
          const action: ShellPendingLocalAction = {
            actionId: input.actionId,
            actionType: input.actionType as ShellPendingLocalAction["actionType"],
            title: input.title,
            description: input.description,
            constraints: input.constraints,
            sessionKey: input.sessionKey,
            requestedAt: "2026-04-18T00:05:00.000Z",
            resolvedAt: null,
            expiresAt: null,
            lifecycle: "pending",
            status: "pending",
          };
          actions.set(input.actionId, action);
          return action;
        },
        resolveAction(actionId, result) {
          const existing = actions.get(actionId);
          if (!existing) {
            throw new Error(`missing desktop harness action: ${actionId}`);
          }
          const next: ShellPendingLocalAction = {
            ...existing,
            resolvedAt: "2026-04-18T00:06:00.000Z",
            lifecycle: result.approved ? "completed" : "rejected",
            status: result.approved ? "completed" : "rejected",
            result,
          };
          actions.set(actionId, next);
          return next;
        },
      },
      readiness: "ready",
      label: "Attached Desktop Bridge",
      summary: "Desktop-native bridge transport is attached and ready to serve the shared shell local bridge contract.",
      supports: ["request", "resolve", "focus_policy", "lifecycle_tracking"],
    });

    try {
      updateLocalBridgeStartupPosture({
        desktopHostPlatform: "macos",
        nativeProcessIngressSource: "macos_app_lifecycle",
      });

      const requestAction = createOptions("localBridge.requestAction", {
        actionId: "desktop-action-open-1",
        actionType: "open_file",
        title: "Open generated desktop file",
        description: "Open the generated desktop artifact.",
        constraints: {
          path: "/tmp/generated-artifact.txt",
        },
      });
      await sanjinHandlers["localBridge.requestAction"](requestAction);

      const submitResult = createOptions("localBridge.submitActionResult", {
        actionId: "desktop-action-open-1",
        approved: true,
        payload: {
          path: "/tmp/generated-artifact.txt",
          opened: true,
        },
      });
      sanjinHandlers["localBridge.submitActionResult"](submitResult);

      const bridgeStatus = createOptions("localBridge.status");
      sanjinHandlers["localBridge.status"](bridgeStatus);
      expect(bridgeStatus.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          pendingCount: 0,
          startupPosture: expect.objectContaining({
            nativeLocalActionExecutionSource: "macos_local_action_executor",
            lastNativeLocalActionExecutionAt: expect.any(String),
            nativeLocalActionExecutionSummary: expect.stringMatching(
              /\(open_file\).*macos_local_action_executor on macos/,
            ),
          }),
        }),
        undefined,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("surfaces shared native local-action capability matrix metadata through local bridge status and desktop integration", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;
    process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER = "desktop";
    startDesktopShellStartupModuleStub({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      moduleLabel: "Desktop Shell Startup Module",
      providerKey: "desktop-main",
      transport: {
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
          throw new Error("requestAction should not be called");
        },
        resolveAction() {
          throw new Error("resolveAction should not be called");
        },
      },
      readiness: "ready",
      label: "Attached Desktop Bridge",
      summary: "Desktop-native bridge transport is attached and ready to serve the shared shell local bridge contract.",
      supports: ["request", "resolve", "focus_policy", "lifecycle_tracking"],
    });

    try {
      updateLocalBridgeStartupPosture({
        desktopHostPlatform: "windows",
        nativeProcessIngressSource: "windows_app_lifecycle",
      });

      const bridgeStatus = createOptions("localBridge.status");
      sanjinHandlers["localBridge.status"](bridgeStatus);
      expect(bridgeStatus.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          startupPosture: expect.objectContaining({
            desktopHostPlatform: "windows",
            nativeLocalActionCapabilitySummary: expect.stringContaining(
              "windows host native local-action capability matrix supports",
            ),
            nativeLocalActionCapabilityMatrix: expect.objectContaining({
              pick_file: expect.objectContaining({
                supported: true,
                hostPlatform: "windows",
                executionMode: "file_picker",
              }),
              pick_folder: expect.objectContaining({
                supported: true,
                hostPlatform: "windows",
                executionMode: "folder_picker",
              }),
              open_file: expect.objectContaining({
                supported: true,
                hostPlatform: "windows",
                executionMode: "default_file_open",
              }),
              confirm_execution: expect.objectContaining({
                supported: true,
                hostPlatform: "windows",
                executionMode: "confirmation_dialog",
              }),
            }),
          }),
        }),
        undefined,
      );

      const pilotShell = createOptions("shell.pilotShell.get");
      sanjinHandlers["shell.pilotShell.get"](pilotShell);
      expect(pilotShell.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          desktopIntegration: expect.objectContaining({
            desktopHostPlatform: "windows",
            nativeLocalActionCapabilitySummary: expect.stringContaining(
              "windows host native local-action capability matrix supports",
            ),
            nativeLocalActionCapabilityMatrix: expect.objectContaining({
              open_file: expect.objectContaining({
                supported: true,
                hostPlatform: "windows",
                executionMode: "default_file_open",
              }),
            }),
          }),
        }),
        undefined,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("surfaces desktop bridge stub posture when desktop adapter mode is configured", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;
    process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER = "desktop";

    try {
      const bridgeStatus = createOptions("localBridge.status");
      sanjinHandlers["localBridge.status"](bridgeStatus);
      expect(bridgeStatus.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          status: "ready",
          adapter: expect.objectContaining({
            mode: "desktop",
            readiness: "unavailable",
            label: "Desktop Bridge Stub",
          }),
          startupPosture: expect.objectContaining({
            mode: "desktop",
            attached: false,
            startupModeLabel: "desktop bridge startup",
          }),
          contract: expect.objectContaining({
            version: "v1",
          }),
          pendingCount: 0,
          completedCount: 0,
        }),
        undefined,
      );

      const authMe = createOptions("auth.me");
      sanjinHandlers["auth.me"](authMe);
      expect(authMe.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          onboardingState: expect.objectContaining({
            phase: "workbenchLanding",
            summary: expect.stringMatching(
              /Gateway access is ready, but derived bridge adapter posture still needs desktop integration review before native local-action work surfaces should lead shell entry\..*Current desktop provider posture: no desktop provider\..*Next action: Review Derived Bridge Posture\./,
            ),
            target: expect.objectContaining({
              panel: "settings",
            }),
            desktopIntegration: expect.objectContaining({
              adapterMode: "desktop",
              readiness: "unavailable",
            }),
          }),
        }),
        undefined,
      );

      const tenantBootstrap = createOptions("tenant.bootstrap");
      sanjinHandlers["tenant.bootstrap"](tenantBootstrap);
      expect(tenantBootstrap.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          onboardingState: expect.objectContaining({
            phase: "workbenchLanding",
            target: expect.objectContaining({
              panel: "settings",
            }),
            desktopIntegration: expect.objectContaining({
              adapterMode: "desktop",
              readiness: "unavailable",
            }),
          }),
        }),
        undefined,
      );

      const pilotShell = createOptions("shell.pilotShell.get");
      sanjinHandlers["shell.pilotShell.get"](pilotShell);
      expect(pilotShell.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          desktopIntegration: expect.objectContaining({
            adapterLabel: "Desktop Bridge Stub",
            adapterMode: "desktop",
            readiness: "unavailable",
            contractVersion: "v1",
            startupPosture: expect.objectContaining({
              mode: "desktop",
              attached: false,
            }),
          }),
          operatorQueue: expect.arrayContaining([
            expect.objectContaining({
              title: "Attach Desktop Bridge",
              actionLabel: "Review Derived Bridge Posture",
              detail:
                "derived bridge adapter posture is configured for desktop mode, but no desktop provider is attached yet. Attach desktop bridge transport before relying on native local actions. Current desktop provider posture: no desktop provider. Current desktop integration health: awaiting desktop attach. Next action: Review Derived Bridge Posture.",
              actionMethod: "localBridge.status",
            }),
          ]),
          boundaryRules: expect.arrayContaining([
            expect.objectContaining({
              title: "Desktop Bridge Before Native Actions",
              detail:
                "derived bridge adapter posture selected desktop mode, but native local-action transport is still unattached. The shell should stay cautious until the desktop bridge provider is wired in. Current desktop provider posture: no desktop provider. Current desktop integration health: awaiting desktop attach. Next action: Review Derived Bridge Posture.",
            }),
          ]),
        }),
        undefined,
      );

      const requestAction = createOptions("localBridge.requestAction", {
        actionId: "desktop-action-1",
        actionType: "pick_file",
        title: "Choose desktop file",
        description: "Pick the file through the desktop bridge.",
      });
      await sanjinHandlers["localBridge.requestAction"](requestAction);
      expect(requestAction.respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({
          code: ErrorCodes.UNAVAILABLE,
        }),
      );
    } finally {
      delete process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER;
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("runs a desktop provider harness through status, request, stream, resolve, and status again", async () => {
    vi.spyOn(sessionsHandlers, "sessions.list").mockImplementation(({ respond }) => {
      respond(
        true,
        {
          sessions: [
            {
              key: "agent:main:dashboard:sess-1",
              sessionId: "sess-1",
              displayName: "Desktop Harness Session",
              status: "running",
              updatedAt: 1713000000000,
            },
          ],
        },
        undefined,
      );
    });
    vi.spyOn(sessionsHandlers, "sessions.get").mockImplementation(({ respond }) => {
      respond(
        true,
        {
          messages: [
            { role: "assistant", content: [{ type: "output_text", text: "desktop bridge waiting for a local file" }] },
          ],
        },
        undefined,
      );
    });
    vi.spyOn(sessionsHandlers, "sessions.resolve").mockImplementation(({ respond }) => {
      respond(
        true,
        {
          key: "agent:main:dashboard:sess-1",
        },
        undefined,
      );
    });

    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;
    process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER = "desktop";
    const actions = new Map<string, {
      actionId: string;
      actionType: "pick_file";
      title: string;
      description: string;
      constraints?: Record<string, unknown>;
      sessionKey?: string;
      requestedAt: string;
      resolvedAt: string | null;
      expiresAt: string | null;
      lifecycle: "pending" | "completed" | "rejected";
      status: "pending" | "completed" | "rejected";
      result?: {
        actionId: string;
        approved: boolean;
        payload?: Record<string, unknown>;
        error?: string;
      };
    }>();
    startDesktopShellStartupModuleStub({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      moduleLabel: "Desktop Shell Startup Module",
      providerKey: "desktop-main",
      transport: {
        listActions() {
          return Array.from(actions.values()).sort((left, right) =>
            right.requestedAt.localeCompare(left.requestedAt),
          );
        },
        listActionsForSession(sessionKey) {
          return Array.from(actions.values()).filter((action) => action.sessionKey === sessionKey);
        },
        listPendingActionsForSession(sessionKey) {
          return Array.from(actions.values()).filter(
            (action) => action.sessionKey === sessionKey && action.lifecycle === "pending",
          );
        },
        requestAction(input) {
          const action = {
            actionId: input.actionId,
            actionType: input.actionType as "pick_file",
            title: input.title,
            description: input.description,
            constraints: input.constraints,
            sessionKey: input.sessionKey,
            requestedAt: "2026-04-16T00:00:00.000Z",
            resolvedAt: null,
            expiresAt: null,
            lifecycle: "pending" as const,
            status: "pending" as const,
          };
          actions.set(input.actionId, action);
          return action;
        },
        resolveAction(actionId, result) {
          const existing = actions.get(actionId);
          if (!existing) {
            throw new Error(`missing desktop harness action: ${actionId}`);
          }
          const next = {
            ...existing,
            resolvedAt: "2026-04-16T00:01:00.000Z",
            lifecycle: result.approved ? ("completed" as const) : ("rejected" as const),
            status: result.approved ? ("completed" as const) : ("rejected" as const),
            result,
          };
          actions.set(actionId, next);
          return next;
        },
      },
      readiness: "ready",
      label: "Attached Desktop Bridge",
      summary: "Desktop-native bridge transport is attached and ready to serve the shared shell local bridge contract.",
      supports: ["request", "resolve", "focus_policy", "lifecycle_tracking"],
    });

    try {
      const initialStatus = createOptions("localBridge.status");
      sanjinHandlers["localBridge.status"](initialStatus);
      expect(initialStatus.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          adapter: expect.objectContaining({
            mode: "desktop",
            readiness: "ready",
            label: "Attached Desktop Bridge",
          }),
          startupPosture: expect.objectContaining({
            mode: "desktop",
            attached: true,
            startupModeLabel: "desktop bridge startup",
            startupSource: "desktop_startup_wiring",
            shellAppLabel: "OpenClaw Desktop",
            moduleLabel: "Desktop Shell Startup Module",
          }),
          pendingCount: 0,
        }),
        undefined,
      );

      updateLocalBridgeStartupPosture({
        hostState: "armed",
        hostStarted: true,
        hostArmed: true,
        nextWakeAt: "2026-04-17T00:01:00.000Z",
        lastWakeStartedAt: "2026-04-17T00:00:00.000Z",
        lastWakeCompletedAt: "2026-04-17T00:00:02.000Z",
        hostSummary: "Desktop runtime host remains armed for the next desktop main-process wake.",
        serviceState: "acquired",
        serviceOwned: true,
        serviceActive: true,
        lastAcquireAt: "2026-04-17T00:00:00.000Z",
        lastReleaseAt: null,
        serviceSummary: "Desktop runtime service owner remains acquired for the next desktop main-process wake.",
        lifecycleState: "active",
        lifecycleOwned: true,
        lifecycleActive: true,
        lastBootAt: "2026-04-17T00:00:00.000Z",
        lastResumeAt: null,
        lastSuspendAt: null,
        lastShutdownAt: null,
        lifecycleSummary: "OpenClaw Desktop booted desktop runtime lifecycle owner and Desktop runtime lifecycle owner remains active for the next desktop app wake.",
        bootstrapState: "active",
        bootstrapOwned: true,
        bootstrapActive: true,
        appOwnerState: "active",
        appOwnerOwned: true,
        appOwnerActive: true,
        shellOwnerState: "active",
        shellOwnerOwned: true,
        shellOwnerActive: true,
        processHostState: "foreground",
        processHostOwned: true,
        processHostActive: true,
        processEventType: "foreground",
        processEventSource: "desktop_main_process_event_bridge",
        lastProcessEventAt: "2026-04-17T00:01:02.000Z",
        nativeProcessEventType: "app_foregrounded",
        nativeProcessEventSource: "desktop_native_main_process_bridge",
        desktopHostPlatform: "macos",
        nativeProcessIngressSource: "macos_app_lifecycle",
        lastNativeProcessEventAt: "2026-04-17T00:01:02.000Z",
        lastStartAt: "2026-04-17T00:00:00.000Z",
        lastWakeAt: "2026-04-17T00:00:02.000Z",
        lastForegroundAt: "2026-04-17T00:00:02.000Z",
        lastBackgroundAt: null,
        lastStopAt: null,
        bootstrapSummary:
          "OpenClaw Desktop started desktop runtime bootstrap owner and Desktop runtime bootstrap owner remains active for the next desktop app wake.",
        appOwnerSummary:
          "OpenClaw Desktop woke desktop runtime app owner and Desktop runtime app owner remains active for the next desktop app wake.",
        shellOwnerSummary:
          "OpenClaw Desktop woke desktop runtime shell owner and Desktop runtime shell owner remains active for the next desktop shell wake.",
        processHostSummary:
          "OpenClaw Desktop foregrounded desktop runtime process host and Desktop runtime process host remains in the foreground for the next desktop shell wake.",
        processEventSummary:
          "OpenClaw Desktop reported desktop main-process foreground and OpenClaw Desktop foregrounded desktop runtime process host and Desktop runtime process host remains in the foreground for the next desktop shell wake.",
        nativeProcessEventSummary:
          "OpenClaw Desktop ingested native desktop app_foregrounded from macos_app_lifecycle on macos and OpenClaw Desktop reported desktop main-process foreground and OpenClaw Desktop foregrounded desktop runtime process host and Desktop runtime process host remains in the foreground for the next desktop shell wake.",
      });

      const authMe = createOptions("auth.me");
      sanjinHandlers["auth.me"](authMe);
      expect(authMe.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          onboardingState: expect.objectContaining({
            phase: "workbenchLanding",
            target: expect.objectContaining({
              panel: "workbench",
            }),
            desktopIntegration: expect.objectContaining({
              adapterMode: "desktop",
              readiness: "ready",
            }),
          }),
        }),
        undefined,
      );

      const pilotShell = createOptions("shell.pilotShell.get");
      sanjinHandlers["shell.pilotShell.get"](pilotShell);
      expect(pilotShell.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          desktopIntegration: expect.objectContaining({
            adapterLabel: "Attached Desktop Bridge",
            adapterMode: "desktop",
            readiness: "ready",
            contractVersion: "v1",
            startupSource: "desktop_startup_wiring",
            shellAppLabel: "OpenClaw Desktop",
            moduleLabel: "Desktop Shell Startup Module",
            moduleSummary:
              "Desktop Shell Startup Module reused provider desktop-main for OpenClaw Desktop and started desktop bridge startup (attached).",
            moduleStatus: "reused_attached",
            moduleStatusLabel: "module reused / attached",
            providerKey: "desktop-main",
            hostState: "armed",
            hostStarted: true,
            hostArmed: true,
            serviceState: "acquired",
            serviceOwned: true,
            serviceActive: true,
            lifecycleState: "active",
            lifecycleOwned: true,
            lifecycleActive: true,
            bootstrapState: "active",
            bootstrapOwned: true,
            bootstrapActive: true,
            appOwnerState: "active",
            appOwnerOwned: true,
            appOwnerActive: true,
            shellOwnerState: "active",
            shellOwnerOwned: true,
            shellOwnerActive: true,
            processHostState: "foreground",
            processHostOwned: true,
            processHostActive: true,
            processEventType: "foreground",
            processEventSource: "desktop_main_process_event_bridge",
            lastProcessEventAt: "2026-04-17T00:01:02.000Z",
            nativeProcessEventType: "app_foregrounded",
            nativeProcessEventSource: "desktop_native_main_process_bridge",
            desktopHostPlatform: "macos",
            nativeProcessIngressSource: "macos_app_lifecycle",
            lastNativeProcessEventAt: "2026-04-17T00:01:02.000Z",
            nextWakeAt: "2026-04-17T00:01:00.000Z",
            hostSummary: "Desktop runtime host remains armed for the next desktop main-process wake.",
            serviceSummary: "Desktop runtime service owner remains acquired for the next desktop main-process wake.",
            lifecycleSummary: "OpenClaw Desktop booted desktop runtime lifecycle owner and Desktop runtime lifecycle owner remains active for the next desktop app wake.",
            bootstrapSummary:
              "OpenClaw Desktop started desktop runtime bootstrap owner and Desktop runtime bootstrap owner remains active for the next desktop app wake.",
            appOwnerSummary:
              "OpenClaw Desktop woke desktop runtime app owner and Desktop runtime app owner remains active for the next desktop app wake.",
            shellOwnerSummary:
              "OpenClaw Desktop woke desktop runtime shell owner and Desktop runtime shell owner remains active for the next desktop shell wake.",
            processHostSummary:
              "OpenClaw Desktop foregrounded desktop runtime process host and Desktop runtime process host remains in the foreground for the next desktop shell wake.",
            processEventSummary:
              "OpenClaw Desktop reported desktop main-process foreground and OpenClaw Desktop foregrounded desktop runtime process host and Desktop runtime process host remains in the foreground for the next desktop shell wake.",
            nativeProcessEventSummary:
              "OpenClaw Desktop ingested native desktop app_foregrounded from macos_app_lifecycle on macos and OpenClaw Desktop reported desktop main-process foreground and OpenClaw Desktop foregrounded desktop runtime process host and Desktop runtime process host remains in the foreground for the next desktop shell wake.",
            startupPosture: expect.objectContaining({
              mode: "desktop",
              attached: true,
              hostState: "armed",
              serviceState: "acquired",
              lifecycleState: "active",
              bootstrapState: "active",
              appOwnerState: "active",
              shellOwnerState: "active",
              processHostState: "foreground",
              processEventType: "foreground",
              nativeProcessEventType: "app_foregrounded",
              desktopHostPlatform: "macos",
              nativeProcessIngressSource: "macos_app_lifecycle",
            }),
          }),
          focusItems: expect.arrayContaining([
            expect.objectContaining({
              title: "Desktop Bridge Startup",
              summary: expect.stringContaining("Desktop Shell Startup Module for OpenClaw Desktop"),
            }),
          ]),
          operatorQueue: expect.arrayContaining([
            expect.objectContaining({
              title: "Confirm Desktop Bridge Attach",
              detail: expect.stringContaining(
                "Desktop Shell Startup Module reused provider desktop-main for OpenClaw Desktop and started desktop bridge startup (attached).",
              ),
              detail: expect.stringContaining("Current desktop startup status: module reused / attached."),
              detail: expect.stringContaining("Current desktop startup provider: desktop-main."),
              detail: expect.stringContaining("Current desktop provider posture: direct desktop transport."),
              actionLabel: "Inspect Reused Desktop Attach",
              actionMethod: "localBridge.status",
            }),
          ]),
          boundaryRules: expect.arrayContaining([
            expect.objectContaining({
              title: "Desktop Bridge Attached",
              detail: expect.stringContaining(
                "Desktop Shell Startup Module reused provider desktop-main for OpenClaw Desktop and started desktop bridge startup (attached).",
              ),
              detail: expect.stringContaining("Current desktop startup status: module reused / attached."),
              detail: expect.stringContaining("Current desktop startup provider: desktop-main."),
              detail: expect.stringContaining("Current desktop provider posture: direct desktop transport."),
            }),
          ]),
        }),
        undefined,
      );

      const requestAction = createOptions("localBridge.requestAction", {
        actionId: "desktop-action-2",
        actionType: "pick_file",
        title: "Choose desktop file",
        description: "Pick the file through the attached desktop bridge.",
        sessionId: "sess-1",
      });
      await sanjinHandlers["localBridge.requestAction"](requestAction);
      expect(requestAction.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          transport: expect.objectContaining({
            adapterMode: "desktop",
            adapterReadiness: "ready",
            contractVersion: "v1",
          }),
          action: expect.objectContaining({
            actionId: "desktop-action-2",
            sessionKey: "agent:main:dashboard:sess-1",
            lifecycle: "requested",
          }),
        }),
        undefined,
      );

      const stream = createOptions("shell.session.stream", {
        sessionId: "sess-1",
      });
      await sanjinHandlers["shell.session.stream"](stream);
      expect(stream.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          key: "agent:main:dashboard:sess-1",
          pendingLocalActions: [
            expect.objectContaining({
              actionId: "desktop-action-2",
              lifecycle: "pending",
              sessionKey: "agent:main:dashboard:sess-1",
            }),
          ],
          plannerOutcome: expect.objectContaining({
            stageAction: "hold",
            nextActionLabel: "Open Pending Action",
          }),
        }),
        undefined,
      );

      const getSession = createOptions("shell.session.get", {
        sessionId: "sess-1",
      });
      await sanjinHandlers["shell.session.get"](getSession);
      expect(getSession.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          localActions: [
            expect.objectContaining({
              actionId: "desktop-action-2",
              lifecycle: "pending",
            }),
          ],
        }),
        undefined,
      );

      const submitResult = createOptions("localBridge.submitActionResult", {
        actionId: "desktop-action-2",
        approved: true,
        payload: {
          path: "/tmp/desktop-file.md",
        },
      });
      sanjinHandlers["localBridge.submitActionResult"](submitResult);
      expect(submitResult.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          transport: expect.objectContaining({
            adapterMode: "desktop",
            adapterReadiness: "ready",
          }),
          action: expect.objectContaining({
            actionId: "desktop-action-2",
            lifecycle: "completed",
            status: "completed",
          }),
        }),
        undefined,
      );

      const finalStatus = createOptions("localBridge.status");
      sanjinHandlers["localBridge.status"](finalStatus);
      expect(finalStatus.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          pendingCount: 0,
          completedCount: 1,
          actions: [
            expect.objectContaining({
              actionId: "desktop-action-2",
              lifecycle: "completed",
            }),
          ],
        }),
        undefined,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("uses health review labels when an attached desktop provider is degraded", () => {
    process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER = "desktop";
    startDesktopShellStartupModuleStub({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      moduleLabel: "Desktop Shell Startup Module",
      providerKey: "desktop-main",
      transport: {
        listActions() {
          return [];
        },
        listActionsForSession() {
          return [];
        },
        listPendingActionsForSession() {
          return [];
        },
        requestAction(input) {
          return {
            actionId: input.actionId,
            actionType: input.actionType as "pick_file",
            title: input.title,
            description: input.description,
            constraints: input.constraints,
            sessionKey: input.sessionKey,
            requestedAt: "2026-04-16T00:00:00.000Z",
            resolvedAt: null,
            expiresAt: null,
            lifecycle: "pending" as const,
            status: "pending" as const,
          };
        },
        resolveAction(actionId, result) {
          return {
            actionId,
            actionType: "pick_file" as const,
            title: "Choose desktop file",
            description: "Resolve through degraded desktop provider.",
            requestedAt: "2026-04-16T00:00:00.000Z",
            resolvedAt: "2026-04-16T00:01:00.000Z",
            expiresAt: null,
            lifecycle: result.approved ? ("completed" as const) : ("rejected" as const),
            status: result.approved ? ("completed" as const) : ("rejected" as const),
            result,
          };
        },
      },
      readiness: "degraded",
      label: "Attached Desktop Bridge",
      summary: "Desktop-native bridge transport is attached but degraded.",
      supports: ["request", "resolve", "focus_policy", "lifecycle_tracking"],
    });

    const pilotShell = createOptions("shell.pilotShell.get");
    sanjinHandlers["shell.pilotShell.get"](pilotShell);
    expect(pilotShell.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        desktopIntegration: expect.objectContaining({
          adapterMode: "desktop",
          readiness: "degraded",
          healthStatus: "degraded",
          healthStatusLabel: "desktop bridge degraded",
        }),
        operatorQueue: expect.arrayContaining([
          expect.objectContaining({
            title: "Confirm Desktop Bridge Attach",
            actionLabel: "Review Degraded Reused Desktop Health",
          }),
        ]),
      }),
      undefined,
    );
  });

  it("keeps gateway onboarding on workbench when desktop integration is degraded but attached", () => {
    process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER = "desktop";
    startDesktopShellStartupModuleStub({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      moduleLabel: "Desktop Shell Startup Module",
      providerKey: "desktop-main",
      transport: {
        listActions() {
          return [];
        },
        listActionsForSession() {
          return [];
        },
        listPendingActionsForSession() {
          return [];
        },
        requestAction(input) {
          return {
            actionId: input.actionId,
            actionType: input.actionType as "pick_file",
            title: input.title,
            description: input.description,
            constraints: input.constraints,
            sessionKey: input.sessionKey,
            requestedAt: "2026-04-16T00:00:00.000Z",
            resolvedAt: null,
            expiresAt: null,
            lifecycle: "pending" as const,
            status: "pending" as const,
          };
        },
        resolveAction(actionId, result) {
          return {
            actionId,
            actionType: "pick_file" as const,
            title: "Choose desktop file",
            description: "Resolve through degraded desktop provider.",
            requestedAt: "2026-04-16T00:00:00.000Z",
            resolvedAt: "2026-04-16T00:01:00.000Z",
            expiresAt: null,
            lifecycle: result.approved ? ("completed" as const) : ("rejected" as const),
            status: result.approved ? ("completed" as const) : ("rejected" as const),
            result,
          };
        },
      },
      readiness: "degraded",
      label: "Attached Desktop Bridge",
      summary: "Desktop-native bridge transport is attached but degraded.",
      supports: ["request", "resolve", "focus_policy", "lifecycle_tracking"],
    });

    const authMe = createOptions("auth.me");
    sanjinHandlers["auth.me"](authMe);
      expect(authMe.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          onboardingState: expect.objectContaining({
            phase: "workbenchLanding",
            target: expect.objectContaining({
              panel: "workbench",
            }),
            summary: expect.stringMatching(
              /can keep work surfaces open while desktop health stays under review\..*Current desktop integration health: desktop bridge degraded\..*Next action: Review Degraded Reused Desktop Health\./,
            ),
            desktopIntegration: expect.objectContaining({
              adapterMode: "desktop",
            readiness: "degraded",
            healthStatus: "degraded",
          }),
        }),
      }),
      undefined,
    );
  });

  it("updates gateway onboarding to settings when runtime health becomes unavailable after attach", () => {
    process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER = "desktop";
    startDesktopShellStartupModuleStub({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      moduleLabel: "Desktop Shell Startup Module",
      providerKey: "desktop-main",
      transport: {
        listActions() {
          return [];
        },
        listActionsForSession() {
          return [];
        },
        listPendingActionsForSession() {
          return [];
        },
        requestAction(input) {
          return {
            actionId: input.actionId,
            actionType: input.actionType as "pick_file",
            title: input.title,
            description: input.description,
            constraints: input.constraints,
            sessionKey: input.sessionKey,
            requestedAt: "2026-04-16T00:00:00.000Z",
            resolvedAt: null,
            expiresAt: null,
            lifecycle: "pending" as const,
            status: "pending" as const,
          };
        },
        resolveAction(actionId, result) {
          return {
            actionId,
            actionType: "pick_file" as const,
            title: "Choose desktop file",
            description: "Resolve through unavailable desktop provider.",
            requestedAt: "2026-04-16T00:00:00.000Z",
            resolvedAt: "2026-04-16T00:01:00.000Z",
            expiresAt: null,
            lifecycle: result.approved ? ("completed" as const) : ("rejected" as const),
            status: result.approved ? ("completed" as const) : ("rejected" as const),
            result,
          };
        },
      },
      readiness: "ready",
      label: "Attached Desktop Bridge",
      summary: "Desktop-native bridge transport is attached and healthy.",
      supports: ["request", "resolve", "focus_policy", "lifecycle_tracking"],
    });
    reportDesktopShellStartupModuleHealth({
      adapterReadiness: "unavailable",
    });

    const authMe = createOptions("auth.me");
    sanjinHandlers["auth.me"](authMe);
    expect(authMe.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        onboardingState: expect.objectContaining({
          phase: "workbenchLanding",
          target: expect.objectContaining({
            panel: "settings",
          }),
          summary: expect.stringMatching(
            /Current desktop integration health: desktop bridge unavailable\..*Next action: Review Unavailable Reused Desktop Health\./,
          ),
          desktopIntegration: expect.objectContaining({
            adapterMode: "desktop",
            readiness: "ready",
            healthStatus: "unavailable",
            healthStatusLabel: "desktop bridge unavailable",
            healthFeed: expect.objectContaining({
              eventCount: expect.any(Number),
              latestSource: "runtime_heartbeat",
              latestHealthStatus: "unavailable",
            }),
            recentHealthEvents: expect.arrayContaining([
              expect.objectContaining({
                source: "runtime_heartbeat",
                healthStatus: "unavailable",
              }),
            ]),
          }),
        }),
      }),
      undefined,
    );
  });

  it("updates gateway onboarding to settings when desktop health feed becomes stale after attach", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-17T00:00:00.000Z"));
    process.env.OPENCLAW_LOCAL_BRIDGE_ADAPTER = "desktop";
    startDesktopShellStartupModuleStub({
      env: { OPENCLAW_LOCAL_BRIDGE_ADAPTER: "desktop" } as NodeJS.ProcessEnv,
      shellAppLabel: "OpenClaw Desktop",
      moduleLabel: "Desktop Shell Startup Module",
      providerKey: "desktop-main",
      transport: {
        listActions() {
          return [];
        },
        listActionsForSession() {
          return [];
        },
        listPendingActionsForSession() {
          return [];
        },
        requestAction(input) {
          return {
            actionId: input.actionId,
            actionType: input.actionType as "pick_file",
            title: input.title,
            description: input.description,
            constraints: input.constraints,
            sessionKey: input.sessionKey,
            requestedAt: "2026-04-16T00:00:00.000Z",
            resolvedAt: null,
            expiresAt: null,
            lifecycle: "pending" as const,
            status: "pending" as const,
          };
        },
        resolveAction(actionId, result) {
          return {
            actionId,
            actionType: "pick_file" as const,
            title: "Choose desktop file",
            description: "Resolve through desktop provider.",
            requestedAt: "2026-04-16T00:00:00.000Z",
            resolvedAt: "2026-04-16T00:01:00.000Z",
            expiresAt: null,
            lifecycle: result.approved ? ("completed" as const) : ("rejected" as const),
            status: result.approved ? ("completed" as const) : ("rejected" as const),
            result,
          };
        },
      },
      readiness: "ready",
      label: "Attached Desktop Bridge",
      summary: "Desktop-native bridge transport is attached and healthy.",
      supports: ["request", "resolve", "focus_policy", "lifecycle_tracking"],
    });

    vi.setSystemTime(new Date("2026-04-17T00:10:30.000Z"));

    const authMe = createOptions("auth.me");
    sanjinHandlers["auth.me"](authMe);
    expect(authMe.respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        onboardingState: expect.objectContaining({
          target: expect.objectContaining({
            panel: "settings",
          }),
          summary: expect.stringMatching(
            /Current desktop health feed freshness: desktop health feed stale\..*Next action: Review Reused Desktop Feed Freshness\./,
          ),
          desktopIntegration: expect.objectContaining({
            adapterMode: "desktop",
            healthFeed: expect.objectContaining({
              stalenessStatus: "stale",
              stalenessStatusLabel: "desktop health feed stale",
            }),
          }),
        }),
      }),
      undefined,
    );
    vi.useRealTimers();
  });

  it("runs capability schema validation and sample runs against capability-pack drafts", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      const schemaValidation = createOptions("sanjin.runCapabilitySchemaValidation");
      await sanjinHandlers["sanjin.runCapabilitySchemaValidation"](schemaValidation);
      expect(schemaValidation.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          message: "Ran Sanjin capability schema validation.",
          result: expect.objectContaining({
            mdPath: expect.stringContaining("sanjin_capability_schema_validation_2026-04-09.md"),
          }),
        }),
        undefined,
      );

      const sampleRuns = createOptions("sanjin.runCapabilitySampleRuns");
      await sanjinHandlers["sanjin.runCapabilitySampleRuns"](sampleRuns);
      expect(sampleRuns.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          message: "Ran Sanjin capability sample runs.",
          result: expect.objectContaining({
            mdPath: expect.stringContaining("sanjin_capability_sample_runs_2026-04-09.md"),
          }),
        }),
        undefined,
      );

      const registry = JSON.parse(
        await fs.readFile(path.join(workspaceDir, "sanjin", "memory", "capabilities", "registry.json"), "utf8"),
      );
      const draft = registry.entries.find(
        (entry: { capability_id: string }) =>
          entry.capability_id === "draft:workflow:weekly-memory-digest",
      );
      expect(draft.admission_stage).toBe("sampled");
      expect(draft.sample_run_count).toBe(1);
      expect(draft.metadata.schema_validation.ok).toBe(true);
      expect(draft.metadata.sample_run.sample_status).toBe("ok");
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("promotes sampled capability-pack drafts to candidate", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      const schemaValidation = createOptions("sanjin.runCapabilitySchemaValidation");
      await sanjinHandlers["sanjin.runCapabilitySchemaValidation"](schemaValidation);

      const sampleRuns = createOptions("sanjin.runCapabilitySampleRuns");
      await sanjinHandlers["sanjin.runCapabilitySampleRuns"](sampleRuns);

      const promote = createOptions("sanjin.runCapabilityCandidatePromotion");
      await sanjinHandlers["sanjin.runCapabilityCandidatePromotion"](promote);
      expect(promote.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          message: "Promoted Sanjin capability candidates.",
          result: expect.objectContaining({
            mdPath: expect.stringContaining("sanjin_capability_candidate_promotion_2026-04-09.md"),
          }),
        }),
        undefined,
      );

      const registry = JSON.parse(
        await fs.readFile(path.join(workspaceDir, "sanjin", "memory", "capabilities", "registry.json"), "utf8"),
      );
      const draft = registry.entries.find(
        (entry: { capability_id: string }) =>
          entry.capability_id === "draft:workflow:weekly-memory-digest",
      );
      expect(draft.admission_stage).toBe("candidate");
      expect(draft.status).toBe("candidate");
      expect(draft.metadata.candidate_promotion.reason).toBe("sampled_ready_for_candidate");
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("promotes workflow candidates to limited active without touching placeholder candidates", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      await sanjinHandlers["sanjin.runCapabilitySchemaValidation"](createOptions("sanjin.runCapabilitySchemaValidation"));
      await sanjinHandlers["sanjin.runCapabilitySampleRuns"](createOptions("sanjin.runCapabilitySampleRuns"));
      await sanjinHandlers["sanjin.runCapabilityCandidatePromotion"](createOptions("sanjin.runCapabilityCandidatePromotion"));

      const limited = createOptions("sanjin.runCapabilityLimitedActivePromotion");
      await sanjinHandlers["sanjin.runCapabilityLimitedActivePromotion"](limited);
      expect(limited.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          message: "Promoted Sanjin limited active workflows.",
          result: expect.objectContaining({
            mdPath: expect.stringContaining("sanjin_capability_limited_active_promotion_2026-04-09.md"),
          }),
        }),
        undefined,
      );

      const registry = JSON.parse(
        await fs.readFile(path.join(workspaceDir, "sanjin", "memory", "capabilities", "registry.json"), "utf8"),
      );
      const workflow = registry.entries.find(
        (entry: { capability_id: string }) =>
          entry.capability_id === "draft:workflow:weekly-memory-digest",
      );
      const connector = registry.entries.find(
        (entry: { capability_id: string }) =>
          entry.capability_id === "connector:mcp_placeholder",
      );
      expect(workflow.admission_stage).toBe("limited_active");
      expect(workflow.status).toBe("limited_active");
      expect(workflow.enabled).toBe(true);
      expect(workflow.metadata.limited_activation.reason).toBe("candidate_ready_for_limited_active");
      expect(connector.admission_stage).toBe("candidate");
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("observes limited active workflows and leaves placeholder candidates untouched", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      await sanjinHandlers["sanjin.runCapabilitySchemaValidation"](createOptions("sanjin.runCapabilitySchemaValidation"));
      await sanjinHandlers["sanjin.runCapabilitySampleRuns"](createOptions("sanjin.runCapabilitySampleRuns"));
      await sanjinHandlers["sanjin.runCapabilityCandidatePromotion"](createOptions("sanjin.runCapabilityCandidatePromotion"));
      await sanjinHandlers["sanjin.runCapabilityLimitedActivePromotion"](createOptions("sanjin.runCapabilityLimitedActivePromotion"));

      const observe = createOptions("sanjin.runCapabilityLimitedActiveObservation");
      await sanjinHandlers["sanjin.runCapabilityLimitedActiveObservation"](observe);
      expect(observe.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          message: "Ran Sanjin limited active observation.",
          result: expect.objectContaining({
            mdPath: expect.stringContaining("sanjin_capability_limited_active_observation_2026-04-09.md"),
          }),
        }),
        undefined,
      );

      const registry = JSON.parse(
        await fs.readFile(path.join(workspaceDir, "sanjin", "memory", "capabilities", "registry.json"), "utf8"),
      );
      const workflow = registry.entries.find(
        (entry: { capability_id: string }) =>
          entry.capability_id === "draft:workflow:weekly-memory-digest",
      );
      const connector = registry.entries.find(
        (entry: { capability_id: string }) =>
          entry.capability_id === "connector:mcp_placeholder",
      );
      expect(workflow.admission_stage).toBe("limited_active");
      expect(workflow.sample_run_count).toBe(2);
      expect(workflow.metadata.limited_active_observation.observation_count).toBe(1);
      expect(workflow.metadata.limited_active_observation.shadow_status).toBe("passed");
      expect(connector.admission_stage).toBe("candidate");
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("promotes ready limited active workflows to active", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      await sanjinHandlers["sanjin.runCapabilitySchemaValidation"](createOptions("sanjin.runCapabilitySchemaValidation"));
      await sanjinHandlers["sanjin.runCapabilitySampleRuns"](createOptions("sanjin.runCapabilitySampleRuns"));
      await sanjinHandlers["sanjin.runCapabilityCandidatePromotion"](createOptions("sanjin.runCapabilityCandidatePromotion"));
      await sanjinHandlers["sanjin.runCapabilityLimitedActivePromotion"](createOptions("sanjin.runCapabilityLimitedActivePromotion"));
      await sanjinHandlers["sanjin.runCapabilityLimitedActiveObservation"](createOptions("sanjin.runCapabilityLimitedActiveObservation"));
      await sanjinHandlers["sanjin.runCapabilityLimitedActiveObservation"](createOptions("sanjin.runCapabilityLimitedActiveObservation"));

      const promote = createOptions("sanjin.runCapabilityActivePromotion");
      await sanjinHandlers["sanjin.runCapabilityActivePromotion"](promote);
      expect(promote.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          message: "Promoted Sanjin ready capabilities to active.",
          result: expect.objectContaining({
            mdPath: expect.stringContaining("sanjin_capability_active_promotion_2026-04-10.md"),
          }),
        }),
        undefined,
      );

      const registry = JSON.parse(
        await fs.readFile(path.join(workspaceDir, "sanjin", "memory", "capabilities", "registry.json"), "utf8"),
      );
      const workflow = registry.entries.find(
        (entry: { capability_id: string }) =>
          entry.capability_id === "draft:workflow:weekly-memory-digest",
      );
      expect(workflow.admission_stage).toBe("active");
      expect(workflow.status).toBe("active");
      expect(workflow.governance_policy).toBe("active_monitoring");
      expect(workflow.metadata.active_promotion.reason).toBe("limited_active_observed_ready_for_active");
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("observes active workflows after promotion", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      await sanjinHandlers["sanjin.runCapabilitySchemaValidation"](createOptions("sanjin.runCapabilitySchemaValidation"));
      await sanjinHandlers["sanjin.runCapabilitySampleRuns"](createOptions("sanjin.runCapabilitySampleRuns"));
      await sanjinHandlers["sanjin.runCapabilityCandidatePromotion"](createOptions("sanjin.runCapabilityCandidatePromotion"));
      await sanjinHandlers["sanjin.runCapabilityLimitedActivePromotion"](createOptions("sanjin.runCapabilityLimitedActivePromotion"));
      await sanjinHandlers["sanjin.runCapabilityLimitedActiveObservation"](createOptions("sanjin.runCapabilityLimitedActiveObservation"));
      await sanjinHandlers["sanjin.runCapabilityLimitedActiveObservation"](createOptions("sanjin.runCapabilityLimitedActiveObservation"));
      await sanjinHandlers["sanjin.runCapabilityActivePromotion"](createOptions("sanjin.runCapabilityActivePromotion"));

      const observe = createOptions("sanjin.runCapabilityActiveObservation");
      await sanjinHandlers["sanjin.runCapabilityActiveObservation"](observe);
      expect(observe.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          message: "Ran Sanjin active observation.",
          result: expect.objectContaining({
            mdPath: expect.stringContaining("sanjin_capability_active_observation_2026-04-10.md"),
          }),
        }),
        undefined,
      );

      const registry = JSON.parse(
        await fs.readFile(path.join(workspaceDir, "sanjin", "memory", "capabilities", "registry.json"), "utf8"),
      );
      const workflow = registry.entries.find(
        (entry: { capability_id: string }) =>
          entry.capability_id === "draft:workflow:weekly-memory-digest",
      );
      expect(workflow.admission_stage).toBe("active");
      expect(workflow.metadata.active_observation.observation_count).toBe(1);
      expect(workflow.metadata.active_observation.active_status).toBe("healthy");
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("runs post-active monitoring after active observation", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      await sanjinHandlers["sanjin.runCapabilitySchemaValidation"](createOptions("sanjin.runCapabilitySchemaValidation"));
      await sanjinHandlers["sanjin.runCapabilitySampleRuns"](createOptions("sanjin.runCapabilitySampleRuns"));
      await sanjinHandlers["sanjin.runCapabilityCandidatePromotion"](createOptions("sanjin.runCapabilityCandidatePromotion"));
      await sanjinHandlers["sanjin.runCapabilityLimitedActivePromotion"](createOptions("sanjin.runCapabilityLimitedActivePromotion"));
      await sanjinHandlers["sanjin.runCapabilityLimitedActiveObservation"](createOptions("sanjin.runCapabilityLimitedActiveObservation"));
      await sanjinHandlers["sanjin.runCapabilityLimitedActiveObservation"](createOptions("sanjin.runCapabilityLimitedActiveObservation"));
      await sanjinHandlers["sanjin.runCapabilityActivePromotion"](createOptions("sanjin.runCapabilityActivePromotion"));
      await sanjinHandlers["sanjin.runCapabilityActiveObservation"](createOptions("sanjin.runCapabilityActiveObservation"));

      const observe = createOptions("sanjin.runCapabilityPostActiveMonitoringWindow");
      await sanjinHandlers["sanjin.runCapabilityPostActiveMonitoringWindow"](observe);
      expect(observe.respond).toHaveBeenCalledWith(
        true,
        expect.objectContaining({
          message: "Ran Sanjin post-active monitoring window.",
          result: expect.objectContaining({
            mdPath: expect.stringContaining("sanjin_capability_post_active_monitoring_window_2026-04-10.md"),
          }),
        }),
        undefined,
      );

      const registry = JSON.parse(
        await fs.readFile(path.join(workspaceDir, "sanjin", "memory", "capabilities", "registry.json"), "utf8"),
      );
      const workflow = registry.entries.find(
        (entry: { capability_id: string }) =>
          entry.capability_id === "draft:workflow:weekly-memory-digest",
      );
      expect(workflow.admission_stage).toBe("active");
      expect(workflow.metadata.post_active_monitoring.window_count).toBe(1);
      expect(workflow.metadata.post_active_monitoring.acceptance_label).toBe("ready_for_production_shell");
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("creates, lists, and fetches tenant promotion requests through gateway handlers", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      const create = createOptions("governance.promotionRequest.create", {
        actorRole: "tenant_operator",
        requestReason: "Repeated structural evidence is ready for governed review.",
        evidence: {
          evidenceKind: "capability_candidate",
          title: "Weekly Memory Digest candidate shows repeatable structure",
          detail: "The candidate survived repeated runs without tenant-specific payload.",
          sourceRefs: ["/tmp/sanjin/eval/artifacts/evidence.json"],
          capabilityId: "draft:workflow:weekly-memory-digest",
          sessionKey: "shell-session-1",
        },
      });
      await sanjinHandlers["governance.promotionRequest.create"](create);
      const createPayload = create.respond.mock.calls[0]?.[1] as {
        record: { requestId: string; status: string; rolloutControlId: string | null };
      };
      expect(createPayload.record.status).toBe("submitted");
      expect(createPayload.record.rolloutControlId).toBeNull();

      const list = createOptions("governance.promotionRequest.list");
      await sanjinHandlers["governance.promotionRequest.list"](list);
      const listPayload = list.respond.mock.calls[0]?.[1] as {
        records: Array<{ requestId: string }>;
      };
      expect(listPayload.records).toHaveLength(1);

      const get = createOptions("governance.promotionRequest.get", {
        requestId: createPayload.record.requestId,
      });
      await sanjinHandlers["governance.promotionRequest.get"](get);
      const getPayload = get.respond.mock.calls[0]?.[1] as {
        record: {
          requestId: string;
          evidence: { capabilityId: string | null };
          rolloutControlId: string | null;
          rolloutControlStatus: string | null;
        };
      };
      expect(getPayload.record.requestId).toBe(createPayload.record.requestId);
      expect(getPayload.record.evidence.capabilityId).toBe("draft:workflow:weekly-memory-digest");
      expect(getPayload.record.rolloutControlId).toBeNull();
      expect(getPayload.record.rolloutControlStatus).toBeNull();
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects malformed tenant promotion requests that do not include abstracted evidence locators", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      const create = createOptions("governance.promotionRequest.create", {
        actorRole: "tenant_operator",
        requestReason: "This should fail.",
        evidence: {
          evidenceKind: "execution_evidence",
          title: "No locator",
          detail: "Missing source refs and candidate locators.",
          sourceRefs: [],
        },
      });
      await sanjinHandlers["governance.promotionRequest.create"](create);
      expect(create.respond).toHaveBeenCalledWith(
        false,
        undefined,
        expect.objectContaining({
          code: ErrorCodes.INVALID_REQUEST,
        }),
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("intakes submitted tenant promotion requests into brain-side review", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      const create = createOptions("governance.promotionRequest.create", {
        actorRole: "tenant_operator",
        requestReason: "Repeated structural evidence is ready for governed review.",
        evidence: {
          evidenceKind: "capability_candidate",
          title: "Weekly Memory Digest candidate shows repeatable structure",
          detail: "The candidate survived repeated runs without tenant-specific payload.",
          sourceRefs: ["/tmp/sanjin/eval/artifacts/evidence.json"],
          capabilityId: "draft:workflow:weekly-memory-digest",
          sessionKey: "shell-session-1",
        },
      });
      await sanjinHandlers["governance.promotionRequest.create"](create);
      const createPayload = create.respond.mock.calls[0]?.[1] as {
        record: { requestId: string };
      };

      const intake = createOptions(
        "governance.execute",
        {
          actionLabel: "intake_promotion_request",
          targetId: createPayload.record.requestId,
          targetType: "promotion_request",
          actorRole: "brain_owner",
        },
        {
          connId: "brain-owner-conn",
          connect: {
            role: "brain_owner",
            scopes: ["governance:write"],
            client: { id: "brain-owner-client" },
          },
        } as unknown as GatewayRequestHandlerOptions["client"],
      );
      await sanjinHandlers["governance.execute"](intake);
      const intakePayload = intake.respond.mock.calls[0]?.[1] as {
        workflowStatus: string;
        payload: {
          updated_request_record: {
            status: string;
            reviewId: string | null;
            reviewQueueId: string | null;
          };
        };
      };
      expect(intakePayload.workflowStatus).toBe("succeeded");
      expect(intakePayload.payload.updated_request_record.status).toBe("under_review");
      expect(intakePayload.payload.updated_request_record.reviewId).toBeTruthy();
      expect(intakePayload.payload.updated_request_record.reviewQueueId).toBeTruthy();

      const get = createOptions("governance.promotionRequest.get", {
        requestId: createPayload.record.requestId,
      });
      await sanjinHandlers["governance.promotionRequest.get"](get);
      const getPayload = get.respond.mock.calls[0]?.[1] as {
        record: {
          status: string;
          reviewId: string | null;
          reviewQueueId: string | null;
          lastGovernanceTransitionAt: string | null;
        };
      };
      expect(getPayload.record.status).toBe("under_review");
      expect(getPayload.record.reviewId).toBeTruthy();
      expect(getPayload.record.reviewQueueId).toBeTruthy();
      expect(getPayload.record.lastGovernanceTransitionAt).toBeTruthy();
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("admits request-origin reviews into the limited rollout gate", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    try {
      const create = createOptions("governance.promotionRequest.create", {
        actorRole: "tenant_operator",
        requestReason: "Repeated structural evidence is ready for governed review.",
        evidence: {
          evidenceKind: "capability_candidate",
          title: "Weekly Memory Digest candidate shows repeatable structure",
          detail: "The candidate survived repeated runs without tenant-specific payload.",
          sourceRefs: ["/tmp/sanjin/eval/artifacts/evidence.json"],
          capabilityId: "draft:workflow:weekly-memory-digest",
          sessionKey: "shell-session-1",
        },
      });
      await sanjinHandlers["governance.promotionRequest.create"](create);
      const requestId = (create.respond.mock.calls[0]?.[1] as { record: { requestId: string } }).record.requestId;

      const intake = createOptions(
        "governance.execute",
        {
          actionLabel: "intake_promotion_request",
          targetId: requestId,
          targetType: "promotion_request",
          actorRole: "brain_owner",
        },
        {
          connId: "brain-owner-conn",
          connect: {
            role: "brain_owner",
            scopes: ["governance:write"],
            client: { id: "brain-owner-client" },
          },
        } as unknown as GatewayRequestHandlerOptions["client"],
      );
      await sanjinHandlers["governance.execute"](intake);

      const admit = createOptions(
        "governance.execute",
        {
          actionLabel: "admit_promotion_request_review_to_gate",
          targetId: requestId,
          targetType: "promotion_request",
          actorRole: "brain_owner",
        },
        {
          connId: "brain-owner-conn",
          connect: {
            role: "brain_owner",
            scopes: ["governance:write"],
            client: { id: "brain-owner-client" },
          },
        } as unknown as GatewayRequestHandlerOptions["client"],
      );
      await sanjinHandlers["governance.execute"](admit);
      const admitPayload = admit.respond.mock.calls[0]?.[1] as {
        workflowStatus: string;
        payload: {
          updated_request_record: {
            status: string;
            governanceQueueId: string | null;
            governanceQueueStatus: string | null;
            gateId: string | null;
            gateStatus: string | null;
            reviewStatus: string | null;
          };
        };
      };
      expect(admitPayload.workflowStatus).toBe("succeeded");
      expect(admitPayload.payload.updated_request_record.status).toBe("admitted_to_gate");
      expect(admitPayload.payload.updated_request_record.governanceQueueId).toBeTruthy();
      expect(admitPayload.payload.updated_request_record.gateId).toBeTruthy();
      expect(admitPayload.payload.updated_request_record.gateStatus).toBe("pending_approval");
      expect(admitPayload.payload.updated_request_record.reviewStatus).toBe("admitted_to_gate");
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("bridges request-origin rollout control visibility after gate and shadow follow-through", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    const brainOwnerClient = {
      connId: "brain-owner-conn",
      connect: {
        role: "brain_owner",
        scopes: ["governance:write"],
        client: { id: "brain-owner-client" },
      },
    } as unknown as GatewayRequestHandlerOptions["client"];

    try {
      const create = createOptions("governance.promotionRequest.create", {
        actorRole: "tenant_operator",
        requestReason: "Repeated structural evidence is ready for governed review.",
        evidence: {
          evidenceKind: "capability_candidate",
          title: "Weekly Memory Digest candidate shows repeatable structure",
          detail: "The candidate survived repeated runs without tenant-specific payload.",
          sourceRefs: ["/tmp/sanjin/eval/artifacts/evidence.json"],
          capabilityId: "draft:workflow:weekly-memory-digest",
          sessionKey: "shell-session-1",
        },
      });
      await sanjinHandlers["governance.promotionRequest.create"](create);
      const requestId = (create.respond.mock.calls[0]?.[1] as { record: { requestId: string } }).record.requestId;

      const intake = createOptions(
        "governance.execute",
        {
          actionLabel: "intake_promotion_request",
          targetId: requestId,
          targetType: "promotion_request",
          actorRole: "brain_owner",
        },
        brainOwnerClient,
      );
      await sanjinHandlers["governance.execute"](intake);

      const admit = createOptions(
        "governance.execute",
        {
          actionLabel: "admit_promotion_request_review_to_gate",
          targetId: requestId,
          targetType: "promotion_request",
          actorRole: "brain_owner",
        },
        brainOwnerClient,
      );
      await sanjinHandlers["governance.execute"](admit);
      const gateId = (admit.respond.mock.calls[0]?.[1] as {
        gateId: string | null;
      }).gateId;
      expect(gateId).toBeTruthy();

      const approve = createOptions(
        "governance.execute",
        {
          actionLabel: "approve_gate",
          targetId: gateId ?? "",
          targetType: "gate",
          actorRole: "brain_owner",
          metadata: { requestId },
        },
        brainOwnerClient,
      );
      await sanjinHandlers["governance.execute"](approve);
      const approvePayload = approve.respond.mock.calls[0]?.[1] as {
        payload: {
          updated_request_record: {
            rolloutControlId: string | null;
            rolloutControlStatus: string | null;
            rolloutControlSource: string | null;
          };
        };
      };
      expect(approvePayload.payload.updated_request_record.rolloutControlId).toBe(`rollout-control:${gateId}`);
      expect(approvePayload.payload.updated_request_record.rolloutControlStatus).toBe("active");
      expect(approvePayload.payload.updated_request_record.rolloutControlSource).toBe("governance_gate");

      const openShadow = createOptions(
        "governance.execute",
        {
          actionLabel: "open_shadow",
          targetId: gateId ?? "",
          targetType: "gate",
          actorRole: "brain_owner",
          metadata: { requestId },
        },
        brainOwnerClient,
      );
      await sanjinHandlers["governance.execute"](openShadow);
      const shadowId = (openShadow.respond.mock.calls[0]?.[1] as {
        shadowId: string | null;
      }).shadowId;
      expect(shadowId).toBeTruthy();

      const shadowPass = createOptions(
        "governance.execute",
        {
          actionLabel: "submit_shadow_pass",
          targetId: shadowId ?? "",
          targetType: "shadow",
          actorRole: "brain_owner",
          metadata: {
            requestId,
            gateId,
          },
          shadowPayload: {
            observed_success_rate: 0.95,
            observed_risk_rate: 0.05,
          },
        },
        brainOwnerClient,
      );
      await sanjinHandlers["governance.execute"](shadowPass);

      const get = createOptions("governance.promotionRequest.get", { requestId });
      await sanjinHandlers["governance.promotionRequest.get"](get);
      const getPayload = get.respond.mock.calls[0]?.[1] as {
        record: {
          status: string;
          rolloutControlId: string | null;
          rolloutControlStatus: string | null;
          rolloutControlSource: string | null;
          rolloutContextKeys: string[];
          rolloutPreferredRoles: string[];
          rolloutControlSummary: string | null;
        };
      };
      expect(getPayload.record.status).toBe("rolled_out");
      expect(getPayload.record.rolloutControlId).toBe(`rollout-control:${gateId}`);
      expect(getPayload.record.rolloutControlStatus).toBe("active");
      expect(getPayload.record.rolloutControlSource).toBe("governance_gate");
      expect(getPayload.record.rolloutContextKeys).toHaveLength(1);
      expect(getPayload.record.rolloutContextKeys[0]).toContain("promotion-request:");
      expect(getPayload.record.rolloutPreferredRoles).toEqual(["primary"]);
      expect(getPayload.record.rolloutControlSummary).toContain(`bridged_from_gate=${gateId}`);
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("exposes governance console, gate detail, and audit trail only to brain owners", async () => {
    const { rootDir, workspaceDir } = await createSanjinFixture();
    process.env.OPENCLAW_WORKSPACE_DIR = workspaceDir;

    const brainOwnerClient = {
      connId: "brain-owner-conn",
      connect: {
        role: "brain_owner",
        scopes: ["governance:write"],
        client: { id: "brain-owner-client" },
      },
    } as unknown as GatewayRequestHandlerOptions["client"];

    try {
      const create = createOptions("governance.promotionRequest.create", {
        actorRole: "tenant_operator",
        requestReason: "Repeated structural evidence is ready for governed review.",
        evidence: {
          evidenceKind: "capability_candidate",
          title: "Weekly Memory Digest candidate shows repeatable structure",
          detail: "The candidate survived repeated runs without tenant-specific payload.",
          sourceRefs: ["/tmp/sanjin/eval/artifacts/evidence.json"],
          capabilityId: "draft:workflow:weekly-memory-digest",
          sessionKey: "shell-session-1",
        },
      });
      await sanjinHandlers["governance.promotionRequest.create"](create);
      const requestId = (create.respond.mock.calls[0]?.[1] as { record: { requestId: string } }).record.requestId;

      for (const [actionLabel, targetType] of [
        ["intake_promotion_request", "promotion_request"],
        ["admit_promotion_request_review_to_gate", "promotion_request"],
      ] as const) {
        const req = createOptions(
          "governance.execute",
          {
            actionLabel,
            targetId: requestId,
            targetType,
            actorRole: "brain_owner",
          },
          brainOwnerClient,
        );
        await sanjinHandlers["governance.execute"](req);
      }
      const getRequest = createOptions("governance.promotionRequest.get", { requestId });
      await sanjinHandlers["governance.promotionRequest.get"](getRequest);
      const requestPayload = getRequest.respond.mock.calls[0]?.[1] as {
        record: { gateId: string | null };
      };
      const resolvedGateId = requestPayload.record.gateId;
      expect(resolvedGateId).toBeTruthy();

      const approve = createOptions(
        "governance.execute",
        {
          actionLabel: "approve_gate",
          targetId: resolvedGateId ?? "",
          targetType: "gate",
          actorRole: "brain_owner",
          metadata: { requestId },
        },
        brainOwnerClient,
      );
      await sanjinHandlers["governance.execute"](approve);

      const consoleList = createOptions("governance.console.list", {}, brainOwnerClient);
      await sanjinHandlers["governance.console.list"](consoleList);
      expect(consoleList.respond.mock.calls[0]?.[0]).toBe(true);

      const unauthorized = createOptions("governance.console.list");
      await sanjinHandlers["governance.console.list"](unauthorized);
      expect(unauthorized.respond.mock.calls[0]?.[0]).toBe(false);
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});
