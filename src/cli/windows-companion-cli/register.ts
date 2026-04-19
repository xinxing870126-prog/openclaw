import type { Command } from "commander";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { formatHelpExamples } from "../help-format.js";
import {
  runWindowsCompanionDaemonInstall,
  runWindowsCompanionDaemonRestart,
  runWindowsCompanionDaemonStatus,
  runWindowsCompanionDaemonStop,
  runWindowsCompanionDaemonUninstall,
  runWindowsCompanionForeground,
} from "./daemon.js";

function addGatewayConnectionOptions(command: Command): Command {
  return command
    .option("--url <url>", "Gateway WebSocket URL")
    .option("--token <token>", "Gateway token")
    .option("--bootstrap-token <token>", "Gateway bootstrap token")
    .option("--device-token <token>", "Gateway device token")
    .option("--password <password>", "Gateway password")
    .option("--instance-id <id>", "Gateway instance id")
    .option("--tls-fingerprint <sha256>", "Expected TLS certificate fingerprint (sha256)")
    .option("--shell-app-label <label>", "Override the Windows companion shell app label");
}

export function registerWindowsCompanionCli(program: Command) {
  const companion = program
    .command("windows-companion")
    .description("Run and manage the Windows companion host")
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          ["openclaw windows-companion run", "Run the Windows companion in tray mode for the current session."],
          ["openclaw windows-companion run --headless", "Run the Windows companion without the tray shell."],
          ["openclaw windows-companion status", "Check managed companion status + gateway reachability."],
          ["openclaw windows-companion install", "Install the managed Windows companion host."],
          ["openclaw windows-companion restart", "Restart the installed Windows companion host."],
        ])}\n\n${theme.muted("Docs:")} ${formatDocsLink("/platforms/windows", "docs.openclaw.ai/platforms/windows")}\n`,
    );

  addGatewayConnectionOptions(
    companion
      .command("run")
      .description("Run the Windows companion host (foreground)")
      .option("--headless", "Skip the tray shell and run the managed host headlessly", false),
  ).action(async (opts) => {
    await runWindowsCompanionForeground({
      headless: Boolean(opts.headless),
      shellAppLabel: opts.shellAppLabel,
      gateway: {
        url: opts.url,
        token: opts.token,
        bootstrapToken: opts.bootstrapToken,
        deviceToken: opts.deviceToken,
        password: opts.password,
        instanceId: opts.instanceId,
        tlsFingerprint: opts.tlsFingerprint,
      },
    });
  });

  addGatewayConnectionOptions(
    companion
      .command("install")
      .description("Install the Windows companion managed host (schtasks + startup-folder fallback)")
      .option("--force", "Reinstall/overwrite if already installed", false)
      .option("--json", "Output JSON", false),
  ).action(async (opts) => {
    await runWindowsCompanionDaemonInstall({
      shellAppLabel: opts.shellAppLabel,
      gateway: {
        url: opts.url,
        token: opts.token,
        bootstrapToken: opts.bootstrapToken,
        deviceToken: opts.deviceToken,
        password: opts.password,
        instanceId: opts.instanceId,
        tlsFingerprint: opts.tlsFingerprint,
      },
      force: Boolean(opts.force),
      json: Boolean(opts.json),
    });
  });

  companion
    .command("status")
    .description("Show Windows companion install/runtime status")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runWindowsCompanionDaemonStatus(opts);
    });

  companion
    .command("stop")
    .description("Stop the Windows companion managed host")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runWindowsCompanionDaemonStop(opts);
    });

  companion
    .command("restart")
    .description("Restart the Windows companion managed host")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runWindowsCompanionDaemonRestart(opts);
    });

  companion
    .command("uninstall")
    .description("Uninstall the Windows companion managed host")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runWindowsCompanionDaemonUninstall(opts);
    });
}
