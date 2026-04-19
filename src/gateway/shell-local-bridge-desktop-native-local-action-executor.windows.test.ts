import { afterEach, describe, expect, it } from "vitest";
import {
  executeDesktopNativeLocalAction,
  isDesktopNativeLocalActionExecutorStarted,
  resolveDesktopNativeLocalActionCapabilityMatrix,
  resolveDesktopNativeLocalActionExecutionRequest,
  setDesktopNativeLocalActionCommandRunnerForTests,
  startDesktopNativeLocalActionExecutor,
  stopDesktopNativeLocalActionExecutor,
} from "./shell-local-bridge-desktop-native-local-action-executor.windows.js";

describe("windows desktop native local-action executor seam", () => {
  afterEach(() => {
    stopDesktopNativeLocalActionExecutor();
    setDesktopNativeLocalActionCommandRunnerForTests(null);
  });

  it("normalizes windows execution requests onto the canonical action semantics", () => {
    expect(resolveDesktopNativeLocalActionExecutionRequest({
      actionId: "pick-file-1",
      actionType: "pick_file",
      title: "Pick file",
      description: "Choose a file",
    })).toMatchObject({
      actionId: "pick-file-1",
      actionType: "pick_file",
      hostPlatform: "windows",
      executionMode: "file_picker",
      expectedPayloadShape: "{ path }",
      requiredPath: null,
    });

    expect(resolveDesktopNativeLocalActionExecutionRequest({
      actionId: "pick-folder-1",
      actionType: "pick_folder",
      title: "Pick folder",
      description: "Choose a folder",
    })).toMatchObject({
      actionId: "pick-folder-1",
      actionType: "pick_folder",
      hostPlatform: "windows",
      executionMode: "folder_picker",
      expectedPayloadShape: "{ path }",
      requiredPath: null,
    });

    expect(resolveDesktopNativeLocalActionExecutionRequest({
      actionId: "open-file-1",
      actionType: "open_file",
      title: "Open file",
      description: "Open a file",
      constraints: {
        path: "C:/temp/generated.txt",
      },
    })).toMatchObject({
      actionId: "open-file-1",
      actionType: "open_file",
      hostPlatform: "windows",
      executionMode: "default_file_open",
      expectedPayloadShape: "{ path, opened: true }",
      requiredPath: "C:/temp/generated.txt",
    });

    expect(resolveDesktopNativeLocalActionExecutionRequest({
      actionId: "confirm-1",
      actionType: "confirm_execution",
      title: "Confirm",
      description: "Approve execution",
    })).toMatchObject({
      actionId: "confirm-1",
      actionType: "confirm_execution",
      hostPlatform: "windows",
      executionMode: "confirmation_dialog",
      expectedPayloadShape: null,
      requiredPath: null,
    });

    expect(resolveDesktopNativeLocalActionCapabilityMatrix()).toMatchObject({
      open_file: {
        supported: true,
        hostPlatform: "windows",
        executionMode: "default_file_open",
      },
    });
  });

  it("keeps the windows executor seam explicit until the runtime starts", async () => {
    expect(isDesktopNativeLocalActionExecutorStarted()).toBe(false);

    const notStartedResult = await executeDesktopNativeLocalAction({
      actionId: "open-file-2",
      actionType: "open_file",
      title: "Open file",
      description: "Open a file",
      constraints: {
        path: "C:/temp/generated.txt",
      },
    });
    expect(notStartedResult).toMatchObject({
      actionId: "open-file-2",
      approved: false,
      error: "windows_executor_not_started",
      executionSource: "windows_local_action_executor",
      payload: {
        path: "C:/temp/generated.txt",
        opened: false,
      },
    });
  });

  it("executes concrete windows native local actions through the injected command runner", async () => {
    startDesktopNativeLocalActionExecutor();
    setDesktopNativeLocalActionCommandRunnerForTests(async ({ request }) => {
      if (request.actionType === "pick_folder") {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            approved: true,
            payload: {
              path: "C:/Users/example/Documents",
            },
          }),
          stderr: "",
        };
      }
      if (request.actionType === "confirm_execution") {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            approved: false,
            error: "user_rejected",
          }),
          stderr: "",
        };
      }
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          approved: true,
          payload: {
            path: request.requiredPath,
            opened: true,
          },
        }),
        stderr: "",
      };
    });

    const folderResult = await executeDesktopNativeLocalAction({
      actionId: "pick-folder-2",
      actionType: "pick_folder",
      title: "Pick folder",
      description: "Choose a folder",
    });
    expect(folderResult).toMatchObject({
      actionId: "pick-folder-2",
      approved: true,
      payload: {
        path: "C:/Users/example/Documents",
      },
      executionSource: "windows_local_action_executor",
    });

    const openResult = await executeDesktopNativeLocalAction({
      actionId: "open-file-3",
      actionType: "open_file",
      title: "Open file",
      description: "Open a file",
      constraints: {
        path: "C:/temp/generated.txt",
      },
    });
    expect(openResult).toMatchObject({
      actionId: "open-file-3",
      approved: true,
      payload: {
        path: "C:/temp/generated.txt",
        opened: true,
      },
      executionSource: "windows_local_action_executor",
    });

    const confirmResult = await executeDesktopNativeLocalAction({
      actionId: "confirm-2",
      actionType: "confirm_execution",
      title: "Confirm",
      description: "Approve execution",
    });
    expect(confirmResult).toMatchObject({
      actionId: "confirm-2",
      approved: false,
      error: "user_rejected",
      executionSource: "windows_local_action_executor",
    });
  });

  it("keeps open_file on the canonical path constraint semantics when the runner fails", async () => {
    startDesktopNativeLocalActionExecutor();
    setDesktopNativeLocalActionCommandRunnerForTests(async () => ({
      exitCode: 1,
      stdout: "",
      stderr: "start process failed",
    }));

    const failedOpen = await executeDesktopNativeLocalAction({
      actionId: "open-file-4",
      actionType: "open_file",
      title: "Open file",
      description: "Open a file",
      constraints: {
        path: "C:/temp/generated.txt",
      },
    });

    expect(failedOpen).toMatchObject({
      actionId: "open-file-4",
      approved: false,
      error: "windows_executor_failed",
      executionSource: "windows_local_action_executor",
      payload: {
        path: "C:/temp/generated.txt",
        opened: false,
      },
    });
  });
});
