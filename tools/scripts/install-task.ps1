# Registers the capture worker with Windows Task Scheduler: at logon, then every 2 hours.
# The worker exits straight away when nothing is queued, so this costs nothing when idle.
#   Install:   powershell -ExecutionPolicy Bypass -File tools\scripts\install-task.ps1
#   Remove:    powershell -ExecutionPolicy Bypass -File tools\scripts\install-task.ps1 -Uninstall
param([switch]$Uninstall)

$TaskName = "HubCapture"
$Repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed $TaskName."
  exit 0
}

$pnpm = (Get-Command pnpm.cmd -ErrorAction Stop).Source
$log = Join-Path $Repo ".worker\capture.log"
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"`"$pnpm`" capture:pending >> `"$log`" 2>&1`"" -WorkingDirectory $Repo

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$repeat = (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 2)).Repetition
$trigger.Repetition = $repeat

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
  -Description "Downloads media for new design references and refreshes design-library/." -Force | Out-Null

Write-Host "Installed $TaskName: runs at logon and every 2 hours. Output goes to $log."
Write-Host "Run it now with:  Start-ScheduledTask -TaskName $TaskName"
