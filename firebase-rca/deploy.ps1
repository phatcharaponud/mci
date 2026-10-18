# Deploy RCA Management System -> https://rca-up-hospital.web.app
# Usage:  powershell -ExecutionPolicy Bypass -File C:\firebase-rca\deploy.ps1
#
# NOTE: This file is intentionally ASCII-only.
# Windows PowerShell 5.1 reads .ps1 files as ANSI when there is no BOM, so Thai
# characters get mis-decoded. The Thai letter "dor dek" turns into a curly double
# quote, which PowerShell treats as a real string delimiter - that silently broke
# the script and made it skip the downloads. Keep all messages in ASCII.

$ErrorActionPreference = 'Stop'
$base = 'https://raw.githubusercontent.com/phatcharaponud/mci/claude/display-rca-code-91yTH/firebase-rca'
$root = 'C:\firebase-rca'
$nc   = Get-Random

function Get-File($url, $dest) {
    Invoke-WebRequest -Uri ($url + '?nocache=' + $nc) -OutFile $dest -UseBasicParsing
    $f = Get-Item $dest
    Write-Host ("  OK  {0,-22} {1,8:N0} bytes" -f $f.Name, $f.Length) -ForegroundColor DarkGray
}

Write-Host ''
Write-Host '== Step 1/3: downloading latest files from GitHub ==' -ForegroundColor Cyan

Get-File "$base/public/index.html" "$root\public\index.html"

# firebase.json decides what 'firebase deploy' pushes. If the local copy only has
# "hosting", the security rules never reach Firestore no matter what we download.
Get-File "$base/firebase.json" "$root\firebase.json"

# Firestore security rules. These must stay in sync with the app, otherwise users
# cannot read or save their RCA records.
Get-File "$base/firestore.rules" "$root\firestore.rules"

Write-Host ''
Write-Host '== Step 2/3: verifying files ==' -ForegroundColor Cyan

$checks = @(
    @{ Path = "$root\public\index.html"; Pattern = 'AIzaSy';        Label = 'index.html has Firebase API key' },
    @{ Path = "$root\public\index.html"; Pattern = 'WelcomeNotice'; Label = 'index.html is the latest version' },
    @{ Path = "$root\firestore.rules";   Pattern = 'match /rca/';   Label = 'firestore.rules has RCA rules' },
    @{ Path = "$root\firebase.json";     Pattern = 'firestore';     Label = 'firebase.json deploys Firestore rules' }
)
$failed = $false
foreach ($c in $checks) {
    if (Select-String -Path $c.Path -Pattern $c.Pattern -Quiet -SimpleMatch) {
        Write-Host ("  PASS  " + $c.Label) -ForegroundColor Green
    } else {
        Write-Host ("  FAIL  " + $c.Label) -ForegroundColor Red
        $failed = $true
    }
}
if ($failed) {
    Write-Host ''
    Write-Host 'Deploy cancelled: a file is missing or out of date. The live site was NOT changed.' -ForegroundColor Red
    Write-Host 'Wait a minute and run this script again (GitHub caches raw files briefly).' -ForegroundColor Yellow
    exit 1
}

Write-Host ''
Write-Host '== Step 3/3: deploying ==' -ForegroundColor Cyan
Set-Location $root
firebase deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host "firebase deploy failed (exit code $LASTEXITCODE). See the messages above." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ''
Write-Host 'Done. Open https://rca-up-hospital.web.app and press Ctrl+Shift+R' -ForegroundColor Green
Write-Host ''
