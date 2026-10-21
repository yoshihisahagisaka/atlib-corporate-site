param([switch]$QueueUninstall,[string]$VerifiedAgentVersion,[switch]$WindowsX64Verified)
# GET preflight by default. No Organization DELETE or Site/Policy/Key mutation.
$ErrorActionPreference='Stop'
$sgOrgId='10220954'; $sgAgentId='2a7659c5-68ec-4704-850f-e0f65347b2ee'; $sgSiteId='10678578'
$sgKey=$env:DNSFILTER_API_KEY
function SG-Relation($item,[string]$name) {
  $rel=$item.relationships.$name
  if ($null -ne $rel.data.id) { return [string]$rel.data.id }
  if ($null -ne $rel.id) { return [string]$rel.id }
  return [string]$item.attributes.($name+'_id')
}
try {
  if ([string]::IsNullOrWhiteSpace($sgKey)) {
    $sgSecret=Read-Host 'DNSFilter API key (local only)' -AsSecureString
    $sgPtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($sgSecret)
    try { $sgKey=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($sgPtr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($sgPtr); $sgSecret=$null }
  }
  $sgHeaders=@{Authorization="Bearer $sgKey";Accept='application/json'}
  $sgSpec=Invoke-RestMethod -Method Get -Uri 'https://api.dnsfilter.com/docs/api.json' -TimeoutSec 30 -MaximumRedirection 0
  $sgPath=$sgSpec.paths.'/v1/user_agents/{id}'
  $sgOperation=$sgPath.delete
  if ($null -eq $sgOperation) { throw 'No single-agent DELETE operation' }
  $sgResolved=@()
  foreach ($sgParameter in (@($sgPath.parameters)+@($sgOperation.parameters))) {
    if ($null -eq $sgParameter) { continue }
    if ($sgParameter.'$ref') {
      $sgParts=$sgParameter.'$ref' -split '/'
      if ($sgParts[0] -ne '#') { throw 'External schema ref unsupported' }
      $sgNode=$sgSpec
      foreach ($sgPart in $sgParts[1..($sgParts.Length-1)]) { $sgNode=$sgNode.($sgPart.Replace('~1','/').Replace('~0','~')) }
      if ($null -eq $sgNode) { throw 'Unresolved schema ref' }
      $sgResolved+=$sgNode
    } else { $sgResolved+=$sgParameter }
  }
  $sgQueue=@($sgResolved | Where-Object { $_.name -eq 'queue_uninstall' -and $_.in -eq 'query' })
  if ($sgQueue.Count -ne 1) { throw 'queue_uninstall not verified' }
  $sgType=$sgQueue[0].type
  if (!$sgType) { $sgType=$sgQueue[0].schema.type }
  if ($sgType -ne 'boolean') { throw 'queue_uninstall type not verified' }
  if ($sgOperation.requestBody.required) { throw 'Unexpected required body' }
  foreach ($sgParameter in $sgResolved) {
    if ($sgParameter.required -and $sgParameter.name -notin @('id','queue_uninstall')) { throw 'Unexpected required parameter' }
  }
  $sgOrg=Invoke-RestMethod -Method Get -Headers $sgHeaders -Uri ('https://api.dnsfilter.com/v1/organizations/'+$sgOrgId) -TimeoutSec 30 -MaximumRedirection 0
  $sgAgent=Invoke-RestMethod -Method Get -Headers $sgHeaders -Uri ('https://api.dnsfilter.com/v1/user_agents/'+$sgAgentId) -TimeoutSec 30 -MaximumRedirection 0
  if ([string]$sgOrg.data.id -ne $sgOrgId -or [string]$sgAgent.data.id -ne $sgAgentId) { throw 'Resource ID mismatch' }
  if ((SG-Relation $sgAgent.data 'organization') -ne $sgOrgId -or (SG-Relation $sgAgent.data 'network') -ne $sgSiteId) { throw 'Relation mismatch or unknown' }
  $sgAttr=$sgAgent.data.attributes
  if ($sgAttr.hostname -ne 'atI20260003') { throw 'Hostname mismatch; do not bypass identity check' }
  [ordered]@{stage='preflight';organization_id=$sgOrgId;agent_id=$sgAgentId;network_id=$sgSiteId;hostname=$sgAttr.hostname;status=$sgAttr.status;agent_state=$sgAttr.agent_state;schema_queue_uninstall_boolean=$true} | ConvertTo-Json
  if ($QueueUninstall) {
    if (!$WindowsX64Verified -or !$VerifiedAgentVersion) { throw 'Verify actual Windows x64 and version on endpoint first' }
    $sgVersion=$null
    if (![version]::TryParse($VerifiedAgentVersion,[ref]$sgVersion) -or $sgVersion -lt [version]'2.0.1') { throw 'Unsupported or unknown version' }
    if ($sgAttr.status -ne 'active' -or $sgAttr.agent_state -ne 'protected') { throw 'Unexpected or already pending state' }
    $sgMarker=Join-Path $env:TEMP ('secure-guard-'+$sgAgentId+'-uninstall-attempt.json')
    $sgAttempt=[ordered]@{agent_id=$sgAgentId;organization_id=$sgOrgId;attempted_at_utc=[DateTime]::UtcNow.ToString('o');state='attempt_started_result_not_yet_known'} | ConvertTo-Json -Compress
    # Atomic guard retained on all failures; never automatically remove or retry.
    $sgStream=[IO.File]::Open($sgMarker,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try { $sgBytes=[Text.Encoding]::UTF8.GetBytes($sgAttempt); $sgStream.Write($sgBytes,0,$sgBytes.Length) }
    finally { $sgStream.Dispose() }
    $sgResponse=Invoke-WebRequest -Method Delete -Headers $sgHeaders -Uri ('https://api.dnsfilter.com/v1/user_agents/'+$sgAgentId+'?queue_uninstall=true') -TimeoutSec 30 -MaximumRedirection 0 -UseBasicParsing
    [ordered]@{stage='request_result';http_status=[int]$sgResponse.StatusCode;agent_id=$sgAgentId;notes='Acceptance is not completion. No response body logged. Do not resend.'} | ConvertTo-Json
  }
} catch {
  $sgStatus=$null
  if ($null -ne $_.Exception.Response) { try { $sgStatus=[int]$_.Exception.Response.StatusCode } catch {} }
  [ordered]@{stage='STOP';http_status=$sgStatus;notes='Schema/identity/preflight failed or result uncertain. Inspect locally. Do not resend a mutation; retain attempt marker.'} | ConvertTo-Json
  exit 1
} finally {
  $sgKey=$null;$sgHeaders=$null;$sgSecret=$null;$sgPtr=$null
  $sgOrg=$null;$sgAgent=$null;$sgAttr=$null;$sgResponse=$null
}
