param(
  [string]$OrganizationId,
  [string]$MspParentId='10220948',
  [ValidateSet('DryRun','RequestUninstall','Observe')][string]$Mode='DryRun',
  [string]$AuditDirectory,
  [string]$PlanPath,
  [string]$ApprovedPlanHash,
  [string]$ApprovalReference,
  [string]$VerifiedWindowsX64Version,
  [string]$SecretFilePath,
  [string]$SecretVersionResource,
  [string]$ExpectedRuntimeServiceAccount,
  [switch]$LibraryOnly
)
$ErrorActionPreference='Stop'

function SG-Fail([string]$Code) { throw [InvalidOperationException]::new($Code) }
function SG-Id($Value) { return [string]$Value }
function SG-Relation($Item,[string]$Name) {
  $r=$Item.relationships.$Name
  $values=@($r.data.id,$r.id,$Item.attributes.($Name+'_id')) | Where-Object { $null -ne $_ -and [string]$_ -ne '' } | ForEach-Object { [string]$_ } | Select-Object -Unique
  if (@($values).Count -ne 1) { SG-Fail ('RELATION_UNKNOWN_OR_CONFLICT_'+$Name) }
  return [string]@($values)[0]
}
function SG-Hash($Value) {
  $json=ConvertTo-Json -InputObject $Value -Depth 20 -Compress
  $hash=[Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($json)))).Replace('-','').ToLowerInvariant() }
  finally { $hash.Dispose() }
}
function SG-WriteJson([string]$Path,$Value) {
  # CreateNew prevents accidental overwrite. These files contain allowlisted metadata only.
  $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try { $bytes=[Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $Value -Depth 20)); $stream.Write($bytes,0,$bytes.Length); $stream.Flush() }
  finally { $stream.Dispose() }
}
function SG-Event([string]$Directory,[string]$OperationId,[string]$State,$Details) {
  SG-WriteJson (Join-Path $Directory (([Guid]::NewGuid().ToString())+'.json')) ([ordered]@{operation_id=$OperationId;at_utc=[DateTime]::UtcNow.ToString('o');state=$State;details=$Details})
}
function SG-Resolve($Spec,$Node) {
  for ($depth=0;$depth -lt 10;$depth++) {
    if (!$Node.'$ref') { return $Node }
    $parts=$Node.'$ref' -split '/'
    if ($parts[0] -ne '#') { SG-Fail 'EXTERNAL_SCHEMA_REF' }
    $Node=$Spec
    foreach ($part in $parts[1..($parts.Length-1)]) { $Node=$Node.($part.Replace('~1','/').Replace('~0','~')) }
    if ($null -eq $Node) { SG-Fail 'UNRESOLVED_SCHEMA_REF' }
  }
  SG-Fail 'SCHEMA_REF_LOOP'
}
function SG-Parameters($Spec,[string]$Path,[string]$Method) {
  $p=$Spec.paths.$Path
  if ($null -eq $p.$Method) { SG-Fail ('MISSING_OPERATION_'+$Method+'_'+$Path) }
  $all=@()
  foreach ($v in (@($p.parameters)+@($p.$Method.parameters))) { if ($null -ne $v) { $all+=,(SG-Resolve $Spec $v) } }
  return $all
}
function SG-RequireQuery($Spec,[string]$Path,[string]$Method,[string]$Name,[string[]]$Types) {
  $found=@(SG-Parameters $Spec $Path $Method | Where-Object { $_.name -eq $Name -and $_.in -eq 'query' })
  if ($found.Count -ne 1) { SG-Fail ('QUERY_NOT_DOCUMENTED_'+$Name) }
  $type=$found[0].type; if (!$type) { $type=$found[0].schema.type }
  if ($type -notin $Types) { SG-Fail ('QUERY_TYPE_UNSUPPORTED_'+$Name) }
  return $found[0]
}
function SG-Get($Invoke,[string]$Uri) {
  $r=& $Invoke 'GET' $Uri
  if ($r.status -ne 200) { SG-Fail ('GET_HTTP_'+$r.status) }
  return $r.body
}
function SG-MountedSecret([string]$Path,[string]$Version,[string]$ExpectedIdentity,$IdentityReader) {
  if ($Version -notmatch '^projects/[A-Za-z0-9_-]+/secrets/[A-Za-z0-9_-]+/versions/[1-9][0-9]*$') { SG-Fail 'PINNED_SECRET_VERSION_REQUIRED' }
  if (!$ExpectedIdentity -or !$Path) { SG-Fail 'SECRET_MOUNT_AND_RUNTIME_ID_REQUIRED' }
  $identity=& $IdentityReader
  if ([string]$identity -cne $ExpectedIdentity) { SG-Fail 'RUNTIME_SERVICE_IDENTITY_MISMATCH' }
  if (!(Test-Path -LiteralPath $Path -PathType Leaf)) { SG-Fail 'SECRET_MOUNT_UNAVAILABLE' }
  $value=[IO.File]::ReadAllText($Path)
  if ([string]::IsNullOrWhiteSpace($value) -or $value -match '[\r\n]') { SG-Fail 'SECRET_PAYLOAD_EMPTY_OR_INVALID' }
  return $value
}
function SG-AllPages($Invoke,$Spec,[string]$InitialUri,[string]$Path,[hashtable]$Scope) {
  # Strict adapter: explicit links.next AND stable meta.total_count are required.
  # An unrecognized live pagination shape must be reviewed; never infer completeness.
  $uri=$InitialUri; $seenUrls=@{}; $seenIds=@{}; $rows=@(); $pages=0; $expected=$null
  $base=[Uri]'https://api.dnsfilter.com'
  $allowed=@(SG-Parameters $Spec $Path 'get' | Where-Object { $_.in -eq 'query' } | ForEach-Object { $_.name })
  while ($uri) {
    $u=[Uri]::new($base,$uri)
    if ($u.Scheme -ne 'https' -or $u.Host -ne $base.Host -or $u.Port -ne 443 -or $u.UserInfo -or $u.Fragment -or $u.AbsolutePath -ne $Path) { SG-Fail 'UNSAFE_NEXT_LINK' }
    $query=@{}
    foreach ($part in $u.Query.TrimStart('?').Split('&')) {
      if (!$part) { continue }; $kv=$part.Split('=',2)
      $k=[Uri]::UnescapeDataString($kv[0]); $v=''; if ($kv.Length -gt 1) { $v=[Uri]::UnescapeDataString($kv[1]) }
      if ($query.ContainsKey($k) -or $k -notin $allowed) { SG-Fail 'UNDOCUMENTED_OR_DUPLICATE_QUERY' }
      if (!$Scope.ContainsKey($k) -and $k -notin @('page','per_page','page_size','page[number]','page[size]','offset','limit','cursor')) { SG-Fail 'NEXT_LINK_ADDS_NONPAGING_FILTER' }
      $query[$k]=$v
    }
    foreach ($k in $Scope.Keys) { if (!$query.ContainsKey($k) -or $query[$k] -cne [string]$Scope[$k]) { SG-Fail 'PAGINATION_SCOPE_CHANGED' } }
    if ($seenUrls.ContainsKey($u.AbsoluteUri) -or $pages -ge 10000) { SG-Fail 'PAGINATION_LOOP_OR_LIMIT' }
    $seenUrls[$u.AbsoluteUri]=$true; $pages++
    $body=SG-Get $Invoke $u.AbsoluteUri
    if ($null -eq $body.PSObject.Properties['data'] -or $body.data -isnot [array]) { SG-Fail 'LIST_SHAPE_UNKNOWN' }
    if ($null -eq $body.links -or $null -eq $body.links.PSObject.Properties['next']) { SG-Fail 'PAGINATION_TERMINATOR_UNVERIFIED' }
    $total=0L
    if ($null -eq $body.meta.total_count -or ![long]::TryParse([string]$body.meta.total_count,[ref]$total) -or $total -lt 0) { SG-Fail 'PAGINATION_TOTAL_UNVERIFIED' }
    if ($null -eq $expected) { $expected=$total } elseif ($expected -ne $total) { SG-Fail 'PAGINATION_TOTAL_CHANGED' }
    foreach ($row in $body.data) {
      $id=[string]$row.id
      if (!$id -or $seenIds.ContainsKey($id)) { SG-Fail 'DUPLICATE_OR_MISSING_RESOURCE_ID' }
      $seenIds[$id]=$true; $rows+=,$row
    }
    $next=$body.links.next
    if ($null -ne $next -and $next -isnot [string]) { SG-Fail 'NEXT_LINK_SHAPE_UNKNOWN' }
    if ($next -eq '') { SG-Fail 'EMPTY_NEXT_LINK_NOT_VERIFIED_NULL' }
    $uri=$next
  }
  if ($rows.Count -ne $expected) { SG-Fail 'PAGINATION_COUNT_MISMATCH' }
  return [pscustomobject]@{rows=$rows;pages=$pages;total=$expected;proof='explicit-next-null+stable-total_count+unique-ids'}
}
function SG-Agent($Item,[string]$Org,[string]$Site) {
  if ((SG-Relation $Item 'organization') -ne $Org) { SG-Fail 'AGENT_ORG_MISMATCH' }
  $actualSite=SG-Relation $Item 'network'
  if ($Site -and $actualSite -ne $Site) { SG-Fail 'AGENT_SITE_MISMATCH' }
  $a=$Item.attributes
  if (!$Item.id -or !$a.hostname -or !$a.status -or !$a.agent_state) { SG-Fail 'AGENT_FIELDS_MISSING' }
  return [ordered]@{uuid=[string]$Item.id;hostname=[string]$a.hostname;organization_id=$Org;site_id=$actualSite;status=[string]$a.status;agent_state=[string]$a.agent_state}
}
function SG-Inventory($Invoke,$Spec,[string]$Org,[string]$Parent) {
  if ($Org -notmatch '^\d+$' -or $Parent -notmatch '^\d+$' -or $Org -eq $Parent) { SG-Fail 'INVALID_OR_PARENT_TARGET' }
  $null=SG-Parameters $Spec '/v1/organizations/{id}' 'get'
  $orgBody=SG-Get $Invoke ('https://api.dnsfilter.com/v1/organizations/'+$Org)
  if ([string]$orgBody.data.id -ne $Org -or (SG-Relation $orgBody.data 'managed_by_msp') -ne $Parent) { SG-Fail 'ORG_PARENT_MISMATCH_OR_UNKNOWN' }
  $null=SG-RequireQuery $Spec '/v1/networks' 'get' 'organization_id' @('integer','string')
  $null=SG-RequireQuery $Spec '/v1/user_agents' 'get' 'organization_ids' @('array','string')
  $null=SG-RequireQuery $Spec '/v1/user_agents' 'get' 'network_ids' @('array','string')
  $sitesResult=SG-AllPages $Invoke $Spec ('https://api.dnsfilter.com/v1/networks?organization_id='+$Org) '/v1/networks' @{organization_id=$Org}
  $sites=@(); $agents=@(); $seen=@{}; $pageEvidence=@()
  foreach ($site in $sitesResult.rows) {
    if ((SG-Relation $site 'organization') -ne $Org) { SG-Fail 'SITE_ORG_MISMATCH' }
    $sid=[string]$site.id
    $sites+=,[ordered]@{id=$sid;name=[string]$site.attributes.name;organization_id=$Org}
    $list=SG-AllPages $Invoke $Spec ('https://api.dnsfilter.com/v1/user_agents?organization_ids='+$Org+'&network_ids='+$sid) '/v1/user_agents' @{organization_ids=$Org;network_ids=$sid}
    $pageEvidence+=,[ordered]@{scope='site';site_id=$sid;pages=$list.pages;total=$list.total;proof=$list.proof}
    foreach ($item in $list.rows) {
      $agent=SG-Agent $item $Org $sid
      if ($seen.ContainsKey($agent.uuid)) { SG-Fail 'AGENT_DUPLICATE_ACROSS_SITES' }
      $seen[$agent.uuid]=$true; $agents+=,$agent
    }
  }
  # Org-wide independent reconciliation catches orphaned/missing Site membership.
  $orgAgents=SG-AllPages $Invoke $Spec ('https://api.dnsfilter.com/v1/user_agents?organization_ids='+$Org) '/v1/user_agents' @{organization_ids=$Org}
  $all=@(); foreach ($item in $orgAgents.rows) { $all+=,(SG-Agent $item $Org '') }
  $left=ConvertTo-Json -InputObject @($agents | Sort-Object uuid) -Depth 10 -Compress
  $right=ConvertTo-Json -InputObject @($all | Sort-Object uuid) -Depth 10 -Compress
  if ($left -cne $right) { SG-Fail 'ORG_SITE_INVENTORY_MISMATCH' }
  return [ordered]@{organization_id=$Org;msp_parent_id=$Parent;sites=@($sites | Sort-Object id);agents=@($agents | Sort-Object uuid);paging=[ordered]@{site_pages=$sitesResult.pages;site_total=$sitesResult.total;org_agent_pages=$orgAgents.pages;org_agent_total=$orgAgents.total;per_site=$pageEvidence};visibility='API default documented collection only; relay/deleted visibility requires review'}
}
function SG-UninstallSchema($Spec) {
  $path='/v1/user_agents/{id}'; $null=SG-Parameters $Spec $path 'get'
  $params=@(SG-Parameters $Spec $path 'delete')
  $q=SG-RequireQuery $Spec $path 'delete' 'queue_uninstall' @('boolean')
  if ([string]$q.description -notmatch 'uninstall') { SG-Fail 'UNINSTALL_SEMANTICS_UNVERIFIED' }
  $id=@($params | Where-Object { $_.name -eq 'id' -and $_.in -eq 'path' })
  if ($id.Count -ne 1) { SG-Fail 'AGENT_PATH_ID_UNVERIFIED' }
  $idType=$id[0].type; if (!$idType) { $idType=$id[0].schema.type }
  if ($idType -ne 'string') { SG-Fail 'AGENT_UUID_TYPE_UNVERIFIED' }
  foreach ($p in $params) { if ($p.required -and $p.name -notin @('id','queue_uninstall')) { SG-Fail 'UNEXPECTED_REQUIRED_DELETE_PARAMETER' } }
  if ($Spec.paths.$path.delete.requestBody.required) { SG-Fail 'UNEXPECTED_REQUIRED_DELETE_BODY' }
}

