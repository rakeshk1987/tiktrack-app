$ErrorActionPreference = "Stop"

function Resolve-JavaBin {
  $javaCommand = Get-Command java -ErrorAction SilentlyContinue
  if ($javaCommand) {
    return Split-Path -Parent $javaCommand.Source
  }

  $candidates = @(
    "C:\Program Files\Java\jdk-26\bin",
    "C:\Program Files\Java\jdk-25\bin",
    "C:\Program Files\Java\jdk-24\bin",
    "C:\Program Files\Eclipse Adoptium\jdk-26*\bin",
    "C:\Program Files\Microsoft\jdk-26*\bin"
  )

  foreach ($candidate in $candidates) {
    $matches = Get-Item $candidate -ErrorAction SilentlyContinue
    if ($matches) {
      return $matches[0].FullName
    }
  }

  throw "Java could not be found. Install a modern JDK and make sure it is available to this script."
}

function Test-PortListening([int] $Port) {
  try {
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    return $connection -ne $null
  } catch {
    return $false
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$javaBin = Resolve-JavaBin
$env:Path = "$javaBin;$env:Path"

if (-not (Test-PortListening 4400)) {
  $emulatorCommand = @"
`$env:Path = '$javaBin;' + `$env:Path
Set-Location '$repoRoot'
npm run emulators:data
"@

  Start-Process powershell.exe -WorkingDirectory $repoRoot -ArgumentList @(
    "-NoExit",
    "-Command",
    $emulatorCommand
  ) | Out-Null

  $maxAttempts = 40
  for ($attempt = 0; $attempt -lt $maxAttempts; $attempt++) {
    Start-Sleep -Seconds 1
    if (Test-PortListening 4400) {
      break
    }
  }

  if (-not (Test-PortListening 4400)) {
    throw "Firebase emulators did not start within the expected time. Check the emulator window for details."
  }
}

Set-Location $repoRoot
npm run dev
