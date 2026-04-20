import process from "node:process";
import {
  resolveWindowsReleaseArtifactMetadata,
  signWindowsMsiArtifact,
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
  const artifactPath = requireOption("--artifact-path");
  const version = requireOption("--version");
  const releaseChannel = requireOption("--release-channel");
  const pfxPath = requireOption("--pfx-path");
  const pfxPassword = requireOption("--pfx-password");
  const certSubject = readOption("--cert-subject");
  const signtoolBinary = readOption("--signtool-binary");
  const timestampUrl = readOption("--timestamp-url");

  const signingStatus = await signWindowsMsiArtifact({
    artifactPath,
    pfxPath,
    pfxPassword,
    certSubject,
    signtoolBinary,
    timestampUrl,
  });
  const metadata = await resolveWindowsReleaseArtifactMetadata({
    artifactPath,
    version,
    releaseChannel,
    expectedSignerSubject: certSubject,
    signingStatus,
  });
  process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
}

main().catch((error) => {
  console.error(`[sign-windows-msi] ${String(error)}`);
  process.exitCode = 1;
});
