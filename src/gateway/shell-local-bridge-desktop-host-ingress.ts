import type { ShellLocalBridgeStartupPosture } from "./shell-app-contract.js";

export const DESKTOP_HOST_PLATFORMS = ["macos", "windows"] as const;
export const DESKTOP_HOST_LIFECYCLE_INGRESS_SOURCES = [
  "macos_app_lifecycle",
  "windows_app_lifecycle",
] as const;

export type DesktopHostPlatform = NonNullable<ShellLocalBridgeStartupPosture["desktopHostPlatform"]>;
export type DesktopHostLifecycleIngressSource =
  NonNullable<ShellLocalBridgeStartupPosture["nativeProcessIngressSource"]>;

const DEFAULT_INGRESS_BY_PLATFORM: Record<DesktopHostPlatform, DesktopHostLifecycleIngressSource> = {
  macos: "macos_app_lifecycle",
  windows: "windows_app_lifecycle",
};

const DEFAULT_PLATFORM_BY_INGRESS: Record<DesktopHostLifecycleIngressSource, DesktopHostPlatform> = {
  macos_app_lifecycle: "macos",
  windows_app_lifecycle: "windows",
};

export function isDesktopHostPlatform(input: string | null | undefined): input is DesktopHostPlatform {
  return input === "macos" || input === "windows";
}

export function isDesktopHostLifecycleIngressSource(
  input: string | null | undefined,
): input is DesktopHostLifecycleIngressSource {
  return input === "macos_app_lifecycle" || input === "windows_app_lifecycle";
}

export function resolveDesktopHostLifecycleIngress(params: {
  hostPlatform?: string | null;
  source?: string | null;
}): {
  hostPlatform: DesktopHostPlatform;
  source: DesktopHostLifecycleIngressSource;
} {
  const normalizedPlatform = params.hostPlatform?.trim() ?? "";
  const normalizedSource = params.source?.trim() ?? "";

  if (isDesktopHostPlatform(normalizedPlatform) && isDesktopHostLifecycleIngressSource(normalizedSource)) {
    if (DEFAULT_PLATFORM_BY_INGRESS[normalizedSource] !== normalizedPlatform) {
      throw new Error(`source ${normalizedSource} does not match hostPlatform ${normalizedPlatform}`);
    }
    return {
      hostPlatform: normalizedPlatform,
      source: normalizedSource,
    };
  }
  if (isDesktopHostPlatform(normalizedPlatform)) {
    return {
      hostPlatform: normalizedPlatform,
      source: DEFAULT_INGRESS_BY_PLATFORM[normalizedPlatform],
    };
  }
  if (isDesktopHostLifecycleIngressSource(normalizedSource)) {
    return {
      hostPlatform: DEFAULT_PLATFORM_BY_INGRESS[normalizedSource],
      source: normalizedSource,
    };
  }
  return {
    hostPlatform: "macos",
    source: "macos_app_lifecycle",
  };
}
