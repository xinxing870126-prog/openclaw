import { spawn } from "node:child_process";
import process from "node:process";
import { triggerOpenClawRestart } from "../infra/restart.js";
import { detectRespawnSupervisor } from "../infra/supervisor-markers.js";
import { normalizeOptionalLowercaseString } from "../shared/string-coerce.js";

export type WindowsCompanionRecoveryState =
  | "idle"
  | "relaunching"
  | "headless_fallback"
  | "supervisor_handoff";

export type WindowsCompanionRecoveryReason =
  | "tray_adapter_failed"
  | "host_runtime_failed"
  | "singleton_conflict_recovered";

export type WindowsCompanionRecoveryResult = {
  handled: boolean;
  state: WindowsCompanionRecoveryState;
  attemptCount: number;
  detail?: string;
  pid?: number;
};

export type WindowsCompanionRecoveryPolicy = {
  supervisor: "schtasks" | null;
  localRelaunchAllowed: boolean;
  maxLocalRelaunchAttempts: number;
  maxTrayRebuildAttempts: number;
  recoveryAttemptCount: number;
};

const WINDOWS_COMPANION_RECOVERY_ATTEMPT_ENV = "OPENCLAW_WINDOWS_COMPANION_RECOVERY_ATTEMPT";
const WINDOWS_COMPANION_RECOVERY_DELAY_ENV = "OPENCLAW_WINDOWS_COMPANION_RECOVERY_DELAY_MS";
const DEFAULT_RECOVERY_DELAY_MS = 750;

function parsePositiveInteger(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isTruthy(value: string | undefined): boolean {
  const normalized = normalizeOptionalLowercaseString(value);
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function resolveWindowsCompanionRecoveryPolicy(params: {
  env?: NodeJS.ProcessEnv;
  mode: "interactive" | "headless";
}): WindowsCompanionRecoveryPolicy {
  const env = params.env ?? process.env;
  const supervisor = detectRespawnSupervisor(env, process.platform) === "schtasks" ? "schtasks" : null;
  const recoveryAttemptCount = parsePositiveInteger(env[WINDOWS_COMPANION_RECOVERY_ATTEMPT_ENV]);
  return {
    supervisor,
    localRelaunchAllowed: !isTruthy(env.OPENCLAW_NO_RESPAWN),
    maxLocalRelaunchAttempts: 1,
    maxTrayRebuildAttempts: 2,
    recoveryAttemptCount,
  };
}

export function restartWindowsCompanionProcessWithFreshPid(params: {
  env?: NodeJS.ProcessEnv;
  mode: "interactive" | "headless";
  reason: WindowsCompanionRecoveryReason;
  policy?: WindowsCompanionRecoveryPolicy;
}): WindowsCompanionRecoveryResult {
  const env = params.env ?? process.env;
  const policy = params.policy ?? resolveWindowsCompanionRecoveryPolicy({
    env,
    mode: params.mode,
  });

  if (policy.supervisor === "schtasks") {
    const restart = triggerOpenClawRestart();
    if (!restart.ok) {
      return {
        handled: false,
        state: "idle",
        attemptCount: policy.recoveryAttemptCount,
        detail: restart.detail ?? `${restart.method} restart failed`,
      };
    }
    return {
      handled: true,
      state: "supervisor_handoff",
      attemptCount: policy.recoveryAttemptCount,
      detail: restart.detail ?? "handed off to scheduled task supervisor",
    };
  }

  if (!policy.localRelaunchAllowed) {
    return {
      handled: false,
      state: "idle",
      attemptCount: policy.recoveryAttemptCount,
      detail: "OPENCLAW_NO_RESPAWN",
    };
  }

  if (policy.recoveryAttemptCount >= policy.maxLocalRelaunchAttempts) {
    return {
      handled: false,
      state: "idle",
      attemptCount: policy.recoveryAttemptCount,
      detail: "relaunch limit reached",
    };
  }

  try {
    const args = [...process.execArgv, ...process.argv.slice(1)];
    const nextEnv: NodeJS.ProcessEnv = {
      ...env,
      [WINDOWS_COMPANION_RECOVERY_ATTEMPT_ENV]: String(policy.recoveryAttemptCount + 1),
      [WINDOWS_COMPANION_RECOVERY_DELAY_ENV]: String(DEFAULT_RECOVERY_DELAY_MS),
      OPENCLAW_WINDOWS_COMPANION_LAST_RECOVERY_REASON: params.reason,
    };
    const child = spawn(process.execPath, args, {
      env: nextEnv,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    return {
      handled: true,
      state: "relaunching",
      attemptCount: policy.recoveryAttemptCount + 1,
      pid: child.pid ?? undefined,
      detail: params.reason,
    };
  } catch (error) {
    return {
      handled: false,
      state: "idle",
      attemptCount: policy.recoveryAttemptCount,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export function resolveWindowsCompanionRecoveryDelayMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return parsePositiveInteger(env[WINDOWS_COMPANION_RECOVERY_DELAY_ENV]);
}
