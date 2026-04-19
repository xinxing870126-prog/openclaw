import type { ShellLocalBridgeStartupPosture } from "./shell-app-contract.js";
import { resolveDesktopHostLifecycleIngress } from "./shell-local-bridge-desktop-host-ingress.js";
import { updateLocalBridgeStartupPosture } from "./shell-local-bridge-provider-runtime.js";
import {
  dispatchDesktopShellRuntimeProcessEvent,
  type DesktopShellRuntimeProcessEventOptions,
  type DesktopShellRuntimeProcessEventResult,
} from "./shell-local-bridge-desktop-runtime.process-events.js";

export const DESKTOP_RUNTIME_NATIVE_PROCESS_EVENT_SOURCE =
  "desktop_native_main_process_bridge" as const;

export type DesktopShellRuntimeNativeProcessEventType =
  NonNullable<ShellLocalBridgeStartupPosture["nativeProcessEventType"]>;

export type DesktopShellRuntimeNativeProcessEventOptions =
  Omit<DesktopShellRuntimeProcessEventOptions, "eventType"> & {
    nativeEventType: DesktopShellRuntimeNativeProcessEventType;
    nativeEventIngressSource?: ShellLocalBridgeStartupPosture["nativeProcessIngressSource"];
    hostPlatform?: ShellLocalBridgeStartupPosture["desktopHostPlatform"];
  };

export type DesktopShellRuntimeNativeProcessEventSnapshot = {
  processEventDispatch: DesktopShellRuntimeProcessEventResult;
  processHostState: DesktopShellRuntimeProcessEventResult["processHostState"];
  processHostOwned: boolean;
  processHostActive: boolean;
  nativeProcessEventType: DesktopShellRuntimeNativeProcessEventType;
  nativeProcessEventSource: typeof DESKTOP_RUNTIME_NATIVE_PROCESS_EVENT_SOURCE;
  desktopHostPlatform: NonNullable<ShellLocalBridgeStartupPosture["desktopHostPlatform"]>;
  nativeProcessIngressSource: NonNullable<ShellLocalBridgeStartupPosture["nativeProcessIngressSource"]>;
  lastNativeProcessEventAt: string;
  processEventType: DesktopShellRuntimeProcessEventResult["processEventType"];
  lastProcessEventAt: string;
  nextWakeAt: string | null;
  processHostSummary: string;
  processEventSummary: string;
  nativeProcessEventSummary: string;
};

export type DesktopShellRuntimeNativeProcessEventResult =
  DesktopShellRuntimeProcessEventResult & {
    processEventDispatch: DesktopShellRuntimeProcessEventResult;
    nativeProcessEventType: DesktopShellRuntimeNativeProcessEventType;
    nativeProcessEventSource: typeof DESKTOP_RUNTIME_NATIVE_PROCESS_EVENT_SOURCE;
    desktopHostPlatform: NonNullable<ShellLocalBridgeStartupPosture["desktopHostPlatform"]>;
    nativeProcessIngressSource: NonNullable<ShellLocalBridgeStartupPosture["nativeProcessIngressSource"]>;
    lastNativeProcessEventAt: string;
    nativeProcessEventSummary: string;
  };

function normalizeNativeProcessEventType(
  nativeEventType: DesktopShellRuntimeNativeProcessEventType,
): DesktopShellRuntimeProcessEventResult["processEventType"] {
  switch (nativeEventType) {
    case "app_started":
      return "start";
    case "app_foregrounded":
      return "foreground";
    case "app_backgrounded":
      return "background";
    case "app_stopped":
      return "stop";
  }
}

function resolveNativeProcessEventSummary(params: {
  nativeEventType: DesktopShellRuntimeNativeProcessEventType;
  shellAppLabel: string;
  processEventSummary: string;
  nativeEventIngressSource: NonNullable<ShellLocalBridgeStartupPosture["nativeProcessIngressSource"]>;
  hostPlatform: NonNullable<ShellLocalBridgeStartupPosture["desktopHostPlatform"]>;
}): string {
  const ingressClause = ` from ${params.nativeEventIngressSource} on ${params.hostPlatform}`;
  switch (params.nativeEventType) {
    case "app_started":
      return `${params.shellAppLabel} ingested native desktop app_started${ingressClause} and ${params.processEventSummary}`;
    case "app_foregrounded":
      return `${params.shellAppLabel} ingested native desktop app_foregrounded${ingressClause} and ${params.processEventSummary}`;
    case "app_backgrounded":
      return `${params.shellAppLabel} ingested native desktop app_backgrounded${ingressClause} and ${params.processEventSummary}`;
    case "app_stopped":
      return `${params.shellAppLabel} ingested native desktop app_stopped${ingressClause} and ${params.processEventSummary}`;
  }
}

