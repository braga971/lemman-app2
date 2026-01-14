param(
  [Parameter(Mandatory=$true)][string]$SourceDbUrl,
  [Parameter(Mandatory=$true)][string]$TargetDbUrl,
  [switch]$IncludeAuth,
  [switch]$DryRun
)

function Require-Tool($name){
  $path = (Get-Command $name -ErrorAction SilentlyContinue).Path
  if (-not $path){ throw "Required tool '$name' not found in PATH" }
  return $path
}

try {
  $pg_dump = Require-Tool 'pg_dump'
  $psql = Require-Tool 'psql'
} catch { Write-Error $_; exit 1 }

Write-Host "Source: $SourceDbUrl" -ForegroundColor Cyan
Write-Host "Target: $TargetDbUrl" -ForegroundColor Cyan
Write-Host "Include auth schema: $IncludeAuth" -ForegroundColor Cyan

# Build dump args
$schemas = @('public','storage')
if ($IncludeAuth) { $schemas += 'auth' }

$dumpArgs = @('--no-owner','--no-privileges') + ($schemas | ForEach-Object { '-n'; $_ }) + @('-d', $SourceDbUrl)

$psqlArgs = @('--set','ON_ERROR_STOP=1', $TargetDbUrl)

Write-Host "Running: pg_dump $($dumpArgs -join ' ') | psql $($psqlArgs -join ' ')" -ForegroundColor Yellow

if ($DryRun){
  Write-Host "Dry run: not executing." -ForegroundColor DarkYellow
  exit 0
}

$procInfo = New-Object System.Diagnostics.ProcessStartInfo
$procInfo.FileName = $pg_dump
$procInfo.Arguments = ($dumpArgs -join ' ')
$procInfo.RedirectStandardOutput = $true
$procInfo.RedirectStandardError = $true
$procInfo.UseShellExecute = $false

$pg = New-Object System.Diagnostics.Process
$pg.StartInfo = $procInfo
$pg.Start() | Out-Null

$psi2 = New-Object System.Diagnostics.ProcessStartInfo
$psi2.FileName = $psql
$psi2.Arguments = ($psqlArgs -join ' ')
$psi2.RedirectStandardInput = $true
$psi2.RedirectStandardError = $true
$psi2.UseShellExecute = $false

$ps = New-Object System.Diagnostics.Process
$ps.StartInfo = $psi2
$ps.Start() | Out-Null

# Pipe stdout of pg_dump into stdin of psql
$buffer = New-Object byte[] 8192
while (($read = $pg.StandardOutput.BaseStream.Read($buffer,0,$buffer.Length)) -gt 0) {
  $ps.StandardInput.BaseStream.Write($buffer,0,$read)
}
$ps.StandardInput.Close()

$pg_err = $pg.StandardError.ReadToEnd()
$ps_err = $ps.StandardError.ReadToEnd()

$pg.WaitForExit()
$ps.WaitForExit()

if ($pg.ExitCode -ne 0 -or $ps.ExitCode -ne 0) {
  Write-Error "Clone failed. ExitCodes: pg_dump=$($pg.ExitCode), psql=$($ps.ExitCode)"
  if ($pg_err) { Write-Error "pg_dump: $pg_err" }
  if ($ps_err) { Write-Error "psql: $ps_err" }
  exit 1
}

Write-Host "Clone completed successfully." -ForegroundColor Green

