import type { DesktopLocalBridgeProviderFactory } from "./shell-local-bridge-desktop-provider-registry.js";
import {
  runDesktopShellAppRuntimeHealthHeartbeatCycleStub,
  runDesktopShellAppRuntimeDriverCycleStub,
  runDesktopShellAppRuntimeHostWakeStub,
  runDesktopShellAppRuntimeLifecycleWakeStub,
  runDesktopShellAppRuntimeAppOwnerWakeStub,
  dispatchDesktopShellAppRuntimeNativeProcessEventStub,
  dispatchDesktopShellAppRuntimeProcessEventStub,
  runDesktopShellAppRuntimeShellOwnerWakeStub,
  runDesktopShellAppRuntimeProcessHostWakeStub,
  runDesktopShellAppRuntimeBootstrapWakeStub,
  runDesktopShellAppRuntimeServiceWakeStub,
  runDesktopShellAppRuntimeSchedulerCycleStub,
  runDesktopShellAppRuntimeTimerTickStub,
  runDesktopShellAppRuntimeRunnerTickStub,
  startDesktopShellAppRuntimeStub,
  type DesktopShellAppRuntimeStartupOptions,
  type DesktopShellAppRuntimeDriverCycleResult,
  type DesktopShellAppRuntimeHeartbeatCycleResult,
  type DesktopShellAppRuntimeHostWakeResult,
  type DesktopShellAppRuntimeLifecycleWakeResult,
  type DesktopShellAppRuntimeAppOwnerWakeResult,
  type DesktopShellAppRuntimeNativeProcessEventResult,
  type DesktopShellAppRuntimeProcessEventResult,
  type DesktopShellAppRuntimeShellOwnerWakeResult,
  type DesktopShellAppRuntimeProcessHostWakeResult,
  type DesktopShellAppRuntimeBootstrapWakeResult,
  type DesktopShellAppRuntimeServiceWakeResult,
  type DesktopShellAppRuntimeRunnerTickResult,
  type DesktopShellAppRuntimeSchedulerCycleResult,
  type DesktopShellAppRuntimeTimerTickResult,
  type DesktopShellAppRuntimeStartupResult,
} from "./shell-local-bridge-desktop-app-runtime.stub.js";
import {
  resolveDesktopShellLocalBridgeHealthStatus,
  describeDesktopShellLocalBridgeHealthStatus,
} from "./shell-local-bridge-desktop-startup-wiring.stub.js";
import {
  appendLocalBridgeHealthEvent,
  resolveLocalBridgeStartupPosture,
  setLocalBridgeStartupPosture,
  updateLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";

export type DesktopShellStartupModuleOptions =
  DesktopShellAppRuntimeStartupOptions & {
    moduleLabel?: string;
    providerFactory?: DesktopLocalBridgeProviderFactory | null;
  };

export type DesktopShellStartupModuleResult =
  DesktopShellAppRuntimeStartupResult & {
    moduleLabel: string;
    moduleSummary: string;
    moduleStatus:
      | "registered_pending_attach"
      | "registered_attached"
      | "reused_pending_attach"
      | "reused_attached";
    moduleStatusLabel: string;
  };

export type DesktopShellStartupModuleHeartbeatCycleResult =
  DesktopShellAppRuntimeHeartbeatCycleResult & {
    moduleLabel: string;
    moduleSummary: string | null;
    moduleStatus: DesktopShellStartupModuleResult["moduleStatus"] | null;
    moduleStatusLabel: string | null;
  };

export type DesktopShellStartupModuleSchedulerCycleResult =
  DesktopShellAppRuntimeSchedulerCycleResult & {
    moduleLabel: string;
    moduleSummary: string | null;
    moduleStatus: DesktopShellStartupModuleResult["moduleStatus"] | null;
    moduleStatusLabel: string | null;
  };

export type DesktopShellStartupModuleDriverCycleResult =
  DesktopShellAppRuntimeDriverCycleResult & {
    moduleLabel: string;
    moduleSummary: string | null;
    moduleStatus: DesktopShellStartupModuleResult["moduleStatus"] | null;
    moduleStatusLabel: string | null;
  };

export type DesktopShellStartupModuleTimerTickResult =
  DesktopShellAppRuntimeTimerTickResult & {
    moduleLabel: string;
    moduleSummary: string | null;
    moduleStatus: DesktopShellStartupModuleResult["moduleStatus"] | null;
    moduleStatusLabel: string | null;
  };

export type DesktopShellStartupModuleRunnerTickResult =
  DesktopShellAppRuntimeRunnerTickResult & {
    moduleLabel: string;
    moduleSummary: string | null;
    moduleStatus: DesktopShellStartupModuleResult["moduleStatus"] | null;
    moduleStatusLabel: string | null;
  };

export type DesktopShellStartupModuleHostWakeResult =
  DesktopShellAppRuntimeHostWakeResult & {
    moduleLabel: string;
    moduleSummary: string | null;
    moduleStatus: DesktopShellStartupModuleResult["moduleStatus"] | null;
    moduleStatusLabel: string | null;
  };

export type DesktopShellStartupModuleServiceWakeResult =
  DesktopShellAppRuntimeServiceWakeResult & {
    moduleLabel: string;
    moduleSummary: string | null;
    moduleStatus: DesktopShellStartupModuleResult["moduleStatus"] | null;
    moduleStatusLabel: string | null;
  };

export type DesktopShellStartupModuleLifecycleWakeResult =
  DesktopShellAppRuntimeLifecycleWakeResult & {
    moduleLabel: string;
    moduleSummary: string | null;
    moduleStatus: DesktopShellStartupModuleResult["moduleStatus"] | null;
    moduleStatusLabel: string | null;
  };

export type DesktopShellStartupModuleBootstrapWakeResult =
  DesktopShellAppRuntimeBootstrapWakeResult & {
    moduleLabel: string;
    moduleSummary: string | null;
    moduleStatus: DesktopShellStartupModuleResult["moduleStatus"] | null;
    moduleStatusLabel: string | null;
  };

export type DesktopShellStartupModuleAppOwnerWakeResult =
  DesktopShellAppRuntimeAppOwnerWakeResult & {
    moduleLabel: string;
    moduleSummary: string | null;
    moduleStatus: DesktopShellStartupModuleResult["moduleStatus"] | null;
    moduleStatusLabel: string | null;
  };

export type DesktopShellStartupModuleShellOwnerWakeResult =
  DesktopShellAppRuntimeShellOwnerWakeResult & {
    moduleLabel: string;
    moduleSummary: string | null;
    moduleStatus: DesktopShellStartupModuleResult["moduleStatus"] | null;
    moduleStatusLabel: string | null;
  };

export type DesktopShellStartupModuleProcessHostWakeResult =
  DesktopShellAppRuntimeProcessHostWakeResult & {
    moduleLabel: string;
    moduleSummary: string | null;
    moduleStatus: DesktopShellStartupModuleResult["moduleStatus"] | null;
    moduleStatusLabel: string | null;
  };

export function resolveDesktopShellStartupModuleStatus(params: {
  providerRegistered: boolean;
  attached: boolean;
}): DesktopShellStartupModuleResult["moduleStatus"] {
  if (params.providerRegistered) {
    return params.attached ? "registered_attached" : "registered_pending_attach";
  }
  return params.attached ? "reused_attached" : "reused_pending_attach";
}

export function describeDesktopShellStartupModuleStatus(
  status: DesktopShellStartupModuleResult["moduleStatus"],
): string {
  switch (status) {
    case "registered_attached":
      return "module registered / attached";
    case "registered_pending_attach":
      return "module registered / pending attach";
    case "reused_attached":
      return "module reused / attached";
    case "reused_pending_attach":
      return "module reused / pending attach";
  }
}

export function summarizeDesktopShellStartupModule(params: {
  moduleLabel: string;
  shellAppLabel: string;
  startup: Pick<
    DesktopShellAppRuntimeStartupResult,
    "mode" | "attached" | "providerRegistered" | "providerKey"
  >;
}): string {
  const providerLabel = params.startup.providerKey
    ? `provider ${params.startup.providerKey}`
    : "no provider key";

  if (params.startup.providerRegistered) {
    return `${params.moduleLabel} registered ${providerLabel} for ${params.shellAppLabel} and started ${params.startup.mode} bridge startup (${params.startup.attached ? "attached" : "not attached"}).`;
  }

  return `${params.moduleLabel} reused ${providerLabel} for ${params.shellAppLabel} and started ${params.startup.mode} bridge startup (${params.startup.attached ? "attached" : "not attached"}).`;
}

export function startDesktopShellStartupModuleStub(
  options: DesktopShellStartupModuleOptions = {},
): DesktopShellStartupModuleResult {
  const shellAppLabel = options.shellAppLabel?.trim() || "OpenClaw Desktop";
  const moduleLabel = options.moduleLabel?.trim() || "Desktop Shell Startup Module";
  const startup = startDesktopShellAppRuntimeStub({
    ...options,
    shellAppLabel,
  });
  const moduleStatus = resolveDesktopShellStartupModuleStatus({
    providerRegistered: startup.providerRegistered,
    attached: startup.attached,
  });
  const moduleSummary = summarizeDesktopShellStartupModule({
    moduleLabel,
    shellAppLabel,
    startup,
  });

  setLocalBridgeStartupPosture({
    mode: startup.mode,
    attached: startup.attached,
    adapterReadiness: startup.adapterReadiness,
    healthSource: "startup_posture",
    healthStatus: startup.healthStatus,
    healthStatusLabel: startup.healthStatusLabel,
    healthEventSummary: null,
    startupModeLabel: startup.startupModeLabel,
    startupSummary: startup.startupSummary,
    startupSource: "desktop_startup_wiring",
    providerStatus: startup.providerStatus,
    providerStatusLabel: startup.providerStatusLabel,
    shellAppLabel,
    moduleLabel,
    moduleSummary,
    moduleStatus,
    moduleStatusLabel: describeDesktopShellStartupModuleStatus(moduleStatus),
    providerKey: startup.providerKey,
  });
  appendLocalBridgeHealthEvent({
    occurredAt: new Date().toISOString(),
    source: "startup_posture",
    healthStatus: startup.healthStatus,
    healthStatusLabel: startup.healthStatusLabel,
    summary: moduleSummary,
    shellAppLabel,
    moduleLabel,
    providerKey: startup.providerKey,
  });

  return {
    ...startup,
    shellAppLabel,
    moduleLabel,
    moduleSummary,
    moduleStatus,
    moduleStatusLabel: describeDesktopShellStartupModuleStatus(moduleStatus),
  };
}

export function reportDesktopShellStartupModuleHealth(params: {
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
}): void {
  const current = resolveLocalBridgeStartupPosture();
  if (!current || current.startupSource !== "desktop_startup_wiring") {
    throw new Error("desktop shell startup module health update requires startup wiring posture");
  }
  const attached = params.attached ?? current.attached;
  const adapterReadiness = params.adapterReadiness ?? current.adapterReadiness;
  const healthStatus = resolveDesktopShellLocalBridgeHealthStatus({
    mode: current.mode,
    attached,
    adapterReadiness,
  });
  const subjectLabel = current.moduleLabel ?? current.shellAppLabel ?? "Desktop shell startup";
  updateLocalBridgeStartupPosture({
    attached,
    adapterReadiness,
    healthSource: "runtime_heartbeat",
    healthStatus,
    healthStatusLabel: describeDesktopShellLocalBridgeHealthStatus(healthStatus),
    healthEventSummary: `${subjectLabel} reported ${describeDesktopShellLocalBridgeHealthStatus(healthStatus)} through runtime health heartbeat.`,
  });
  appendLocalBridgeHealthEvent({
    occurredAt: new Date().toISOString(),
    source: "runtime_heartbeat",
    healthStatus,
    healthStatusLabel: describeDesktopShellLocalBridgeHealthStatus(healthStatus),
    summary: `${subjectLabel} reported ${describeDesktopShellLocalBridgeHealthStatus(healthStatus)} through runtime health heartbeat.`,
    shellAppLabel: current.shellAppLabel ?? null,
    moduleLabel: current.moduleLabel ?? null,
    providerKey: current.providerKey ?? null,
  });
}

export function runDesktopShellStartupModuleHeartbeatCycle(params: {
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
}): DesktopShellStartupModuleHeartbeatCycleResult {
  const cycle = runDesktopShellAppRuntimeHealthHeartbeatCycleStub({
    shellAppLabel: params.shellAppLabel,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
  });
  const current = resolveLocalBridgeStartupPosture();
  return {
    ...cycle,
    moduleLabel: current?.moduleLabel ?? "Desktop Shell Startup Module",
    moduleSummary: current?.moduleSummary ?? null,
    moduleStatus: current?.moduleStatus ?? null,
    moduleStatusLabel: current?.moduleStatusLabel ?? null,
  };
}

export function runDesktopShellStartupModuleSchedulerCycle(params: {
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
} = {}): DesktopShellStartupModuleSchedulerCycleResult {
  const cycle = runDesktopShellAppRuntimeSchedulerCycleStub({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel: params.shellAppLabel,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const current = resolveLocalBridgeStartupPosture();
  return {
    ...cycle,
    moduleLabel: current?.moduleLabel ?? "Desktop Shell Startup Module",
    moduleSummary: current?.moduleSummary ?? null,
    moduleStatus: current?.moduleStatus ?? null,
    moduleStatusLabel: current?.moduleStatusLabel ?? null,
  };
}

export function runDesktopShellStartupModuleDriverCycle(params: {
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  lastRunAt?: number | null;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
} = {}): DesktopShellStartupModuleDriverCycleResult {
  const cycle = runDesktopShellAppRuntimeDriverCycleStub({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel: params.shellAppLabel,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    lastRunAt: params.lastRunAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const current = resolveLocalBridgeStartupPosture();
  return {
    ...cycle,
    moduleLabel: current?.moduleLabel ?? "Desktop Shell Startup Module",
    moduleSummary: current?.moduleSummary ?? null,
    moduleStatus: current?.moduleStatus ?? null,
    moduleStatusLabel: current?.moduleStatusLabel ?? null,
  };
}

export function runDesktopShellStartupModuleTimerTick(params: {
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  lastTickAt?: number | null;
  timerArmed?: boolean;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
} = {}): DesktopShellStartupModuleTimerTickResult {
  const cycle = runDesktopShellAppRuntimeTimerTickStub({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel: params.shellAppLabel,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    lastTickAt: params.lastTickAt,
    timerArmed: params.timerArmed,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const current = resolveLocalBridgeStartupPosture();
  return {
    ...cycle,
    moduleLabel: current?.moduleLabel ?? "Desktop Shell Startup Module",
    moduleSummary: current?.moduleSummary ?? null,
    moduleStatus: current?.moduleStatus ?? null,
    moduleStatusLabel: current?.moduleStatusLabel ?? null,
  };
}

export function runDesktopShellStartupModuleRunnerTick(params: {
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  lastTickAt?: number | null;
  runnerStarted?: boolean;
  timerArmed?: boolean;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
} = {}): DesktopShellStartupModuleRunnerTickResult {
  const cycle = runDesktopShellAppRuntimeRunnerTickStub({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel: params.shellAppLabel,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    lastTickAt: params.lastTickAt,
    runnerStarted: params.runnerStarted,
    timerArmed: params.timerArmed,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const current = resolveLocalBridgeStartupPosture();
  return {
    ...cycle,
    moduleLabel: current?.moduleLabel ?? "Desktop Shell Startup Module",
    moduleSummary: current?.moduleSummary ?? null,
    moduleStatus: current?.moduleStatus ?? null,
    moduleStatusLabel: current?.moduleStatusLabel ?? null,
  };
}

export function runDesktopShellStartupModuleHostWake(params: {
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  lastTickAt?: number | null;
  hostStarted?: boolean;
  runnerStarted?: boolean;
  timerArmed?: boolean;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
} = {}): DesktopShellStartupModuleHostWakeResult {
  const cycle = runDesktopShellAppRuntimeHostWakeStub({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel: params.shellAppLabel,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    lastTickAt: params.lastTickAt,
    hostStarted: params.hostStarted,
    runnerStarted: params.runnerStarted,
    timerArmed: params.timerArmed,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const current = resolveLocalBridgeStartupPosture();
  return {
    ...cycle,
    moduleLabel: current?.moduleLabel ?? "Desktop Shell Startup Module",
    moduleSummary: current?.moduleSummary ?? null,
    moduleStatus: current?.moduleStatus ?? null,
    moduleStatusLabel: current?.moduleStatusLabel ?? null,
  };
}

export function runDesktopShellStartupModuleServiceWake(params: {
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  hostStarted?: boolean;
  runnerStarted?: boolean;
  timerArmed?: boolean;
  serviceOwned?: boolean;
  lastTickAt?: number | null;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
} = {}): DesktopShellStartupModuleServiceWakeResult {
  const cycle = runDesktopShellAppRuntimeServiceWakeStub({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel: params.shellAppLabel,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    hostStarted: params.hostStarted,
    runnerStarted: params.runnerStarted,
    timerArmed: params.timerArmed,
    serviceOwned: params.serviceOwned,
    lastTickAt: params.lastTickAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const current = resolveLocalBridgeStartupPosture();
  return {
    ...cycle,
    moduleLabel: current?.moduleLabel ?? "Desktop Shell Startup Module",
    moduleSummary: current?.moduleSummary ?? null,
    moduleStatus: current?.moduleStatus ?? null,
    moduleStatusLabel: current?.moduleStatusLabel ?? null,
  };
}

export function runDesktopShellStartupModuleLifecycleWake(params: {
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  hostStarted?: boolean;
  runnerStarted?: boolean;
  timerArmed?: boolean;
  serviceOwned?: boolean;
  lifecycleOwned?: boolean;
  lastTickAt?: number | null;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
} = {}): DesktopShellStartupModuleLifecycleWakeResult {
  const cycle = runDesktopShellAppRuntimeLifecycleWakeStub({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel: params.shellAppLabel,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    hostStarted: params.hostStarted,
    runnerStarted: params.runnerStarted,
    timerArmed: params.timerArmed,
    serviceOwned: params.serviceOwned,
    lifecycleOwned: params.lifecycleOwned,
    lastTickAt: params.lastTickAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const current = resolveLocalBridgeStartupPosture();
  return {
    ...cycle,
    moduleLabel: current?.moduleLabel ?? "Desktop Shell Startup Module",
    moduleSummary: current?.moduleSummary ?? null,
    moduleStatus: current?.moduleStatus ?? null,
    moduleStatusLabel: current?.moduleStatusLabel ?? null,
  };
}

export function runDesktopShellStartupModuleBootstrapWake(params: {
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  hostStarted?: boolean;
  runnerStarted?: boolean;
  timerArmed?: boolean;
  serviceOwned?: boolean;
  lifecycleOwned?: boolean;
  bootstrapOwned?: boolean;
  lastTickAt?: number | null;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
} = {}): DesktopShellStartupModuleBootstrapWakeResult {
  const cycle = runDesktopShellAppRuntimeBootstrapWakeStub({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel: params.shellAppLabel,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    hostStarted: params.hostStarted,
    runnerStarted: params.runnerStarted,
    timerArmed: params.timerArmed,
    serviceOwned: params.serviceOwned,
    lifecycleOwned: params.lifecycleOwned,
    bootstrapOwned: params.bootstrapOwned,
    lastTickAt: params.lastTickAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const current = resolveLocalBridgeStartupPosture();
  return {
    ...cycle,
    moduleLabel: current?.moduleLabel ?? "Desktop Shell Startup Module",
    moduleSummary: current?.moduleSummary ?? null,
    moduleStatus: current?.moduleStatus ?? null,
    moduleStatusLabel: current?.moduleStatusLabel ?? null,
  };
}

export function runDesktopShellStartupModuleAppOwnerWake(params: {
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  hostStarted?: boolean;
  runnerStarted?: boolean;
  timerArmed?: boolean;
  serviceOwned?: boolean;
  lifecycleOwned?: boolean;
  bootstrapOwned?: boolean;
  appOwnerOwned?: boolean;
  lastTickAt?: number | null;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
} = {}): DesktopShellStartupModuleAppOwnerWakeResult {
  const cycle = runDesktopShellAppRuntimeAppOwnerWakeStub({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel: params.shellAppLabel,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    hostStarted: params.hostStarted,
    runnerStarted: params.runnerStarted,
    timerArmed: params.timerArmed,
    serviceOwned: params.serviceOwned,
    lifecycleOwned: params.lifecycleOwned,
    bootstrapOwned: params.bootstrapOwned,
    appOwnerOwned: params.appOwnerOwned,
    lastTickAt: params.lastTickAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const current = resolveLocalBridgeStartupPosture();
  return {
    ...cycle,
    moduleLabel: current?.moduleLabel ?? "Desktop Shell Startup Module",
    moduleSummary: current?.moduleSummary ?? null,
    moduleStatus: current?.moduleStatus ?? null,
    moduleStatusLabel: current?.moduleStatusLabel ?? null,
  };
}

export function runDesktopShellStartupModuleShellOwnerWake(params: {
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  hostStarted?: boolean;
  runnerStarted?: boolean;
  timerArmed?: boolean;
  serviceOwned?: boolean;
  lifecycleOwned?: boolean;
  bootstrapOwned?: boolean;
  appOwnerOwned?: boolean;
  appShellOwned?: boolean;
  lastTickAt?: number | null;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
} = {}): DesktopShellStartupModuleShellOwnerWakeResult {
  const cycle = runDesktopShellAppRuntimeShellOwnerWakeStub({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel: params.shellAppLabel,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    hostStarted: params.hostStarted,
    runnerStarted: params.runnerStarted,
    timerArmed: params.timerArmed,
    serviceOwned: params.serviceOwned,
    lifecycleOwned: params.lifecycleOwned,
    bootstrapOwned: params.bootstrapOwned,
    appOwnerOwned: params.appOwnerOwned,
    appShellOwned: params.appShellOwned,
    lastTickAt: params.lastTickAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const current = resolveLocalBridgeStartupPosture();
  return {
    ...cycle,
    moduleLabel: current?.moduleLabel ?? "Desktop Shell Startup Module",
    moduleSummary: current?.moduleSummary ?? null,
    moduleStatus: current?.moduleStatus ?? null,
    moduleStatusLabel: current?.moduleStatusLabel ?? null,
  };
}

export function runDesktopShellStartupModuleProcessHostWake(params: {
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  hostStarted?: boolean;
  runnerStarted?: boolean;
  timerArmed?: boolean;
  serviceOwned?: boolean;
  lifecycleOwned?: boolean;
  bootstrapOwned?: boolean;
  appOwnerOwned?: boolean;
  appShellOwned?: boolean;
  processHostOwned?: boolean;
  lastTickAt?: number | null;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
} = {}): DesktopShellStartupModuleProcessHostWakeResult {
  const cycle = runDesktopShellAppRuntimeProcessHostWakeStub({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel: params.shellAppLabel,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    hostStarted: params.hostStarted,
    runnerStarted: params.runnerStarted,
    timerArmed: params.timerArmed,
    serviceOwned: params.serviceOwned,
    lifecycleOwned: params.lifecycleOwned,
    bootstrapOwned: params.bootstrapOwned,
    appOwnerOwned: params.appOwnerOwned,
    appShellOwned: params.appShellOwned,
    processHostOwned: params.processHostOwned,
    lastTickAt: params.lastTickAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const current = resolveLocalBridgeStartupPosture();
  return {
    ...cycle,
    moduleLabel: current?.moduleLabel ?? "Desktop Shell Startup Module",
    moduleSummary: current?.moduleSummary ?? null,
    moduleStatus: current?.moduleStatus ?? null,
    moduleStatusLabel: current?.moduleStatusLabel ?? null,
  };
}

export type DesktopShellStartupModuleProcessEventResult =
  DesktopShellAppRuntimeProcessEventResult & {
    moduleLabel: string;
    moduleSummary: string | null;
    moduleStatus: string | null;
    moduleStatusLabel: string | null;
  };

export type DesktopShellStartupModuleNativeProcessEventResult =
  DesktopShellAppRuntimeNativeProcessEventResult & {
    moduleLabel: string;
    moduleSummary: string | null;
    moduleStatus: string | null;
    moduleStatusLabel: string | null;
  };

export function dispatchDesktopShellStartupModuleProcessEvent(params: {
  eventType: DesktopShellRuntimeProcessEventType;
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  hostStarted?: boolean;
  runnerStarted?: boolean;
  timerArmed?: boolean;
  serviceOwned?: boolean;
  lifecycleOwned?: boolean;
  bootstrapOwned?: boolean;
  appOwnerOwned?: boolean;
  appShellOwned?: boolean;
  processHostOwned?: boolean;
  lastTickAt?: number | null;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
}): DesktopShellStartupModuleProcessEventResult {
  const cycle = dispatchDesktopShellAppRuntimeProcessEventStub({
    eventType: params.eventType,
    runtimeLabel: params.runtimeLabel,
    shellAppLabel: params.shellAppLabel,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    hostStarted: params.hostStarted,
    runnerStarted: params.runnerStarted,
    timerArmed: params.timerArmed,
    serviceOwned: params.serviceOwned,
    lifecycleOwned: params.lifecycleOwned,
    bootstrapOwned: params.bootstrapOwned,
    appOwnerOwned: params.appOwnerOwned,
    appShellOwned: params.appShellOwned,
    processHostOwned: params.processHostOwned,
    lastTickAt: params.lastTickAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const current = resolveLocalBridgeStartupPosture();
  return {
    ...cycle,
    moduleLabel: current?.moduleLabel ?? "Desktop Shell Startup Module",
    moduleSummary: current?.moduleSummary ?? null,
    moduleStatus: current?.moduleStatus ?? null,
    moduleStatusLabel: current?.moduleStatusLabel ?? null,
  };
}

export function dispatchDesktopShellStartupModuleNativeProcessEvent(params: {
  nativeEventType: "app_started" | "app_foregrounded" | "app_backgrounded" | "app_stopped";
  hostPlatform?: "macos" | "windows";
  nativeProcessIngressSource?: "macos_app_lifecycle" | "windows_app_lifecycle";
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  hostStarted?: boolean;
  runnerStarted?: boolean;
  timerArmed?: boolean;
  serviceOwned?: boolean;
  lifecycleOwned?: boolean;
  bootstrapOwned?: boolean;
  appOwnerOwned?: boolean;
  appShellOwned?: boolean;
  processHostOwned?: boolean;
  lastTickAt?: number | null;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
}): DesktopShellStartupModuleNativeProcessEventResult {
  const cycle = dispatchDesktopShellAppRuntimeNativeProcessEventStub({
    nativeEventType: params.nativeEventType,
    hostPlatform: params.hostPlatform,
    nativeProcessIngressSource: params.nativeProcessIngressSource,
    runtimeLabel: params.runtimeLabel,
    shellAppLabel: params.shellAppLabel,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    hostStarted: params.hostStarted,
    runnerStarted: params.runnerStarted,
    timerArmed: params.timerArmed,
    serviceOwned: params.serviceOwned,
    lifecycleOwned: params.lifecycleOwned,
    bootstrapOwned: params.bootstrapOwned,
    appOwnerOwned: params.appOwnerOwned,
    appShellOwned: params.appShellOwned,
    processHostOwned: params.processHostOwned,
    lastTickAt: params.lastTickAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const current = resolveLocalBridgeStartupPosture();
  return {
    ...cycle,
    moduleLabel: current?.moduleLabel ?? "Desktop Shell Startup Module",
    moduleSummary: current?.moduleSummary ?? null,
    moduleStatus: current?.moduleStatus ?? null,
    moduleStatusLabel: current?.moduleStatusLabel ?? null,
  };
}
