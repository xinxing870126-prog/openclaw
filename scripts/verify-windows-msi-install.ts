import process from "node:process";
import {
  runWindowsMsiSmokeInstall,
  runWindowsMsiSmokeRepair,
  runWindowsMsiSmokeUninstall,
} from "../src/windows-installer/msi.js";

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function requireOption(name: string): string {
  const value = readOption(name);
  if (!value?.trim()) {
    throw new Error(`Missing required option: ${name}`);
  }
  return value.trim();
}

function readNumberOption(name: string): number | undefined {
  const value = readOption(name);
  if (!value?.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric option for ${name}: ${value}`);
  }
  return parsed;
}

async function main() {
  const artifactPath = requireOption("--artifact-path");
  const timeoutMs = readNumberOption("--timeout-ms");
  const retryAttempts = readNumberOption("--retry-attempts");
  const retryDelayMs = readNumberOption("--retry-delay-ms");

  const install = await runWindowsMsiSmokeInstall({
    artifactPath,
    timeoutMs,
    retryAttempts,
    retryDelayMs,
  });
  const repair = await runWindowsMsiSmokeRepair({
    artifactPath,
    timeoutMs,
    retryAttempts,
    retryDelayMs,
  });
  const uninstall = await runWindowsMsiSmokeUninstall({
    artifactPath,
    timeoutMs,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        install,
        repair,
        uninstall,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  console.error(`[verify-windows-msi-install] ${String(error)}`);
  process.exitCode = 1;
});
