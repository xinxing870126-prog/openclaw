import path from "node:path";
import process from "node:process";
import { buildWindowsMsiInstaller } from "../src/windows-installer/msi.js";

function readFlag(name: string): boolean {
  return process.argv.includes(name);
}

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function main() {
  const rootDir = process.cwd();
  const outDir =
    readOption("--out-dir") ? path.resolve(rootDir, readOption("--out-dir")!) : undefined;
  const version = readOption("--version");
  const artifactName = readOption("--artifact-name");
  const wixBinary = readOption("--wix-binary");
  const skipWixBuild = readFlag("--skip-wix-build");

  const result = await buildWindowsMsiInstaller({
    rootDir,
    outDir,
    version,
    artifactName,
    wixBinary,
    skipWixBuild,
  });

  process.stdout.write(
    JSON.stringify(
      {
        artifactPath: result.artifactPath,
        artifactName: result.artifactName,
        sourcePath: result.sourcePath,
        stageDir: result.stageDir,
        installRoot: result.installRoot,
        version: result.version,
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((error) => {
  console.error(`[build-windows-msi] ${String(error)}`);
  process.exitCode = 1;
});
