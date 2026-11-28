[CmdletBinding()]
param(
  [string]$Workspace = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$OutputRoot = (Join-Path (Split-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path -Parent) 'production-overlay-artifacts'),
  [string]$Project = 'atlib-corporate-site',
  [string]$Region = 'asia-northeast1',
  [string]$Service = 'corporate-site'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$manifestPath = Join-Path $PSScriptRoot 'manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$controlHead = (& git -C $Workspace rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'STOP: unable to resolve the control HEAD' }
if ((& git -C $Workspace status --porcelain).Count -ne 0) { throw 'STOP: worktree is not clean' }
foreach ($relative in $manifest.allowedFiles) {
  $approvedHash = (& git -C $Workspace rev-parse "$($manifest.headCommit):$relative").Trim()
  if ($LASTEXITCODE -ne 0) { throw "STOP: approved content is missing: $relative" }
  $currentHash = (& git -C $Workspace hash-object (Join-Path $Workspace $relative)).Trim()
  if ($LASTEXITCODE -ne 0 -or $currentHash -ne $approvedHash) {
    throw "STOP: current content differs from approved HEAD for $relative"
  }
}

$serviceJson = & gcloud.cmd run services describe $Service --project=$Project --region=$Region --format=json
if ($LASTEXITCODE -ne 0) { throw 'STOP: Cloud Run read-back failed' }
$serviceState = $serviceJson | ConvertFrom-Json
$live = @($serviceState.status.traffic | Where-Object { $_.percent -eq 100 })
if ($live.Count -ne 1 -or $live[0].revisionName -ne $manifest.productionRevision) { throw 'STOP: Production traffic/revision mismatch' }
$revisionJson = & gcloud.cmd run revisions describe $manifest.productionRevision --project=$Project --region=$Region --format=json
if ($LASTEXITCODE -ne 0) { throw 'STOP: Production revision read-back failed' }
$revision = $revisionJson | ConvertFrom-Json
if ($revision.status.imageDigest -ne $manifest.baseImage) { throw 'STOP: Production image digest mismatch' }

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) { throw 'STOP: Docker CLI is required to extract the immutable Production image' }
$artifactRoot = Join-Path $OutputRoot $manifest.headCommit
if (Test-Path -LiteralPath $artifactRoot) { throw "STOP: output already exists: $artifactRoot" }
$baseRoot = Join-Path $artifactRoot 'base'
$candidateRoot = Join-Path $artifactRoot 'candidate'
$overlayRoot = Join-Path $artifactRoot 'build-context\overlay'
New-Item -ItemType Directory -Path $baseRoot,$candidateRoot,$overlayRoot -Force | Out-Null

& docker pull $manifest.baseImage
if ($LASTEXITCODE -ne 0) { throw 'STOP: immutable Production image pull failed' }
$containerName = "atlib-overlay-$($manifest.headCommit.Substring(0, 10))"
try {
  & docker create --name $containerName $manifest.baseImage | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'STOP: Production image container creation failed' }
  & docker cp "${containerName}:/app/." $baseRoot
  if ($LASTEXITCODE -ne 0) { throw 'STOP: Production image extraction failed' }
} finally {
  & docker rm $containerName 2>$null | Out-Null
}
foreach ($baseItem in Get-ChildItem -LiteralPath $baseRoot -Force) {
  Copy-Item -LiteralPath $baseItem.FullName -Destination $candidateRoot -Recurse -Force
}

$patchPath = Join-Path $artifactRoot 'approved.patch'
$diffArgs = @('-C',$Workspace,'diff','--binary',$manifest.baseCommit,$manifest.headCommit,'--') + @($manifest.allowedFiles)
$patch = & git @diffArgs
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($patch -join "`n"))) { throw 'STOP: approved Git diff generation failed or empty' }
[IO.File]::WriteAllText($patchPath, (($patch -join "`n") + "`n"), [Text.UTF8Encoding]::new($false))
$gitDir = (& git -C $Workspace rev-parse --git-common-dir).Trim()
& git --git-dir=$gitDir --work-tree=$candidateRoot apply --check --binary $patchPath
if ($LASTEXITCODE -ne 0) { throw 'STOP: approved patch is not uniquely applicable to extracted Production content' }
& git --git-dir=$gitDir --work-tree=$candidateRoot apply --binary $patchPath
if ($LASTEXITCODE -ne 0) { throw 'STOP: approved patch application failed' }

$verificationPath = Join-Path $artifactRoot 'overlay-verification.json'
& node (Join-Path $PSScriptRoot 'overlay-verifier.cjs') $baseRoot $candidateRoot $manifestPath $verificationPath
if ($LASTEXITCODE -ne 0) { throw 'STOP: overlay verification failed' }
foreach ($relative in $manifest.allowedFiles) {
  $source = Join-Path $candidateRoot $relative
  $destination = Join-Path $overlayRoot $relative
  New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Dockerfile.candidate') -Destination (Join-Path $artifactRoot 'build-context\Dockerfile')
Write-Output "PREPARED=$artifactRoot"
Write-Output "CONTROL_HEAD=$controlHead"
Write-Output "CONTENT_HEAD=$($manifest.headCommit)"
Write-Output "BASE_IMAGE=$($manifest.baseImage)"
Write-Output "PRODUCTION_REVISION=$($manifest.productionRevision)"
