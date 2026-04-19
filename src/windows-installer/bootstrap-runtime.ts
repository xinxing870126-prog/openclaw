import { runWindowsPostInstallBootstrap, runWindowsPostUninstallCleanup } from "./msi.js";

function readArgValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] ?? null;
}

async function main() {
  const mode = process.argv[2]?.trim();
  const installRoot = readArgValue("--install-root");
  if (!mode || !installRoot) {
    throw new Error("Usage: bootstrap-runtime.js <install|uninstall> --install-root <path>");
  }

  if (mode === "install") {
    const result = await runWindowsPostInstallBootstrap({
      installRoot,
      env: process.env,
    });
    if (!result.gateway.ok || (result.companion.attempted && !result.companion.ok)) {
      console.error(
        `[windows-installer-bootstrap] install bootstrap failed: ${JSON.stringify(
          {
            gateway: {
              ok: result.gateway.ok,
              code: result.gateway.code,
              stdout: result.gateway.stdout,
              stderr: result.gateway.stderr,
            },
            companion: {
              attempted: result.companion.attempted,
              ok: result.companion.ok,
              skipped: result.companion.skipped,
              code: result.companion.code,
              stdout: result.companion.stdout,
              stderr: result.companion.stderr,
            },
            repairHints: result.status.repairHints,
            partialFailure: result.status.partialFailure,
          },
          null,
          2,
        )}`,
      );
      process.exitCode = 1;
    }
    return;
  }

  if (mode === "uninstall") {
    const result = await runWindowsPostUninstallCleanup({
      env: process.env,
    });
    if (!result.gatewayRemoved && !result.companionRemoved) {
      console.error(
        `[windows-installer-bootstrap] uninstall cleanup removed nothing: ${JSON.stringify(result, null, 2)}`,
      );
      process.exitCode = 1;
    }
    return;
  }

  throw new Error(`Unsupported Windows installer bootstrap mode: ${mode}`);
}

main().catch((error) => {
  console.error(`[windows-installer] ${String(error)}`);
  process.exitCode = 1;
});
