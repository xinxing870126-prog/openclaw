import type { DesktopLocalBridgeProviderOptions } from "./shell-local-bridge-desktop-provider.stub.js";
import { bootstrapDesktopLocalBridgeProvider } from "./shell-local-bridge-desktop-bootstrap.js";
import { resolveDesktopLocalBridgeProviderFactory } from "./shell-local-bridge-desktop-provider-registry.js";

export function resolveDesktopLocalBridgeStartupMode(
  env: NodeJS.ProcessEnv = process.env,
): "simulated" | "desktop" {
  const configured =
    env.OPENCLAW_LOCAL_BRIDGE_ADAPTER?.trim().toLowerCase()
    || env.OPENCLAW_SHELL_LOCAL_BRIDGE_ADAPTER?.trim().toLowerCase()
    || "simulated";
  return configured === "desktop" ? "desktop" : "simulated";
}

export function resolveDesktopLocalBridgeStartupProviderKey(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const configured =
    env.OPENCLAW_DESKTOP_LOCAL_BRIDGE_PROVIDER_KEY?.trim()
    || env.OPENCLAW_SHELL_LOCAL_BRIDGE_PROVIDER_KEY?.trim()
    || "";
  return configured || null;
}

export type DesktopLocalBridgeStartupOptions = {
  env?: NodeJS.ProcessEnv;
  transport?: DesktopLocalBridgeProviderOptions["transport"] | null;
  providerKey?: string | null;
  readiness?: DesktopLocalBridgeProviderOptions["readiness"];
  label?: string;
  summary?: string;
  supports?: DesktopLocalBridgeProviderOptions["supports"];
};

export type DesktopLocalBridgeStartupProviderStatus =
  | "direct_transport"
  | "registry_provider"
  | "missing_provider"
  | "no_provider";

export function resolveDesktopLocalBridgeStartupProviderStatus(params: {
  hasTransport: boolean;
  providerKey: string | null;
  providerFactory: ReturnType<typeof resolveDesktopLocalBridgeProviderFactory>;
}): DesktopLocalBridgeStartupProviderStatus {
  if (params.hasTransport) {
    return "direct_transport";
  }
  if (params.providerKey && params.providerFactory) {
    return "registry_provider";
  }
  if (params.providerKey) {
    return "missing_provider";
  }
  return "no_provider";
}

export function describeDesktopLocalBridgeStartupProviderStatus(
  status: DesktopLocalBridgeStartupProviderStatus,
): string {
  switch (status) {
    case "direct_transport":
      return "direct desktop transport";
    case "registry_provider":
      return "registered desktop provider";
    case "missing_provider":
      return "missing desktop provider";
    case "no_provider":
    default:
      return "no desktop provider";
  }
}

export function startDesktopLocalBridgeStartupStub(
  options: DesktopLocalBridgeStartupOptions = {},
): ReturnType<typeof bootstrapDesktopLocalBridgeProvider> {
  const mode = resolveDesktopLocalBridgeStartupMode(options.env);
  const providerKey = options.providerKey?.trim() || resolveDesktopLocalBridgeStartupProviderKey(options.env);
  const providerFactory = !options.transport && providerKey
    ? resolveDesktopLocalBridgeProviderFactory(providerKey)
    : null;
  const provider = providerFactory?.() ?? null;
  const startup = bootstrapDesktopLocalBridgeProvider({
    mode,
    transport: options.transport,
    provider,
    providerKey,
    readiness: options.readiness,
    label: options.label,
    summary: options.summary,
    supports: options.supports,
  });
  return {
    ...startup,
    providerStatus: resolveDesktopLocalBridgeStartupProviderStatus({
      hasTransport: Boolean(options.transport),
      providerKey,
      providerFactory,
    }),
  };
}
