import type { ShellLocalBridgeStartupPosture } from "./shell-app-contract.js";
import {
  backgroundDesktopShellRuntimeProcessHost,
  foregroundDesktopShellRuntimeProcessHost,
  startDesktopShellRuntimeProcessHost,
  stopDesktopShellRuntimeProcessHost,
  type DesktopShellRuntimeProcessHostOptions,
  type DesktopShellRuntimeProcessHostResult,
} from "./shell-local-bridge-desktop-runtime.process-host.js";
import { updateLocalBridgeStartupPosture } from "./shell-local-bridge-provider-runtime.js";

export const DESKTOP_RUNTIME_PROCESS_EVENT_SOURCE = "desktop_main_process_event_bridge" as const;

export type DesktopShellRuntimeProcessEventType =
  NonNullable<ShellLocalBridgeStartupPosture["processEventType"]>;

export type DesktopShellRuntimeProcessEventOptions =
  DesktopShellRuntimeProcessHostOptions & {
    eventType: DesktopShellRuntimeProcessEventType;
  };

export type DesktopShellRuntimeProcessEventSnapshot = {
  processHostWake: DesktopShellRuntimeProcessHostResult;
  processHostState: DesktopShellRuntimeProcessHostResult["processHostState"];
  processHostOwned: boolean;
  processHostActive: boolean;
  processEventType: DesktopShellRuntimeProcessEventType;
  processEventSource: typeof DESKTOP_RUNTIME_PROCESS_EVENT_SOURCE;
  lastProcessEventAt: string;
  nextWakeAt: string | null;
  processHostSummary: string;
  processEventSummary: string;
};

export type DesktopShellRuntimeProcessEventResult =
  DesktopShellRuntimeProcessHostResult & {
    processHostWake: DesktopShellRuntimeProcessHostResult;
    processEventType: DesktopShellRuntimeProcessEventType;
    processEventSource: typeof DESKTOP_RUNTIME_PROCESS_EVENT_SOURCE;
    lastProcessEventAt: string;
    processEventSummary: string;
  };

function resolveProcessEventSummary(params: {
  eventType: DesktopShellRuntimeProcessEventType;
  shellAppLabel: string;
  processHostSummary: string;
}): string {
  switch (params.eventType) {
    case "start":
      return `${params.shellAppLabel} reported desktop main-process start and ${params.processHostSummary}`;
    case "foreground":
      return `${params.shellAppLabel} reported desktop main-process foreground and ${params.processHostSummary}`;
    case "background":
      return `${params.shellAppLabel} reported desktop main-process background and ${params.processHostSummary}`;
    case "stop":
      return `${params.shellAppLabel} reported desktop main-process stop and ${params.processHostSummary}`;
  }
}

export function resolveDesktopShellRuntimeProcessEventSnapshot(params: {
  processHostWake: DesktopShellRuntimeProcessHostResult;
  eventType: DesktopShellRuntimeProcessEventType;
  shellAppLabel?: string;
  now?: number;
}): DesktopShellRuntimeProcessEventSnapshot {
  const now = params.now ?? Date.now();
  const lastProcessEventAt = new Date(now).toISOString();
  const shellAppLabel = params.shellAppLabel?.trim() || "Desktop Shell";
  return {
    processHostWake: params.processHostWake,
    processHostState: params.processHostWake.processHostState,
    processHostOwned: params.processHostWake.processHostOwned,
    processHostActive: params.processHostWake.processHostActive,
    processEventType: params.eventType,
    processEventSource: DESKTOP_RUNTIME_PROCESS_EVENT_SOURCE,
    lastProcessEventAt,
    nextWakeAt: params.processHostWake.nextWakeAt,
    processHostSummary: params.processHostWake.processHostSummary,
    processEventSummary: resolveProcessEventSummary({
      eventType: params.eventType,
      shellAppLabel,
      processHostSummary: params.processHostWake.processHostSummary,
    }),
  };
}

export function dispatchDesktopShellRuntimeProcessEvent(
  options: DesktopShellRuntimeProcessEventOptions,
): DesktopShellRuntimeProcessEventResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const processHostWake =
    options.eventType === "start"
      ? startDesktopShellRuntimeProcessHost(options)
      : options.eventType === "foreground"
        ? foregroundDesktopShellRuntimeProcessHost(options)
        : options.eventType === "background"
          ? backgroundDesktopShellRuntimeProcessHost({
              now,
              shellAppLabel,
            })
          : stopDesktopShellRuntimeProcessHost({
              now,
              shellAppLabel,
            });
  const snapshot = resolveDesktopShellRuntimeProcessEventSnapshot({
    processHostWake,
    eventType: options.eventType,
    shellAppLabel,
    now,
  });
  updateLocalBridgeStartupPosture({
    processEventType: snapshot.processEventType,
    processEventSource: snapshot.processEventSource,
    lastProcessEventAt: snapshot.lastProcessEventAt,
    processEventSummary: snapshot.processEventSummary,
  });
  return {
    ...processHostWake,
    processHostWake,
    processEventType: snapshot.processEventType,
    processEventSource: snapshot.processEventSource,
    lastProcessEventAt: snapshot.lastProcessEventAt,
    processEventSummary: snapshot.processEventSummary,
  };
}