if ($LibraryOnly) { return }
$sgKey=$null; $sgHeaders=$null; $sgOperationId=[Guid]::NewGuid().ToString(); $sgStage='initialization'
try {
  if (!$OrganizationId -or !$AuditDirectory) { SG-Fail 'ORG_AND_AUDIT_DIRECTORY_REQUIRED' }
  if (!(Test-Path -LiteralPath $AuditDirectory -PathType Container)) { SG-Fail 'CREATE_PRIVATE_AUDIT_DIRECTORY_FIRST' }
  $AuditDirectory=(Resolve-Path -LiteralPath $AuditDirectory).Path
  $sgStage='unattended_authentication'
  if (!$env:CLOUD_RUN_JOB) { SG-Fail 'CLOUD_RUN_JOB_RUNTIME_REQUIRED_NO_INTERACTIVE_FALLBACK' }
  $identityReader={
    Invoke-RestMethod -Method Get -Uri 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email' -Headers @{'Metadata-Flavor'='Google'} -TimeoutSec 5 -MaximumRedirection 0
  }
  $sgKey=SG-MountedSecret $SecretFilePath $SecretVersionResource $ExpectedRuntimeServiceAccount $identityReader
  $sgHeaders=@{Authorization='Bearer '+$sgKey;Accept='application/json'}
  $sgInvoke={ param($method,$uri)
    try {
      $r=Invoke-WebRequest -Method $method -Uri $uri -Headers $sgHeaders -TimeoutSec 30 -MaximumRedirection 0 -UseBasicParsing
      $body=$null; if ($r.Content) { $body=$r.Content | ConvertFrom-Json }
      return [pscustomobject]@{status=[int]$r.StatusCode;body=$body}
    } catch {
      $status=$null; if ($_.Exception.Response) { try { $status=[int]$_.Exception.Response.StatusCode } catch {} }
      # Never emit exception/raw body/header. No retries for either GET or DELETE.
      return [pscustomobject]@{status=$status;body=$null}
    }
  }
  $sgStage='official_schema'
  $sgSpec=SG-Get $sgInvoke 'https://api.dnsfilter.com/docs/api.json'
  SG-UninstallSchema $sgSpec
  if ($Mode -eq 'DryRun') {
    $sgStage='inventory'
    $inventory=SG-Inventory $sgInvoke $sgSpec $OrganizationId $MspParentId
    $payload=[ordered]@{operation_id=$sgOperationId;created_at_utc=[DateTime]::UtcNow.ToString('o');inventory=$inventory;actions=@($inventory.agents | ForEach-Object { [ordered]@{uuid=$_.uuid;method='DELETE';queue_uninstall=$true;state='planned'} });organization_delete='BLOCKED_REQUIRES_SEPARATE_FINAL_APPROVAL'}
    $plan=[ordered]@{plan_hash=(SG-Hash $payload);payload=$payload}
    $out=Join-Path $AuditDirectory ($sgOperationId+'-plan.json')
    SG-WriteJson $out $plan
    SG-Event $AuditDirectory $sgOperationId 'dry_run_complete' @{plan_hash=$plan.plan_hash;agent_count=@($inventory.agents).Count;site_count=@($inventory.sites).Count}
    $plan | ConvertTo-Json -Depth 20
    Write-Output ('PlanPath: '+$out)
  } else {
    if (!$PlanPath) { SG-Fail 'PLAN_REQUIRED' }
    $plan=Get-Content -LiteralPath $PlanPath -Raw | ConvertFrom-Json
    if ((SG-Hash $plan.payload) -cne $plan.plan_hash -or $plan.payload.inventory.organization_id -ne $OrganizationId -or $plan.payload.inventory.msp_parent_id -ne $MspParentId) { SG-Fail 'PLAN_INTEGRITY_OR_SCOPE_FAILED' }
    $sgOperationId=$plan.payload.operation_id
    if ($Mode -eq 'Observe') {
      foreach ($agent in $plan.payload.inventory.agents) {
        $r=& $sgInvoke 'GET' ('https://api.dnsfilter.com/v1/user_agents/'+$agent.uuid)
        $details=[ordered]@{uuid=$agent.uuid;http_status=$r.status;completion='NOT_PROVEN_BY_API_ALONE'}
        if ($r.status -eq 200) {
          $now=SG-Agent $r.body.data $OrganizationId $agent.site_id
          if ($now.uuid -cne $agent.uuid -or $now.hostname -cne $agent.hostname) { SG-Fail 'OBSERVE_IDENTITY_CHANGED' }
          $details.status=$now.status;$details.agent_state=$now.agent_state
        } elseif ($r.status -ne 404) { SG-Fail 'OBSERVE_API_FAILED' }
        SG-Event $AuditDirectory $sgOperationId 'observed' $details
        $details | ConvertTo-Json
      }
    } else {
      $sgStage='request_gate'
      # Cloud Run local filesystem cannot fence a later execution. Live requests
      # remain disabled until the reviewed durable audit/claim adapter is deployed.
      SG-Fail 'DURABLE_AUDIT_AND_CROSS_EXECUTION_CLAIM_ADAPTER_REQUIRED'
    }
  }
} catch {
  # Only internal error codes, never API exception text, are persisted.
  $code='UNEXPECTED_ERROR_DETAILS_WITHHELD'
  if ($_.Exception -is [InvalidOperationException] -and $_.Exception.Message -match '^[A-Z0-9_/{}/]+$') { $code=$_.Exception.Message }
  if ($AuditDirectory -and (Test-Path -LiteralPath $AuditDirectory -PathType Container)) {
    try { SG-Event $AuditDirectory $sgOperationId 'stopped' @{stage=$sgStage;code=$code} } catch {}
  }
  [ordered]@{state='STOP';stage=$sgStage;code=$code;notes='No automatic resend; retain audit and claims. Organization DELETE is not implemented.'} | ConvertTo-Json
  exit 1
} finally { $sgKey=$null;$sgHeaders=$null;$sgSpec=$null;$r=$null;$result=$null;$sgInvoke=$null }
