import {
  WINDOWS_COMPANION_SERVICE_KIND,
  WINDOWS_COMPANION_SERVICE_MARKER,
  WINDOWS_COMPANION_WINDOWS_TASK_SCRIPT_NAME,
  resolveWindowsCompanionWindowsTaskName,
} from "../daemon/constants.js";
import type { GatewayService, GatewayServiceInstallArgs } from "../daemon/service.js";
import { resolveGatewayService } from "../daemon/service.js";

function withWindowsCompanionServiceEnv(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return {
    ...env,
    OPENCLAW_WINDOWS_TASK_NAME: resolveWindowsCompanionWindowsTaskName(env.OPENCLAW_PROFILE),
    OPENCLAW_TASK_SCRIPT_NAME: WINDOWS_COMPANION_WINDOWS_TASK_SCRIPT_NAME,
    OPENCLAW_LOG_PREFIX: "windows-companion",
    OPENCLAW_SERVICE_MARKER: WINDOWS_COMPANION_SERVICE_MARKER,
    OPENCLAW_SERVICE_KIND: WINDOWS_COMPANION_SERVICE_KIND,
  };
}

function withWindowsCompanionInstallEnv(
  args: GatewayServiceInstallArgs,
): GatewayServiceInstallArgs {
  return {
    ...args,
    env: withWindowsCompanionServiceEnv(args.env),
    environment: {
      ...args.environment,
      OPENCLAW_WINDOWS_TASK_NAME: resolveWindowsCompanionWindowsTaskName(args.env.OPENCLAW_PROFILE),
      OPENCLAW_TASK_SCRIPT_NAME: WINDOWS_COMPANION_WINDOWS_TASK_SCRIPT_NAME,
      OPENCLAW_LOG_PREFIX: "windows-companion",
      OPENCLAW_SERVICE_MARKER: WINDOWS_COMPANION_SERVICE_MARKER,
      OPENCLAW_SERVICE_KIND: WINDOWS_COMPANION_SERVICE_KIND,
    },
  };
}

export function resolveWindowsCompanionService(): GatewayService {
  const base = resolveGatewayService();
  return {
    ...base,
    stage: async (args) => {
      return base.stage(withWindowsCompanionInstallEnv(args));
    },
    install: async (args) => {
      return base.install(withWindowsCompanionInstallEnv(args));
    },
    uninstall: async (args) => {
      return base.uninstall({ ...args, env: withWindowsCompanionServiceEnv(args.env) });
    },
    stop: async (args) => {
      return base.stop({ ...args, env: withWindowsCompanionServiceEnv(args.env ?? {}) });
    },
    restart: async (args) => {
      return base.restart({ ...args, env: withWindowsCompanionServiceEnv(args.env ?? {}) });
    },
    isLoaded: async (args) => {
      return base.isLoaded({ env: withWindowsCompanionServiceEnv(args.env ?? {}) });
    },
    readCommand: (env) => base.readCommand(withWindowsCompanionServiceEnv(env)),
    readRuntime: (env) => base.readRuntime(withWindowsCompanionServiceEnv(env)),
  };
}
