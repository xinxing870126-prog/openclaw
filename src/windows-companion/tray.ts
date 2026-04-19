import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type WindowsCompanionTrayMode = "interactive" | "headless";
export type WindowsCompanionTrayHealthState = "healthy" | "degraded" | "repair_needed";
export type WindowsCompanionTrayNotificationKind =
  | "healthy"
  | "degraded"
  | "repair_needed"
  | "action_required";
export type WindowsCompanionTrayAction =
  | "open_dashboard"
  | "review_desktop_health"
  | "repair_openclaw"
  | "restart_gateway"
  | "restart_windows_companion"
  | "exit_companion";

export type WindowsCompanionTrayNotification = {
  id: string;
  kind: WindowsCompanionTrayNotificationKind;
  title: string;
  message: string;
  createdAt: string;
};

export type WindowsCompanionTrayAttentionState = {
  healthState: WindowsCompanionTrayHealthState;
  lastNotificationKind: WindowsCompanionTrayNotificationKind | null;
  lastNotificationAt: string | null;
  cooldownUntilByKind: Partial<Record<WindowsCompanionTrayNotificationKind, string>>;
  notifiedActionIds: string[];
};

export type WindowsCompanionTrayState = {
  enabled: boolean;
  mode: WindowsCompanionTrayMode | null;
  healthState: WindowsCompanionTrayHealthState;
  shellAppLabel: string;
  tooltip: string;
  statusLine: string;
  primaryAction: WindowsCompanionTrayAction;
  primaryActionLabel: string;
  reviewDesktopHealthVisible: boolean;
  notification?: WindowsCompanionTrayNotification | null;
};

export type WindowsCompanionTrayProcessFactory = (params: {
  scriptPath: string;
  env: NodeJS.ProcessEnv;
}) => ChildProcess;

export type WindowsCompanionTrayHandle = {
  commandPath: string;
  process: ChildProcess;
  statePath: string;
  stop: () => Promise<void>;
  tempDir: string;
  update: (state: WindowsCompanionTrayState) => Promise<void>;
};

type WindowsCompanionTrayCommand = {
  action: WindowsCompanionTrayAction;
  requestedAt: string;
};

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

