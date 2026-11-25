[CmdletBinding(SupportsShouldProcess, ConfirmImpact='High')]
param(
  [Parameter(Mandatory=$true)][string]$ImageDigestUri,
  [string]$Project = 'atlib-corporate-site',
  [string]$Location = 'asia',
  [switch]$Execute
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($ImageDigestUri -notmatch '@sha256:[0-9a-f]{64}$') { throw 'STOP: immutable digest URI required' }
if (-not $Execute) { throw 'STOP: On-Demand Scan requires explicit -Execute and approval' }
if ($PSCmdlet.ShouldProcess($ImageDigestUri, 'Run one Google On-Demand vulnerability scan')) {
  & gcloud artifacts docker images scan $ImageDigestUri --remote --async --location=$Location --project=$Project
  if ($LASTEXITCODE -ne 0) { throw 'STOP: scan submission failed; do not retry automatically' }
}
