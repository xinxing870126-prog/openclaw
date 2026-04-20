import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readGatewayServiceState = vi.fn();
const resolveWindowsCompanionInstallerStatus = vi.fn();
const uninstallWindowsCompanionFromInstaller = vi.fn();
const runCommandWithTimeout = vi.fn();

vi.mock("../daemon/service.js", () => ({
  resolveGatewayService: () => ({
    stop: vi.fn(),
    uninstall: vi.fn(),
  }),
  readGatewayServiceState,
}));

vi.mock("../windows-companion/installer.js", () => ({
  installWindowsCompanionFromInstaller: vi.fn(),
  resolveWindowsCompanionInstallerStatus,
  uninstallWindowsCompanionFromInstaller,
}));

vi.mock("../process/exec.js", () => ({
  runCommandWithTimeout,
}));

const installer = await import("./msi.js");

describe("windows MSI helpers", () => {
  let stateDir: string;
  let installRoot: string;

  beforeEach(async () => {
    stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-windows-installer-state-"));
    installRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-windows-installer-root-"));
    process.env.OPENCLAW_STATE_DIR = stateDir;
    await fs.mkdir(path.join(installRoot, "dist", "windows-installer"), { recursive: true });
    await fs.writeFile(path.join(installRoot, "dist", "entry.js"), "console.log('cli');\n", "utf8");
    await fs.writeFile(
      path.join(installRoot, "dist", "windows-installer", "bootstrap-runtime.js"),
      "console.log('bootstrap');\n",
      "utf8",
    );
    readGatewayServiceState.mockResolvedValue({
      installed: true,
      loaded: true,
      running: true,
      env: process.env,
      command: null,
      runtime: { status: "running" },
    });
    resolveWindowsCompanionInstallerStatus.mockResolvedValue({
      selected: true,
      configured: true,
      installed: true,
      loaded: true,
      running: true,
      installMode: "schtasks",
      profile: null,
      supervisorLabel: "OpenClaw Windows Companion",
      config: { version: 1, installMode: "schtasks" },
    });
    uninstallWindowsCompanionFromInstaller.mockResolvedValue({
      attempted: true,
      removed: true,
      configRemoved: true,
    });
    runCommandWithTimeout.mockReset();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    delete process.env.OPENCLAW_STATE_DIR;
    await fs.rm(stateDir, { recursive: true, force: true });
    await fs.rm(installRoot, { recursive: true, force: true });
  });

  it("persists an MSI manifest with a repair hint when companion bootstrap fails", async () => {
    runCommandWithTimeout
      .mockResolvedValueOnce({
        code: 0,
        stdout: '{"ok":true}',
        stderr: "",
      })
      .mockResolvedValueOnce({
        code: 1,
        stdout: "",
        stderr: "companion failed",
      });
    resolveWindowsCompanionInstallerStatus.mockResolvedValue({
      selected: true,
      configured: false,
      installed: false,
      loaded: false,
      running: false,
      installMode: null,
      profile: null,
      supervisorLabel: null,
      config: null,
    });

    const result = await installer.runWindowsPostInstallBootstrap({
      installRoot,
      env: process.env,
      productVersion: "2026.4.10",
    });

    expect(result.gateway.ok).toBe(true);
    expect(result.companion.ok).toBe(false);
    expect(result.manifest.repairHint).toBe("openclaw windows-companion install --force");

    const persisted = await installer.loadWindowsInstallerManifest(process.env);
    expect(persisted?.companionBootstrapSucceeded).toBe(false);
    expect(persisted?.repairHint).toBe("openclaw windows-companion install --force");
  });

  it("reports repair hints when the MSI baseline expects a missing companion host", async () => {
    await installer.saveWindowsInstallerManifest(
      {
        version: 1,
        installMode: "msi",
        productName: "OpenClaw",
        productVersion: "2026.4.10",
        architecture: "x64",
        installRoot,
        installedAt: "2026-04-18T00:00:00.000Z",
        updatedAt: "2026-04-18T00:00:00.000Z",
        companionEnabled: true,
        gatewayBootstrapSucceeded: true,
        companionBootstrapSucceeded: false,
        repairHint: "openclaw windows-companion install --force",
      },
      process.env,
    );
    resolveWindowsCompanionInstallerStatus.mockResolvedValue({
      selected: true,
      configured: false,
      installed: false,
      loaded: false,
      running: false,
      installMode: null,
      profile: null,
      supervisorLabel: null,
      config: null,
    });

    const status = await installer.resolveWindowsInstallerBootstrapStatus({
      env: process.env,
    });

    expect(status.manifestPresent).toBe(true);
    expect(status.partialFailure).toBe(true);
    expect(status.repairHints).toContain("openclaw windows-companion install --force");
  });

  it("renders a WiX source with bootstrap custom actions and component refs", () => {
    const source = installer.renderWindowsMsiSource({
      version: "2026.4.10",
      installRoot: "C:\\stage\\payload",
      fileEntries: [
        {
          relativePath: "dist\\entry.js",
          sourcePath: "C:\\stage\\payload\\dist\\entry.js",
        },
        {
          relativePath: "bootstrap\\msi-bootstrap.ps1",
          sourcePath: "C:\\stage\\payload\\bootstrap\\msi-bootstrap.ps1",
        },
      ],
    });

    expect(source).toContain("RunPostInstallBootstrap");
    expect(source).toContain("RunPostUninstallCleanup");
    expect(source).toContain("ComponentRef Id=");
    expect(source).toContain("bootstrap\\msi-bootstrap.ps1");
    expect(source).toContain('Version="26.4.10"');
  });

  it("normalizes Windows MSI signature verification metadata", async () => {
    runCommandWithTimeout.mockResolvedValueOnce({
      code: 0,
      stdout: JSON.stringify({
        status: "Valid",
        statusMessage: "Signature verified.",
        signerSubject: "CN=OpenClaw Release Signing",
        timestampSubject: "CN=DigiCert Timestamp 2025",
      }),
      stderr: "",
    });

    const status = await installer.verifyWindowsMsiSignature({
      artifactPath: path.join(installRoot, "OpenClaw-2026.4.10-windows-x64.msi"),
      expectedSignerSubject: "OpenClaw Release Signing",
    });

    expect(status.verified).toBe(true);
    expect(status.signed).toBe(true);
    expect(status.signerSubject).toContain("OpenClaw Release Signing");
    expect(status.timestampStatus).toBe("present");
  });

  it("signs and verifies an MSI artifact through signtool + powershell helpers", async () => {
    runCommandWithTimeout
      .mockResolvedValueOnce({
        code: 0,
        stdout: "Successfully signed",
        stderr: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify({
          status: "Valid",
          statusMessage: "Signature verified.",
          signerSubject: "CN=OpenClaw Release Signing",
          timestampSubject: "CN=DigiCert Timestamp 2025",
        }),
        stderr: "",
      });

    const status = await installer.signWindowsMsiArtifact({
      artifactPath: path.join(installRoot, "OpenClaw-2026.4.10-windows-x64.msi"),
      pfxPath: path.join(installRoot, "openclaw-signing.pfx"),
      pfxPassword: "top-secret",
      certSubject: "OpenClaw Release Signing",
    });

    expect(status.verified).toBe(true);
    expect(runCommandWithTimeout).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        "signtool",
        "sign",
        "/fd",
        "SHA256",
        "/tr",
        "http://timestamp.digicert.com",
      ]),
      expect.any(Object),
    );
  });

  it("resolves Windows release artifact metadata from signing status", async () => {
    const artifactPath = path.join(installRoot, "OpenClaw-2026.4.10-windows-x64.msi");
    await fs.writeFile(artifactPath, "fake msi", "utf8");

    const metadata = await installer.resolveWindowsReleaseArtifactMetadata({
      artifactPath,
      version: "2026.4.10",
      releaseChannel: "stable",
      signingStatus: {
        status: "Valid",
        statusMessage: "Signature verified.",
        signed: true,
        verified: true,
        signerSubject: "CN=OpenClaw Release Signing",
        expectedSignerMatched: true,
        timestampSubject: "CN=DigiCert Timestamp 2025",
        timestampStatus: "present",
      },
    });

    expect(metadata.exists).toBe(true);
    expect(metadata.artifactName).toBe("OpenClaw-2026.4.10-windows-x64.msi");
    expect(metadata.releaseChannel).toBe("stable");
    expect(metadata.signed).toBe(true);
    expect(metadata.timestampStatus).toBe("present");
  });

  it("resolves installed product status from the MSI manifest and installed CLI", async () => {
    await installer.saveWindowsInstallerManifest(
      {
        version: 1,
        installMode: "msi",
        productName: "OpenClaw",
        productVersion: "2026.4.10",
        architecture: "x64",
        installRoot,
        installedAt: "2026-04-18T00:00:00.000Z",
        updatedAt: "2026-04-18T00:00:00.000Z",
        companionEnabled: true,
        gatewayBootstrapSucceeded: true,
        companionBootstrapSucceeded: true,
        companionInstallMode: "schtasks",
        companionSupervisorLabel: "OpenClaw Windows Companion",
      },
      process.env,
    );
    runCommandWithTimeout
      .mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify({
          rpc: { ok: true },
          windowsCompanion: { installed: true, managedByOpenClaw: true },
        }),
        stderr: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify({
          service: { installed: true, running: true, installMode: "schtasks" },
          reachability: { reachable: true },
        }),
        stderr: "",
      });

    const status = await installer.resolveWindowsInstalledProductStatus({
      env: process.env,
    });

    expect(status.installRoot).toBe(installRoot);
    expect(status.gatewayStatusCommandOk).toBe(true);
    expect(status.companionStatusCommandOk).toBe(true);
    expect(status.companionPresenceDetected).toBe(true);
  });

  it("falls back to companion status when gateway status omits windowsCompanion", async () => {
    await installer.saveWindowsInstallerManifest(
      {
        version: 1,
        installMode: "msi",
        productName: "OpenClaw",
        productVersion: "2026.4.10",
        architecture: "x64",
        installRoot,
        installedAt: "2026-04-18T00:00:00.000Z",
        updatedAt: "2026-04-18T00:00:00.000Z",
        companionEnabled: true,
        gatewayBootstrapSucceeded: true,
        companionBootstrapSucceeded: true,
        companionInstallMode: "schtasks",
        companionSupervisorLabel: "OpenClaw Windows Companion",
      },
      process.env,
    );
    runCommandWithTimeout
      .mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify({
          rpc: { ok: false, error: "gateway closed" },
        }),
        stderr: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify({
          service: { installed: true, running: true, installMode: "schtasks" },
          reachability: { reachable: false },
        }),
        stderr: "",
      });

    const status = await installer.resolveWindowsInstalledProductStatus({
      env: process.env,
    });

    expect(status.gatewayStatusCommandOk).toBe(true);
    expect(status.companionStatusCommandOk).toBe(true);
    expect(status.companionPresenceDetected).toBe(true);
  });

  it("resolves an installed Windows release baseline from the MSI manifest", async () => {
    await installer.saveWindowsInstallerManifest(
      {
        version: 1,
        installMode: "msi",
        productName: "OpenClaw",
        productVersion: "2026.4.10",
        architecture: "x64",
        installRoot,
        installedAt: "2026-04-18T00:00:00.000Z",
        updatedAt: "2026-04-18T00:00:00.000Z",
        companionEnabled: true,
        gatewayBootstrapSucceeded: true,
        companionBootstrapSucceeded: true,
      },
      process.env,
    );

    const baseline = await installer.resolveWindowsInstalledReleaseBaseline({
      env: process.env,
    });

    expect(baseline?.installedVersion).toBe("2026.4.10");
    expect(baseline?.releaseChannel).toBe("stable");
    expect(baseline?.needsRepair).toBe(false);
  });

  it("resolves the latest signed Windows MSI update from GitHub Releases", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              {
                tag_name: "v2026.4.11",
                prerelease: false,
                draft: false,
                html_url: "https://github.com/openclaw/openclaw/releases/tag/v2026.4.11",
                published_at: "2026-04-19T00:00:00.000Z",
                assets: [
                  {
                    name: "OpenClaw-2026.4.11-windows-x64.msi",
                    browser_download_url:
                      "https://github.com/openclaw/openclaw/releases/download/v2026.4.11/OpenClaw-2026.4.11-windows-x64.msi",
                  },
                ],
              },
            ]),
            { status: 200 },
          ),
      ) as typeof globalThis.fetch,
    );

    const available = await installer.resolveWindowsMsiAvailableUpdate({
      baseline: {
        manifest: {
          version: 1,
          installMode: "msi",
          productName: "OpenClaw",
          productVersion: "2026.4.10",
          architecture: "x64",
          installRoot,
          installedAt: "2026-04-18T00:00:00.000Z",
          updatedAt: "2026-04-18T00:00:00.000Z",
          companionEnabled: true,
          gatewayBootstrapSucceeded: true,
          companionBootstrapSucceeded: true,
        },
        bootstrapStatus: {
          manifest: null,
          manifestPresent: true,
          gatewayInstalled: true,
          gatewayLoaded: true,
          gatewayRunning: true,
          companionConfigured: true,
          companionInstalled: true,
          companionRunning: true,
          companionInstallMode: "schtasks",
          companionSupervisorLabel: "OpenClaw Windows Companion",
          partialFailure: false,
          repairHints: [],
        },
        installRoot,
        installedVersion: "2026.4.10",
        releaseChannel: "stable",
        installedAt: "2026-04-18T00:00:00.000Z",
        updatedAt: "2026-04-18T00:00:00.000Z",
        needsRepair: false,
        repairHints: [],
      },
    });

    expect(available.status).toBe("upgrade-available");
    expect(available.latest?.version).toBe("2026.4.11");
  });

  it("runs MSI repair against the installed baseline artifact version when available", async () => {
    await installer.saveWindowsInstallerManifest(
      {
        version: 1,
        installMode: "msi",
        productName: "OpenClaw",
        productVersion: "2026.4.10",
        architecture: "x64",
        installRoot,
        installedAt: "2026-04-18T00:00:00.000Z",
        updatedAt: "2026-04-18T00:00:00.000Z",
        companionEnabled: true,
        gatewayBootstrapSucceeded: true,
        companionBootstrapSucceeded: true,
        companionInstallMode: "schtasks",
        companionSupervisorLabel: "OpenClaw Windows Companion",
      },
      process.env,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/repos/openclaw/openclaw/releases")) {
          return new Response(
            JSON.stringify([
              {
                tag_name: "v2026.4.10",
                prerelease: false,
                draft: false,
                html_url: "https://github.com/openclaw/openclaw/releases/tag/v2026.4.10",
                published_at: "2026-04-18T00:00:00.000Z",
                assets: [
                  {
                    name: "OpenClaw-2026.4.10-windows-x64.msi",
                    browser_download_url:
                      "https://github.com/openclaw/openclaw/releases/download/v2026.4.10/OpenClaw-2026.4.10-windows-x64.msi",
                  },
                ],
              },
            ]),
            { status: 200 },
          );
        }
        return new Response("fake-msi", { status: 200 });
      }) as typeof globalThis.fetch,
    );
    runCommandWithTimeout
      .mockResolvedValueOnce({
        code: 0,
        stdout: "repair ok",
        stderr: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify({
          rpc: { ok: true },
          windowsCompanion: { installed: true, managedByOpenClaw: true },
        }),
        stderr: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify({
          service: { installed: true, running: true, installMode: "schtasks" },
          reachability: { reachable: true },
        }),
        stderr: "",
      });

    const result = await installer.runWindowsMsiRepair({
      env: process.env,
      timeoutMs: 5_000,
    });

    expect(result.performed).toBe(true);
    expect(result.exactVersionMatch).toBe(true);
    expect(result.artifact?.version).toBe("2026.4.10");
  });

  it("builds a stable winget manifest set from the signed MSI release metadata", async () => {
    const artifactPath = path.join(installRoot, "OpenClaw-2026.4.10-windows-x64.msi");
    await fs.writeFile(artifactPath, "fake-msi-payload", "utf8");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              {
                tag_name: "v2026.4.10",
                prerelease: false,
                draft: false,
                html_url: "https://github.com/openclaw/openclaw/releases/tag/v2026.4.10",
                body: "Stable Windows release.",
                published_at: "2026-04-18T00:00:00.000Z",
                assets: [
                  {
                    name: "OpenClaw-2026.4.10-windows-x64.msi",
                    browser_download_url:
                      "https://github.com/openclaw/openclaw/releases/download/v2026.4.10/OpenClaw-2026.4.10-windows-x64.msi",
                  },
                ],
              },
            ]),
            { status: 200 },
          ),
      ) as typeof globalThis.fetch,
    );

    const manifestSet = await installer.buildWindowsWingetManifestSet({
      artifactPath,
      version: "2026.4.10",
      releaseChannel: "stable",
      outDir: path.join(installRoot, "winget-out"),
      signingStatus: {
        status: "Valid",
        statusMessage: "Signature verified.",
        signed: true,
        verified: true,
        signerSubject: "CN=OpenClaw Release Signing",
        expectedSignerMatched: true,
        timestampSubject: "CN=DigiCert Timestamp 2025",
        timestampStatus: "present",
      },
    });

    expect(manifestSet.metadata.packageIdentifier).toBe("OpenClaw.OpenClaw");
    expect(manifestSet.metadata.releaseChannel).toBe("stable");
    expect(manifestSet.metadata.artifactUrl).toContain("OpenClaw-2026.4.10-windows-x64.msi");
    const installerManifest = await fs.readFile(manifestSet.files.installerManifestPath, "utf8");
    expect(installerManifest).toContain("InstallerType: wix");
    expect(installerManifest).toContain("Scope: user");
    expect(installerManifest).toContain("OpenClaw-2026.4.10-windows-x64.msi");
  });

  it("rejects non-stable winget release metadata generation", async () => {
    const artifactPath = path.join(installRoot, "OpenClaw-2026.4.10-beta.1-windows-x64.msi");
    await fs.writeFile(artifactPath, "fake-beta-msi", "utf8");

    await expect(
      installer.resolveWindowsWingetReleaseMetadata({
        artifactPath,
        version: "2026.4.10-beta.1",
        releaseChannel: "beta",
        signingStatus: {
          status: "Valid",
          statusMessage: "Signature verified.",
          signed: true,
          verified: true,
          signerSubject: "CN=OpenClaw Release Signing",
          expectedSignerMatched: true,
          timestampSubject: "CN=DigiCert Timestamp 2025",
          timestampStatus: "present",
        },
      }),
    ).rejects.toThrow(/stable-only/i);
  });

  it("runs MSI smoke install and repair with retryable installed-status verification", async () => {
    await installer.saveWindowsInstallerManifest(
      {
        version: 1,
        installMode: "msi",
        productName: "OpenClaw",
        productVersion: "2026.4.10",
        architecture: "x64",
        installRoot,
        installedAt: "2026-04-18T00:00:00.000Z",
        updatedAt: "2026-04-18T00:00:00.000Z",
        companionEnabled: true,
        gatewayBootstrapSucceeded: true,
        companionBootstrapSucceeded: true,
        companionInstallMode: "schtasks",
        companionSupervisorLabel: "OpenClaw Windows Companion",
      },
      process.env,
    );
    runCommandWithTimeout
      .mockResolvedValueOnce({
        code: 0,
        stdout: "install ok",
        stderr: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify({
          rpc: { ok: true },
          windowsCompanion: { installed: true, managedByOpenClaw: true },
        }),
        stderr: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify({
          service: { installed: true, running: true, installMode: "schtasks" },
          reachability: { reachable: true },
        }),
        stderr: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stdout: "repair ok",
        stderr: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify({
          rpc: { ok: true },
          windowsCompanion: { installed: true, managedByOpenClaw: true },
        }),
        stderr: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify({
          service: { installed: true, running: true, installMode: "schtasks" },
          reachability: { reachable: true },
        }),
        stderr: "",
      });

    const installResult = await installer.runWindowsMsiSmokeInstall({
      artifactPath: path.join(installRoot, "OpenClaw-2026.4.10-windows-x64.msi"),
      env: process.env,
      retryAttempts: 1,
      retryDelayMs: 0,
    });
    const repairResult = await installer.runWindowsMsiSmokeRepair({
      artifactPath: path.join(installRoot, "OpenClaw-2026.4.10-windows-x64.msi"),
      env: process.env,
      retryAttempts: 1,
      retryDelayMs: 0,
    });

    expect(installResult.phase).toBe("install");
    expect(installResult.installedProduct?.bootstrapStatus.gatewayInstalled).toBe(true);
    expect(repairResult.phase).toBe("repair");
    expect(repairResult.installedProduct?.bootstrapStatus.companionInstalled).toBe(true);
  });

  it("runs MSI smoke uninstall and verifies the managed hosts are gone", async () => {
    await installer.saveWindowsInstallerManifest(
      {
        version: 1,
        installMode: "msi",
        productName: "OpenClaw",
        productVersion: "2026.4.10",
        architecture: "x64",
        installRoot,
        installedAt: "2026-04-18T00:00:00.000Z",
        updatedAt: "2026-04-18T00:00:00.000Z",
        companionEnabled: true,
        gatewayBootstrapSucceeded: true,
        companionBootstrapSucceeded: true,
      },
      process.env,
    );
    runCommandWithTimeout.mockResolvedValueOnce({
      code: 0,
      stdout: "uninstall ok",
      stderr: "",
    });
    readGatewayServiceState.mockResolvedValueOnce({
      installed: false,
      loaded: false,
      running: false,
      env: process.env,
      command: null,
      runtime: undefined,
    });
    resolveWindowsCompanionInstallerStatus.mockResolvedValueOnce({
      selected: true,
      configured: false,
      installed: false,
      loaded: false,
      running: false,
      installMode: null,
      profile: null,
      supervisorLabel: null,
      config: null,
    });
    await installer.removeWindowsInstallerManifest(process.env);

    const uninstallResult = await installer.runWindowsMsiSmokeUninstall({
      artifactPath: path.join(installRoot, "OpenClaw-2026.4.10-windows-x64.msi"),
      env: process.env,
    });

    expect(uninstallResult.phase).toBe("uninstall");
    expect(uninstallResult.installedProduct?.manifest).toBeNull();
  });

  it("accepts uninstall 1603 when MSI reports the product was removed and no residual state remains", async () => {
    await installer.saveWindowsInstallerManifest(
      {
        version: 1,
        installMode: "msi",
        productName: "OpenClaw",
        productVersion: "2026.4.10",
        architecture: "x64",
        installRoot,
        installedAt: "2026-04-18T00:00:00.000Z",
        updatedAt: "2026-04-18T00:00:00.000Z",
        companionEnabled: true,
        gatewayBootstrapSucceeded: true,
        companionBootstrapSucceeded: true,
      },
      process.env,
    );
    const logPath = path.join(installRoot, "OpenClaw-2026.4.10-windows-x64-uninstall.log");
    await fs.writeFile(
      logPath,
      [
        "Product: OpenClaw -- Removal failed.",
        "Windows Installer removed the product. Product Name: OpenClaw. Product Version: 26.4.10. Product Language: 1033. Manufacturer: OpenClaw. Removal success or error status: 1603.",
        "MainEngineThread is returning 1603",
      ].join("\n"),
      "utf8",
    );
    runCommandWithTimeout.mockResolvedValueOnce({
      code: 1603,
      stdout: "",
      stderr: "",
    });
    readGatewayServiceState.mockResolvedValueOnce({
      installed: false,
      loaded: false,
      running: false,
      env: process.env,
      command: null,
      runtime: undefined,
    });
    resolveWindowsCompanionInstallerStatus.mockResolvedValueOnce({
      selected: true,
      configured: false,
      installed: false,
      loaded: false,
      running: false,
      installMode: null,
      profile: null,
      supervisorLabel: null,
      config: null,
    });
    await installer.removeWindowsInstallerManifest(process.env);

    const uninstallResult = await installer.runWindowsMsiSmokeUninstall({
      artifactPath: path.join(installRoot, "OpenClaw-2026.4.10-windows-x64.msi"),
      env: process.env,
      logPath,
    });

    expect(uninstallResult.phase).toBe("uninstall");
    expect(uninstallResult.installedProduct?.manifest).toBeNull();
  });
});
