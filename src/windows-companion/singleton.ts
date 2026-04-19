import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { resolveStateDir } from "../config/paths.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";

export type WindowsCompanionSingletonMode = "interactive" | "headless";
export type WindowsCompanionSingletonNotificationKind =
  | "healthy"
  | "degraded"
  | "repair_needed"
  | "action_required";
export type WindowsCompanionSingletonHealthState = "healthy" | "degraded" | "repair_needed";
export type WindowsCompanionSingletonRecoveryState =
  | "idle"
  | "relaunching"
  | "headless_fallback"
  | "supervisor_handoff";
export type WindowsCompanionSingletonRecoveryReason =
  | "tray_adapter_failed"
  | "host_runtime_failed"
  | "singleton_conflict_recovered";

export type WindowsCompanionSingletonState = {
  filePath: string;
  active: boolean;
  ownerId: string | null;
  pid: number | null;
  mode: WindowsCompanionSingletonMode | null;
  profile: string | null;
  acquiredAt: string | null;
  updatedAt: string | null;
  trayHealthState?: WindowsCompanionSingletonHealthState | null;
  statusLine?: string | null;
  lastNotificationKind?: WindowsCompanionSingletonNotificationKind | null;
  lastNotificationAt?: string | null;
  recoveryState?: WindowsCompanionSingletonRecoveryState | null;
  lastRecoveryReason?: WindowsCompanionSingletonRecoveryReason | null;
  lastRecoveryAt?: string | null;
  recoveryAttemptCount?: number | null;
  currentDashboardTarget?: string | null;
  lastDashboardTarget?: string | null;
  currentPendingActionId?: string | null;
  currentResolvedActionId?: string | null;
  lastResolvedActionOutcome?: "completed" | "rejected" | null;
  lastDashboardTargetActionId?: string | null;
  lastDashboardTargetResultActionId?: string | null;
  lastAttentionTargetReason?: "action_required" | "degraded" | "repair_needed" | null;
};

type WindowsCompanionSingletonRecord = Omit<WindowsCompanionSingletonState, "filePath">;

export type WindowsCompanionSingletonHandle = {
  filePath: string;
  ownerId: string;
  release: () => Promise<void>;
  update: (
    patch: Partial<
      Pick<
        WindowsCompanionSingletonState,
        "trayHealthState" | "statusLine" | "lastNotificationKind" | "lastNotificationAt"
        | "recoveryState" | "lastRecoveryReason" | "lastRecoveryAt" | "recoveryAttemptCount"
        | "currentDashboardTarget" | "lastDashboardTarget" | "currentPendingActionId"
        | "currentResolvedActionId" | "lastResolvedActionOutcome"
        | "lastDashboardTargetActionId" | "lastDashboardTargetResultActionId" | "lastAttentionTargetReason"
      >
    >,
  ) => Promise<void>;
};

export type WindowsCompanionSingletonAcquireResult =
  | {
      acquired: true;
      handle: WindowsCompanionSingletonHandle;
      state: WindowsCompanionSingletonState;
    }
  | {
      acquired: false;
      handle: null;
      state: WindowsCompanionSingletonState;
    };

const WINDOWS_COMPANION_SINGLETON_PREFIX = "windows-companion.singleton";

