import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";
import {
  resolveShellDesktopNativeActionCapabilityMatrix,
  resolveShellLocalActionExecutionRequest,
  resolveShellLocalActionExecutionSource,
  type ShellLocalActionExecutionRequest,
  type ShellLocalActionExecutionResult,
  type ShellPendingLocalAction,
} from "./shell-app-contract.js";

type WindowsDesktopNativeLocalAction = Pick<
  ShellPendingLocalAction,
  "actionId" | "actionType" | "title" | "description" | "constraints"
>;

type WindowsDesktopNativeLocalActionCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type WindowsDesktopNativeLocalActionCommandRunnerParams = {
  action: WindowsDesktopNativeLocalAction;
  request: ShellLocalActionExecutionRequest;
  script: string;
};

export type WindowsDesktopNativeLocalActionCommandRunner = (
  params: WindowsDesktopNativeLocalActionCommandRunnerParams,
) => Promise<WindowsDesktopNativeLocalActionCommandResult>;

let windowsDesktopNativeLocalActionExecutorStarted = false;
let windowsDesktopNativeLocalActionCommandRunner: WindowsDesktopNativeLocalActionCommandRunner | null =
  null;

const execFileAsync = promisify(execFile);

export function startDesktopNativeLocalActionExecutor(): void {
  windowsDesktopNativeLocalActionExecutorStarted = true;
}

export function stopDesktopNativeLocalActionExecutor(): void {
  windowsDesktopNativeLocalActionExecutorStarted = false;
}

export function isDesktopNativeLocalActionExecutorStarted(): boolean {
  return windowsDesktopNativeLocalActionExecutorStarted;
}

export function setDesktopNativeLocalActionCommandRunnerForTests(
  runner: WindowsDesktopNativeLocalActionCommandRunner | null,
): void {
  windowsDesktopNativeLocalActionCommandRunner = runner;
}

export function resolveDesktopNativeLocalActionExecutionRequest(
  action: WindowsDesktopNativeLocalAction,
): ShellLocalActionExecutionRequest {
  return resolveShellLocalActionExecutionRequest({
    action,
    hostPlatform: "windows",
  });
}

export function resolveDesktopNativeLocalActionCapabilityMatrix() {
  return resolveShellDesktopNativeActionCapabilityMatrix("windows");
}

function escapeForPowerShellSingleQuotedString(value: string): string {
  return value.replaceAll("'", "''");
}

function buildDesktopNativeLocalActionPowerShellScript(
  request: ShellLocalActionExecutionRequest,
): string {
  const title = escapeForPowerShellSingleQuotedString(request.title);
  const description = escapeForPowerShellSingleQuotedString(request.description);
  if (request.actionType === "pick_file") {
    return `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = '${title}'
$dialog.CheckFileExists = $true
$dialog.Multiselect = $false
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK -and $dialog.FileName) {
  @{ approved = $true; payload = @{ path = $dialog.FileName } } | ConvertTo-Json -Compress -Depth 4
} else {
  @{ approved = $false; error = 'user_cancelled' } | ConvertTo-Json -Compress -Depth 4
}
`.trim();
  }
  if (request.actionType === "pick_folder") {
    return `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '${description}'
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK -and $dialog.SelectedPath) {
  @{ approved = $true; payload = @{ path = $dialog.SelectedPath } } | ConvertTo-Json -Compress -Depth 4
} else {
  @{ approved = $false; error = 'user_cancelled' } | ConvertTo-Json -Compress -Depth 4
}
`.trim();
  }
  if (request.actionType === "open_file") {
    const path = escapeForPowerShellSingleQuotedString(request.requiredPath ?? "");
    return `
$path = '${path}'
if (-not $path) {
  @{ approved = $false; error = 'missing_path_constraint' } | ConvertTo-Json -Compress -Depth 4
  exit 0
}
try {
  Start-Process -FilePath $path | Out-Null
  @{ approved = $true; payload = @{ path = $path; opened = $true } } | ConvertTo-Json -Compress -Depth 4
} catch {
  @{ approved = $false; payload = @{ path = $path; opened = $false }; error = 'open_failed' } | ConvertTo-Json -Compress -Depth 4
}
`.trim();
  }
  return `
Add-Type -AssemblyName System.Windows.Forms
$result = [System.Windows.Forms.MessageBox]::Show('${description}', '${title}', [System.Windows.Forms.MessageBoxButtons]::OKCancel, [System.Windows.Forms.MessageBoxIcon]::Warning)
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  @{ approved = $true } | ConvertTo-Json -Compress -Depth 4
} else {
  @{ approved = $false; error = 'user_rejected' } | ConvertTo-Json -Compress -Depth 4
}
`.trim();
}

