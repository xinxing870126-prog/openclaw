import process from "node:process";
import { resolveWindowsReleaseArtifactMetadata } from "../src/windows-installer/msi.js";

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
  const metadata = await resolveWindowsReleaseArtifactMetadata({
    artifactPath: requireOption("--artifact-path"),
    version: requireOption("--version"),
    releaseChannel: requireOption("--release-channel"),
    expectedSignerSubject: readOption("--expected-signer-subject"),
  });
  process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
}

main().catch((error) => {
  console.error(`[resolve-windows-release-metadata] ${String(error)}`);
  process.exitCode = 1;
});
