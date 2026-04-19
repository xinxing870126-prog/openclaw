import { describe, expect, it } from "vitest";
import {
  resolveShellDesktopNativeActionCapabilityMatrix,
  resolveShellDesktopNativeActionCapabilitySummary,
} from "./shell-app-contract.js";

describe("resolveShellDesktopNativeActionCapabilityMatrix", () => {
  it("declares the canonical macos native local-action capability matrix", () => {
    const capabilityMatrix = resolveShellDesktopNativeActionCapabilityMatrix("macos");

    expect(capabilityMatrix).toMatchObject({
      pick_file: {
        actionType: "pick_file",
        supported: true,
        hostPlatform: "macos",
        executionMode: "file_picker",
      },
      pick_folder: {
        actionType: "pick_folder",
        supported: true,
        hostPlatform: "macos",
        executionMode: "folder_picker",
      },
      open_file: {
        actionType: "open_file",
        supported: true,
        hostPlatform: "macos",
        executionMode: "default_file_open",
      },
      confirm_execution: {
        actionType: "confirm_execution",
        supported: true,
        hostPlatform: "macos",
        executionMode: "confirmation_dialog",
      },
    });
    expect(resolveShellDesktopNativeActionCapabilitySummary({
      hostPlatform: "macos",
      capabilityMatrix,
    })).toContain("macos host native local-action capability matrix supports");
  });

  it("keeps the windows capability matrix on the same canonical action semantics", () => {
    const capabilityMatrix = resolveShellDesktopNativeActionCapabilityMatrix("windows");

    expect(capabilityMatrix).toMatchObject({
      pick_file: {
        actionType: "pick_file",
        supported: true,
        hostPlatform: "windows",
        executionMode: "file_picker",
      },
      pick_folder: {
        actionType: "pick_folder",
        supported: true,
        hostPlatform: "windows",
        executionMode: "folder_picker",
      },
      open_file: {
        actionType: "open_file",
        supported: true,
        hostPlatform: "windows",
        executionMode: "default_file_open",
      },
      confirm_execution: {
        actionType: "confirm_execution",
        supported: true,
        hostPlatform: "windows",
        executionMode: "confirmation_dialog",
      },
    });
    expect(resolveShellDesktopNativeActionCapabilitySummary({
      hostPlatform: "windows",
      capabilityMatrix,
    })).toContain("pick_file (file_picker)");
  });
});
