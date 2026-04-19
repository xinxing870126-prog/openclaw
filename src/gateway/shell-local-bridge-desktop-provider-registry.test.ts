import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearDesktopLocalBridgeProviderFactories,
  registerDesktopLocalBridgeProviderFactory,
  resolveDesktopLocalBridgeProviderFactory,
  unregisterDesktopLocalBridgeProviderFactory,
} from "./shell-local-bridge-desktop-provider-registry.js";

afterEach(() => {
  clearDesktopLocalBridgeProviderFactories();
});

describe("shell local bridge desktop provider registry", () => {
  it("registers and resolves desktop provider factories by normalized key", () => {
    const factory = vi.fn(() => null);

    registerDesktopLocalBridgeProviderFactory(" OpenClaw-Desktop ", factory);

    expect(resolveDesktopLocalBridgeProviderFactory("openclaw-desktop")).toBe(factory);
    expect(resolveDesktopLocalBridgeProviderFactory(" OPENCLAW-DESKTOP ")).toBe(factory);
  });

  it("unregisters desktop provider factories", () => {
    const factory = vi.fn(() => null);

    registerDesktopLocalBridgeProviderFactory("desktop", factory);
    unregisterDesktopLocalBridgeProviderFactory("desktop");

    expect(resolveDesktopLocalBridgeProviderFactory("desktop")).toBeNull();
  });
});
