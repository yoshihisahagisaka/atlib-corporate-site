$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'c1-gcs.ps1')
function O($x) { ConvertFrom-Json (ConvertTo-Json -InputObject $x -Depth 40) }
function Assert($condition) { if (!$condition) { throw 'Assertion failed' } }
function StopIs([string]$code,[scriptblock]$action) {
  try { & $action | Out-Null } catch { if ($_.Exception.Message -ceq $code) { return }; throw }
  throw ('Expected '+$code)
}
$script:results=@()
function Check([string]$name,[scriptblock]$action) { & $action; $script:results+=@{name=$name;result='PASS'} }
function Policy {
  O ((Get-Content (Join-Path $PSScriptRoot 'runtime-policy.template.json') -Raw).Replace('__SOURCE_SHA__',('a'*40)).Replace('__SECRET_VERSION__','7') | ConvertFrom-Json)
}
$script:identity={ 'secure-guard-job-sa@msp-zabbix.iam.gserviceaccount.com' }
$script:secret={param($p,$v,$sa) 'synthetic-api-secret-NOT-A-CREDENTIAL' }
function P($rows) { O @{data=@($rows);meta=@{total_count=@($rows).Count};links=@{next=$null}} }
function Reset {
  $script:requests=@();$script:objects=@{};$script:writeCount=0;$script:failAt=0;$script:statusOverride=0
  $script:spec=O @{paths=@{
    '/v1/organizations/{id}'=@{get=@{parameters=@()}};
    '/v1/networks'=@{get=@{parameters=@(@{name='organization_id';in='query';type='integer'})}};
    '/v1/user_agents'=@{get=@{parameters=@(@{name='organization_ids';in='query';type='string'},@{name='network_ids';in='query';type='string'})}}
  }}
  $script:agent=O @{id='discovered-uuid';attributes=@{organization_id='10220954';network_id='discovered-site';hostname='Actual-I-l-HOST';status='active';agent_state='protected';api_key='synthetic-hidden-response'}}
  $script:responses=@{
    'https://api.dnsfilter.com/docs/api.json'=$script:spec
    'https://api.dnsfilter.com/v1/organizations/10220954'=(O @{data=@{id='10220954';attributes=@{managed_by_msp_id='10220948'}}})
    'https://api.dnsfilter.com/v1/networks?organization_id=10220954'=(P @((O @{id='discovered-site';attributes=@{name='Fixture Site';organization_id='10220954';secret_key='synthetic-hidden-response'}})))
    'https://api.dnsfilter.com/v1/user_agents?organization_ids=10220954&network_ids=discovered-site'=(P @($script:agent))
    'https://api.dnsfilter.com/v1/user_agents?organization_ids=10220954'=(P @($script:agent))
  }
}
$script:dns={param($method,$uri,$headers,$body)
  $script:requests+=@{method=$method;uri=$uri}
  if ($method -cne 'GET') { throw 'Fixture blocks mutations' }
  if ($script:statusOverride) { return @{status=$script:statusOverride;body=$null} }
  if (!$script:responses.ContainsKey($uri)) { return @{status=404;body=$null} }
  return @{status=200;body=$script:responses[$uri]}
}
$script:gcs={param($method,$uri,$headers,$body)
  $script:requests+=@{method=$method;uri=$uri}
  if ($method -eq 'POST') {
    Assert ($uri.EndsWith('&ifGenerationMatch=0'))
    $path=[Uri]::UnescapeDataString(($uri -split '&name=')[1].Split('&')[0])
    $script:writeCount++
    if ($script:failAt -eq $script:writeCount) { return @{status=403;body=$null} }
    if ($script:objects.ContainsKey($path)) { return @{status=412;body=$null} }
    $script:objects[$path]=$body | ConvertFrom-Json
    return @{status=200;body=@{generation='1'}}
  }
  Assert ($method -eq 'GET')
  $path=[Uri]::UnescapeDataString((([Uri]$uri).AbsolutePath -split '/o/')[1])
  if ($script:objects.ContainsKey($path)) { return @{status=200;body=$script:objects[$path]} }
  return @{status=404;body=$null}
}
function Store { SG-C1Store 'msp-zabbix-secure-guard-offboarding-audit' $script:gcs { 'synthetic-gcp-token-NOT-A-CREDENTIAL' } }
function Plan { SG-C1DryRun (Policy) @() $script:identity $script:secret $script:dns }
function Freeze($s,$p) { SG-C1Freeze $s $p $p.plan_hash 'approval-v1' 'cancellation-event-1' 'contract-v1' (Policy) }