async function runDesktopNativeLocalActionPowerShell(
  params: WindowsDesktopNativeLocalActionCommandRunnerParams,
): Promise<WindowsDesktopNativeLocalActionCommandResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-STA",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        params.script,
      ],
      {
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      },
    );
    return {
      exitCode: 0,
      stdout: stdout ?? "",
      stderr: stderr ?? "",
    };
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      code?: string | number;
    };
    return {
      exitCode:
        typeof failure.code === "number"
          ? failure.code
          : typeof failure.code === "string" && Number.isFinite(Number(failure.code))
            ? Number(failure.code)
            : 1,
      stdout:
        typeof failure.stdout === "string"
          ? failure.stdout
          : Buffer.isBuffer(failure.stdout)
            ? failure.stdout.toString("utf8")
            : "",
      stderr:
        typeof failure.stderr === "string"
          ? failure.stderr
          : Buffer.isBuffer(failure.stderr)
            ? failure.stderr.toString("utf8")
            : failure.message,
    };
  }
}

function resolveDesktopNativeLocalActionCommandRunner(): WindowsDesktopNativeLocalActionCommandRunner {
  return windowsDesktopNativeLocalActionCommandRunner ?? runDesktopNativeLocalActionPowerShell;
}

function parseDesktopNativeLocalActionRunnerOutput(
  stdout: string,
): Pick<ShellLocalActionExecutionResult, "approved" | "payload" | "error"> | null {
  const candidate = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  if (!candidate) {
    return null;
  }
  try {
    const parsed = JSON.parse(candidate) as {
      approved?: unknown;
      payload?: unknown;
      error?: unknown;
    };
    if (typeof parsed.approved !== "boolean") {
      return null;
    }
    return {
      approved: parsed.approved,
      payload:
        parsed.payload && typeof parsed.payload === "object" && !Array.isArray(parsed.payload)
          ? (parsed.payload as Record<string, unknown>)
          : undefined,
      error: typeof parsed.error === "string" ? parsed.error : undefined,
    };
  } catch {
    return null;
  }
}

function buildWindowsDesktopNativeLocalActionFallbackPayload(
  request: ShellLocalActionExecutionRequest,
): Record<string, unknown> | undefined {
  if (request.actionType !== "open_file" || !request.requiredPath) {
    return undefined;
  }
  return {
    path: request.requiredPath,
    opened: false,
  };
}

export async function executeDesktopNativeLocalAction(
  action: WindowsDesktopNativeLocalAction,
): Promise<ShellLocalActionExecutionResult> {
  const request = resolveDesktopNativeLocalActionExecutionRequest(action);
  const executionSource = resolveShellLocalActionExecutionSource("windows");
  const executedAt = new Date().toISOString();
  const fallbackPayload = buildWindowsDesktopNativeLocalActionFallbackPayload(request);
  if (!windowsDesktopNativeLocalActionExecutorStarted) {
    return {
      actionId: request.actionId,
      approved: false,
      payload: fallbackPayload,
      error: "windows_executor_not_started",
      executionSource,
      executedAt: null,
    };
  }
  if (request.actionType === "open_file" && !request.requiredPath) {
    return {
      actionId: request.actionId,
      approved: false,
      payload: undefined,
      error: "missing_path_constraint",
      executionSource,
      executedAt: null,
    };
  }
  if (!windowsDesktopNativeLocalActionCommandRunner && process.platform !== "win32") {
    return {
      actionId: request.actionId,
      approved: false,
      payload: fallbackPayload,
      error: "windows_executor_unavailable_on_current_platform",
      executionSource,
      executedAt: null,
    };
  }
  const script = buildDesktopNativeLocalActionPowerShellScript(request);
  const runner = resolveDesktopNativeLocalActionCommandRunner();
  const response = await runner({
    action,
    request,
    script,
  });
  const parsed = parseDesktopNativeLocalActionRunnerOutput(response.stdout);
  if (parsed) {
    return {
      actionId: request.actionId,
      approved: parsed.approved,
      payload: parsed.payload,
      error: parsed.error,
      executionSource,
      executedAt,
    };
  }
  if (response.exitCode === 0) {
    return {
      actionId: request.actionId,
      approved: false,
      payload: fallbackPayload,
      error: "windows_executor_failed",
      executionSource,
      executedAt,
    };
  }
  return {
    actionId: request.actionId,
    approved: false,
    payload: fallbackPayload,
    error: "windows_executor_failed",
    executionSource,
    executedAt,
  };
}
