import {
  startDesktopLocalBridgeStartupStub,
  describeDesktopLocalBridgeStartupProviderStatus,
  type DesktopLocalBridgeStartupOptions,
} from "./shell-local-bridge-desktop-startup.stub.js";
import type { ShellLocalBridgeAdapter } from "./shell-app-contract.js";
import {
  appendLocalBridgeHealthEvent,
  setLocalBridgeStartupPosture,
} from "./shell-local-bridge-provider-runtime.js";

export type DesktopShellLocalBridgeStartupWiringOptions =
  DesktopLocalBridgeStartupOptions & {
    shellAppLabel?: string;
  };

export type DesktopShellLocalBridgeStartupWiringResult =
  ReturnType<typeof startDesktopLocalBridgeStartupStub> & {
    shellAppLabel: string;
    startupModeLabel: string;
    startupSummary: string;
    healthStatus:
      | "simulated"
      | "awaiting_attach"
      | "healthy"
      | "degraded"
      | "unavailable";
    healthStatusLabel: string;
    providerKey: string | null;
    providerStatus: ReturnType<typeof startDesktopLocalBridgeStartupStub>["providerStatus"];
    providerStatusLabel: string;
  };

export function resolveDesktopShellLocalBridgeHealthStatus(params: {
  mode: "simulated" | "desktop";
  attached: boolean;
  adapterReadiness?: ShellLocalBridgeAdapter["readiness"];
}): DesktopShellLocalBridgeStartupWiringResult["healthStatus"] {
  if (params.mode !== "desktop") {
    return "simulated";
  }
  if (!params.attached) {
    return "awaiting_attach";
  }
  if (params.adapterReadiness === "degraded") {
    return "degraded";
  }
  if (params.adapterReadiness === "unavailable") {
    return "unavailable";
  }
  return "healthy";
}

export function describeDesktopShellLocalBridgeHealthStatus(
  status: DesktopShellLocalBridgeStartupWiringResult["healthStatus"],
): string {
  switch (status) {
    case "simulated":
      return "simulated bridge path";
    case "awaiting_attach":
      return "awaiting desktop attach";
    case "degraded":
      return "desktop bridge degraded";
    case "unavailable":
      return "desktop bridge unavailable";
    case "healthy":
    default:
      return "desktop bridge ready";
  }
}

export function summarizeDesktopShellLocalBridgeStartupWiring(params: {
  mode: "simulated" | "desktop";
  attached: boolean;
  adapterReadiness?: ShellLocalBridgeAdapter["readiness"];
  contractVersion: "v1";
  adapterLabel: string | null;
  shellAppLabel?: string;
  providerKey?: string | null;
  providerStatus: ReturnType<typeof startDesktopLocalBridgeStartupStub>["providerStatus"];
}): DesktopShellLocalBridgeStartupWiringResult {
  const shellAppLabel = params.shellAppLabel?.trim() || "Desktop Shell";
  const startupModeLabel =
    params.mode === "desktop"
      ? "desktop bridge startup"
      : "simulated bridge startup";

  const startupSummary =
    params.mode === "desktop"
      ? params.attached
        ? `${shellAppLabel} attached ${params.adapterLabel ?? "desktop bridge"} during startup using contract ${params.contractVersion}.`
        : `${shellAppLabel} is in desktop bridge mode, but no desktop transport was attached during startup.`
      : `${shellAppLabel} is starting with the simulated local bridge path.`;
  const healthStatus = resolveDesktopShellLocalBridgeHealthStatus({
    mode: params.mode,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
  });

  return {
    mode: params.mode,
    attached: params.attached,
    adapterReadiness: params.adapterReadiness,
    healthStatus,
    healthStatusLabel: describeDesktopShellLocalBridgeHealthStatus(healthStatus),
    contractVersion: params.contractVersion,
    adapterLabel: params.adapterLabel,
    providerKey: params.providerKey?.trim() || null,
    providerStatus: params.providerStatus,
    providerStatusLabel: describeDesktopLocalBridgeStartupProviderStatus(params.providerStatus),
    shellAppLabel,
    startupModeLabel,
    startupSummary,
  };
}

export function summarizeDesktopShellLocalBridgeStartupFromAdapter(params: {
  adapter: Pick<ShellLocalBridgeAdapter, "mode" | "readiness" | "label">;
  contractVersion: "v1";
  shellAppLabel?: string;
  providerKey?: string | null;
}): DesktopShellLocalBridgeStartupWiringResult {
  return summarizeDesktopShellLocalBridgeStartupWiring({
    mode: params.adapter.mode,
    attached: params.adapter.mode === "desktop" ? params.adapter.readiness !== "unavailable" : false,
    adapterReadiness: params.adapter.readiness,
    contractVersion: params.contractVersion,
    adapterLabel: params.adapter.mode === "desktop" ? params.adapter.label : null,
    shellAppLabel: params.shellAppLabel,
    providerKey: params.providerKey,
    providerStatus: params.providerKey ? "registry_provider" : "no_provider",
  });
}

export function wireDesktopShellLocalBridgeStartup(
  options: DesktopShellLocalBridgeStartupWiringOptions = {},
): DesktopShellLocalBridgeStartupWiringResult {
  const shellAppLabel = options.shellAppLabel?.trim() || "Desktop Shell";
  const startup = startDesktopLocalBridgeStartupStub(options);
  const summary = summarizeDesktopShellLocalBridgeStartupWiring({
    ...startup,
    shellAppLabel,
  });
  setLocalBridgeStartupPosture({
    mode: summary.mode,
    attached: summary.attached,
    adapterReadiness: summary.adapterReadiness,
    healthSource: "startup_posture",
    healthStatus: summary.healthStatus,
    healthStatusLabel: summary.healthStatusLabel,
    healthEventSummary: null,
    startupModeLabel: summary.startupModeLabel,
    startupSummary: summary.startupSummary,
    startupSource: "desktop_startup_wiring",
    providerStatus: summary.providerStatus,
    providerStatusLabel: summary.providerStatusLabel,
    shellAppLabel: summary.shellAppLabel,
    providerKey: summary.providerKey,
  });
  appendLocalBridgeHealthEvent({
    occurredAt: new Date().toISOString(),
    source: "startup_posture",
    healthStatus: summary.healthStatus,
    healthStatusLabel: summary.healthStatusLabel,
    summary: summary.startupSummary,
    shellAppLabel: summary.shellAppLabel,
    providerKey: summary.providerKey,
  });
  return summary;
}
