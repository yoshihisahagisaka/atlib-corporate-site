$ErrorActionPreference='Stop'
# Reuse C1 fixtures and execute the directly affected 46-test regression once.
$c1Result=(. (Join-Path $PSScriptRoot 'c1.tests.ps1')) -join "`n" | ConvertFrom-Json
. (Join-Path $PSScriptRoot 'c2-durable-plan.ps1')
$script:c2results=@()
function C2Check([string]$Name,[scriptblock]$Action) { & $Action; $script:c2results+=@{name=$Name;result='PASS'} }
function C2Reset {
  Reset
  $script:storageCalls=@();$script:saved=$null;$script:dryObjects=@{};$script:savedPath='';$script:createStatus=200;$script:readStatus=200;$script:readMode='normal';$script:createMode='normal'
}
$script:c2transport={param($method,$uri,$headers,$body)
  $script:storageCalls+=@{method=$method;uri=$uri}
  if ($method -ceq 'POST') {
    Assert ($uri.EndsWith('&ifGenerationMatch=0'))
    if ($script:createStatus -ne 200) { return @{status=$script:createStatus;body=$null} }
    $path=[Uri]::UnescapeDataString(($uri -split '&name=')[1].Split('&')[0]);Assert ($path.StartsWith('dryruns/organizations/10220954/plans/'))
    if ($script:dryObjects.ContainsKey($path)) { return @{status=412;body=$null} }
    $script:savedPath=$path
    $script:saved=$body | ConvertFrom-Json
    $script:dryObjects[$path]=$script:saved
    if ($script:createMode -eq 'lost') { throw 'synthetic-token-secret-raw-error' }
    $meta=@{bucket='msp-zabbix-secure-guard-offboarding-audit';name=$script:savedPath;generation='12345'}
    switch ($script:createMode) { 'bucket' { $meta.bucket='other' };'path' { $meta.name='other' };'generation' { $meta.generation='invalid' };'empty' { $meta=@{} } }
    return @{status=200;body=$meta}
  }
  Assert ($method -ceq 'GET');Assert ($uri.EndsWith('?alt=media&generation=12345'))
  $path=[Uri]::UnescapeDataString((([Uri]$uri).AbsolutePath -split '/o/')[1]);Assert ($path -ceq $script:savedPath)
  if ($script:readStatus -ne 200) { return @{status=$script:readStatus;body=$null} }
  $copy=O $script:dryObjects[$path]
  switch ($script:readMode) {
    'altered' { $copy.payload.inventory.agents[0].hostname='altered' }
    'newhash' { $copy.payload.inventory.agents[0].hostname='altered';$copy.plan_hash=SG-Hash $copy.payload }
    'hash' { $copy.plan_hash='f'*64 }
    'secret' { $copy | Add-Member -NotePropertyName api_key -NotePropertyValue 'synthetic-must-not-leak' }
    'org' { $copy.payload.inventory.organization_id='999' }
  }
  return @{status=200;body=$copy}
}
function C2Store { SG-C1Store 'msp-zabbix-secure-guard-offboarding-audit' $script:c2transport { 'synthetic-gcp-token' } 'DryRun' }
function Save { SG-C2SavePlan (C2Store) (Plan) (Policy) }
C2Check 'Create-only save then generation-pinned read-back and safe receipt' {
  C2Reset;$r=Save
  Assert ($r.status -ceq 'DRYRUN_DURABLE_VERIFIED' -and $r.generation -ceq '12345' -and $r.mutations -eq 0)
  Assert ($script:storageCalls.Count -eq 2);Assert ($r.gcs_object -ceq ('gs://msp-zabbix-secure-guard-offboarding-audit/'+$script:savedPath))
  Assert ($r.plan_hash -ceq (SG-Hash $script:saved.payload))
}
C2Check 'Existing same hash conflicts and is never treated as success' {
  C2Reset;$null=Save;StopIs 'CLAIM_CONFLICT_UNKNOWN_NO_RESEND' { Save };Assert ($script:storageCalls.Count -eq 3)
}
C2Check 'Empty Organization inventory preserves arrays and verifies roundtrip' {
  C2Reset
  $script:responses['https://api.dnsfilter.com/v1/networks?organization_id=10220954']=P @()
  $script:responses['https://api.dnsfilter.com/v1/user_agents?organization_ids=10220954']=P @()
  $r=Save;Assert ($r.site_count -eq 0 -and $r.agent_count -eq 0 -and $script:saved.payload.inventory.agents -is [array])
}
C2Check 'Different hash uses different object without replacing first plan' {
  C2Reset;$first=Save;$firstBody=O $script:saved;$firstPath=$script:savedPath
  $p=Plan;$p.payload.inventory.agents[0].hostname='Different-Actual-Host';$p.plan_hash=SG-Hash $p.payload
  $second=SG-C2SavePlan (C2Store) $p (Policy)
  Assert ($first.plan_hash -cne $second.plan_hash -and $firstPath -cne $script:savedPath)
  Assert ($firstBody.payload.inventory.agents[0].hostname -ceq 'Actual-I-l-HOST')
  Assert ($script:dryObjects.Count -eq 2 -and $script:dryObjects[$firstPath].payload.inventory.agents[0].hostname -ceq 'Actual-I-l-HOST')
}
C2Check 'Unknown create response is not retried or read back' {
  C2Reset;$script:createMode='lost';StopIs 'AUDIT_IO_FAILED_UNKNOWN_NO_RESEND' { Save };Assert ($script:storageCalls.Count -eq 1 -and $script:dryObjects.Count -eq 1)
}
foreach ($status in @(401,403,0)) {
  C2Check ('Storage create failure '+$status+' stops without read-back or retry') { C2Reset;$script:createStatus=$status;StopIs 'AUDIT_IO_FAILED_UNKNOWN_NO_RESEND' { Save };Assert ($script:storageCalls.Count -eq 1) }
}
foreach ($status in @(401,403,0)) {
  C2Check ('Read-back failure '+$status+' leaves saved object and stops') { C2Reset;$script:readStatus=$status;StopIs 'AUDIT_IO_FAILED_UNKNOWN_NO_RESEND' { Save };Assert ($null -ne $script:saved -and $script:storageCalls.Count -eq 2) }
}
C2Check 'Read-back 404 is not success and does not re-create' { C2Reset;$script:readStatus=404;StopIs 'DRYRUN_READBACK_MISSING' { Save };Assert ($script:storageCalls.Count -eq 2) }
foreach ($mode in @('bucket','path','generation','empty')) {
  C2Check ('Create response '+$mode+' mismatch stops UNKNOWN before read-back') { C2Reset;$script:createMode=$mode;StopIs 'DRYRUN_CREATE_RESULT_UNKNOWN_NO_RESEND' { Save };Assert ($script:storageCalls.Count -eq 1) }
}
C2Check 'Read-back changed content with stale hash rejected' { C2Reset;$script:readMode='altered';StopIs 'DRYRUN_PLAN_HASH_MISMATCH' { Save } }
C2Check 'Read-back changed content and recomputed hash still rejected' { C2Reset;$script:readMode='newhash';StopIs 'DRYRUN_READBACK_CONTENT_MISMATCH' { Save } }
C2Check 'Read-back changed hash rejected' { C2Reset;$script:readMode='hash';StopIs 'DRYRUN_PLAN_HASH_MISMATCH' { Save } }
C2Check 'Read-back Organization mismatch rejected' { C2Reset;$script:readMode='org';StopIs 'DRYRUN_PLAN_SCOPE_INVALID' { Save } }
C2Check 'Unknown secret-bearing field rejected before write' {
  C2Reset;$p=Plan;$p.payload.Add('api_key','synthetic-must-not-leak');$p.plan_hash=SG-Hash $p.payload
  StopIs 'DRYRUN_PLAN_SCHEMA_INVALID' { SG-C2SavePlan (C2Store) $p (Policy) };Assert ($script:storageCalls.Count -eq 0)
}
C2Check 'Unknown secret-bearing read-back field rejected' { C2Reset;$script:readMode='secret';StopIs 'DRYRUN_PLAN_SCHEMA_INVALID' { Save } }
C2Check 'Plan Organization outside allowlist rejected before write' {
  C2Reset;$p=Plan;$p.payload.inventory.organization_id='999';$p.plan_hash=SG-Hash $p.payload
  StopIs 'DRYRUN_PLAN_SCOPE_INVALID' { SG-C2SavePlan (C2Store) $p (Policy) };Assert ($script:storageCalls.Count -eq 0)
}
C2Check 'Missing GCP authentication does not invoke transport' {
  C2Reset;$s=SG-C1Store 'msp-zabbix-secure-guard-offboarding-audit' $script:c2transport { '' } 'DryRun'
  StopIs 'GCP_TOKEN_UNAVAILABLE' { SG-C2SavePlan $s (Plan) (Policy) };Assert ($script:storageCalls.Count -eq 0)
}
C2Check 'DryRun storage scope refuses Org claim and Agent claim paths' {
  C2Reset;$s=C2Store
  StopIs 'AUDIT_STORE_SCOPE_INVALID' { SG-C1StorageRequest $s 'POST' 'claims/organizations/10220954/current' @{} }
  StopIs 'AUDIT_STORE_SCOPE_INVALID' { SG-C1StorageRequest $s 'POST' ('claims/operations/'+('a'*64)+'/agents/discovered-uuid/uninstall') @{} }
  Assert ($script:storageCalls.Count -eq 0)
}
C2Check 'Claim scope cannot save a DryRun plan' { C2Reset;StopIs 'AUDIT_STORE_SCOPE_INVALID' { SG-C2SavePlan (Store) (Plan) (Policy) };Assert ($script:writeCount -eq 0) }
C2Check 'Full offline pipeline returns no plan or hostname in receipt' {
  C2Reset;$r=SG-C2Run (Policy) @() $script:identity $script:secret $script:dns (C2Store)
  $json=$r | ConvertTo-Json -Compress
  Assert ($json -notmatch 'Actual-I-l-HOST|synthetic|Authorization|payload|inventory|hostname|token')
  Assert (@($script:requests | Where-Object method -ne GET).Count -eq 0)
  Assert ((ConvertTo-Json -InputObject $script:saved -Depth 30) -notmatch 'synthetic|Authorization|api_key|secret_key')
}
foreach ($status in @(401,403)) {
  C2Check ('DNSFilter '+$status+' prevents any GCS write') { C2Reset;$script:statusOverride=$status;StopIs ('GET_HTTP_'+$status) { SG-C2Run (Policy) @() $script:identity $script:secret $script:dns (C2Store) };Assert ($script:storageCalls.Count -eq 0) }
}
C2Check 'Secret failure prevents all GCS and DNS requests' {
  C2Reset;StopIs 'SECRET_PAYLOAD_EMPTY_OR_INVALID' { SG-C2Run (Policy) @() $script:identity { '' } $script:dns (C2Store) };Assert ($script:storageCalls.Count -eq 0 -and $script:requests.Count -eq 0)
}
C2Check 'Runtime identity failure prevents Secret and GCS access' {
  C2Reset;StopIs 'RUNTIME_SERVICE_IDENTITY_MISMATCH' { SG-C2Run (Policy) @() { 'wrong' } { throw 'must not run' } $script:dns (C2Store) };Assert ($script:storageCalls.Count -eq 0)
}
C2Check 'Argument override prevents all work in integrated pipeline' {
  C2Reset;StopIs 'ARGUMENT_OVERRIDE_FORBIDDEN' { SG-C2Run (Policy) @('-Mode','RequestUninstall') $script:identity $script:secret $script:dns (C2Store) };Assert ($script:storageCalls.Count -eq 0 -and $script:requests.Count -eq 0)
}
C2Check 'DNSFilter change APIs remain forbidden' {
  StopIs 'HTTP_OPERATION_FORBIDDEN' { SG-C1Http 'POST' 'https://api.dnsfilter.com/v1/networks' @{} }
  StopIs 'HTTP_OPERATION_FORBIDDEN' { SG-C1Http 'PATCH' 'https://api.dnsfilter.com/v1/networks/fixture' @{} }
  StopIs 'HTTP_OPERATION_FORBIDDEN' { SG-C1Http 'DELETE' 'https://api.dnsfilter.com/v1/organizations/10220954' @{} }
}
C2Check 'Safe STOP code excludes write exception and Secret data' {
  C2Reset;$script:createMode='lost'
  try { Save;throw 'Expected failure' } catch { $code=SG-C1StopCode $_;Assert ($code -ceq 'AUDIT_IO_FAILED_UNKNOWN_NO_RESEND' -and $code -notmatch 'synthetic') }
}
[ordered]@{kind='C2_OFFLINE_FIXTURES';live_requests=0;new_passed=$script:c2results.Count;new_failed=0;c1_regression_passed=$c1Result.passed;total_passed=($script:c2results.Count+$c1Result.passed);results=$script:c2results} | ConvertTo-Json -Depth 8