export function resolveDesktopShellRuntimeNativeProcessEventSnapshot(params: {
  processEventDispatch: DesktopShellRuntimeProcessEventResult;
  nativeEventType: DesktopShellRuntimeNativeProcessEventType;
  shellAppLabel?: string;
  nativeEventIngressSource?: ShellLocalBridgeStartupPosture["nativeProcessIngressSource"];
  hostPlatform?: ShellLocalBridgeStartupPosture["desktopHostPlatform"];
  now?: number;
}): DesktopShellRuntimeNativeProcessEventSnapshot {
  const now = params.now ?? Date.now();
  const shellAppLabel = params.shellAppLabel?.trim() || "Desktop Shell";
  const lastNativeProcessEventAt = new Date(now).toISOString();
  const ingress = resolveDesktopHostLifecycleIngress({
    hostPlatform: params.hostPlatform,
    source: params.nativeEventIngressSource,
  });
  return {
    processEventDispatch: params.processEventDispatch,
    processHostState: params.processEventDispatch.processHostState,
    processHostOwned: params.processEventDispatch.processHostOwned,
    processHostActive: params.processEventDispatch.processHostActive,
    nativeProcessEventType: params.nativeEventType,
    nativeProcessEventSource: DESKTOP_RUNTIME_NATIVE_PROCESS_EVENT_SOURCE,
    desktopHostPlatform: ingress.hostPlatform,
    nativeProcessIngressSource: ingress.source,
    lastNativeProcessEventAt,
    processEventType: params.processEventDispatch.processEventType,
    lastProcessEventAt: params.processEventDispatch.lastProcessEventAt,
    nextWakeAt: params.processEventDispatch.nextWakeAt,
    processHostSummary: params.processEventDispatch.processHostSummary,
    processEventSummary: params.processEventDispatch.processEventSummary,
    nativeProcessEventSummary: resolveNativeProcessEventSummary({
      nativeEventType: params.nativeEventType,
      shellAppLabel,
      processEventSummary: params.processEventDispatch.processEventSummary,
      nativeEventIngressSource: ingress.source,
      hostPlatform: ingress.hostPlatform,
    }),
  };
}

export function dispatchDesktopShellRuntimeNativeProcessEvent(
  options: DesktopShellRuntimeNativeProcessEventOptions,
): DesktopShellRuntimeNativeProcessEventResult {
  const now = options.now ?? Date.now();
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const processEventDispatch = dispatchDesktopShellRuntimeProcessEvent({
    ...options,
    eventType: normalizeNativeProcessEventType(options.nativeEventType),
  });
  const snapshot = resolveDesktopShellRuntimeNativeProcessEventSnapshot({
    processEventDispatch,
    nativeEventType: options.nativeEventType,
    shellAppLabel,
    nativeEventIngressSource: options.nativeEventIngressSource,
    hostPlatform: options.hostPlatform,
    now,
  });
  updateLocalBridgeStartupPosture({
    nativeProcessEventType: snapshot.nativeProcessEventType,
    nativeProcessEventSource: snapshot.nativeProcessEventSource,
    desktopHostPlatform: snapshot.desktopHostPlatform,
    nativeProcessIngressSource: snapshot.nativeProcessIngressSource,
    lastNativeProcessEventAt: snapshot.lastNativeProcessEventAt,
    nativeProcessEventSummary: snapshot.nativeProcessEventSummary,
  });
  return {
    ...processEventDispatch,
    processEventDispatch,
    nativeProcessEventType: snapshot.nativeProcessEventType,
    nativeProcessEventSource: snapshot.nativeProcessEventSource,
    desktopHostPlatform: snapshot.desktopHostPlatform,
    nativeProcessIngressSource: snapshot.nativeProcessIngressSource,
    lastNativeProcessEventAt: snapshot.lastNativeProcessEventAt,
    nativeProcessEventSummary: snapshot.nativeProcessEventSummary,
  };
}
