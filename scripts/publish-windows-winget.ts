import process from "node:process";
import {
  buildWindowsWingetManifestSet,
  publishWindowsWingetManifest,
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

async function main() {
  const manifestSet = await buildWindowsWingetManifestSet({
    artifactPath: requireOption("--artifact-path"),
    version: requireOption("--version"),
    releaseChannel: requireOption("--release-channel") as "stable" | "beta" | "dev",
    outDir: readOption("--out-dir"),
    expectedSignerSubject: readOption("--expected-signer-subject"),
  });
  const result = await publishWindowsWingetManifest({
    manifestSet,
    forkRepo: requireOption("--fork-repo"),
    targetRepo: readOption("--target-repo"),
    baseBranch: readOption("--base-branch"),
    branchName: readOption("--branch-name"),
    githubToken: requireOption("--github-token"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  console.error(`[publish-windows-winget] ${String(error)}`);
  process.exitCode = 1;
});
