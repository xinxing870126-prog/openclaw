import path from "node:path";
import process from "node:process";
import { buildWindowsWingetManifestSet } from "../src/windows-installer/msi.js";

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

async function main() {
  const rootDir = process.cwd();
  const outDir = readOption("--out-dir")
    ? path.resolve(rootDir, readOption("--out-dir")!)
    : undefined;
  const result = await buildWindowsWingetManifestSet({
    artifactPath: requireOption("--artifact-path"),
    version: requireOption("--version"),
    releaseChannel: requireOption("--release-channel") as "stable" | "beta" | "dev",
    outDir,
    expectedSignerSubject: readOption("--expected-signer-subject"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  console.error(`[build-windows-winget] ${String(error)}`);
  process.exitCode = 1;
});
