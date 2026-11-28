[CmdletBinding(SupportsShouldProcess, ConfirmImpact='High')]
param(
  [Parameter(Mandatory=$true)][string]$ImageDigestUri,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]{1,40}$')][string]$Tag,
  [string]$Project = 'atlib-corporate-site',
  [string]$Region = 'asia-northeast1',
  [string]$Service = 'corporate-site',
  [switch]$Execute
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
if ($ImageDigestUri -notmatch '@sha256:[0-9a-f]{64}$') { throw 'STOP: immutable candidate digest URI required' }
$before = (& gcloud.cmd run services describe $Service --project=$Project --region=$Region --format=json) | ConvertFrom-Json
$live = @($before.status.traffic | Where-Object { $_.percent -eq 100 })
if ($live.Count -ne 1 -or $live[0].revisionName -ne $manifest.productionRevision) { throw 'STOP: current Production traffic differs from the approved baseline' }
if (@($before.status.traffic | Where-Object { $_.tag -eq $Tag }).Count -ne 0) { throw 'STOP: traffic tag already exists' }
if (-not $Execute) { throw 'STOP: isolated Production deployment requires explicit -Execute approval' }
if ($PSCmdlet.ShouldProcess($Service, "Deploy $ImageDigestUri at 0% with tag $Tag")) {
  & gcloud.cmd run deploy $Service --project=$Project --region=$Region --image=$ImageDigestUri --no-traffic --tag=$Tag
  if ($LASTEXITCODE -ne 0) { throw 'STOP: deployment failed or state is unknown; do not retry automatically' }
  $after = (& gcloud.cmd run services describe $Service --project=$Project --region=$Region --format=json) | ConvertFrom-Json
  $afterLive = @($after.status.traffic | Where-Object { $_.percent -eq 100 })
  if ($afterLive.Count -ne 1 -or $afterLive[0].revisionName -ne $manifest.productionRevision) { throw 'STOP: existing Production 100% traffic was not preserved' }
  $tagged = @($after.status.traffic | Where-Object { $_.tag -eq $Tag })
  if ($tagged.Count -ne 1 -or $tagged[0].percent) { throw 'STOP: isolated tag read-back mismatch' }
  Write-Output "ISOLATED_REVISION=$($tagged[0].revisionName)"
  Write-Output "TAG_URL=$($tagged[0].url)"
}
