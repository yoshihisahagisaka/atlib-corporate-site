[CmdletBinding(SupportsShouldProcess, ConfirmImpact='High')]
param(
  [string]$Project = 'atlib-corporate-site',
  [string]$Region = 'asia-northeast1',
  [string]$Service = 'corporate-site',
  [string]$RollbackRevision = 'corporate-site-imv-20261123071048',
  [switch]$Execute
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $Execute) { throw 'STOP: rollback requires explicit -Execute approval' }
$revision = (& gcloud.cmd run revisions describe $RollbackRevision --project=$Project --region=$Region --format=json) | ConvertFrom-Json
$ready = @($revision.status.conditions | Where-Object { $_.type -eq 'Ready' })
if ($ready.Count -ne 1 -or $ready[0].status -ne 'True') { throw 'STOP: rollback revision is not Ready' }
if ($PSCmdlet.ShouldProcess($Service, "Route 100% to $RollbackRevision")) {
  & gcloud.cmd run services update-traffic $Service --project=$Project --region=$Region --to-revisions="${RollbackRevision}=100"
  if ($LASTEXITCODE -ne 0) { throw 'STOP: rollback command failed or state is unknown' }
  $serviceState = (& gcloud.cmd run services describe $Service --project=$Project --region=$Region --format=json) | ConvertFrom-Json
  $live = @($serviceState.status.traffic | Where-Object { $_.percent -eq 100 })
  if ($live.Count -ne 1 -or $live[0].revisionName -ne $RollbackRevision) { throw 'STOP: rollback read-back mismatch' }
  Write-Output "ROLLBACK_REVISION=$RollbackRevision"
}
