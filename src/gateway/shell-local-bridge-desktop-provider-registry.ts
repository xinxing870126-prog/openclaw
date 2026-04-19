import type { LocalBridgeAdapterProvider } from "./shell-local-bridge-provider.js";

export type DesktopLocalBridgeProviderFactory = () => LocalBridgeAdapterProvider | null;

const DESKTOP_LOCAL_BRIDGE_PROVIDER_FACTORIES = new Map<string, DesktopLocalBridgeProviderFactory>();

function normalizeDesktopLocalBridgeProviderKey(key: string): string {
  return key.trim().toLowerCase();
}

export function registerDesktopLocalBridgeProviderFactory(
  key: string,
  factory: DesktopLocalBridgeProviderFactory,
): void {
  const normalized = normalizeDesktopLocalBridgeProviderKey(key);
  if (!normalized) {
    throw new Error("desktop local bridge provider key must not be empty");
  }
  DESKTOP_LOCAL_BRIDGE_PROVIDER_FACTORIES.set(normalized, factory);
}

export function unregisterDesktopLocalBridgeProviderFactory(key: string): void {
  const normalized = key.trim().toLowerCase();
  if (!normalized) {
    return;
  }
  DESKTOP_LOCAL_BRIDGE_PROVIDER_FACTORIES.delete(normalized);
}

export function clearDesktopLocalBridgeProviderFactories(): void {
  DESKTOP_LOCAL_BRIDGE_PROVIDER_FACTORIES.clear();
}

export function resolveDesktopLocalBridgeProviderFactory(
  key: string | null | undefined,
): DesktopLocalBridgeProviderFactory | null {
  const normalized = key?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return DESKTOP_LOCAL_BRIDGE_PROVIDER_FACTORIES.get(normalized) ?? null;
}
