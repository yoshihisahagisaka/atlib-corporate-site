$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'organization-offboarding.ps1') -LibraryOnly
function Obj($v) { return ($v | ConvertTo-Json -Depth 30 | ConvertFrom-Json) }
$spec=Obj @{paths=@{
 '/v1/organizations/{id}'=@{get=@{parameters=@()}};
 '/v1/networks'=@{get=@{parameters=@(@{name='organization_id';in='query';type='integer'},@{name='page';in='query';type='integer'})}};
 '/v1/user_agents'=@{get=@{parameters=@(@{name='organization_ids';in='query';type='array'},@{name='network_ids';in='query';type='array'},@{name='page';in='query';type='integer'})}};
 '/v1/user_agents/{id}'=@{get=@{parameters=@()};delete=@{parameters=@(@{name='id';in='path';type='string';required=$true},@{name='queue_uninstall';in='query';type='boolean';description='Queue uninstall instead of soft delete'})}}
}}
function Page($rows,$total,$next=$null) { return (Obj @{data=@($rows);links=@{next=$next};meta=@{total_count=$total}}) }
function Site($id,$org='10220954') { return (Obj @{id=$id;attributes=@{name=('Site '+$id);organization_id=$org}}) }
function Agent($id,$site='S1',$org='10220954',$hostname='Actual-HOST-l-I') { return (Obj @{id=$id;attributes=@{hostname=$hostname;organization_id=$org;network_id=$site;status='active';agent_state='protected'}}) }
$script:responses=@{}; $script:calls=@()
$invoke={param($method,$uri)
 $script:calls+=@{method=$method;uri=$uri}
 if ($method -ne 'GET') { throw 'Live mutation forbidden in offline tests' }
 if (!$script:responses.ContainsKey($uri)) { return [pscustomobject]@{status=500;body=$null} }
 return [pscustomobject]@{status=200;body=$script:responses[$uri]}
}
function Baseline {
 $script:calls=@();$script:responses=@{}
 $script:responses['https://api.dnsfilter.com/v1/organizations/10220954']=Obj @{data=@{id='10220954';attributes=@{managed_by_msp_id='10220948'}}}
 $script:responses['https://api.dnsfilter.com/v1/networks?organization_id=10220954']=Page @((Site 'S1')) 2 'https://api.dnsfilter.com/v1/networks?organization_id=10220954&page=2'
 $script:responses['https://api.dnsfilter.com/v1/networks?organization_id=10220954&page=2']=Page @((Site 'S2')) 2
 $script:responses['https://api.dnsfilter.com/v1/user_agents?organization_ids=10220954&network_ids=S1']=Page @((Agent 'dynamic-uuid')) 1
 $script:responses['https://api.dnsfilter.com/v1/user_agents?organization_ids=10220954&network_ids=S2']=Page @() 0
 $script:responses['https://api.dnsfilter.com/v1/user_agents?organization_ids=10220954']=Page @((Agent 'dynamic-uuid')) 1
}
$script:results=@()
function Check([string]$name,[scriptblock]$body) { & $body; $script:results+=@{name=$name;result='PASS'} }
function ExpectStop([string]$expected,[scriptblock]$body) {
 try { & $body | Out-Null } catch { if ($_.Exception.Message -eq $expected) { return }; throw }
 throw ('Expected STOP: '+$expected)
}
Check 'Organization discovery, two Site pages, empty Site and one dynamic agent' {
 Baseline; $x=SG-Inventory $invoke $spec '10220954' '10220948'
 if ($x.sites.Count -ne 2 -or $x.agents.Count -ne 1 -or $x.agents[0].uuid -ne 'dynamic-uuid' -or $x.agents[0].hostname -cne 'Actual-HOST-l-I') { throw 'Inventory mismatch' }
 if (@($script:calls | Where-Object method -ne 'GET').Count) { throw 'Mutation during Dry Run' }
}
Check 'Unknown pagination proof stops even when only one row' {
 Baseline;$script:responses['https://api.dnsfilter.com/v1/user_agents?organization_ids=10220954&network_ids=S1'].meta=Obj @{}
 ExpectStop 'PAGINATION_TOTAL_UNVERIFIED' { SG-Inventory $invoke $spec '10220954' '10220948' }
}
Check 'Duplicate Site ID across pages stops' {
 Baseline;$script:responses['https://api.dnsfilter.com/v1/networks?organization_id=10220954&page=2']=Page @((Site 'S1')) 2
 ExpectStop 'DUPLICATE_OR_MISSING_RESOURCE_ID' { SG-Inventory $invoke $spec '10220954' '10220948' }
}
Check 'Parent relation mismatch stops' {
 Baseline;$script:responses['https://api.dnsfilter.com/v1/organizations/10220954'].data.attributes.managed_by_msp_id='other'
 ExpectStop 'ORG_PARENT_MISMATCH_OR_UNKNOWN' { SG-Inventory $invoke $spec '10220954' '10220948' }
}
Check 'Cross-Organization Site stops' {
 Baseline;$script:responses['https://api.dnsfilter.com/v1/networks?organization_id=10220954&page=2']=Page @((Site 'S2' 'other')) 2
 ExpectStop 'SITE_ORG_MISMATCH' { SG-Inventory $invoke $spec '10220954' '10220948' }
}
Check 'Agent belongs to a different Site stops' {
 Baseline;$script:responses['https://api.dnsfilter.com/v1/user_agents?organization_ids=10220954&network_ids=S1']=Page @((Agent 'dynamic-uuid' 'S2')) 1
 ExpectStop 'AGENT_SITE_MISMATCH' { SG-Inventory $invoke $spec '10220954' '10220948' }
}
Check 'Organization-only orphan agent catches omitted Site' {
 Baseline;$script:responses['https://api.dnsfilter.com/v1/user_agents?organization_ids=10220954']=Page @((Agent 'dynamic-uuid'),(Agent 'orphan' 'S9')) 2
 ExpectStop 'ORG_SITE_INVENTORY_MISMATCH' { SG-Inventory $invoke $spec '10220954' '10220948' }
}
Check 'Pagination next link cannot cross host' {
 Baseline;$script:responses['https://api.dnsfilter.com/v1/networks?organization_id=10220954'].links.next='https://evil.example/v1/networks?organization_id=10220954&page=2'
 ExpectStop 'UNSAFE_NEXT_LINK' { SG-Inventory $invoke $spec '10220954' '10220948' }
}
Check 'Pagination next link cannot change scope' {
 Baseline;$script:responses['https://api.dnsfilter.com/v1/networks?organization_id=10220954'].links.next='https://api.dnsfilter.com/v1/networks?organization_id=other&page=2'
 ExpectStop 'PAGINATION_SCOPE_CHANGED' { SG-Inventory $invoke $spec '10220954' '10220948' }
}
Check 'API failure prevents a completed inventory' {
 Baseline;$script:responses.Remove('https://api.dnsfilter.com/v1/networks?organization_id=10220954&page=2')
 ExpectStop 'GET_HTTP_500' { SG-Inventory $invoke $spec '10220954' '10220948' }
}
Check 'Uninstall semantics and UUID path confirmed from mock spec' { SG-UninstallSchema $spec }
Check 'Missing queue_uninstall blocks mutation readiness' {
 $bad=Obj $spec;$bad.paths.'/v1/user_agents/{id}'.delete.parameters=@(@{name='id';in='path';type='string'})
 ExpectStop 'QUERY_NOT_DOCUMENTED_queue_uninstall' { SG-UninstallSchema $bad }
}
Check 'Serialization roundtrip keeps reviewed plan hash stable' {
 Baseline;$payload=[ordered]@{operation_id='offline';inventory=(SG-Inventory $invoke $spec '10220954' '10220948')}
 if ((SG-Hash $payload) -cne (SG-Hash (Obj $payload))) { throw 'Hash roundtrip mismatch' }
}
Check 'Atomic claim cannot be overwritten by repeated request' {
 $dir=Join-Path ([IO.Path]::GetTempPath()) ('sg-offline-'+[Guid]::NewGuid().ToString());$null=New-Item -ItemType Directory -Path $dir
 $path=Join-Path $dir 'claim.json'
 try { SG-WriteJson $path @{state='claimed'};try { SG-WriteJson $path @{state='again'};throw 'Claim overwrite succeeded' } catch [IO.IOException] {} }
 finally { Remove-Item -LiteralPath $path -ErrorAction SilentlyContinue;Remove-Item -LiteralPath $dir }
}
Check 'Unattended authentication rejects unknown runtime identity without reading a key' {
 ExpectStop 'RUNTIME_SERVICE_IDENTITY_MISMATCH' { SG-MountedSecret 'not-read' 'projects/offline/secrets/dnsfilter/versions/1' 'worker@offline.iam.gserviceaccount.com' { 'other@offline.iam.gserviceaccount.com' } }
}
Check 'Unattended authentication rejects latest alias' {
 ExpectStop 'PINNED_SECRET_VERSION_REQUIRED' { SG-MountedSecret 'not-read' 'projects/offline/secrets/dnsfilter/versions/latest' 'worker@offline.iam.gserviceaccount.com' { 'worker@offline.iam.gserviceaccount.com' } }
}
Check 'Unattended authentication refuses missing mount with no interactive fallback' {
 ExpectStop 'SECRET_MOUNT_UNAVAILABLE' { SG-MountedSecret (Join-Path $PSScriptRoot 'missing-secret-file') 'projects/offline/secrets/dnsfilter/versions/1' 'worker@offline.iam.gserviceaccount.com' { 'worker@offline.iam.gserviceaccount.com' } }
}
Check 'Unattended authentication returns only injected fixture value in memory' {
 $path=Join-Path ([IO.Path]::GetTempPath()) ('sg-fake-secret-'+[Guid]::NewGuid().ToString())
 try {
  [IO.File]::WriteAllText($path,'synthetic-offline-fixture-not-a-credential')
  $value=SG-MountedSecret $path 'projects/offline/secrets/dnsfilter/versions/1' 'worker@offline.iam.gserviceaccount.com' { 'worker@offline.iam.gserviceaccount.com' }
  if ($value -cne 'synthetic-offline-fixture-not-a-credential') { throw 'Fixture mismatch' }
 } finally { $value=$null; Remove-Item -LiteralPath $path -ErrorAction SilentlyContinue }
}
Check 'DNSFilter 401 stops inventory before any later action' {
 Baseline
 $unauthorized={param($method,$uri) return [pscustomobject]@{status=401;body=$null}}
 ExpectStop 'GET_HTTP_401' { SG-Inventory $unauthorized $spec '10220954' '10220948' }
}
Check 'Secret-like API fields are excluded from the frozen inventory' {
 Baseline
 $script:responses['https://api.dnsfilter.com/v1/networks?organization_id=10220954'].data[0].attributes | Add-Member -NotePropertyName secret_key -NotePropertyValue 'synthetic-must-not-appear'
 $json=SG-Inventory $invoke $spec '10220954' '10220948' | ConvertTo-Json -Depth 20
 if ($json -match 'secret_key|synthetic-must-not-appear') { throw 'Unsafe inventory projection' }
}
[ordered]@{kind='offline_fixtures_not_live_api';live_requests=0;total=$script:results.Count;results=$script:results} | ConvertTo-Json -Depth 8
