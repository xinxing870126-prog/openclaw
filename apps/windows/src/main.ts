import { runDesktopWindowsCompanionForeground } from "../../../src/windows-companion/runtime.js";

void runDesktopWindowsCompanionForeground().catch((error) => {
  console.error("[DesktopWindowsCompanionHost]", error);
  process.exitCode = 1;
});