function sanitizeProfileSegment(profile?: string | null): string {
  const normalized = normalizeOptionalString(profile) ?? "default";
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function resolveWindowsCompanionSingletonPath(
  env: NodeJS.ProcessEnv = process.env,
  profile?: string | null,
): string {
  const segment = sanitizeProfileSegment(profile);
  return path.join(resolveStateDir(env), `${WINDOWS_COMPANION_SINGLETON_PREFIX}.${segment}.json`);
}

function buildRecordState(
  record: Partial<WindowsCompanionSingletonRecord> | null | undefined,
  filePath: string,
): WindowsCompanionSingletonState {
  const pid = typeof record?.pid === "number" ? record.pid : null;
  return {
    filePath,
    active: isProcessAlive(pid),
    ownerId: typeof record?.ownerId === "string" ? record.ownerId : null,
    pid,
    mode: record?.mode === "interactive" || record?.mode === "headless" ? record.mode : null,
    profile: normalizeOptionalString(record?.profile) ?? null,
    acquiredAt: typeof record?.acquiredAt === "string" ? record.acquiredAt : null,
    updatedAt: typeof record?.updatedAt === "string" ? record.updatedAt : null,
    trayHealthState:
      record?.trayHealthState === "healthy"
      || record?.trayHealthState === "degraded"
      || record?.trayHealthState === "repair_needed"
        ? record.trayHealthState
        : null,
    statusLine: normalizeOptionalString(record?.statusLine) ?? null,
    lastNotificationKind:
      record?.lastNotificationKind === "healthy"
      || record?.lastNotificationKind === "degraded"
      || record?.lastNotificationKind === "repair_needed"
      || record?.lastNotificationKind === "action_required"
        ? record.lastNotificationKind
        : null,
    lastNotificationAt: typeof record?.lastNotificationAt === "string" ? record.lastNotificationAt : null,
    recoveryState:
      record?.recoveryState === "idle"
      || record?.recoveryState === "relaunching"
      || record?.recoveryState === "headless_fallback"
      || record?.recoveryState === "supervisor_handoff"
        ? record.recoveryState
        : null,
    lastRecoveryReason:
      record?.lastRecoveryReason === "tray_adapter_failed"
      || record?.lastRecoveryReason === "host_runtime_failed"
      || record?.lastRecoveryReason === "singleton_conflict_recovered"
        ? record.lastRecoveryReason
        : null,
    lastRecoveryAt: typeof record?.lastRecoveryAt === "string" ? record.lastRecoveryAt : null,
    recoveryAttemptCount:
      typeof record?.recoveryAttemptCount === "number" && Number.isInteger(record.recoveryAttemptCount)
        ? record.recoveryAttemptCount
        : null,
    currentDashboardTarget: normalizeOptionalString(record?.currentDashboardTarget) ?? null,
    lastDashboardTarget: normalizeOptionalString(record?.lastDashboardTarget) ?? null,
    currentPendingActionId: normalizeOptionalString(record?.currentPendingActionId) ?? null,
    currentResolvedActionId: normalizeOptionalString(record?.currentResolvedActionId) ?? null,
    lastResolvedActionOutcome:
      record?.lastResolvedActionOutcome === "completed" || record?.lastResolvedActionOutcome === "rejected"
        ? record.lastResolvedActionOutcome
        : null,
    lastDashboardTargetActionId: normalizeOptionalString(record?.lastDashboardTargetActionId) ?? null,
    lastDashboardTargetResultActionId: normalizeOptionalString(record?.lastDashboardTargetResultActionId) ?? null,
    lastAttentionTargetReason:
      record?.lastAttentionTargetReason === "action_required"
      || record?.lastAttentionTargetReason === "degraded"
      || record?.lastAttentionTargetReason === "repair_needed"
        ? record.lastAttentionTargetReason
        : null,
  };
}

async function readSingletonRecord(filePath: string): Promise<WindowsCompanionSingletonRecord | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as WindowsCompanionSingletonRecord;
  } catch (error) {
    const errno = error as NodeJS.ErrnoException;
    if (errno?.code === "ENOENT") {
      return null;
    }
    return null;
  }
}

function isProcessAlive(pid: number | null): boolean {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function writeSingletonRecord(
  filePath: string,
  record: WindowsCompanionSingletonRecord,
  mode: "replace" | "create" = "replace",
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: mode === "create" ? "wx" : "w",
  });
}

