import type { DesktopLocalBridgeProviderFactory } from "./shell-local-bridge-desktop-provider-registry.js";
import { registerDesktopLocalBridgeProviderFactory } from "./shell-local-bridge-desktop-provider-registry.js";
import {
  describeDesktopShellLocalBridgeHealthStatus,
  resolveDesktopShellLocalBridgeHealthStatus,
} from "./shell-local-bridge-desktop-startup-wiring.stub.js";
import {
  resolveShellLocalBridgeHealthFeedPollingDecision,
  type ShellLocalBridgeHealthFeedSummary,
  type ShellLocalBridgeHealthFeedPollingDecision,
  type ShellLocalBridgeHealthFeedSchedulerDecision,
} from "./shell-app-contract.js";
import {
  resolveDesktopLocalBridgeStartupProviderKey,
  type DesktopLocalBridgeStartupOptions,
} from "./shell-local-bridge-desktop-startup.stub.js";
import {
  wireDesktopShellLocalBridgeStartup,
  type DesktopShellLocalBridgeStartupWiringResult,
} from "./shell-local-bridge-desktop-startup-wiring.stub.js";
import {
  appendLocalBridgeHealthEvent,
  resolveLocalBridgeStartupPosture,
  summarizeLocalBridgeHealthFeed,
  updateLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";
import { runDesktopShellRuntimeSchedulerCycle } from "./shell-local-bridge-desktop-runtime.scheduler.js";
import { runDesktopShellRuntimeDriverCycle } from "./shell-local-bridge-desktop-runtime.driver.js";
import {
  runDesktopShellRuntimeTimerTick,
  type DesktopShellRuntimeTimerTickResult,
} from "./shell-local-bridge-desktop-runtime.timer.js";
import {
  tickDesktopShellRuntimeRunner,
  type DesktopShellRuntimeRunnerTickResult,
} from "./shell-local-bridge-desktop-runtime.runner.js";
import {
  wakeDesktopShellRuntimeHost,
  type DesktopShellRuntimeHostWakeResult,
} from "./shell-local-bridge-desktop-runtime.host.js";
import {
  wakeDesktopShellRuntimeService,
  type DesktopShellRuntimeServiceWakeResult,
} from "./shell-local-bridge-desktop-runtime.service.js";
import {
  resumeDesktopShellRuntimeLifecycle,
  type DesktopShellRuntimeLifecycleResult,
} from "./shell-local-bridge-desktop-runtime.lifecycle.js";
import {
  wakeDesktopShellRuntimeBootstrap,
  type DesktopShellRuntimeBootstrapResult,
} from "./shell-local-bridge-desktop-runtime.bootstrap.js";
import {
  wakeDesktopShellRuntimeAppOwner,
  type DesktopShellRuntimeAppOwnerResult,
} from "./shell-local-bridge-desktop-runtime.app-owner.js";
import {
  wakeDesktopShellRuntimeShellOwner,
  type DesktopShellRuntimeShellOwnerResult,
} from "./shell-local-bridge-desktop-runtime.shell-owner.js";
import {
  foregroundDesktopShellRuntimeProcessHost,
  type DesktopShellRuntimeProcessHostResult,
} from "./shell-local-bridge-desktop-runtime.process-host.js";
import {
  dispatchDesktopShellRuntimeProcessEvent,
  type DesktopShellRuntimeProcessEventResult,
  type DesktopShellRuntimeProcessEventType,
} from "./shell-local-bridge-desktop-runtime.process-events.js";
import {
  dispatchDesktopShellRuntimeNativeProcessEvent,
  type DesktopShellRuntimeNativeProcessEventResult,
  type DesktopShellRuntimeNativeProcessEventType,
} from "./shell-local-bridge-desktop-runtime.native-process-events.js";

export type DesktopShellAppRuntimeStartupOptions =
  DesktopLocalBridgeStartupOptions & {
    shellAppLabel?: string;
    providerFactory?: DesktopLocalBridgeProviderFactory | null;
  };

export type DesktopShellAppRuntimeStartupResult =
  DesktopShellLocalBridgeStartupWiringResult & {
    providerRegistered: boolean;
    startupRuntimeSummary: string;
  };

export type DesktopShellAppRuntimeHealthHeartbeatResult = {
  attached: boolean;
  adapterReadiness: "ready" | "degraded" | "unavailable";
  healthSource: "runtime_heartbeat";
  healthStatus: DesktopShellLocalBridgeStartupWiringResult["healthStatus"];
  healthStatusLabel: string;
  heartbeatSummary: string;
};

export type DesktopShellAppRuntimeHeartbeatCycleResult = {
  shellAppLabel: string;
  heartbeat: DesktopShellAppRuntimeHealthHeartbeatResult;
  healthFeed: ShellLocalBridgeHealthFeedSummary;
  pollingDecision: ShellLocalBridgeHealthFeedPollingDecision;
  startupRuntimeSummary: string;
};

export type DesktopShellAppRuntimeSchedulerCycleResult = {
  shellAppLabel: string;
  heartbeatCycle: ReturnType<typeof runDesktopShellRuntimeSchedulerCycle>["heartbeatCycle"];
  healthFeed: ShellLocalBridgeHealthFeedSummary;
  pollingDecision: ShellLocalBridgeHealthFeedPollingDecision;
  schedulerDecision: ShellLocalBridgeHealthFeedSchedulerDecision;
  nextRunAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  startupRuntimeSummary: string;
};

export type DesktopShellAppRuntimeDriverCycleResult = {
  shellAppLabel: string;
  schedulerCycle: ReturnType<typeof runDesktopShellRuntimeDriverCycle>["schedulerCycle"];
  heartbeatCycle: ReturnType<typeof runDesktopShellRuntimeDriverCycle>["heartbeatCycle"];
  healthFeed: ShellLocalBridgeHealthFeedSummary;
  pollingDecision: ShellLocalBridgeHealthFeedPollingDecision;
  schedulerDecision: ShellLocalBridgeHealthFeedSchedulerDecision;
  driverDecision: ReturnType<typeof runDesktopShellRuntimeDriverCycle>["driverDecision"];
  driverState: ReturnType<typeof runDesktopShellRuntimeDriverCycle>["driverState"];
  nextRunAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  startupRuntimeSummary: string;
};

export type DesktopShellAppRuntimeTimerTickResult = {
  shellAppLabel: string;
  driverCycle: DesktopShellRuntimeTimerTickResult["driverCycle"];
  heartbeatCycle: DesktopShellRuntimeTimerTickResult["heartbeatCycle"];
  healthFeed: ShellLocalBridgeHealthFeedSummary;
  pollingDecision: ShellLocalBridgeHealthFeedPollingDecision;
  schedulerDecision: DesktopShellRuntimeTimerTickResult["schedulerDecision"];
  driverDecision: DesktopShellRuntimeTimerTickResult["driverDecision"];
  timerDecision: DesktopShellRuntimeTimerTickResult["timerDecision"];
  timerState: DesktopShellRuntimeTimerTickResult["timerState"];
  shouldArmTimer: boolean;
  scheduledAt: string | null;
  nextTickAt: string | null;
  lastTickAt: string | null;
  driverState: DesktopShellRuntimeTimerTickResult["driverState"];
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  startupRuntimeSummary: string;
};

export type DesktopShellAppRuntimeRunnerTickResult = {
  shellAppLabel: string;
  timerTick: DesktopShellRuntimeRunnerTickResult["timerTick"];
  driverCycle: DesktopShellRuntimeRunnerTickResult["driverCycle"];
  heartbeatCycle: DesktopShellRuntimeRunnerTickResult["heartbeatCycle"];
  healthFeed: ShellLocalBridgeHealthFeedSummary;
  pollingDecision: ShellLocalBridgeHealthFeedPollingDecision;
  schedulerDecision: DesktopShellRuntimeRunnerTickResult["schedulerDecision"];
  driverDecision: DesktopShellRuntimeRunnerTickResult["driverDecision"];
  timerDecision: DesktopShellRuntimeRunnerTickResult["timerDecision"];
  runnerDecision: DesktopShellRuntimeRunnerTickResult["runnerDecision"];
  runnerState: DesktopShellRuntimeRunnerTickResult["runnerState"];
  shouldKeepRunning: boolean;
  armed: boolean;
  nextWakeAt: string | null;
  lastTickStartedAt: string | null;
  lastTickCompletedAt: string | null;
  timerState: DesktopShellRuntimeRunnerTickResult["timerState"];
  scheduledAt: string | null;
  nextTickAt: string | null;
  lastTickAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  startupRuntimeSummary: string;
};

export type DesktopShellAppRuntimeHostWakeResult = {
  shellAppLabel: string;
  runnerTick: DesktopShellRuntimeHostWakeResult["runnerTick"];
  timerTick: DesktopShellRuntimeHostWakeResult["timerTick"];
  driverCycle: DesktopShellRuntimeHostWakeResult["driverCycle"];
  heartbeatCycle: DesktopShellRuntimeHostWakeResult["heartbeatCycle"];
  healthFeed: DesktopShellRuntimeHostWakeResult["healthFeed"];
  pollingDecision: DesktopShellRuntimeHostWakeResult["pollingDecision"];
  schedulerDecision: DesktopShellRuntimeHostWakeResult["schedulerDecision"];
  driverDecision: DesktopShellRuntimeHostWakeResult["driverDecision"];
  timerDecision: DesktopShellRuntimeHostWakeResult["timerDecision"];
  runnerDecision: DesktopShellRuntimeHostWakeResult["runnerDecision"];
  runnerState: DesktopShellRuntimeHostWakeResult["runnerState"];
  hostDecision: DesktopShellRuntimeHostWakeResult["hostDecision"];
  hostState: DesktopShellRuntimeHostWakeResult["hostState"];
  hostStarted: boolean;
  hostArmed: boolean;
  nextWakeAt: string | null;
  lastWakeStartedAt: string | null;
  lastWakeCompletedAt: string | null;
  recommendedDelayMs: DesktopShellRuntimeHostWakeResult["recommendedDelayMs"];
  retryBackoffMs: DesktopShellRuntimeHostWakeResult["retryBackoffMs"];
  startupRuntimeSummary: string;
};

export type DesktopShellAppRuntimeServiceWakeResult = {
  shellAppLabel: string;
  hostWake: DesktopShellRuntimeServiceWakeResult["hostWake"];
  runnerTick: DesktopShellRuntimeServiceWakeResult["runnerTick"];
  timerTick: DesktopShellRuntimeServiceWakeResult["timerTick"];
  driverCycle: DesktopShellRuntimeServiceWakeResult["driverCycle"];
  heartbeatCycle: DesktopShellRuntimeServiceWakeResult["heartbeatCycle"];
  healthFeed: DesktopShellRuntimeServiceWakeResult["healthFeed"];
  pollingDecision: DesktopShellRuntimeServiceWakeResult["pollingDecision"];
  schedulerDecision: DesktopShellRuntimeServiceWakeResult["schedulerDecision"];
  driverDecision: DesktopShellRuntimeServiceWakeResult["driverDecision"];
  timerDecision: DesktopShellRuntimeServiceWakeResult["timerDecision"];
  runnerDecision: DesktopShellRuntimeServiceWakeResult["runnerDecision"];
  hostDecision: DesktopShellRuntimeServiceWakeResult["hostDecision"];
  hostState: DesktopShellRuntimeServiceWakeResult["hostState"];
  serviceDecision: DesktopShellRuntimeServiceWakeResult["serviceDecision"];
  serviceState: DesktopShellRuntimeServiceWakeResult["serviceState"];
  serviceOwned: boolean;
  serviceActive: boolean;
  nextWakeAt: string | null;
  lastAcquireAt: string | null;
  lastReleaseAt: string | null;
  recommendedDelayMs: DesktopShellRuntimeServiceWakeResult["recommendedDelayMs"];
  retryBackoffMs: DesktopShellRuntimeServiceWakeResult["retryBackoffMs"];
  startupRuntimeSummary: string;
};

export type DesktopShellAppRuntimeLifecycleWakeResult = {
  shellAppLabel: string;
  serviceWake: DesktopShellRuntimeLifecycleResult["serviceWake"];
  hostWake: DesktopShellRuntimeLifecycleResult["hostWake"];
  runnerTick: DesktopShellRuntimeLifecycleResult["runnerTick"];
  timerTick: DesktopShellRuntimeLifecycleResult["timerTick"];
  driverCycle: DesktopShellRuntimeLifecycleResult["driverCycle"];
  heartbeatCycle: DesktopShellRuntimeLifecycleResult["heartbeatCycle"];
  healthFeed: DesktopShellRuntimeLifecycleResult["healthFeed"];
  pollingDecision: DesktopShellRuntimeLifecycleResult["pollingDecision"];
  schedulerDecision: DesktopShellRuntimeLifecycleResult["schedulerDecision"];
  driverDecision: DesktopShellRuntimeLifecycleResult["driverDecision"];
  timerDecision: DesktopShellRuntimeLifecycleResult["timerDecision"];
  runnerDecision: DesktopShellRuntimeLifecycleResult["runnerDecision"];
  hostDecision: DesktopShellRuntimeLifecycleResult["hostDecision"];
  serviceDecision: DesktopShellRuntimeLifecycleResult["serviceDecision"];
  serviceState: DesktopShellRuntimeLifecycleResult["serviceState"];
  lifecycleDecision: DesktopShellRuntimeLifecycleResult["lifecycleDecision"];
  lifecycleState: DesktopShellRuntimeLifecycleResult["lifecycleState"];
  lifecycleOwned: boolean;
  lifecycleActive: boolean;
  nextWakeAt: string | null;
  lastBootAt: string | null;
  lastResumeAt: string | null;
  lastSuspendAt: string | null;
  lastShutdownAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  startupRuntimeSummary: string;
};

export type DesktopShellAppRuntimeBootstrapWakeResult = {
  shellAppLabel: string;
  lifecycleWake: DesktopShellRuntimeBootstrapResult["lifecycleWake"];
  serviceWake: DesktopShellRuntimeBootstrapResult["serviceWake"];
  hostWake: DesktopShellRuntimeBootstrapResult["hostWake"];
  runnerTick: DesktopShellRuntimeBootstrapResult["runnerTick"];
  timerTick: DesktopShellRuntimeBootstrapResult["timerTick"];
  driverCycle: DesktopShellRuntimeBootstrapResult["driverCycle"];
  heartbeatCycle: DesktopShellRuntimeBootstrapResult["heartbeatCycle"];
  healthFeed: DesktopShellRuntimeBootstrapResult["healthFeed"];
  pollingDecision: DesktopShellRuntimeBootstrapResult["pollingDecision"];
  schedulerDecision: DesktopShellRuntimeBootstrapResult["schedulerDecision"];
  driverDecision: DesktopShellRuntimeBootstrapResult["driverDecision"];
  timerDecision: DesktopShellRuntimeBootstrapResult["timerDecision"];
  runnerDecision: DesktopShellRuntimeBootstrapResult["runnerDecision"];
  hostDecision: DesktopShellRuntimeBootstrapResult["hostDecision"];
  serviceDecision: DesktopShellRuntimeBootstrapResult["serviceDecision"];
  lifecycleDecision: DesktopShellRuntimeBootstrapResult["lifecycleDecision"];
  serviceState: DesktopShellRuntimeBootstrapResult["serviceState"];
  lifecycleState: DesktopShellRuntimeBootstrapResult["lifecycleState"];
  bootstrapDecision: DesktopShellRuntimeBootstrapResult["bootstrapDecision"];
  bootstrapState: DesktopShellRuntimeBootstrapResult["bootstrapState"];
  bootstrapOwned: boolean;
  bootstrapActive: boolean;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastWakeAt: string | null;
  lastSuspendAt: string | null;
  lastStopAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  startupRuntimeSummary: string;
};

export type DesktopShellAppRuntimeAppOwnerWakeResult = {
  shellAppLabel: string;
  bootstrapWake: DesktopShellRuntimeAppOwnerResult["bootstrapWake"];
  lifecycleWake: DesktopShellRuntimeAppOwnerResult["lifecycleWake"];
  serviceWake: DesktopShellRuntimeAppOwnerResult["serviceWake"];
  hostWake: DesktopShellRuntimeAppOwnerResult["hostWake"];
  runnerTick: DesktopShellRuntimeAppOwnerResult["runnerTick"];
  timerTick: DesktopShellRuntimeAppOwnerResult["timerTick"];
  driverCycle: DesktopShellRuntimeAppOwnerResult["driverCycle"];
  heartbeatCycle: DesktopShellRuntimeAppOwnerResult["heartbeatCycle"];
  healthFeed: DesktopShellRuntimeAppOwnerResult["healthFeed"];
  pollingDecision: DesktopShellRuntimeAppOwnerResult["pollingDecision"];
  schedulerDecision: DesktopShellRuntimeAppOwnerResult["schedulerDecision"];
  driverDecision: DesktopShellRuntimeAppOwnerResult["driverDecision"];
  timerDecision: DesktopShellRuntimeAppOwnerResult["timerDecision"];
  runnerDecision: DesktopShellRuntimeAppOwnerResult["runnerDecision"];
  hostDecision: DesktopShellRuntimeAppOwnerResult["hostDecision"];
  serviceDecision: DesktopShellRuntimeAppOwnerResult["serviceDecision"];
  lifecycleDecision: DesktopShellRuntimeAppOwnerResult["lifecycleDecision"];
  bootstrapDecision: DesktopShellRuntimeAppOwnerResult["bootstrapDecision"];
  serviceState: DesktopShellRuntimeAppOwnerResult["serviceState"];
  lifecycleState: DesktopShellRuntimeAppOwnerResult["lifecycleState"];
  bootstrapState: DesktopShellRuntimeAppOwnerResult["bootstrapState"];
  appOwnerDecision: DesktopShellRuntimeAppOwnerResult["appOwnerDecision"];
  appOwnerState: DesktopShellRuntimeAppOwnerResult["appOwnerState"];
  appOwnerOwned: boolean;
  appOwnerActive: boolean;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastWakeAt: string | null;
  lastBackgroundAt: string | null;
  lastStopAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  startupRuntimeSummary: string;
};

export type DesktopShellAppRuntimeShellOwnerWakeResult = {
  shellAppLabel: string;
  appOwnerWake: DesktopShellRuntimeShellOwnerResult["appOwnerWake"];
  bootstrapWake: DesktopShellRuntimeShellOwnerResult["bootstrapWake"];
  lifecycleWake: DesktopShellRuntimeShellOwnerResult["lifecycleWake"];
  serviceWake: DesktopShellRuntimeShellOwnerResult["serviceWake"];
  hostWake: DesktopShellRuntimeShellOwnerResult["hostWake"];
  runnerTick: DesktopShellRuntimeShellOwnerResult["runnerTick"];
  timerTick: DesktopShellRuntimeShellOwnerResult["timerTick"];
  driverCycle: DesktopShellRuntimeShellOwnerResult["driverCycle"];
  heartbeatCycle: DesktopShellRuntimeShellOwnerResult["heartbeatCycle"];
  healthFeed: DesktopShellRuntimeShellOwnerResult["healthFeed"];
  pollingDecision: DesktopShellRuntimeShellOwnerResult["pollingDecision"];
  schedulerDecision: DesktopShellRuntimeShellOwnerResult["schedulerDecision"];
  driverDecision: DesktopShellRuntimeShellOwnerResult["driverDecision"];
  timerDecision: DesktopShellRuntimeShellOwnerResult["timerDecision"];
  runnerDecision: DesktopShellRuntimeShellOwnerResult["runnerDecision"];
  hostDecision: DesktopShellRuntimeShellOwnerResult["hostDecision"];
  serviceDecision: DesktopShellRuntimeShellOwnerResult["serviceDecision"];
  lifecycleDecision: DesktopShellRuntimeShellOwnerResult["lifecycleDecision"];
  bootstrapDecision: DesktopShellRuntimeShellOwnerResult["bootstrapDecision"];
  appOwnerDecision: DesktopShellRuntimeShellOwnerResult["appOwnerDecision"];
  serviceState: DesktopShellRuntimeShellOwnerResult["serviceState"];
  lifecycleState: DesktopShellRuntimeShellOwnerResult["lifecycleState"];
  bootstrapState: DesktopShellRuntimeShellOwnerResult["bootstrapState"];
  appOwnerState: DesktopShellRuntimeShellOwnerResult["appOwnerState"];
  shellOwnerDecision: DesktopShellRuntimeShellOwnerResult["shellOwnerDecision"];
  shellOwnerState: DesktopShellRuntimeShellOwnerResult["shellOwnerState"];
  shellOwnerOwned: boolean;
  shellOwnerActive: boolean;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastWakeAt: string | null;
  lastBackgroundAt: string | null;
  lastStopAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  startupRuntimeSummary: string;
};

export type DesktopShellAppRuntimeProcessHostWakeResult = {
  shellAppLabel: string;
  shellOwnerWake: DesktopShellRuntimeProcessHostResult["shellOwnerWake"];
  appOwnerWake: DesktopShellRuntimeProcessHostResult["appOwnerWake"];
  bootstrapWake: DesktopShellRuntimeProcessHostResult["bootstrapWake"];
  lifecycleWake: DesktopShellRuntimeProcessHostResult["lifecycleWake"];
  serviceWake: DesktopShellRuntimeProcessHostResult["serviceWake"];
  hostWake: DesktopShellRuntimeProcessHostResult["hostWake"];
  runnerTick: DesktopShellRuntimeProcessHostResult["runnerTick"];
  timerTick: DesktopShellRuntimeProcessHostResult["timerTick"];
  driverCycle: DesktopShellRuntimeProcessHostResult["driverCycle"];
  heartbeatCycle: DesktopShellRuntimeProcessHostResult["heartbeatCycle"];
  healthFeed: DesktopShellRuntimeProcessHostResult["healthFeed"];
  pollingDecision: DesktopShellRuntimeProcessHostResult["pollingDecision"];
  schedulerDecision: DesktopShellRuntimeProcessHostResult["schedulerDecision"];
  driverDecision: DesktopShellRuntimeProcessHostResult["driverDecision"];
  timerDecision: DesktopShellRuntimeProcessHostResult["timerDecision"];
  runnerDecision: DesktopShellRuntimeProcessHostResult["runnerDecision"];
  hostDecision: DesktopShellRuntimeProcessHostResult["hostDecision"];
  serviceDecision: DesktopShellRuntimeProcessHostResult["serviceDecision"];
  lifecycleDecision: DesktopShellRuntimeProcessHostResult["lifecycleDecision"];
  bootstrapDecision: DesktopShellRuntimeProcessHostResult["bootstrapDecision"];
  appOwnerDecision: DesktopShellRuntimeProcessHostResult["appOwnerDecision"];
  shellOwnerDecision: DesktopShellRuntimeProcessHostResult["shellOwnerDecision"];
  serviceState: DesktopShellRuntimeProcessHostResult["serviceState"];
  lifecycleState: DesktopShellRuntimeProcessHostResult["lifecycleState"];
  bootstrapState: DesktopShellRuntimeProcessHostResult["bootstrapState"];
  appOwnerState: DesktopShellRuntimeProcessHostResult["appOwnerState"];
  shellOwnerState: DesktopShellRuntimeProcessHostResult["shellOwnerState"];
  processHostDecision: DesktopShellRuntimeProcessHostResult["processHostDecision"];
  processHostState: DesktopShellRuntimeProcessHostResult["processHostState"];
  processHostOwned: boolean;
  processHostActive: boolean;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastForegroundAt: string | null;
  lastBackgroundAt: string | null;
  lastStopAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  startupRuntimeSummary: string;
};

export type DesktopShellAppRuntimeProcessEventResult = {
  shellAppLabel: string;
  processHostWake: DesktopShellRuntimeProcessEventResult["processHostWake"];
  shellOwnerWake: DesktopShellRuntimeProcessEventResult["shellOwnerWake"];
  appOwnerWake: DesktopShellRuntimeProcessEventResult["appOwnerWake"];
  bootstrapWake: DesktopShellRuntimeProcessEventResult["bootstrapWake"];
  lifecycleWake: DesktopShellRuntimeProcessEventResult["lifecycleWake"];
  serviceWake: DesktopShellRuntimeProcessEventResult["serviceWake"];
  hostWake: DesktopShellRuntimeProcessEventResult["hostWake"];
  runnerTick: DesktopShellRuntimeProcessEventResult["runnerTick"];
  timerTick: DesktopShellRuntimeProcessEventResult["timerTick"];
  driverCycle: DesktopShellRuntimeProcessEventResult["driverCycle"];
  heartbeatCycle: DesktopShellRuntimeProcessEventResult["heartbeatCycle"];
  healthFeed: DesktopShellRuntimeProcessEventResult["healthFeed"];
  pollingDecision: DesktopShellRuntimeProcessEventResult["pollingDecision"];
  schedulerDecision: DesktopShellRuntimeProcessEventResult["schedulerDecision"];
  driverDecision: DesktopShellRuntimeProcessEventResult["driverDecision"];
  timerDecision: DesktopShellRuntimeProcessEventResult["timerDecision"];
  runnerDecision: DesktopShellRuntimeProcessEventResult["runnerDecision"];
  hostDecision: DesktopShellRuntimeProcessEventResult["hostDecision"];
  serviceDecision: DesktopShellRuntimeProcessEventResult["serviceDecision"];
  lifecycleDecision: DesktopShellRuntimeProcessEventResult["lifecycleDecision"];
  bootstrapDecision: DesktopShellRuntimeProcessEventResult["bootstrapDecision"];
  appOwnerDecision: DesktopShellRuntimeProcessEventResult["appOwnerDecision"];
  shellOwnerDecision: DesktopShellRuntimeProcessEventResult["shellOwnerDecision"];
  serviceState: DesktopShellRuntimeProcessEventResult["serviceState"];
  lifecycleState: DesktopShellRuntimeProcessEventResult["lifecycleState"];
  bootstrapState: DesktopShellRuntimeProcessEventResult["bootstrapState"];
  appOwnerState: DesktopShellRuntimeProcessEventResult["appOwnerState"];
  shellOwnerState: DesktopShellRuntimeProcessEventResult["shellOwnerState"];
  processHostDecision: DesktopShellRuntimeProcessEventResult["processHostDecision"];
  processHostState: DesktopShellRuntimeProcessEventResult["processHostState"];
  processHostOwned: boolean;
  processHostActive: boolean;
  processEventType: DesktopShellRuntimeProcessEventType;
  processEventSource: DesktopShellRuntimeProcessEventResult["processEventSource"];
  lastProcessEventAt: string;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastForegroundAt: string | null;
  lastBackgroundAt: string | null;
  lastStopAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  processEventSummary: string;
  startupRuntimeSummary: string;
};

export type DesktopShellAppRuntimeNativeProcessEventResult = {
  shellAppLabel: string;
  processEventDispatch: DesktopShellRuntimeNativeProcessEventResult["processEventDispatch"];
  processHostWake: DesktopShellRuntimeNativeProcessEventResult["processHostWake"];
  shellOwnerWake: DesktopShellRuntimeNativeProcessEventResult["shellOwnerWake"];
  appOwnerWake: DesktopShellRuntimeNativeProcessEventResult["appOwnerWake"];
  bootstrapWake: DesktopShellRuntimeNativeProcessEventResult["bootstrapWake"];
  lifecycleWake: DesktopShellRuntimeNativeProcessEventResult["lifecycleWake"];
  serviceWake: DesktopShellRuntimeNativeProcessEventResult["serviceWake"];
  hostWake: DesktopShellRuntimeNativeProcessEventResult["hostWake"];
  runnerTick: DesktopShellRuntimeNativeProcessEventResult["runnerTick"];
  timerTick: DesktopShellRuntimeNativeProcessEventResult["timerTick"];
  driverCycle: DesktopShellRuntimeNativeProcessEventResult["driverCycle"];
  heartbeatCycle: DesktopShellRuntimeNativeProcessEventResult["heartbeatCycle"];
  healthFeed: DesktopShellRuntimeNativeProcessEventResult["healthFeed"];
  pollingDecision: DesktopShellRuntimeNativeProcessEventResult["pollingDecision"];
  schedulerDecision: DesktopShellRuntimeNativeProcessEventResult["schedulerDecision"];
  driverDecision: DesktopShellRuntimeNativeProcessEventResult["driverDecision"];
  timerDecision: DesktopShellRuntimeNativeProcessEventResult["timerDecision"];
  runnerDecision: DesktopShellRuntimeNativeProcessEventResult["runnerDecision"];
  hostDecision: DesktopShellRuntimeNativeProcessEventResult["hostDecision"];
  serviceDecision: DesktopShellRuntimeNativeProcessEventResult["serviceDecision"];
  lifecycleDecision: DesktopShellRuntimeNativeProcessEventResult["lifecycleDecision"];
  bootstrapDecision: DesktopShellRuntimeNativeProcessEventResult["bootstrapDecision"];
  appOwnerDecision: DesktopShellRuntimeNativeProcessEventResult["appOwnerDecision"];
  shellOwnerDecision: DesktopShellRuntimeNativeProcessEventResult["shellOwnerDecision"];
  serviceState: DesktopShellRuntimeNativeProcessEventResult["serviceState"];
  lifecycleState: DesktopShellRuntimeNativeProcessEventResult["lifecycleState"];
  bootstrapState: DesktopShellRuntimeNativeProcessEventResult["bootstrapState"];
  appOwnerState: DesktopShellRuntimeNativeProcessEventResult["appOwnerState"];
  shellOwnerState: DesktopShellRuntimeNativeProcessEventResult["shellOwnerState"];
  processHostDecision: DesktopShellRuntimeNativeProcessEventResult["processHostDecision"];
  processHostState: DesktopShellRuntimeNativeProcessEventResult["processHostState"];
  processHostOwned: boolean;
  processHostActive: boolean;
  nativeProcessEventType: DesktopShellRuntimeNativeProcessEventType;
  nativeProcessEventSource: DesktopShellRuntimeNativeProcessEventResult["nativeProcessEventSource"];
  desktopHostPlatform: DesktopShellRuntimeNativeProcessEventResult["desktopHostPlatform"];
  nativeProcessIngressSource: DesktopShellRuntimeNativeProcessEventResult["nativeProcessIngressSource"];
  lastNativeProcessEventAt: string;
  processEventType: DesktopShellRuntimeNativeProcessEventResult["processEventType"];
  processEventSource: DesktopShellRuntimeNativeProcessEventResult["processEventSource"];
  lastProcessEventAt: string;
  nextWakeAt: string | null;
  lastStartAt: string | null;
  lastForegroundAt: string | null;
  lastBackgroundAt: string | null;
  lastStopAt: string | null;
  recommendedDelayMs: number | null;
  retryBackoffMs: number | null;
  processEventSummary: string;
  nativeProcessEventSummary: string;
  startupRuntimeSummary: string;
};

export function summarizeDesktopShellAppRuntimeStartup(params: {
  shellAppLabel: string;
  providerKey: string | null;
  providerRegistered: boolean;
  startup: Pick<DesktopShellLocalBridgeStartupWiringResult, "mode" | "attached">;
}): string {
  const providerLabel = params.providerKey ? `provider ${params.providerKey}` : "no provider key";
  if (params.providerRegistered) {
    return `${params.shellAppLabel} registered ${providerLabel} and started ${params.startup.mode} bridge startup (${params.startup.attached ? "attached" : "not attached"}).`;
  }
  return `${params.shellAppLabel} reused ${providerLabel} and started ${params.startup.mode} bridge startup (${params.startup.attached ? "attached" : "not attached"}).`;
}

export function startDesktopShellAppRuntimeStub(
  options: DesktopShellAppRuntimeStartupOptions = {},
): DesktopShellAppRuntimeStartupResult {
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const providerKey =
    options.providerKey?.trim() || resolveDesktopLocalBridgeStartupProviderKey(options.env);

  if (options.providerFactory && !providerKey) {
    throw new Error("desktop shell app runtime provider factory requires a provider key");
  }

  let providerRegistered = false;
  if (options.providerFactory && providerKey) {
    registerDesktopLocalBridgeProviderFactory(providerKey, options.providerFactory);
    providerRegistered = true;
  }

  const startup = wireDesktopShellLocalBridgeStartup({
    ...options,
    shellAppLabel,
    providerKey,
  });

  return {
    ...startup,
    providerRegistered,
    startupRuntimeSummary: summarizeDesktopShellAppRuntimeStartup({
      shellAppLabel,
      providerKey: startup.providerKey,
      providerRegistered,
      startup,
    }),
  };
}

export function reportDesktopShellAppRuntimeHealthHeartbeatStub(params: {
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
}): DesktopShellAppRuntimeHealthHeartbeatResult {
  const current = resolveLocalBridgeStartupPosture();
  if (!current || current.startupSource !== "desktop_startup_wiring") {
    throw new Error("desktop shell app runtime heartbeat requires startup wiring posture");
  }
  const shellAppLabel = params.shellAppLabel?.trim() || current.shellAppLabel || "Desktop Shell";
  const attached = params.attached ?? current.attached;
  const adapterReadiness = params.adapterReadiness ?? current.adapterReadiness ?? "unavailable";
  const healthStatus = resolveDesktopShellLocalBridgeHealthStatus({
    mode: current.mode,
    attached,
    adapterReadiness,
  });
  const healthStatusLabel = describeDesktopShellLocalBridgeHealthStatus(healthStatus);
  const heartbeatSummary = `${shellAppLabel} reported ${healthStatusLabel} through runtime health heartbeat.`;
  updateLocalBridgeStartupPosture({
    attached,
    adapterReadiness,
    healthSource: "runtime_heartbeat",
    healthStatus,
    healthStatusLabel,
    healthEventSummary: heartbeatSummary,
  });
  appendLocalBridgeHealthEvent({
    occurredAt: new Date().toISOString(),
    source: "runtime_heartbeat",
    healthStatus,
    healthStatusLabel,
    summary: heartbeatSummary,
    shellAppLabel,
    moduleLabel: current.moduleLabel ?? null,
    providerKey: current.providerKey ?? null,
  });
  return {
    attached,
    adapterReadiness,
    healthSource: "runtime_heartbeat",
    healthStatus,
    healthStatusLabel,
    heartbeatSummary,
  };
}

export function runDesktopShellAppRuntimeHealthHeartbeatCycleStub(params: {
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
}): DesktopShellAppRuntimeHeartbeatCycleResult {
  const heartbeat = reportDesktopShellAppRuntimeHealthHeartbeatStub({
    shellAppLabel: params.shellAppLabel,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
  });
  const healthFeed = summarizeLocalBridgeHealthFeed(params.now);
  const pollingDecision = resolveShellLocalBridgeHealthFeedPollingDecision(healthFeed);
  const current = resolveLocalBridgeStartupPosture();
  const shellAppLabel =
    params.shellAppLabel?.trim()
    || current?.shellAppLabel
    || "Desktop Shell";
  const startupRuntimeSummary =
    `${shellAppLabel} runtime heartbeat cycle observed ${healthFeed.stalenessStatusLabel} (${pollingDecision.cadenceSummary}).`;
  return {
    shellAppLabel,
    heartbeat,
    healthFeed,
    pollingDecision,
    startupRuntimeSummary,
  };
}

export function runDesktopShellAppRuntimeSchedulerCycleStub(params: {
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
} = {}): DesktopShellAppRuntimeSchedulerCycleResult {
  const current = resolveLocalBridgeStartupPosture();
  const shellAppLabel =
    params.shellAppLabel?.trim()
    || current?.shellAppLabel
    || "Desktop Shell";
  const schedulerCycle = runDesktopShellRuntimeSchedulerCycle({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel,
    moduleLabel: current?.moduleLabel ?? undefined,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const startupRuntimeSummary =
    `${shellAppLabel} runtime scheduler observed ${schedulerCycle.schedulerDecision.runnerSummary}`;
  updateLocalBridgeStartupPosture({
    runnerMode: schedulerCycle.schedulerDecision.runnerMode,
    nextRunAt: schedulerCycle.nextRunAt,
    recommendedDelayMs: schedulerCycle.recommendedDelayMs,
    retryBackoffMs: schedulerCycle.retryBackoffMs,
    runnerSummary: startupRuntimeSummary,
  });
  return {
    shellAppLabel,
    heartbeatCycle: schedulerCycle.heartbeatCycle,
    healthFeed: schedulerCycle.healthFeed,
    pollingDecision: schedulerCycle.pollingDecision,
    schedulerDecision: schedulerCycle.schedulerDecision,
    nextRunAt: schedulerCycle.nextRunAt,
    recommendedDelayMs: schedulerCycle.recommendedDelayMs,
    retryBackoffMs: schedulerCycle.retryBackoffMs,
    startupRuntimeSummary,
  };
}

export function runDesktopShellAppRuntimeDriverCycleStub(params: {
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  lastRunAt?: number | null;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
} = {}): DesktopShellAppRuntimeDriverCycleResult {
  const current = resolveLocalBridgeStartupPosture();
  const shellAppLabel =
    params.shellAppLabel?.trim()
    || current?.shellAppLabel
    || "Desktop Shell";
  const driverCycle = runDesktopShellRuntimeDriverCycle({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel,
    moduleLabel: current?.moduleLabel ?? undefined,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    lastRunAt: params.lastRunAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const startupRuntimeSummary =
    `${shellAppLabel} runtime driver observed ${driverCycle.driverSummary}`;
  return {
    shellAppLabel,
    schedulerCycle: driverCycle.schedulerCycle,
    heartbeatCycle: driverCycle.heartbeatCycle,
    healthFeed: driverCycle.healthFeed,
    pollingDecision: driverCycle.pollingDecision,
    schedulerDecision: driverCycle.schedulerDecision,
    driverDecision: driverCycle.driverDecision,
    driverState: driverCycle.driverState,
    nextRunAt: driverCycle.nextRunAt,
    recommendedDelayMs: driverCycle.recommendedDelayMs,
    retryBackoffMs: driverCycle.retryBackoffMs,
    startupRuntimeSummary,
  };
}

export function runDesktopShellAppRuntimeTimerTickStub(params: {
  runtimeLabel?: string;
  shellAppLabel?: string;
  attached?: boolean;
  adapterReadiness?: "ready" | "degraded" | "unavailable";
  now?: number;
  lastTickAt?: number | null;
  timerArmed?: boolean;
  recommendedDelayMsOverride?: number | null;
  retryBackoffMsOverride?: number | null;
} = {}): DesktopShellAppRuntimeTimerTickResult {
  const current = resolveLocalBridgeStartupPosture();
  const shellAppLabel =
    params.shellAppLabel?.trim()
    || current?.shellAppLabel
    || "Desktop Shell";
  const timerTick = runDesktopShellRuntimeTimerTick({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel,
    moduleLabel: current?.moduleLabel ?? undefined,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    lastTickAt: params.lastTickAt,
    timerArmed: params.timerArmed,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const startupRuntimeSummary =
    `${shellAppLabel} runtime timer observed ${timerTick.timerSummary}`;
  updateLocalBridgeStartupPosture({
    timerState: timerTick.timerState,
    scheduledAt: timerTick.scheduledAt,
    nextTickAt: timerTick.nextTickAt,
    lastTickAt: timerTick.lastTickAt,
    timerSummary: startupRuntimeSummary,
  });
  return {
    shellAppLabel,
    driverCycle: timerTick.driverCycle,
    heartbeatCycle: timerTick.heartbeatCycle,
    healthFeed: timerTick.healthFeed,
    pollingDecision: timerTick.pollingDecision,
    schedulerDecision: timerTick.schedulerDecision,
    driverDecision: timerTick.driverDecision,
    timerDecision: timerTick.timerDecision,
    timerState: timerTick.timerState,
    shouldArmTimer: timerTick.shouldArmTimer,
    scheduledAt: timerTick.scheduledAt,
    nextTickAt: timerTick.nextTickAt,
    lastTickAt: timerTick.lastTickAt,
    driverState: timerTick.driverState,
    recommendedDelayMs: timerTick.recommendedDelayMs,
    retryBackoffMs: timerTick.retryBackoffMs,
    startupRuntimeSummary,
  };
}

export function runDesktopShellAppRuntimeRunnerTickStub(params: {
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
} = {}): DesktopShellAppRuntimeRunnerTickResult {
  const current = resolveLocalBridgeStartupPosture();
  const shellAppLabel =
    params.shellAppLabel?.trim()
    || current?.shellAppLabel
    || "Desktop Shell";
  const runnerTick = tickDesktopShellRuntimeRunner({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel,
    moduleLabel: current?.moduleLabel ?? undefined,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    lastTickAt: params.lastTickAt,
    runnerStarted: params.runnerStarted ?? true,
    timerArmed: params.timerArmed,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const startupRuntimeSummary =
    `${shellAppLabel} runtime runner observed ${runnerTick.runnerSummary}`;
  updateLocalBridgeStartupPosture({
    runnerState: runnerTick.runnerState,
    nextWakeAt: runnerTick.nextWakeAt,
    lastTickStartedAt: runnerTick.lastTickStartedAt,
    lastTickCompletedAt: runnerTick.lastTickCompletedAt,
    runnerServiceSummary: startupRuntimeSummary,
  });
  return {
    shellAppLabel,
    timerTick: runnerTick.timerTick,
    driverCycle: runnerTick.driverCycle,
    heartbeatCycle: runnerTick.heartbeatCycle,
    healthFeed: runnerTick.healthFeed,
    pollingDecision: runnerTick.pollingDecision,
    schedulerDecision: runnerTick.schedulerDecision,
    driverDecision: runnerTick.driverDecision,
    timerDecision: runnerTick.timerDecision,
    runnerDecision: runnerTick.runnerDecision,
    runnerState: runnerTick.runnerState,
    shouldKeepRunning: runnerTick.shouldKeepRunning,
    armed: runnerTick.armed,
    nextWakeAt: runnerTick.nextWakeAt,
    lastTickStartedAt: runnerTick.lastTickStartedAt,
    lastTickCompletedAt: runnerTick.lastTickCompletedAt,
    timerState: runnerTick.timerState,
    scheduledAt: runnerTick.scheduledAt,
    nextTickAt: runnerTick.nextTickAt,
    lastTickAt: runnerTick.lastTickAt,
    recommendedDelayMs: runnerTick.recommendedDelayMs,
    retryBackoffMs: runnerTick.retryBackoffMs,
    startupRuntimeSummary,
  };
}

export function runDesktopShellAppRuntimeHostWakeStub(params: {
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
} = {}): DesktopShellAppRuntimeHostWakeResult {
  const current = resolveLocalBridgeStartupPosture();
  const shellAppLabel =
    params.shellAppLabel?.trim()
    || current?.shellAppLabel
    || "Desktop Shell";
  const hostWake = wakeDesktopShellRuntimeHost({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel,
    moduleLabel: current?.moduleLabel ?? undefined,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    lastTickAt: params.lastTickAt,
    hostStarted: params.hostStarted ?? true,
    runnerStarted: params.runnerStarted ?? true,
    timerArmed: params.timerArmed,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const startupRuntimeSummary =
    `${shellAppLabel} runtime host observed ${hostWake.hostSummary}`;
  updateLocalBridgeStartupPosture({
    hostState: hostWake.hostState,
    hostStarted: hostWake.hostStarted,
    hostArmed: hostWake.hostArmed,
    nextWakeAt: hostWake.nextWakeAt,
    lastWakeStartedAt: hostWake.lastWakeStartedAt,
    lastWakeCompletedAt: hostWake.lastWakeCompletedAt,
    hostSummary: startupRuntimeSummary,
  });
  return {
    shellAppLabel,
    runnerTick: hostWake.runnerTick,
    timerTick: hostWake.timerTick,
    driverCycle: hostWake.driverCycle,
    heartbeatCycle: hostWake.heartbeatCycle,
    healthFeed: hostWake.healthFeed,
    pollingDecision: hostWake.pollingDecision,
    schedulerDecision: hostWake.schedulerDecision,
    driverDecision: hostWake.driverDecision,
    timerDecision: hostWake.timerDecision,
    runnerDecision: hostWake.runnerDecision,
    runnerState: hostWake.runnerState,
    hostDecision: hostWake.hostDecision,
    hostState: hostWake.hostState,
    hostStarted: hostWake.hostStarted,
    hostArmed: hostWake.hostArmed,
    nextWakeAt: hostWake.nextWakeAt,
    lastWakeStartedAt: hostWake.lastWakeStartedAt,
    lastWakeCompletedAt: hostWake.lastWakeCompletedAt,
    recommendedDelayMs: hostWake.recommendedDelayMs,
    retryBackoffMs: hostWake.retryBackoffMs,
    startupRuntimeSummary,
  };
}

export function runDesktopShellAppRuntimeServiceWakeStub(params: {
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
} = {}): DesktopShellAppRuntimeServiceWakeResult {
  const current = resolveLocalBridgeStartupPosture();
  const shellAppLabel =
    params.shellAppLabel?.trim()
    || current?.shellAppLabel
    || "Desktop Shell";
  const serviceWake = wakeDesktopShellRuntimeService({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel,
    moduleLabel: current?.moduleLabel ?? undefined,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    hostStarted: params.hostStarted ?? true,
    runnerStarted: params.runnerStarted ?? true,
    timerArmed: params.timerArmed,
    serviceOwned: params.serviceOwned ?? true,
    lastTickAt: params.lastTickAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const startupRuntimeSummary =
    `${shellAppLabel} runtime service observed ${serviceWake.serviceSummary}`;
  updateLocalBridgeStartupPosture({
    serviceState: serviceWake.serviceState,
    serviceOwned: serviceWake.serviceOwned,
    serviceActive: serviceWake.serviceActive,
    nextWakeAt: serviceWake.nextWakeAt,
    lastAcquireAt: serviceWake.lastAcquireAt,
    lastReleaseAt: serviceWake.lastReleaseAt,
    serviceSummary: startupRuntimeSummary,
  });
  return {
    shellAppLabel,
    hostWake: serviceWake.hostWake,
    runnerTick: serviceWake.runnerTick,
    timerTick: serviceWake.timerTick,
    driverCycle: serviceWake.driverCycle,
    heartbeatCycle: serviceWake.heartbeatCycle,
    healthFeed: serviceWake.healthFeed,
    pollingDecision: serviceWake.pollingDecision,
    schedulerDecision: serviceWake.schedulerDecision,
    driverDecision: serviceWake.driverDecision,
    timerDecision: serviceWake.timerDecision,
    runnerDecision: serviceWake.runnerDecision,
    hostDecision: serviceWake.hostDecision,
    hostState: serviceWake.hostState,
    serviceDecision: serviceWake.serviceDecision,
    serviceState: serviceWake.serviceState,
    serviceOwned: serviceWake.serviceOwned,
    serviceActive: serviceWake.serviceActive,
    nextWakeAt: serviceWake.nextWakeAt,
    lastAcquireAt: serviceWake.lastAcquireAt,
    lastReleaseAt: serviceWake.lastReleaseAt,
    recommendedDelayMs: serviceWake.recommendedDelayMs,
    retryBackoffMs: serviceWake.retryBackoffMs,
    startupRuntimeSummary,
  };
}

export function runDesktopShellAppRuntimeLifecycleWakeStub(params: {
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
} = {}): DesktopShellAppRuntimeLifecycleWakeResult {
  const current = resolveLocalBridgeStartupPosture();
  const shellAppLabel =
    params.shellAppLabel?.trim()
    || current?.shellAppLabel
    || "Desktop Shell";
  const lifecycleWake = resumeDesktopShellRuntimeLifecycle({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel,
    moduleLabel: current?.moduleLabel ?? undefined,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    hostStarted: params.hostStarted ?? true,
    runnerStarted: params.runnerStarted ?? true,
    timerArmed: params.timerArmed,
    serviceOwned: params.serviceOwned ?? true,
    lifecycleOwned: params.lifecycleOwned ?? true,
    lastTickAt: params.lastTickAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const startupRuntimeSummary =
    `${shellAppLabel} runtime lifecycle observed ${lifecycleWake.lifecycleSummary}`;
  updateLocalBridgeStartupPosture({
    lifecycleState: lifecycleWake.lifecycleState,
    lifecycleOwned: lifecycleWake.lifecycleOwned,
    lifecycleActive: lifecycleWake.lifecycleActive,
    nextWakeAt: lifecycleWake.nextWakeAt,
    lastBootAt: lifecycleWake.lastBootAt,
    lastResumeAt: lifecycleWake.lastResumeAt,
    lastSuspendAt: lifecycleWake.lastSuspendAt,
    lastShutdownAt: lifecycleWake.lastShutdownAt,
    lifecycleSummary: startupRuntimeSummary,
  });
  return {
    shellAppLabel,
    serviceWake: lifecycleWake.serviceWake,
    hostWake: lifecycleWake.hostWake,
    runnerTick: lifecycleWake.runnerTick,
    timerTick: lifecycleWake.timerTick,
    driverCycle: lifecycleWake.driverCycle,
    heartbeatCycle: lifecycleWake.heartbeatCycle,
    healthFeed: lifecycleWake.healthFeed,
    pollingDecision: lifecycleWake.pollingDecision,
    schedulerDecision: lifecycleWake.schedulerDecision,
    driverDecision: lifecycleWake.driverDecision,
    timerDecision: lifecycleWake.timerDecision,
    runnerDecision: lifecycleWake.runnerDecision,
    hostDecision: lifecycleWake.hostDecision,
    serviceDecision: lifecycleWake.serviceDecision,
    serviceState: lifecycleWake.serviceState,
    lifecycleDecision: lifecycleWake.lifecycleDecision,
    lifecycleState: lifecycleWake.lifecycleState,
    lifecycleOwned: lifecycleWake.lifecycleOwned,
    lifecycleActive: lifecycleWake.lifecycleActive,
    nextWakeAt: lifecycleWake.nextWakeAt,
    lastBootAt: lifecycleWake.lastBootAt,
    lastResumeAt: lifecycleWake.lastResumeAt,
    lastSuspendAt: lifecycleWake.lastSuspendAt,
    lastShutdownAt: lifecycleWake.lastShutdownAt,
    recommendedDelayMs: lifecycleWake.recommendedDelayMs,
    retryBackoffMs: lifecycleWake.retryBackoffMs,
    startupRuntimeSummary,
  };
}

export function runDesktopShellAppRuntimeBootstrapWakeStub(params: {
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
} = {}): DesktopShellAppRuntimeBootstrapWakeResult {
  const current = resolveLocalBridgeStartupPosture();
  const shellAppLabel =
    params.shellAppLabel?.trim()
    || current?.shellAppLabel
    || "Desktop Shell";
  const bootstrapWake = wakeDesktopShellRuntimeBootstrap({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel,
    moduleLabel: current?.moduleLabel ?? undefined,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    hostStarted: params.hostStarted ?? true,
    runnerStarted: params.runnerStarted ?? true,
    timerArmed: params.timerArmed,
    serviceOwned: params.serviceOwned ?? true,
    lifecycleOwned: params.lifecycleOwned ?? true,
    bootstrapOwned: params.bootstrapOwned ?? true,
    lastTickAt: params.lastTickAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const startupRuntimeSummary =
    `${shellAppLabel} runtime bootstrap observed ${bootstrapWake.bootstrapSummary}`;
  updateLocalBridgeStartupPosture({
    bootstrapState: bootstrapWake.bootstrapState,
    bootstrapOwned: bootstrapWake.bootstrapOwned,
    bootstrapActive: bootstrapWake.bootstrapActive,
    nextWakeAt: bootstrapWake.nextWakeAt,
    lastStartAt: bootstrapWake.lastStartAt,
    lastWakeAt: bootstrapWake.lastWakeAt,
    lastSuspendAt: bootstrapWake.lastSuspendAt,
    lastStopAt: bootstrapWake.lastStopAt,
    bootstrapSummary: startupRuntimeSummary,
  });
  return {
    shellAppLabel,
    lifecycleWake: bootstrapWake.lifecycleWake,
    serviceWake: bootstrapWake.serviceWake,
    hostWake: bootstrapWake.hostWake,
    runnerTick: bootstrapWake.runnerTick,
    timerTick: bootstrapWake.timerTick,
    driverCycle: bootstrapWake.driverCycle,
    heartbeatCycle: bootstrapWake.heartbeatCycle,
    healthFeed: bootstrapWake.healthFeed,
    pollingDecision: bootstrapWake.pollingDecision,
    schedulerDecision: bootstrapWake.schedulerDecision,
    driverDecision: bootstrapWake.driverDecision,
    timerDecision: bootstrapWake.timerDecision,
    runnerDecision: bootstrapWake.runnerDecision,
    hostDecision: bootstrapWake.hostDecision,
    serviceDecision: bootstrapWake.serviceDecision,
    lifecycleDecision: bootstrapWake.lifecycleDecision,
    serviceState: bootstrapWake.serviceState,
    lifecycleState: bootstrapWake.lifecycleState,
    bootstrapDecision: bootstrapWake.bootstrapDecision,
    bootstrapState: bootstrapWake.bootstrapState,
    bootstrapOwned: bootstrapWake.bootstrapOwned,
    bootstrapActive: bootstrapWake.bootstrapActive,
    nextWakeAt: bootstrapWake.nextWakeAt,
    lastStartAt: bootstrapWake.lastStartAt,
    lastWakeAt: bootstrapWake.lastWakeAt,
    lastSuspendAt: bootstrapWake.lastSuspendAt,
    lastStopAt: bootstrapWake.lastStopAt,
    recommendedDelayMs: bootstrapWake.recommendedDelayMs,
    retryBackoffMs: bootstrapWake.retryBackoffMs,
    startupRuntimeSummary,
  };
}

export function runDesktopShellAppRuntimeAppOwnerWakeStub(params: {
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
} = {}): DesktopShellAppRuntimeAppOwnerWakeResult {
  const current = resolveLocalBridgeStartupPosture();
  const shellAppLabel =
    params.shellAppLabel?.trim()
    || current?.shellAppLabel
    || "Desktop Shell";
  const appOwnerWake = wakeDesktopShellRuntimeAppOwner({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel,
    moduleLabel: current?.moduleLabel ?? undefined,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    hostStarted: params.hostStarted ?? true,
    runnerStarted: params.runnerStarted ?? true,
    timerArmed: params.timerArmed,
    serviceOwned: params.serviceOwned ?? true,
    lifecycleOwned: params.lifecycleOwned ?? true,
    bootstrapOwned: params.bootstrapOwned ?? true,
    appOwnerOwned: params.appOwnerOwned ?? true,
    lastTickAt: params.lastTickAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const startupRuntimeSummary =
    `${shellAppLabel} runtime app owner observed ${appOwnerWake.appOwnerSummary}`;
  updateLocalBridgeStartupPosture({
    appOwnerState: appOwnerWake.appOwnerState,
    appOwnerOwned: appOwnerWake.appOwnerOwned,
    appOwnerActive: appOwnerWake.appOwnerActive,
    nextWakeAt: appOwnerWake.nextWakeAt,
    lastStartAt: appOwnerWake.lastStartAt,
    lastWakeAt: appOwnerWake.lastWakeAt,
    lastBackgroundAt: appOwnerWake.lastBackgroundAt,
    lastStopAt: appOwnerWake.lastStopAt,
    appOwnerSummary: startupRuntimeSummary,
  });
  return {
    shellAppLabel,
    bootstrapWake: appOwnerWake.bootstrapWake,
    lifecycleWake: appOwnerWake.lifecycleWake,
    serviceWake: appOwnerWake.serviceWake,
    hostWake: appOwnerWake.hostWake,
    runnerTick: appOwnerWake.runnerTick,
    timerTick: appOwnerWake.timerTick,
    driverCycle: appOwnerWake.driverCycle,
    heartbeatCycle: appOwnerWake.heartbeatCycle,
    healthFeed: appOwnerWake.healthFeed,
    pollingDecision: appOwnerWake.pollingDecision,
    schedulerDecision: appOwnerWake.schedulerDecision,
    driverDecision: appOwnerWake.driverDecision,
    timerDecision: appOwnerWake.timerDecision,
    runnerDecision: appOwnerWake.runnerDecision,
    hostDecision: appOwnerWake.hostDecision,
    serviceDecision: appOwnerWake.serviceDecision,
    lifecycleDecision: appOwnerWake.lifecycleDecision,
    bootstrapDecision: appOwnerWake.bootstrapDecision,
    serviceState: appOwnerWake.serviceState,
    lifecycleState: appOwnerWake.lifecycleState,
    bootstrapState: appOwnerWake.bootstrapState,
    appOwnerDecision: appOwnerWake.appOwnerDecision,
    appOwnerState: appOwnerWake.appOwnerState,
    appOwnerOwned: appOwnerWake.appOwnerOwned,
    appOwnerActive: appOwnerWake.appOwnerActive,
    nextWakeAt: appOwnerWake.nextWakeAt,
    lastStartAt: appOwnerWake.lastStartAt,
    lastWakeAt: appOwnerWake.lastWakeAt,
    lastBackgroundAt: appOwnerWake.lastBackgroundAt,
    lastStopAt: appOwnerWake.lastStopAt,
    recommendedDelayMs: appOwnerWake.recommendedDelayMs,
    retryBackoffMs: appOwnerWake.retryBackoffMs,
    startupRuntimeSummary,
  };
}

export function runDesktopShellAppRuntimeShellOwnerWakeStub(params: {
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
} = {}): DesktopShellAppRuntimeShellOwnerWakeResult {
  const current = resolveLocalBridgeStartupPosture();
  const shellAppLabel =
    params.shellAppLabel?.trim()
    || current?.shellAppLabel
    || "Desktop Shell";
  const shellOwnerWake = wakeDesktopShellRuntimeShellOwner({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel,
    moduleLabel: current?.moduleLabel ?? undefined,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    hostStarted: params.hostStarted ?? true,
    runnerStarted: params.runnerStarted ?? true,
    timerArmed: params.timerArmed,
    serviceOwned: params.serviceOwned ?? true,
    lifecycleOwned: params.lifecycleOwned ?? true,
    bootstrapOwned: params.bootstrapOwned ?? true,
    appOwnerOwned: params.appOwnerOwned ?? true,
    appShellOwned: params.appShellOwned ?? true,
    lastTickAt: params.lastTickAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const startupRuntimeSummary =
    `${shellAppLabel} runtime shell owner observed ${shellOwnerWake.shellOwnerSummary}`;
  updateLocalBridgeStartupPosture({
    shellOwnerState: shellOwnerWake.shellOwnerState,
    shellOwnerOwned: shellOwnerWake.shellOwnerOwned,
    shellOwnerActive: shellOwnerWake.shellOwnerActive,
    nextWakeAt: shellOwnerWake.nextWakeAt,
    lastStartAt: shellOwnerWake.lastStartAt,
    lastWakeAt: shellOwnerWake.lastWakeAt,
    lastBackgroundAt: shellOwnerWake.lastBackgroundAt,
    lastStopAt: shellOwnerWake.lastStopAt,
    shellOwnerSummary: startupRuntimeSummary,
  });
  return {
    shellAppLabel,
    appOwnerWake: shellOwnerWake.appOwnerWake,
    bootstrapWake: shellOwnerWake.bootstrapWake,
    lifecycleWake: shellOwnerWake.lifecycleWake,
    serviceWake: shellOwnerWake.serviceWake,
    hostWake: shellOwnerWake.hostWake,
    runnerTick: shellOwnerWake.runnerTick,
    timerTick: shellOwnerWake.timerTick,
    driverCycle: shellOwnerWake.driverCycle,
    heartbeatCycle: shellOwnerWake.heartbeatCycle,
    healthFeed: shellOwnerWake.healthFeed,
    pollingDecision: shellOwnerWake.pollingDecision,
    schedulerDecision: shellOwnerWake.schedulerDecision,
    driverDecision: shellOwnerWake.driverDecision,
    timerDecision: shellOwnerWake.timerDecision,
    runnerDecision: shellOwnerWake.runnerDecision,
    hostDecision: shellOwnerWake.hostDecision,
    serviceDecision: shellOwnerWake.serviceDecision,
    lifecycleDecision: shellOwnerWake.lifecycleDecision,
    bootstrapDecision: shellOwnerWake.bootstrapDecision,
    appOwnerDecision: shellOwnerWake.appOwnerDecision,
    serviceState: shellOwnerWake.serviceState,
    lifecycleState: shellOwnerWake.lifecycleState,
    bootstrapState: shellOwnerWake.bootstrapState,
    appOwnerState: shellOwnerWake.appOwnerState,
    shellOwnerDecision: shellOwnerWake.shellOwnerDecision,
    shellOwnerState: shellOwnerWake.shellOwnerState,
    shellOwnerOwned: shellOwnerWake.shellOwnerOwned,
    shellOwnerActive: shellOwnerWake.shellOwnerActive,
    nextWakeAt: shellOwnerWake.nextWakeAt,
    lastStartAt: shellOwnerWake.lastStartAt,
    lastWakeAt: shellOwnerWake.lastWakeAt,
    lastBackgroundAt: shellOwnerWake.lastBackgroundAt,
    lastStopAt: shellOwnerWake.lastStopAt,
    recommendedDelayMs: shellOwnerWake.recommendedDelayMs,
    retryBackoffMs: shellOwnerWake.retryBackoffMs,
    startupRuntimeSummary,
  };
}

export function runDesktopShellAppRuntimeProcessHostWakeStub(params: {
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
} = {}): DesktopShellAppRuntimeProcessHostWakeResult {
  const current = resolveLocalBridgeStartupPosture();
  const shellAppLabel =
    params.shellAppLabel?.trim()
    || current?.shellAppLabel
    || "Desktop Shell";
  const processHostWake = foregroundDesktopShellRuntimeProcessHost({
    runtimeLabel: params.runtimeLabel,
    shellAppLabel,
    moduleLabel: current?.moduleLabel ?? undefined,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    hostStarted: params.hostStarted ?? true,
    runnerStarted: params.runnerStarted ?? true,
    timerArmed: params.timerArmed,
    serviceOwned: params.serviceOwned ?? true,
    lifecycleOwned: params.lifecycleOwned ?? true,
    bootstrapOwned: params.bootstrapOwned ?? true,
    appOwnerOwned: params.appOwnerOwned ?? true,
    appShellOwned: params.appShellOwned ?? true,
    processHostOwned: params.processHostOwned ?? true,
    lastTickAt: params.lastTickAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const startupRuntimeSummary =
    `${shellAppLabel} runtime process host observed ${processHostWake.processHostSummary}`;
  updateLocalBridgeStartupPosture({
    processHostState: processHostWake.processHostState,
    processHostOwned: processHostWake.processHostOwned,
    processHostActive: processHostWake.processHostActive,
    nextWakeAt: processHostWake.nextWakeAt,
    lastStartAt: processHostWake.lastStartAt,
    lastForegroundAt: processHostWake.lastForegroundAt,
    lastBackgroundAt: processHostWake.lastBackgroundAt,
    lastStopAt: processHostWake.lastStopAt,
    processHostSummary: startupRuntimeSummary,
  });
  return {
    shellAppLabel,
    shellOwnerWake: processHostWake.shellOwnerWake,
    appOwnerWake: processHostWake.appOwnerWake,
    bootstrapWake: processHostWake.bootstrapWake,
    lifecycleWake: processHostWake.lifecycleWake,
    serviceWake: processHostWake.serviceWake,
    hostWake: processHostWake.hostWake,
    runnerTick: processHostWake.runnerTick,
    timerTick: processHostWake.timerTick,
    driverCycle: processHostWake.driverCycle,
    heartbeatCycle: processHostWake.heartbeatCycle,
    healthFeed: processHostWake.healthFeed,
    pollingDecision: processHostWake.pollingDecision,
    schedulerDecision: processHostWake.schedulerDecision,
    driverDecision: processHostWake.driverDecision,
    timerDecision: processHostWake.timerDecision,
    runnerDecision: processHostWake.runnerDecision,
    hostDecision: processHostWake.hostDecision,
    serviceDecision: processHostWake.serviceDecision,
    lifecycleDecision: processHostWake.lifecycleDecision,
    bootstrapDecision: processHostWake.bootstrapDecision,
    appOwnerDecision: processHostWake.appOwnerDecision,
    shellOwnerDecision: processHostWake.shellOwnerDecision,
    serviceState: processHostWake.serviceState,
    lifecycleState: processHostWake.lifecycleState,
    bootstrapState: processHostWake.bootstrapState,
    appOwnerState: processHostWake.appOwnerState,
    shellOwnerState: processHostWake.shellOwnerState,
    processHostDecision: processHostWake.processHostDecision,
    processHostState: processHostWake.processHostState,
    processHostOwned: processHostWake.processHostOwned,
    processHostActive: processHostWake.processHostActive,
    nextWakeAt: processHostWake.nextWakeAt,
    lastStartAt: processHostWake.lastStartAt,
    lastForegroundAt: processHostWake.lastForegroundAt,
    lastBackgroundAt: processHostWake.lastBackgroundAt,
    lastStopAt: processHostWake.lastStopAt,
    recommendedDelayMs: processHostWake.recommendedDelayMs,
    retryBackoffMs: processHostWake.retryBackoffMs,
    startupRuntimeSummary,
  };
}

export function dispatchDesktopShellAppRuntimeProcessEventStub(params: {
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
}): DesktopShellAppRuntimeProcessEventResult {
  const current = resolveLocalBridgeStartupPosture();
  const shellAppLabel =
    params.shellAppLabel?.trim()
    || current?.shellAppLabel
    || "Desktop Shell";
  const processEvent = dispatchDesktopShellRuntimeProcessEvent({
    eventType: params.eventType,
    runtimeLabel: params.runtimeLabel,
    shellAppLabel,
    moduleLabel: current?.moduleLabel ?? undefined,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    hostStarted: params.hostStarted ?? true,
    runnerStarted: params.runnerStarted ?? true,
    timerArmed: params.timerArmed,
    serviceOwned: params.serviceOwned ?? true,
    lifecycleOwned: params.lifecycleOwned ?? true,
    bootstrapOwned: params.bootstrapOwned ?? true,
    appOwnerOwned: params.appOwnerOwned ?? true,
    appShellOwned: params.appShellOwned ?? true,
    processHostOwned: params.processHostOwned ?? true,
    lastTickAt: params.lastTickAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const startupRuntimeSummary =
    `${shellAppLabel} runtime process event adapter observed ${processEvent.processEventSummary}`;
  updateLocalBridgeStartupPosture({
    processEventType: processEvent.processEventType,
    processEventSource: processEvent.processEventSource,
    lastProcessEventAt: processEvent.lastProcessEventAt,
    processEventSummary: processEvent.processEventSummary,
  });
  return {
    shellAppLabel,
    processHostWake: processEvent.processHostWake,
    shellOwnerWake: processEvent.shellOwnerWake,
    appOwnerWake: processEvent.appOwnerWake,
    bootstrapWake: processEvent.bootstrapWake,
    lifecycleWake: processEvent.lifecycleWake,
    serviceWake: processEvent.serviceWake,
    hostWake: processEvent.hostWake,
    runnerTick: processEvent.runnerTick,
    timerTick: processEvent.timerTick,
    driverCycle: processEvent.driverCycle,
    heartbeatCycle: processEvent.heartbeatCycle,
    healthFeed: processEvent.healthFeed,
    pollingDecision: processEvent.pollingDecision,
    schedulerDecision: processEvent.schedulerDecision,
    driverDecision: processEvent.driverDecision,
    timerDecision: processEvent.timerDecision,
    runnerDecision: processEvent.runnerDecision,
    hostDecision: processEvent.hostDecision,
    serviceDecision: processEvent.serviceDecision,
    lifecycleDecision: processEvent.lifecycleDecision,
    bootstrapDecision: processEvent.bootstrapDecision,
    appOwnerDecision: processEvent.appOwnerDecision,
    shellOwnerDecision: processEvent.shellOwnerDecision,
    serviceState: processEvent.serviceState,
    lifecycleState: processEvent.lifecycleState,
    bootstrapState: processEvent.bootstrapState,
    appOwnerState: processEvent.appOwnerState,
    shellOwnerState: processEvent.shellOwnerState,
    processHostDecision: processEvent.processHostDecision,
    processHostState: processEvent.processHostState,
    processHostOwned: processEvent.processHostOwned,
    processHostActive: processEvent.processHostActive,
    processEventType: processEvent.processEventType,
    processEventSource: processEvent.processEventSource,
    lastProcessEventAt: processEvent.lastProcessEventAt,
    nextWakeAt: processEvent.nextWakeAt,
    lastStartAt: processEvent.lastStartAt,
    lastForegroundAt: processEvent.lastForegroundAt,
    lastBackgroundAt: processEvent.lastBackgroundAt,
    lastStopAt: processEvent.lastStopAt,
    recommendedDelayMs: processEvent.recommendedDelayMs,
    retryBackoffMs: processEvent.retryBackoffMs,
    processEventSummary: processEvent.processEventSummary,
    startupRuntimeSummary,
  };
}

export function dispatchDesktopShellAppRuntimeNativeProcessEventStub(params: {
  nativeEventType: DesktopShellRuntimeNativeProcessEventType;
  hostPlatform?: DesktopShellRuntimeNativeProcessEventResult["desktopHostPlatform"];
  nativeProcessIngressSource?: DesktopShellRuntimeNativeProcessEventResult["nativeProcessIngressSource"];
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
}): DesktopShellAppRuntimeNativeProcessEventResult {
  const current = resolveLocalBridgeStartupPosture();
  const shellAppLabel =
    params.shellAppLabel?.trim()
    || current?.shellAppLabel
    || "Desktop Shell";
  const nativeProcessEvent = dispatchDesktopShellRuntimeNativeProcessEvent({
    nativeEventType: params.nativeEventType,
    hostPlatform: params.hostPlatform,
    nativeEventIngressSource: params.nativeProcessIngressSource,
    runtimeLabel: params.runtimeLabel,
    shellAppLabel,
    moduleLabel: current?.moduleLabel ?? undefined,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    now: params.now,
    hostStarted: params.hostStarted ?? true,
    runnerStarted: params.runnerStarted ?? true,
    timerArmed: params.timerArmed,
    serviceOwned: params.serviceOwned ?? true,
    lifecycleOwned: params.lifecycleOwned ?? true,
    bootstrapOwned: params.bootstrapOwned ?? true,
    appOwnerOwned: params.appOwnerOwned ?? true,
    appShellOwned: params.appShellOwned ?? true,
    processHostOwned: params.processHostOwned ?? true,
    lastTickAt: params.lastTickAt,
    recommendedDelayMsOverride: params.recommendedDelayMsOverride,
    retryBackoffMsOverride: params.retryBackoffMsOverride,
  });
  const startupRuntimeSummary =
    `${shellAppLabel} runtime native process event bridge observed ${nativeProcessEvent.nativeProcessEventSummary}`;
  updateLocalBridgeStartupPosture({
    nativeProcessEventType: nativeProcessEvent.nativeProcessEventType,
    nativeProcessEventSource: nativeProcessEvent.nativeProcessEventSource,
    desktopHostPlatform: nativeProcessEvent.desktopHostPlatform,
    nativeProcessIngressSource: nativeProcessEvent.nativeProcessIngressSource,
    lastNativeProcessEventAt: nativeProcessEvent.lastNativeProcessEventAt,
    nativeProcessEventSummary: nativeProcessEvent.nativeProcessEventSummary,
  });
  return {
    shellAppLabel,
    processEventDispatch: nativeProcessEvent.processEventDispatch,
    processHostWake: nativeProcessEvent.processHostWake,
    shellOwnerWake: nativeProcessEvent.shellOwnerWake,
    appOwnerWake: nativeProcessEvent.appOwnerWake,
    bootstrapWake: nativeProcessEvent.bootstrapWake,
    lifecycleWake: nativeProcessEvent.lifecycleWake,
    serviceWake: nativeProcessEvent.serviceWake,
    hostWake: nativeProcessEvent.hostWake,
    runnerTick: nativeProcessEvent.runnerTick,
    timerTick: nativeProcessEvent.timerTick,
    driverCycle: nativeProcessEvent.driverCycle,
    heartbeatCycle: nativeProcessEvent.heartbeatCycle,
    healthFeed: nativeProcessEvent.healthFeed,
    pollingDecision: nativeProcessEvent.pollingDecision,
    schedulerDecision: nativeProcessEvent.schedulerDecision,
    driverDecision: nativeProcessEvent.driverDecision,
    timerDecision: nativeProcessEvent.timerDecision,
    runnerDecision: nativeProcessEvent.runnerDecision,
    hostDecision: nativeProcessEvent.hostDecision,
    serviceDecision: nativeProcessEvent.serviceDecision,
    lifecycleDecision: nativeProcessEvent.lifecycleDecision,
    bootstrapDecision: nativeProcessEvent.bootstrapDecision,
    appOwnerDecision: nativeProcessEvent.appOwnerDecision,
    shellOwnerDecision: nativeProcessEvent.shellOwnerDecision,
    serviceState: nativeProcessEvent.serviceState,
    lifecycleState: nativeProcessEvent.lifecycleState,
    bootstrapState: nativeProcessEvent.bootstrapState,
    appOwnerState: nativeProcessEvent.appOwnerState,
    shellOwnerState: nativeProcessEvent.shellOwnerState,
    processHostDecision: nativeProcessEvent.processHostDecision,
    processHostState: nativeProcessEvent.processHostState,
    processHostOwned: nativeProcessEvent.processHostOwned,
    processHostActive: nativeProcessEvent.processHostActive,
    nativeProcessEventType: nativeProcessEvent.nativeProcessEventType,
    nativeProcessEventSource: nativeProcessEvent.nativeProcessEventSource,
    desktopHostPlatform: nativeProcessEvent.desktopHostPlatform,
    nativeProcessIngressSource: nativeProcessEvent.nativeProcessIngressSource,
    lastNativeProcessEventAt: nativeProcessEvent.lastNativeProcessEventAt,
    processEventType: nativeProcessEvent.processEventType,
    processEventSource: nativeProcessEvent.processEventSource,
    lastProcessEventAt: nativeProcessEvent.lastProcessEventAt,
    nextWakeAt: nativeProcessEvent.nextWakeAt,
    lastStartAt: nativeProcessEvent.lastStartAt,
    lastForegroundAt: nativeProcessEvent.lastForegroundAt,
    lastBackgroundAt: nativeProcessEvent.lastBackgroundAt,
    lastStopAt: nativeProcessEvent.lastStopAt,
    recommendedDelayMs: nativeProcessEvent.recommendedDelayMs,
    retryBackoffMs: nativeProcessEvent.retryBackoffMs,
    processEventSummary: nativeProcessEvent.processEventSummary,
    nativeProcessEventSummary: nativeProcessEvent.nativeProcessEventSummary,
    startupRuntimeSummary,
  };
}
