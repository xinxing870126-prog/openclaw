# Windows Companion Host

This directory contains the minimal Windows companion host runtime for the
desktop local-bridge contract.

Current scope:

- forward Windows lifecycle ingress through `localBridge.nativeProcessEvent`
- receive dedicated desktop local-action push events
- reconcile pending actions through `localBridge.status`
- execute canonical native local actions with the Windows executor seam
- submit results through `localBridge.submitActionResult`

The runtime intentionally does **not** implement a full Windows shell UI. It is
a tray-first managed companion host that keeps Windows on the same canonical
bridge as the existing macOS host.

Development entry from the repo root:

```powershell
pnpm windows:companion:start
```

Managed host entrypoints:

```powershell
openclaw windows-companion run
openclaw windows-companion run --headless
openclaw windows-companion install
openclaw windows-companion status
openclaw windows-companion restart
```

Tray shell behavior:

- interactive Windows sessions default to tray mode
- `--headless` skips the tray shell and keeps only the bridge runtime
- singleton guard keeps one companion runtime per profile across interactive and headless launches
- tray attention uses deduped `NotifyIcon` balloon tips for degraded, repair-needed, and action-required states
- tray focused-open resolves the current attention target before opening the browser:
  - pending local actions -> `/shell/sessions/... ?shellFocus=pendingAction&shellAction=<actionId>`
  - degraded / repair-needed health -> `/shell/settings`
- focused dashboard opens prefer browser-local handoff, so an existing Control UI tab is reused when possible before a new tab stays open
- exact pending-action opens now preserve `actionId` through `openclaw dashboard --shell-action ...`, browser-local handoff, and session-route hydration instead of stopping at session-level focus
- fatal host failures use supervisor-aware recovery, and repeated tray adapter failures degrade into headless fallback instead of killing the companion bridge
- tray menu actions reuse existing product commands:
  - `Open Dashboard` / `Open Pending Action` / `Review Desktop Health` -> focused `openclaw dashboard`
  - `Repair OpenClaw` -> `openclaw update --repair`
  - `Restart Gateway` -> `openclaw gateway restart`
  - `Restart Windows Companion` -> `openclaw windows-companion restart`

Install behavior:

- preferred supervisor: Windows Scheduled Task
- fallback supervisor: per-user Startup-folder login item
- persisted config: `$OPENCLAW_STATE_DIR/windows-companion.json`

The managed host still only acts as:

- lifecycle ingress relay
- local-action push + reconcile relay
- native local-action executor
- result submitter

The full Windows product outcome still depends on the shared browser/operator
shell and the cross-platform desktop-shell contracts:

- [/Users/liran-it/Documents/Playground/docs/desktop_shell_completion_contract.md](/Users/liran-it/Documents/Playground/docs/desktop_shell_completion_contract.md:1)
- [/Users/liran-it/Documents/Playground/docs/unified_desktop_shell_contract.md](/Users/liran-it/Documents/Playground/docs/unified_desktop_shell_contract.md:1)
- [/Users/liran-it/Documents/Playground/docs/desktop_shell_trial_gate.md](/Users/liran-it/Documents/Playground/docs/desktop_shell_trial_gate.md:1)

Windows currently serves as the real desktop shell baseline for those
cross-platform contracts.

For dual-platform beta-gate execution, keep the existing MSI clean-room verify
and add a shell-level verdict artifact on top:

```powershell
node --import tsx scripts/verify-windows-shell-beta.ts `
  --install-report windows-msi-install-verification.json `
  --artifact-dir artifacts/beta
```

The default artifact output is now aligned with the shared beta-gate lane, so
Windows and macOS can be aggregated into the same `artifacts/beta` verdict set.

When the Windows MSI release/winget lane is ready to hand off for trial
distribution, prefer running `Desktop Shell Beta Gate` with
`release_tag=<tag>`. The Windows release workflow will first try to resolve a
matching beta gate by `releaseTag + expectedSha`, then fall back to
`expectedSha`, and only needs `beta_gate_run_id` as a manual override when
automatic discovery fails or is ambiguous. The release workflow can still build
and verify without a match, but attach/publish handoff stays blocked until the
matching beta gate verdict passes.