async function updateOwnedSingletonRecord(params: {
  filePath: string;
  ownerId: string;
  patch: Partial<
    Pick<
      WindowsCompanionSingletonRecord,
      "trayHealthState" | "statusLine" | "lastNotificationKind" | "lastNotificationAt"
      | "recoveryState" | "lastRecoveryReason" | "lastRecoveryAt" | "recoveryAttemptCount"
      | "currentDashboardTarget" | "lastDashboardTarget" | "currentPendingActionId"
      | "currentResolvedActionId" | "lastResolvedActionOutcome"
      | "lastDashboardTargetActionId" | "lastDashboardTargetResultActionId" | "lastAttentionTargetReason"
    >
  >;
  now: string;
}): Promise<void> {
  const current = await readSingletonRecord(params.filePath);
  if (!current || current.ownerId !== params.ownerId) {
    return;
  }
  await writeSingletonRecord(params.filePath, {
    ...current,
    ...params.patch,
    updatedAt: params.now,
  });
}

export async function resolveWindowsCompanionSingletonState(params: {
  env?: NodeJS.ProcessEnv;
  profile?: string | null;
} = {}): Promise<WindowsCompanionSingletonState> {
  const filePath = resolveWindowsCompanionSingletonPath(params.env ?? process.env, params.profile);
  return buildRecordState(await readSingletonRecord(filePath), filePath);
}

export async function acquireWindowsCompanionSingleton(params: {
  env?: NodeJS.ProcessEnv;
  profile?: string | null;
  mode: WindowsCompanionSingletonMode;
  now?: () => string;
}): Promise<WindowsCompanionSingletonAcquireResult> {
  const env = params.env ?? process.env;
  const now = params.now ?? (() => new Date().toISOString());
  const filePath = resolveWindowsCompanionSingletonPath(env, params.profile);
  const ownerId = randomUUID();
  const initialRecord: WindowsCompanionSingletonRecord = {
    ownerId,
    pid: process.pid,
    mode: params.mode,
    profile: normalizeOptionalString(params.profile) ?? null,
    acquiredAt: now(),
    updatedAt: now(),
    trayHealthState: null,
    statusLine: null,
    lastNotificationKind: null,
    lastNotificationAt: null,
    recoveryState: "idle",
    lastRecoveryReason: null,
    lastRecoveryAt: null,
    recoveryAttemptCount: 0,
    currentDashboardTarget: null,
    lastDashboardTarget: null,
    currentPendingActionId: null,
    currentResolvedActionId: null,
    lastResolvedActionOutcome: null,
    lastDashboardTargetActionId: null,
    lastDashboardTargetResultActionId: null,
    lastAttentionTargetReason: null,
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await writeSingletonRecord(filePath, initialRecord, "create");
      const handle: WindowsCompanionSingletonHandle = {
        filePath,
        ownerId,
        release: async () => {
          const current = await readSingletonRecord(filePath);
          if (!current || current.ownerId !== ownerId) {
            return;
          }
          await fs.rm(filePath, { force: true });
        },
        update: async (patch) => {
          await updateOwnedSingletonRecord({
            filePath,
            ownerId,
            patch,
            now: now(),
          });
        },
      };
      return {
        acquired: true,
        handle,
        state: buildRecordState(initialRecord, filePath),
      };
    } catch (error) {
      const errno = error as NodeJS.ErrnoException;
      if (errno?.code !== "EEXIST") {
        throw error;
      }
      const existing = await readSingletonRecord(filePath);
      if (existing && isProcessAlive(existing.pid)) {
        return {
          acquired: false,
          handle: null,
          state: buildRecordState(existing, filePath),
        };
      }
      await fs.rm(filePath, { force: true }).catch(() => undefined);
    }
  }

  return {
    acquired: false,
    handle: null,
    state: await resolveWindowsCompanionSingletonState({
      env,
      profile: params.profile,
    }),
  };
}

export async function releaseWindowsCompanionSingleton(
  handle: WindowsCompanionSingletonHandle | null | undefined,
): Promise<void> {
  if (!handle) {
    return;
  }
  await handle.release();
}