Check 'GET-only discovery reuses prototype and returns real fixture hostname' {
  Reset;$p=Plan;Assert ($p.payload.inventory.agents[0].hostname -ceq 'Actual-I-l-HOST');Assert (@($script:requests | Where-Object method -ne GET).Count -eq 0)
}
Check 'All argument overrides rejected before identity or secret access' {
  Reset;StopIs 'ARGUMENT_OVERRIDE_FORBIDDEN' { SG-C1DryRun (Policy) @('-Mode','RequestUninstall') { throw 'must not run' } { throw 'must not run' } $script:dns };Assert ($script:requests.Count -eq 0)
}
Check 'Every non-DryRun mode stops unconditionally' { $p=Policy;$p.mode='RequestUninstall';StopIs 'C1_DRYRUN_ONLY' { SG-C1Policy $p @() } }
Check 'Parent Organization cannot be target' { $p=Policy;$p.organization_id=$p.msp_parent_id;StopIs 'ORGANIZATION_NOT_ALLOWED' { SG-C1Policy $p @() } }
Check 'Outside baked allowlist stops' { $p=Policy;$p.organization_id='999';StopIs 'ORGANIZATION_NOT_ALLOWED' { SG-C1Policy $p @() } }
Check 'Runtime identity mismatch does not read secret' { StopIs 'RUNTIME_SERVICE_IDENTITY_MISMATCH' { SG-C1DryRun (Policy) @() { 'other-sa' } { throw 'must not run' } $script:dns } }
Check 'Missing runtime authentication stops' { StopIs 'RUNTIME_SERVICE_IDENTITY_MISMATCH' { SG-C1DryRun (Policy) @() { $null } { throw 'must not run' } $script:dns } }
Check 'Missing mounted Secret fails with no fallback' { StopIs 'SECRET_MOUNT_UNAVAILABLE' { SG-MountedSecret (Join-Path $PSScriptRoot 'does-not-exist') 'projects/msp-zabbix/secrets/secure-guard-dnsfilter-api-key/versions/7' 'expected' { 'expected' } } }
Check 'Empty Secret rejected without request' { Reset;StopIs 'SECRET_PAYLOAD_EMPTY_OR_INVALID' { SG-C1DryRun (Policy) @() $script:identity { '' } $script:dns };Assert ($script:requests.Count -eq 0) }
Check 'Latest Secret alias rejected' { $p=Policy;$p.secret_version='latest';StopIs 'PINNED_SECRET_VERSION_REQUIRED' { SG-C1Policy $p @() } }
Check 'Numeric version reference mismatch rejected' { $p=Policy;$p.secret_version_resource=$p.secret_version_resource.Replace('/7','/8');StopIs 'SECRET_VERSION_MISMATCH' { SG-C1Policy $p @() } }
Check 'Mount version path mismatch rejected' { $p=Policy;$p.secret_path='/var/run/guard-secrets/8';StopIs 'SECRET_VERSION_MISMATCH' { SG-C1Policy $p @() } }
foreach ($status in @(401,403)) {
  Check ('DNS authentication '+$status+' stops without retry') { Reset;$script:statusOverride=$status;StopIs ('GET_HTTP_'+$status) { Plan };Assert ($script:requests.Count -eq 1) }
}
Check 'Unknown OpenAPI shape stops' { Reset;$script:spec.paths='/unknown';StopIs 'MISSING_OPERATION_get_/v1/organizations/{id}' { Plan } }
Check 'Unproven pagination stops' { Reset;$script:responses['https://api.dnsfilter.com/v1/networks?organization_id=10220954'].links=O @{};StopIs 'PAGINATION_TERMINATOR_UNVERIFIED' { Plan } }
Check 'Organization parent mismatch stops' { Reset;$script:responses['https://api.dnsfilter.com/v1/organizations/10220954'].data.attributes.managed_by_msp_id='other';StopIs 'ORG_PARENT_MISMATCH_OR_UNKNOWN' { Plan } }
Check 'Site membership mismatch stops' { Reset;$script:responses['https://api.dnsfilter.com/v1/networks?organization_id=10220954'].data[0].attributes.organization_id='other';StopIs 'SITE_ORG_MISMATCH' { Plan } }
Check 'Agent membership mismatch stops' { Reset;$script:responses['https://api.dnsfilter.com/v1/user_agents?organization_ids=10220954&network_ids=discovered-site'].data[0].attributes.organization_id='other';StopIs 'AGENT_ORG_MISMATCH' { Plan } }
Check 'Agent Site mismatch stops' { Reset;$script:responses['https://api.dnsfilter.com/v1/user_agents?organization_ids=10220954&network_ids=discovered-site'].data[0].attributes.network_id='other';StopIs 'AGENT_SITE_MISMATCH' { Plan } }
Check 'Plan contains neither key nor raw response fields' { Reset;$json=Plan | ConvertTo-Json -Depth 30;Assert ($json -notmatch 'synthetic-|api_key|secret_key|Authorization') }
Check 'Stable operation binds event contract and Organization' {
  $a=SG-C1OperationId '10220954' 'event1' 'v1';Assert ($a -ceq (SG-C1OperationId '10220954' 'event1' 'v1'));Assert ($a -cne (SG-C1OperationId '10220954' 'event1' 'v2'));Assert ($a -cne (SG-C1OperationId '10220955' 'event1' 'v1'))
  StopIs 'STABLE_OPERATION_INPUT_REQUIRED' { SG-C1OperationId '10220954' '' 'v1' }
}
Check 'Org claim then snapshot then Agent claim then send boundary only' {
  Reset;$p=Plan;$script:requests=@();$s=Store;$f=Freeze $s $p;$r=SG-C1PrepareAgent $s $f $p.payload.inventory.agents[0]
  Assert ($r.state -eq 'UNKNOWN' -and !$r.mutation_enabled);Assert ($script:objects.Count -eq 4)
  $paths=@($script:requests | ForEach-Object { [Uri]::UnescapeDataString(($_.uri -split '&name=')[1].Split('&')[0]) })
  Assert ($paths[0] -eq 'claims/organizations/10220954/current');Assert ($paths[1] -like 'audit/*');Assert ($paths[2] -like 'claims/operations/*/agents/discovered-uuid/uninstall');Assert ($paths[3] -like 'audit/*')
}
Check 'Repeated Org claim conflicts even with a new operation event' {
  Reset;$s=Store;$p=Plan;$null=Freeze $s $p;StopIs 'CLAIM_CONFLICT_UNKNOWN_NO_RESEND' { SG-C1Freeze $s $p $p.plan_hash 'approval-v1' 'different-event' 'v1' (Policy) };Assert ($script:objects.Count -eq 2)
}
Check 'Repeated Agent claim conflicts without second begin event' {
  Reset;$s=Store;$p=Plan;$f=Freeze $s $p;$null=SG-C1PrepareAgent $s $f $p.payload.inventory.agents[0];StopIs 'CLAIM_CONFLICT_UNKNOWN_NO_RESEND' { SG-C1PrepareAgent $s $f $p.payload.inventory.agents[0] };Assert ($script:objects.Count -eq 4)
}
Check 'Restart after Org claim before audit remains UNKNOWN' {
  Reset;$s=Store;$p=Plan;$script:failAt=2;StopIs 'AUDIT_IO_FAILED_UNKNOWN_NO_RESEND' { Freeze $s $p };$script:failAt=0;$r=SG-C1ExistingClaim (Store) '10220954';Assert ($r.state -eq 'UNKNOWN' -and !$r.automatic_resend);StopIs 'CLAIM_CONFLICT_UNKNOWN_NO_RESEND' { Freeze (Store) $p }
}
Check 'Restart after Agent claim before send boundary remains UNKNOWN' {
  Reset;$s=Store;$p=Plan;$f=Freeze $s $p;$script:failAt=4;StopIs 'AUDIT_IO_FAILED_UNKNOWN_NO_RESEND' { SG-C1PrepareAgent $s $f $p.payload.inventory.agents[0] };$script:failAt=0;StopIs 'CLAIM_CONFLICT_UNKNOWN_NO_RESEND' { SG-C1PrepareAgent (Store) $f $p.payload.inventory.agents[0] }
}
Check 'Audit permission failure stops without a mutation' {
  Reset;$s=Store;$p=Plan;$script:failAt=1;StopIs 'AUDIT_IO_FAILED_UNKNOWN_NO_RESEND' { Freeze $s $p };Assert ($script:objects.Count -eq 0)
}
Check 'Plan hash mismatch stops before storage' { Reset;$s=Store;$p=Plan;StopIs 'PLAN_HASH_OR_APPROVAL_MISMATCH' { SG-C1Freeze $s $p 'bad' 'v1' 'event' 'v1' (Policy) };Assert ($script:writeCount -eq 0) }
Check 'Changed plan body stops before storage' { Reset;$s=Store;$p=Plan;$p.payload.inventory.agents[0].hostname='changed';StopIs 'PLAN_HASH_OR_APPROVAL_MISMATCH' { Freeze $s $p };Assert ($script:writeCount -eq 0) }
Check 'GCP missing authentication stops without storage' { Reset;$s=SG-C1Store 'msp-zabbix-secure-guard-offboarding-audit' $script:gcs { '' };StopIs 'GCP_TOKEN_UNAVAILABLE' { SG-C1ExistingClaim $s '10220954' };Assert ($script:requests.Count -eq 0) }
Check 'Unknown write response never retried' { Reset;$s=SG-C1Store 'msp-zabbix-secure-guard-offboarding-audit' {param($m,$u,$h,$b) $script:writeCount++;throw 'synthetic-secret-error'} { 'synthetic-token' };$p=Plan;StopIs 'AUDIT_IO_FAILED_UNKNOWN_NO_RESEND' { Freeze $s $p };Assert ($script:writeCount -eq 1) }
Check 'Result audit records HTTP acceptance without claiming uninstall completion' {
  Reset;$s=Store;$p=Plan;$f=Freeze $s $p;$a=$p.payload.inventory.agents[0];$null=SG-C1PrepareAgent $s $f $a
  SG-C1RecordOutcome $s $f $a 202
  $events=@($script:objects.Values | Where-Object state -eq 'REQUEST_RESULT');Assert ($events.Count -eq 1 -and $events[0].details.result -eq 'HTTP_ACCEPTED_COMPLETION_UNPROVEN')
  Assert ((SG-C1ExistingClaim $s '10220954').state -eq 'UNKNOWN')
}
Check 'Crash or unknown response after simulated request never enables resend' {
  Reset;$s=Store;$p=Plan;$f=Freeze $s $p;$a=$p.payload.inventory.agents[0];$null=SG-C1PrepareAgent $s $f $a
  SG-C1RecordOutcome $s $f $a 0
  StopIs 'CLAIM_CONFLICT_UNKNOWN_NO_RESEND' { SG-C1PrepareAgent (Store) $f $a }
}
Check 'Result audit failure after simulated request leaves occupied UNKNOWN claim' {
  Reset;$s=Store;$p=Plan;$f=Freeze $s $p;$a=$p.payload.inventory.agents[0];$null=SG-C1PrepareAgent $s $f $a;$script:failAt=5
  StopIs 'AUDIT_IO_FAILED_UNKNOWN_NO_RESEND' { SG-C1RecordOutcome $s $f $a 202 }
  $script:failAt=0;StopIs 'CLAIM_CONFLICT_UNKNOWN_NO_RESEND' { SG-C1PrepareAgent (Store) $f $a }
}
Check 'Audit snapshot excludes unknown Secret payload properties' {
  Reset;$s=Store;$p=Plan;$p.payload.inventory.agents[0].Add('api_key','synthetic-must-not-leak');$p.plan_hash=SG-Hash $p.payload;$null=Freeze $s $p
  Assert ((ConvertTo-Json -InputObject $script:objects -Depth 40) -notmatch 'synthetic-|api_key|Authorization')
}
Check 'STOP logging hides untrusted exception text' {
  try { throw 'synthetic-secret-error' } catch { Assert ((SG-C1StopCode $_) -ceq 'UNEXPECTED_ERROR_DETAILS_WITHHELD') }
}
Check 'HTTP wrapper never emits secret-bearing exception body' {
  function Invoke-WebRequest { throw 'synthetic-key-and-token-and-raw-response' }
  $output=SG-C1Http 'GET' 'https://api.dnsfilter.com/docs/api.json' @{Authorization='synthetic-key'}
  Assert ($output.status -eq 0 -and $null -eq $output.body)
  Assert ((ConvertTo-Json -InputObject $output) -notmatch 'synthetic|Authorization|raw-response')
}
Check 'Transport rejects DNSFilter POST and every DELETE' {
  StopIs 'HTTP_OPERATION_FORBIDDEN' { SG-C1Http 'DELETE' 'https://api.dnsfilter.com/v1/organizations/10220954' @{} }
  StopIs 'HTTP_OPERATION_FORBIDDEN' { SG-C1Http 'POST' 'https://api.dnsfilter.com/v1/networks' @{} }
}
Check 'Freeze checks Organization against baked policy before storage' {
  Reset;$s=Store;$p=Plan;$p.payload.inventory.organization_id='999';$p.plan_hash=SG-Hash $p.payload
  StopIs 'FROZEN_PLAN_SCOPE_MISMATCH' { Freeze $s $p };Assert ($script:writeCount -eq 0)
}
Check 'Agent identity must exactly match frozen snapshot' {
  Reset;$s=Store;$p=Plan;$f=Freeze $s $p;$a=O $p.payload.inventory.agents[0];$a.hostname='changed'
  StopIs 'AGENT_NOT_IN_FROZEN_INVENTORY' { SG-C1PrepareAgent $s $f $a };Assert ($script:writeCount -eq 2)
}
Check 'Changed frozen snapshot hash fails before Agent claim' {
  Reset;$s=Store;$p=Plan;$f=Freeze $s $p;$f.inventory.agents[0].hostname='changed'
  StopIs 'FROZEN_INVENTORY_HASH_MISMATCH' { SG-C1PrepareAgent $s $f $p.payload.inventory.agents[0] };Assert ($script:writeCount -eq 2)
}
Check 'Environment target or Mode override cannot replace baked policy' {
  Reset;$prior=$env:OrganizationId;$priorMode=$env:Mode
  try { $env:OrganizationId='10220948';$env:Mode='RequestUninstall';$p=Plan;Assert ($p.payload.inventory.organization_id -eq '10220954' -and $p.payload.mode -ceq 'DryRun') }
  finally { $env:OrganizationId=$prior;$env:Mode=$priorMode }
}
Check 'Actual entrypoint rejects override before runtime or Secret I/O' {
  $output=& (Join-Path $PSHOME 'pwsh') -NoProfile -File (Join-Path $PSScriptRoot 'c1-entrypoint.ps1') -Mode RequestUninstall
  Assert ($LASTEXITCODE -eq 1);$r=($output -join "`n") | ConvertFrom-Json;Assert ($r.code -eq 'ARGUMENT_OVERRIDE_FORBIDDEN')
}
Check 'Renderer pins matching numeric version source and digest' {
  $tmp=Join-Path ([IO.Path]::GetTempPath()) ('sg-c1-render-'+[Guid]::NewGuid());$null=[IO.Directory]::CreateDirectory($tmp)
  try {
    & (Join-Path $PSScriptRoot 'render-c1.ps1') -SourceSha ('b'*40) -SecretVersion '7' -ImageDigest ('sha256:'+('c'*64)) -ProjectNumber '123456789' -OutputDirectory $tmp
    $p=Get-Content (Join-Path $tmp 'runtime-policy.json') -Raw | ConvertFrom-Json;SG-C1Policy $p @()
    $yaml=Get-Content (Join-Path $tmp 'job.rendered.yaml') -Raw;Assert ($yaml -match "key: '7'" -and $yaml -match ('@sha256:'+('c'*64)) -and $yaml -notmatch '__|latest')
  } finally { Remove-Item -LiteralPath (Join-Path $tmp 'runtime-policy.json') -ErrorAction SilentlyContinue;Remove-Item -LiteralPath (Join-Path $tmp 'job.rendered.yaml') -ErrorAction SilentlyContinue;Remove-Item -LiteralPath $tmp }
}
Check 'Concurrent workers have one atomic create winner' {
  $shared=[Collections.Concurrent.ConcurrentDictionary[string,string]]::new();$workers=@();$async=@()
  try {
    foreach ($n in @(1,2)) {
      $worker=[PowerShell]::Create();$workers+=,$worker
      $null=$worker.AddScript({param($module,$bag)
        . $module
        $transport={param($m,$u,$h,$b) if ($bag.TryAdd('org-claim',$b)) { return @{status=200;body=@{generation='1'}} };return @{status=412;body=$null} }.GetNewClosure()
        $store=SG-C1Store 'msp-zabbix-secure-guard-offboarding-audit' $transport { 'fixture' }
        try { $null=SG-C1StorageRequest $store 'POST' 'claims/organizations/10220954/current' @{state='UNKNOWN'};'WON' } catch { $_.Exception.Message }
      }).AddArgument((Join-Path $PSScriptRoot 'c1-gcs.ps1')).AddArgument($shared)
      $async+=,$worker.BeginInvoke()
    }
    $values=@();for($i=0;$i -lt 2;$i++) { $values+=@($workers[$i].EndInvoke($async[$i])) }
    Assert (@($values | Where-Object { $_ -eq 'WON' }).Count -eq 1);Assert (@($values | Where-Object { $_ -eq 'CLAIM_CONFLICT_UNKNOWN_NO_RESEND' }).Count -eq 1)
  } finally { foreach($w in $workers) { $w.Dispose() } }
}
[ordered]@{kind='C1_OFFLINE_FIXTURES';live_requests=0;total=$script:results.Count;passed=$script:results.Count;failed=0;results=$script:results} | ConvertTo-Json -Depth 8
