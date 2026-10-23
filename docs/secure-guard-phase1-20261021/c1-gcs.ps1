# Detached adapter. Not imported by the Job entrypoint and no DNS transport.
. (Join-Path $PSScriptRoot 'c1-runtime.ps1')

function SG-C1OperationId([string]$Org,[string]$CancellationEventId,[string]$ContractVersion) {
  if ($Org -notmatch '^\d+$' -or [string]::IsNullOrWhiteSpace($CancellationEventId) -or [string]::IsNullOrWhiteSpace($ContractVersion)) { SG-Fail 'STABLE_OPERATION_INPUT_REQUIRED' }
  return (SG-Hash ([ordered]@{organization_id=$Org;cancellation_event_id=$CancellationEventId;contract_version=$ContractVersion}))
}
function SG-C1Store([string]$Bucket,$Transport,$TokenReader) {
  if ($Bucket -cne 'msp-zabbix-secure-guard-offboarding-audit') { SG-Fail 'AUDIT_BUCKET_NOT_ALLOWED' }
  return @{bucket=$Bucket;transport=$Transport;token_reader=$TokenReader}
}
function SG-C1ObjectPath([string]$Path) {
  if ($Path -notmatch '^(claims/organizations/[0-9]+/current|claims/operations/[a-f0-9]{64}/agents/[a-zA-Z0-9-]+/uninstall|audit/[a-f0-9]{64}/[a-zA-Z0-9-]+\.json)$') { SG-Fail 'AUDIT_OBJECT_PATH_INVALID' }
}
function SG-C1StorageRequest($Store,[string]$Method,[string]$Path,$Value=$null) {
  SG-C1ObjectPath $Path
  if ($Store.bucket -cne 'msp-zabbix-secure-guard-offboarding-audit' -or $Method -notin @('GET','POST')) { SG-Fail 'AUDIT_STORE_SCOPE_INVALID' }
  $encoded=[Uri]::EscapeDataString($Path);$token=$null;$body=$null;$headers=$null
  try {
    $token=& $Store.token_reader
    if ([string]::IsNullOrWhiteSpace($token)) { SG-Fail 'GCP_TOKEN_UNAVAILABLE' }
    $headers=@{Authorization=('Bearer '+$token)}
    if ($Method -eq 'POST') {
      $uri='https://storage.googleapis.com/upload/storage/v1/b/'+$Store.bucket+'/o?uploadType=media&name='+$encoded+'&ifGenerationMatch=0'
      $body=ConvertTo-Json -InputObject $Value -Compress -Depth 30
    } else { $uri='https://storage.googleapis.com/storage/v1/b/'+$Store.bucket+'/o/'+$encoded+'?alt=media' }
    $r=& $Store.transport $Method $uri $headers $body
    if ($Method -eq 'GET' -and $r.status -eq 404) { return $null }
    if ($r.status -eq 412) { SG-Fail 'CLAIM_CONFLICT_UNKNOWN_NO_RESEND' }
    if ($r.status -notin @(200,201)) { SG-Fail 'AUDIT_IO_FAILED_UNKNOWN_NO_RESEND' }
    return $r.body
  } catch {
    if ($_.Exception -is [InvalidOperationException] -and $_.Exception.Message -cmatch '^(GCP_TOKEN_UNAVAILABLE|CLAIM_CONFLICT_UNKNOWN_NO_RESEND|AUDIT_IO_FAILED_UNKNOWN_NO_RESEND)$') { throw }
    SG-Fail 'AUDIT_IO_FAILED_UNKNOWN_NO_RESEND'
  } finally { $token=$null;$headers=$null;$body=$null;$r=$null }
}
function SG-C1Event($Store,[string]$OperationId,[string]$State,$Details) {
  if ($State -notin @('PLAN_FROZEN','SEND_BOUNDARY_UNKNOWN','REQUEST_RESULT','UNKNOWN')) { SG-Fail 'AUDIT_STATE_INVALID' }
  $event=[ordered]@{operation_id=$OperationId;state=$State;at_utc=[DateTime]::UtcNow.ToString('o');details=$Details}
  $null=SG-C1StorageRequest $Store 'POST' ('audit/'+$OperationId+'/'+[Guid]::NewGuid().ToString()+'.json') $event
}
function SG-C1Freeze($Store,$Plan,[string]$ApprovedPlanHash,[string]$ApprovalVersion,[string]$CancellationEventId,[string]$ContractVersion,$Policy) {
  SG-C1Policy $Policy @()
  if (!$ApprovalVersion -or $Plan.plan_hash -cne $ApprovedPlanHash -or (SG-Hash $Plan.payload) -cne $ApprovedPlanHash) { SG-Fail 'PLAN_HASH_OR_APPROVAL_MISMATCH' }
  $org=[string]$Plan.payload.inventory.organization_id
  if ($org -cne $Policy.organization_id -or $Plan.payload.inventory.msp_parent_id -cne $Policy.msp_parent_id -or $Plan.payload.source_sha -cne $Policy.source_sha) { SG-Fail 'FROZEN_PLAN_SCOPE_MISMATCH' }
  $op=SG-C1OperationId $org $CancellationEventId $ContractVersion
  # Org claim survives a new event ID / Job execution. There is no unlock path.
  $null=SG-C1StorageRequest $Store 'POST' ('claims/organizations/'+$org+'/current') ([ordered]@{operation_id=$op;plan_hash=$ApprovedPlanHash;state='UNKNOWN';approval_version=$ApprovalVersion})
  # Only the prototype's allowlisted projection may reach durable storage.
  $i=$Plan.payload.inventory
  $safe=[ordered]@{organization_id=$org;msp_parent_id=[string]$i.msp_parent_id;sites=@($i.sites | ForEach-Object { [ordered]@{id=$_.id;name=$_.name;organization_id=$_.organization_id} });agents=@($i.agents | ForEach-Object { [ordered]@{uuid=$_.uuid;hostname=$_.hostname;organization_id=$_.organization_id;site_id=$_.site_id;status=$_.status;agent_state=$_.agent_state} })}
  SG-C1Event $Store $op 'PLAN_FROZEN' ([ordered]@{plan_hash=$ApprovedPlanHash;approval_version=$ApprovalVersion;source_sha=$Plan.payload.source_sha;inventory=$safe})
  return @{operation_id=$op;organization_id=$org;plan_hash=$ApprovedPlanHash;approval_version=$ApprovalVersion;inventory=$safe;inventory_hash=(SG-Hash $safe)}
}
function SG-C1PrepareAgent($Store,$Frozen,$Agent) {
  if ((SG-Hash $Frozen.inventory) -cne $Frozen.inventory_hash) { SG-Fail 'FROZEN_INVENTORY_HASH_MISMATCH' }
  if ($Agent.organization_id -cne $Frozen.organization_id -or !$Agent.uuid -or !$Agent.site_id -or !$Agent.hostname) { SG-Fail 'AGENT_SCOPE_INVALID' }
  $matches=@($Frozen.inventory.agents | Where-Object { $_.uuid -ceq $Agent.uuid -and $_.organization_id -ceq $Agent.organization_id -and $_.site_id -ceq $Agent.site_id -and $_.hostname -ceq $Agent.hostname -and $_.status -ceq $Agent.status -and $_.agent_state -ceq $Agent.agent_state })
  if ($matches.Count -ne 1) { SG-Fail 'AGENT_NOT_IN_FROZEN_INVENTORY' }
  $identity=[ordered]@{uuid=$Agent.uuid;organization_id=$Agent.organization_id;site_id=$Agent.site_id;hostname=$Agent.hostname}
  $null=SG-C1StorageRequest $Store 'POST' ('claims/operations/'+$Frozen.operation_id+'/agents/'+$Agent.uuid+'/uninstall') ([ordered]@{identity=$identity;state='UNKNOWN';plan_hash=$Frozen.plan_hash})
  SG-C1Event $Store $Frozen.operation_id 'SEND_BOUNDARY_UNKNOWN' ([ordered]@{identity=$identity;plan_hash=$Frozen.plan_hash;approval_version=$Frozen.approval_version})
  # Deliberately no send callback, no live change transport, no automatic resend.
  return @{state='UNKNOWN';operation_id=$Frozen.operation_id;mutation_enabled=$false}
}
function SG-C1ExistingClaim($Store,[string]$Org) {
  $claim=SG-C1StorageRequest $Store 'GET' ('claims/organizations/'+$Org+'/current')
  if ($null -ne $claim) { return @{state='UNKNOWN';automatic_resend=$false;requires_manual_resolution=$true} }
  return @{state='NO_CLAIM';automatic_resend=$false}
}
function SG-C1RecordOutcome($Store,$Frozen,$Agent,[int]$HttpStatus=0) {
  # Persistence only, used by fixtures in C1. No network-send implementation.
  if ((SG-Hash $Frozen.inventory) -cne $Frozen.inventory_hash) { SG-Fail 'FROZEN_INVENTORY_HASH_MISMATCH' }
  $matches=@($Frozen.inventory.agents | Where-Object { $_.uuid -ceq $Agent.uuid -and $_.organization_id -ceq $Agent.organization_id -and $_.site_id -ceq $Agent.site_id -and $_.hostname -ceq $Agent.hostname })
  if ($matches.Count -ne 1) { SG-Fail 'AGENT_NOT_IN_FROZEN_INVENTORY' }
  $state='UNKNOWN'
  if ($HttpStatus -ge 200 -and $HttpStatus -lt 300) { $state='HTTP_ACCEPTED_COMPLETION_UNPROVEN' }
  SG-C1Event $Store $Frozen.operation_id 'REQUEST_RESULT' ([ordered]@{uuid=$Agent.uuid;http_status=$HttpStatus;result=$state;plan_hash=$Frozen.plan_hash})
  # Claims stay UNKNOWN/occupied regardless of HTTP status; no unlock/TTL path.
}
function SG-C1MetadataToken {
  try {
    $r=Invoke-RestMethod -Uri 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token' -Headers @{'Metadata-Flavor'='Google'} -TimeoutSec 5 -MaximumRedirection 0 -Verbose:$false -Debug:$false
    if (!$r.access_token) { SG-Fail 'GCP_TOKEN_UNAVAILABLE' }
    return $r.access_token
  } catch { SG-Fail 'GCP_TOKEN_UNAVAILABLE' }
}
