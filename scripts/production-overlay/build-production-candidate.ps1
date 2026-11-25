[CmdletBinding(SupportsShouldProcess, ConfirmImpact='High')]
param(
  [Parameter(Mandatory=$true)][string]$ArtifactRoot,
  [Parameter(Mandatory=$true)][string]$CandidateImage,
  [string]$Project = 'atlib-corporate-site',
  [string]$Region = 'asia-northeast1',
  [switch]$Execute
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $Execute) { throw 'STOP: Cloud Build requires explicit -Execute after Production Candidate approval' }
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
$context = Join-Path $ArtifactRoot 'build-context'
$evidence = Join-Path $ArtifactRoot 'overlay-verification.json'
if (-not (Test-Path -LiteralPath $evidence)) { throw 'STOP: overlay verification evidence missing' }
if (-not $CandidateImage.Contains(':')) { throw 'STOP: CandidateImage must use a new unique tag' }
if ($PSCmdlet.ShouldProcess($CandidateImage, 'Submit immutable Production overlay candidate to Cloud Build')) {
  & gcloud.cmd builds submit $context --project=$Project --region=$Region --config=(Join-Path $PSScriptRoot 'cloudbuild.production-overlay.yaml') --substitutions="_BASE_IMAGE=$($manifest.baseImage),_CANDIDATE_IMAGE=$CandidateImage"
  if ($LASTEXITCODE -ne 0) { throw 'STOP: Cloud Build failed; do not retry automatically' }
}
