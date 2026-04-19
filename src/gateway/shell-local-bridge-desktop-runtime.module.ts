import type { DesktopLocalBridgeProviderFactory } from "./shell-local-bridge-desktop-provider-registry.js";
import {
  reportDesktopShellAppRuntimeHealthHeartbeatStub,
  startDesktopShellAppRuntimeStub,
  type DesktopShellAppRuntimeHealthHeartbeatResult,
  type DesktopShellAppRuntimeStartupOptions,
  type DesktopShellAppRuntimeStartupResult,
} from "./shell-local-bridge-desktop-app-runtime.stub.js";
import { resolveShellLocalBridgeHealthFeedPollingDecision } from "./shell-app-contract.js";
import {
  summarizeLocalBridgeHealthFeed,
  updateLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";

export type DesktopShellRuntimeModuleOptions =
  DesktopShellAppRuntimeStartupOptions & {
    runtimeLabel?: string;
    providerFactory?: DesktopLocalBridgeProviderFactory | null;
  };

export type DesktopShellRuntimeModuleResult =
  DesktopShellAppRuntimeStartupResult & {
    runtimeLabel: string;
    runtimeSummary: string;
  };

export type DesktopShellRuntimeModuleHealthReportResult =
  DesktopShellAppRuntimeHealthHeartbeatResult & {
    runtimeLabel: string;
    runtimeSummary: string;
  };

export type DesktopShellRuntimeModulePollResult = {
  runtimeLabel: string;
  runtimeSummary: string;
  healthFeed: ReturnType<typeof summarizeLocalBridgeHealthFeed>;
};

export type DesktopShellRuntimeModuleHeartbeatCycleResult = {
  runtimeLabel: string;
  runtimeSummary: string;
  healthFeed: ReturnType<typeof summarizeLocalBridgeHealthFeed>;
  pollingDecision: ReturnType<typeof resolveShellLocalBridgeHealthFeedPollingDecision>;
  heartbeat:
    | DesktopShellRuntimeModuleHealthReportResult
    | null;
};

export function summarizeDesktopShellRuntimeModule(params: {
  runtimeLabel: string;
  startup: Pick<DesktopShellAppRuntimeStartupResult, "mode" | "attached" | "providerKey">;
}): string {
  const providerLabel = params.startup.providerKey
    ? `provider ${params.startup.providerKey}`
    : "no provider key";
  return `${params.runtimeLabel} started ${params.startup.mode} bridge runtime (${params.startup.attached ? "attached" : "not attached"}) using ${providerLabel}.`;
}

export function startDesktopShellRuntimeModule(
  options: DesktopShellRuntimeModuleOptions = {},
): DesktopShellRuntimeModuleResult {
  const runtimeLabel = options.runtimeLabel?.trim() || "Desktop Runtime Integration";
  const startup = startDesktopShellAppRuntimeStub(options);
  const runtimeSummary = summarizeDesktopShellRuntimeModule({
    runtimeLabel,
    startup,
  });
  updateLocalBridgeStartupPosture({
    runtimeLabel,
    runtimeSummary,
  });
  return {
    ...startup,
    runtimeLabel,
    runtimeSummary,
  };
}

export function reportDesktopShellRuntimeModuleHealth(options: {
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
} = {}): DesktopShellRuntimeModuleHealthReportResult {
  const runtimeLabel = options.runtimeLabel?.trim() || "Desktop Runtime Integration";
  const heartbeat = reportDesktopShellAppRuntimeHealthHeartbeatStub(options);
  const runtimeSummary = `${runtimeLabel} reported ${heartbeat.healthStatusLabel}.`;
  updateLocalBridgeStartupPosture({
    runtimeLabel,
    runtimeSummary,
  });
  return {
    ...heartbeat,
    runtimeLabel,
    runtimeSummary,
  };
}

export function pollDesktopShellRuntimeModuleHealthFeed(options: {
  runtimeLabel?: string;
  now?: number;
} = {}): DesktopShellRuntimeModulePollResult {
  const runtimeLabel = options.runtimeLabel?.trim() || "Desktop Runtime Integration";
  const healthFeed = summarizeLocalBridgeHealthFeed(options.now);
  const pollingDecision = resolveShellLocalBridgeHealthFeedPollingDecision(healthFeed);
  const runtimeSummary =
    healthFeed.eventCount <= 0
      ? `${runtimeLabel} is waiting for the first desktop health heartbeat.`
      : `${runtimeLabel} observed ${healthFeed.stalenessStatusLabel} (${pollingDecision.cadenceSummary}).`;
  updateLocalBridgeStartupPosture({
    runtimeLabel,
    runtimeSummary,
  });
  return {
    runtimeLabel,
    runtimeSummary,
    healthFeed,
  };
}

export function runDesktopShellRuntimeModuleHeartbeatCycle(options: {
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
} = {}): DesktopShellRuntimeModuleHeartbeatCycleResult {
  const heartbeat =
    options.adapterReadiness || options.attached !== undefined || options.shellAppLabel
      ? reportDesktopShellRuntimeModuleHealth({
        runtimeLabel: options.runtimeLabel,
        shellAppLabel: options.shellAppLabel,
        attached: options.attached,
        adapterReadiness: options.adapterReadiness,
      })
      : null;
  const poll = pollDesktopShellRuntimeModuleHealthFeed({
    runtimeLabel: options.runtimeLabel ?? heartbeat?.runtimeLabel,
    now: options.now,
  });
  return {
    runtimeLabel: poll.runtimeLabel,
    runtimeSummary: poll.runtimeSummary,
    healthFeed: poll.healthFeed,
    pollingDecision: resolveShellLocalBridgeHealthFeedPollingDecision(poll.healthFeed),
    heartbeat,
  };
}