function buildTrayPowerShellScript(): string {
  return [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    "$statePath = $env:OPENCLAW_WINDOWS_TRAY_STATE_PATH",
    "$commandPath = $env:OPENCLAW_WINDOWS_TRAY_COMMAND_PATH",
    "$parentPid = [int]$env:OPENCLAW_WINDOWS_TRAY_PARENT_PID",
    "$notifyIcon = New-Object System.Windows.Forms.NotifyIcon",
    "$notifyIcon.Visible = $true",
    "$notifyIcon.Icon = [System.Drawing.SystemIcons]::Application",
    "$notifyIcon.Text = 'OpenClaw Windows Companion'",
    "$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip",
    "$statusItem = New-Object System.Windows.Forms.ToolStripMenuItem",
    "$statusItem.Enabled = $false",
    "$statusItem.Text = 'Status: starting'",
    "[void]$contextMenu.Items.Add($statusItem)",
    "[void]$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))",
    "function Write-Command([string]$action) {",
    "  $payload = @{ action = $action; requestedAt = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json -Compress",
    "  Add-Content -Path $commandPath -Value $payload",
    "}",
    "function New-ActionItem([string]$label, [string]$action) {",
    "  $item = New-Object System.Windows.Forms.ToolStripMenuItem",
    "  $item.Text = $label",
    "  $item.add_Click({ Write-Command $action })",
    "  return $item",
    "}",
    "$primaryItem = New-ActionItem 'Open Dashboard' 'open_dashboard'",
    "$primaryAction = 'open_dashboard'",
    "[void]$contextMenu.Items.Add($primaryItem)",
    "$reviewItem = New-ActionItem 'Review Desktop Health' 'review_desktop_health'",
    "$reviewItem.Visible = $false",
    "[void]$contextMenu.Items.Add($reviewItem)",
    "[void]$contextMenu.Items.Add((New-ActionItem 'Repair OpenClaw' 'repair_openclaw'))",
    "[void]$contextMenu.Items.Add((New-ActionItem 'Restart Gateway' 'restart_gateway'))",
    "[void]$contextMenu.Items.Add((New-ActionItem 'Restart Windows Companion' 'restart_windows_companion'))",
    "[void]$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))",
    "[void]$contextMenu.Items.Add((New-ActionItem 'Exit Companion' 'exit_companion'))",
    "$notifyIcon.ContextMenuStrip = $contextMenu",
    "$notifyIcon.add_DoubleClick({ Write-Command $primaryAction })",
    "$appContext = New-Object System.Windows.Forms.ApplicationContext",
    "$lastStateJson = ''",
    "$lastNotificationId = ''",
    "$timer = New-Object System.Windows.Forms.Timer",
    "$timer.Interval = 1000",
    "$timer.add_Tick({",
    "  try {",
    "    Get-Process -Id $parentPid -ErrorAction Stop | Out-Null",
    "  } catch {",
    "    $notifyIcon.Visible = $false",
    "    $timer.Stop()",
    "    $appContext.ExitThread()",
    "    return",
    "  }",
    "  if (-not (Test-Path -LiteralPath $statePath)) {",
    "    return",
    "  }",
    "  try {",
    "    $raw = [IO.File]::ReadAllText($statePath)",
    "    if ([string]::IsNullOrWhiteSpace($raw) -or $raw -eq $lastStateJson) {",
    "      return",
    "    }",
    "    $lastStateJson = $raw",
    "    $state = $raw | ConvertFrom-Json",
    "    $statusItem.Text = 'Status: ' + $state.statusLine",
    "    $primaryItem.Text = if ($state.primaryActionLabel) { [string]$state.primaryActionLabel } else { 'Open Dashboard' }",
    "    $primaryAction = if ($state.primaryAction) { [string]$state.primaryAction } else { 'open_dashboard' }",
    "    $reviewItem.Visible = [bool]$state.reviewDesktopHealthVisible",
    "    $tooltip = if ($state.tooltip) { [string]$state.tooltip } else { [string]$state.shellAppLabel }",
    "    if ($tooltip.Length -gt 63) {",
    "      $tooltip = $tooltip.Substring(0, 63)",
    "    }",
    "    $notifyIcon.Text = $tooltip",
    "    switch ($state.healthState) {",
    "      'healthy' { $notifyIcon.Icon = [System.Drawing.SystemIcons]::Information }",
    "      'repair_needed' { $notifyIcon.Icon = [System.Drawing.SystemIcons]::Error }",
    "      default { $notifyIcon.Icon = [System.Drawing.SystemIcons]::Warning }",
    "    }",
    "    if ($null -ne $state.notification -and $state.notification.id -and $state.notification.id -ne $lastNotificationId) {",
    "      $lastNotificationId = [string]$state.notification.id",
    "      $notificationTitle = if ($state.notification.title) { [string]$state.notification.title } else { 'OpenClaw' }",
    "      $notificationMessage = if ($state.notification.message) { [string]$state.notification.message } else { [string]$state.statusLine }",
    "      $toolTipIcon = [System.Windows.Forms.ToolTipIcon]::Info",
    "      switch ($state.notification.kind) {",
    "        'repair_needed' { $toolTipIcon = [System.Windows.Forms.ToolTipIcon]::Error }",
    "        'degraded' { $toolTipIcon = [System.Windows.Forms.ToolTipIcon]::Warning }",
    "        'action_required' { $toolTipIcon = [System.Windows.Forms.ToolTipIcon]::Info }",
    "        default { $toolTipIcon = [System.Windows.Forms.ToolTipIcon]::Info }",
    "      }",
    "      $notifyIcon.ShowBalloonTip(5000, $notificationTitle, $notificationMessage, $toolTipIcon)",
    "    }",
    "  } catch {",
    "    $statusItem.Text = 'Status: tray update failed'",
    "    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Error",
    "  }",
    "})",
    "$timer.Start()",
    "[System.Windows.Forms.Application]::Run($appContext)",
    "$notifyIcon.Visible = $false",
    "$notifyIcon.Dispose()",
    "$contextMenu.Dispose()",
    "$timer.Dispose()",
  ].join("\r\n");
}

function defaultTrayProcessFactory(params: {
  scriptPath: string;
  env: NodeJS.ProcessEnv;
}): ChildProcess {
  return spawn(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-WindowStyle",
      "Hidden",
      "-File",
      params.scriptPath,
    ],
    {
      detached: false,
      env: params.env,
      stdio: "ignore",
      windowsHide: true,
    },
  );
}

