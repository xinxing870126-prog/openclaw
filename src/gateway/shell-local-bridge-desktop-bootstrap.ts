import {
  createDesktopLocalBridgeProvider,
  type DesktopLocalBridgeProviderOptions,
} from "./shell-local-bridge-desktop-provider.stub.js";
import {
  attachLocalBridgeAdapterProvider,
  resolveAttachedDesktopLocalBridgeAdapter,
} from "./shell-local-bridge-provider-runtime.js";
import {
  DEFAULT_LOCAL_BRIDGE_CONTRACT,
  type LocalBridgeAdapterProvider,
} from "./shell-local-bridge-provider.js";

export type DesktopLocalBridgeBootstrapOptions = {
  mode?: "simulated" | "desktop";
  transport?: DesktopLocalBridgeProviderOptions["transport"] | null;
  provider?: LocalBridgeAdapterProvider | null;
  providerKey?: string | null;
  readiness?: DesktopLocalBridgeProviderOptions["readiness"];
  label?: string;
  summary?: string;
  supports?: DesktopLocalBridgeProviderOptions["supports"];
};

export function bootstrapDesktopLocalBridgeProvider(
  options: DesktopLocalBridgeBootstrapOptions = {},
): {
  mode: "simulated" | "desktop";
  attached: boolean;
  adapterReadiness: DesktopLocalBridgeProviderOptions["readiness"] | "unavailable";
  contractVersion: typeof DEFAULT_LOCAL_BRIDGE_CONTRACT.version;
  adapterLabel: string | null;
  providerKey: string | null;
} {
  if (options.mode !== "desktop") {
    attachLocalBridgeAdapterProvider(null);
    return {
      mode: "simulated",
      attached: false,
      adapterReadiness: "unavailable",
      contractVersion: DEFAULT_LOCAL_BRIDGE_CONTRACT.version,
      adapterLabel: null,
      providerKey: null,
    };
  }

  if (!options.transport && !options.provider) {
    attachLocalBridgeAdapterProvider(null);
    return {
      mode: "desktop",
      attached: false,
      adapterReadiness: "unavailable",
      contractVersion: DEFAULT_LOCAL_BRIDGE_CONTRACT.version,
      adapterLabel: null,
      providerKey: options.providerKey?.trim() || null,
    };
  }

  attachLocalBridgeAdapterProvider(
    options.provider
    ?? createDesktopLocalBridgeProvider({
      contract: DEFAULT_LOCAL_BRIDGE_CONTRACT,
      transport: options.transport!,
      readiness: options.readiness,
      label: options.label,
      summary: options.summary,
      supports: options.supports,
    }),
  );

  const attachedAdapter = resolveAttachedDesktopLocalBridgeAdapter();
  return {
    mode: "desktop",
    attached: Boolean(attachedAdapter),
    adapterReadiness: attachedAdapter?.getAdapter().readiness ?? "unavailable",
    contractVersion: DEFAULT_LOCAL_BRIDGE_CONTRACT.version,
    adapterLabel: attachedAdapter?.getAdapter().label ?? null,
    providerKey: options.providerKey?.trim() || null,
  };
}