async function writeTrayState(filePath: string, state: WindowsCompanionTrayState): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(state)}\n`, "utf8");
}

export async function startWindowsCompanionTray(params: {
  env?: NodeJS.ProcessEnv;
  processFactory?: WindowsCompanionTrayProcessFactory;
  state: WindowsCompanionTrayState;
}): Promise<WindowsCompanionTrayHandle> {
  const env = { ...(params.env ?? process.env) };
  const processFactory = params.processFactory ?? defaultTrayProcessFactory;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-windows-tray-"));
  const statePath = path.join(tempDir, "state.json");
  const commandPath = path.join(tempDir, "commands.jsonl");
  const scriptPath = path.join(tempDir, "tray.ps1");
  await writeTrayState(statePath, params.state);
  await fs.writeFile(commandPath, "", "utf8");
  await fs.writeFile(scriptPath, buildTrayPowerShellScript(), "utf8");

  const trayProcess = processFactory({
    scriptPath,
    env: {
      ...env,
      OPENCLAW_WINDOWS_TRAY_COMMAND_PATH: commandPath,
      OPENCLAW_WINDOWS_TRAY_PARENT_PID: String(process.pid),
      OPENCLAW_WINDOWS_TRAY_STATE_PATH: statePath,
    },
  });

  let stopped = false;

  async function stop(): Promise<void> {
    if (stopped) {
      return;
    }
    stopped = true;
    if (!trayProcess.killed) {
      trayProcess.kill();
    }
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }

  return {
    commandPath,
    process: trayProcess,
    statePath,
    tempDir,
    stop,
      update: async (state) => {
      if (stopped) {
        return;
      }
      await writeTrayState(statePath, state);
    },
  };
}

export async function updateWindowsCompanionTrayState(
  handle: WindowsCompanionTrayHandle,
  state: WindowsCompanionTrayState,
): Promise<void> {
  await handle.update(state);
}

export async function stopWindowsCompanionTray(
  handle: WindowsCompanionTrayHandle | null | undefined,
): Promise<void> {
  if (!handle) {
    return;
  }
  await handle.stop();
}

export async function readWindowsCompanionTrayCommands(params: {
  commandPath: string;
  offset: number;
}): Promise<{ commands: WindowsCompanionTrayCommand[]; offset: number }> {
  const raw = await fs.readFile(params.commandPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error?.code === "ENOENT") {
      return "";
    }
    throw error;
  });
  const slice = raw.slice(params.offset);
  if (!slice) {
    return {
      commands: [],
      offset: raw.length,
    };
  }
  const commands = slice
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as WindowsCompanionTrayCommand)
    .filter(
      (command) =>
        typeof command.action === "string" && typeof command.requestedAt === "string",
    );
  return {
    commands,
    offset: raw.length,
  };
}

export function renderWindowsCompanionTrayTooltip(state: WindowsCompanionTrayState): string {
  return `${state.shellAppLabel} · ${state.statusLine}`;
}

function parseIsoTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function shouldEmitTrayNotification(params: {
  previous: WindowsCompanionTrayAttentionState | null;
  kind: WindowsCompanionTrayNotificationKind;
  createdAt: string;
}): boolean {
  const previousAt = parseIsoTimestamp(params.previous?.cooldownUntilByKind?.[params.kind] ?? null);
  const now = parseIsoTimestamp(params.createdAt);
  if (previousAt == null || now == null) {
    return true;
  }
  return now >= previousAt;
}

function buildTrayNotification(params: {
  kind: WindowsCompanionTrayNotificationKind;
  shellAppLabel: string;
  createdAt: string;
  title?: string;
  message: string;
  idSuffix?: string;
}): WindowsCompanionTrayNotification {
  return {
    id: `${params.kind}:${params.idSuffix ?? params.createdAt}`,
    kind: params.kind,
    title: params.title ?? params.shellAppLabel,
    message: params.message,
    createdAt: params.createdAt,
  };
}

const DEFAULT_NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000;
const ACTION_NOTIFICATION_HISTORY_LIMIT = 64;

export function showWindowsCompanionTrayNotification(params: {
  kind: WindowsCompanionTrayNotificationKind;
  shellAppLabel: string;
  createdAt: string;
  title?: string;
  message: string;
  idSuffix?: string;
}): WindowsCompanionTrayNotification {
  return buildTrayNotification(params);
}

export function updateWindowsCompanionTrayAttention(params: {
  previous: WindowsCompanionTrayAttentionState | null;
  healthState: WindowsCompanionTrayHealthState;
  shellAppLabel: string;
  now?: () => string;
  actionRequired?: {
    actionId: string;
    title?: string | null;
  } | null;
  notifyOnRecovery?: boolean;
  cooldownMs?: number;
}): {
  attentionState: WindowsCompanionTrayAttentionState;
  notification: WindowsCompanionTrayNotification | null;
} {
  const createdAt = (params.now ?? (() => new Date().toISOString()))();
  const cooldownMs = params.cooldownMs ?? DEFAULT_NOTIFICATION_COOLDOWN_MS;
  const previous = params.previous ?? {
    healthState: "healthy",
    lastNotificationKind: null,
    lastNotificationAt: null,
    cooldownUntilByKind: {},
    notifiedActionIds: [],
  };
  let notification: WindowsCompanionTrayNotification | null = null;
  const nextState: WindowsCompanionTrayAttentionState = {
    healthState: params.healthState,
    lastNotificationKind: previous.lastNotificationKind,
    lastNotificationAt: previous.lastNotificationAt,
    cooldownUntilByKind: { ...previous.cooldownUntilByKind },
    notifiedActionIds: [...previous.notifiedActionIds],
  };

  const maybeEmit = (
    kind: WindowsCompanionTrayNotificationKind,
    message: string,
    options: { title?: string; idSuffix?: string } = {},
  ): void => {
    if (
      notification
      || !shouldEmitTrayNotification({
        previous,
        kind,
        createdAt,
      })
    ) {
      return;
    }
    notification = buildTrayNotification({
      kind,
      shellAppLabel: params.shellAppLabel,
      createdAt,
      message,
      title: options.title,
      idSuffix: options.idSuffix,
    });
    nextState.lastNotificationKind = kind;
    nextState.lastNotificationAt = createdAt;
    nextState.cooldownUntilByKind[kind] = new Date(
      Date.parse(createdAt) + cooldownMs,
    ).toISOString();
  };

  if (previous.healthState !== params.healthState) {
    switch (params.healthState) {
      case "degraded":
        maybeEmit("degraded", "Open Dashboard or restart Gateway from the tray menu.");
        break;
      case "repair_needed":
        maybeEmit("repair_needed", "Open the tray menu and run Repair OpenClaw.");
        break;
      case "healthy":
        if (
          params.notifyOnRecovery
          && (previous.healthState === "degraded" || previous.healthState === "repair_needed")
        ) {
          maybeEmit("healthy", "Open Dashboard from the tray menu if you want to confirm status.");
        }
        break;
    }
  }

  const actionId = params.actionRequired?.actionId?.trim();
  if (actionId && !nextState.notifiedActionIds.includes(actionId)) {
    maybeEmit(
      "action_required",
      "Open Dashboard from the tray menu to review the pending desktop action.",
      {
        title: params.actionRequired?.title?.trim() || "OpenClaw action required",
        idSuffix: actionId,
      },
    );
    nextState.notifiedActionIds.push(actionId);
    while (nextState.notifiedActionIds.length > ACTION_NOTIFICATION_HISTORY_LIMIT) {
      nextState.notifiedActionIds.shift();
    }
  }

  return {
    attentionState: nextState,
    notification,
  };
}

export function renderWindowsCompanionTrayState(params: {
  healthState: WindowsCompanionTrayHealthState;
  mode: WindowsCompanionTrayMode | null;
  shellAppLabel: string;
  statusLine: string;
  primaryAction?: WindowsCompanionTrayAction;
  primaryActionLabel?: string;
  reviewDesktopHealthVisible?: boolean;
  notification?: WindowsCompanionTrayNotification | null;
}): WindowsCompanionTrayState {
  return {
    enabled: params.mode === "interactive",
    mode: params.mode,
    healthState: params.healthState,
    shellAppLabel: params.shellAppLabel,
    statusLine: params.statusLine,
    primaryAction: params.primaryAction ?? "open_dashboard",
    primaryActionLabel: params.primaryActionLabel ?? "Open Dashboard",
    reviewDesktopHealthVisible: params.reviewDesktopHealthVisible ?? false,
    notification: params.notification ?? null,
    tooltip: renderWindowsCompanionTrayTooltip({
      enabled: params.mode === "interactive",
      mode: params.mode,
      healthState: params.healthState,
      shellAppLabel: params.shellAppLabel,
      statusLine: params.statusLine,
      primaryAction: params.primaryAction ?? "open_dashboard",
      primaryActionLabel: params.primaryActionLabel ?? "Open Dashboard",
      reviewDesktopHealthVisible: params.reviewDesktopHealthVisible ?? false,
      notification: params.notification ?? null,
      tooltip: "",
    }),
  };
}

export function renderPowerShellWindowlessCommand(programArguments: string[]): string {
  const invocation = programArguments
    .map((arg) => `'${escapePowerShellSingleQuoted(arg)}'`)
    .join(" ");
  return [
    "powershell.exe",
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-WindowStyle",
    "Hidden",
    "-Command",
    `"& { $ErrorActionPreference = 'Stop'; & ${invocation}; exit $LASTEXITCODE }"`,
  ].join(" ");
}

export function renderVbsWindowlessLauncher(scriptPath: string): string {
  const command = `cmd.exe /d /s /c ""${scriptPath.replace(/"/g, "\"\"")}""`;
  return [
    'Set shell = CreateObject("WScript.Shell")',
    `shell.Run "${command.replace(/"/g, '""')}", 0, False`,
    "",
  ].join("\r\n");
}
