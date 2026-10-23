. (Join-Path $PSScriptRoot 'c1-gcs.ps1')

function SG-C2Keys($Value,[string[]]$Keys) {
  if ($null -eq $Value) { SG-Fail 'DRYRUN_PLAN_SCHEMA_INVALID' }
  $actual=@();if ($Value -is [Collections.IDictionary]) { $actual=@($Value.Keys) } else { $actual=@($Value.PSObject.Properties.Name) }
  if ($actual.Count -ne $Keys.Count -or @($actual | Where-Object { $_ -cnotin $Keys }).Count) { SG-Fail 'DRYRUN_PLAN_SCHEMA_INVALID' }
}
function SG-C2Projection($Plan,$Policy) {
  SG-C1Policy $Policy @()
  SG-C2Keys $Plan @('plan_hash','payload')
  $p=$Plan.payload;SG-C2Keys $p @('source_sha','mode','inventory','mutations_enabled')
  if ($Plan.plan_hash -cnotmatch '^[a-f0-9]{64}$' -or $p.source_sha -cne $Policy.source_sha -or $p.mode -cne 'DryRun' -or $p.mutations_enabled -isnot [bool] -or $p.mutations_enabled) { SG-Fail 'DRYRUN_PLAN_SCOPE_INVALID' }
  $i=$p.inventory;SG-C2Keys $i @('organization_id','msp_parent_id','sites','agents','paging','visibility')
  if ($i.organization_id -cne $Policy.organization_id -or $i.msp_parent_id -cne $Policy.msp_parent_id) { SG-Fail 'DRYRUN_PLAN_SCOPE_INVALID' }
  if ($i.sites -isnot [array] -or $i.agents -isnot [array]) { SG-Fail 'DRYRUN_PLAN_SCHEMA_INVALID' }
  $sites=@();$siteIds=@{};$agents=@();$agentIds=@{}
  foreach ($s in $i.sites) {
    SG-C2Keys $s @('id','name','organization_id')
    if (!$s.id -or $s.organization_id -cne $i.organization_id -or $siteIds.ContainsKey([string]$s.id)) { SG-Fail 'DRYRUN_PLAN_SCOPE_INVALID' }
    $siteIds[[string]$s.id]=$true
    $sites+=,[ordered]@{id=[string]$s.id;name=[string]$s.name;organization_id=[string]$s.organization_id}
  }
  foreach ($a in $i.agents) {
    SG-C2Keys $a @('uuid','hostname','organization_id','site_id','status','agent_state')
    if (!$a.uuid -or !$a.hostname -or !$a.status -or !$a.agent_state -or $a.organization_id -cne $i.organization_id -or !$siteIds.ContainsKey([string]$a.site_id) -or $agentIds.ContainsKey([string]$a.uuid)) { SG-Fail 'DRYRUN_PLAN_SCOPE_INVALID' }
    $agentIds[[string]$a.uuid]=$true
    $agents+=,[ordered]@{uuid=[string]$a.uuid;hostname=[string]$a.hostname;organization_id=[string]$a.organization_id;site_id=[string]$a.site_id;status=[string]$a.status;agent_state=[string]$a.agent_state}
  }
  $g=$i.paging;SG-C2Keys $g @('site_pages','site_total','org_agent_pages','org_agent_total','per_site')
  foreach ($n in @('site_pages','site_total','org_agent_pages','org_agent_total')) { if ([string]$g.$n -cnotmatch '^[0-9]+$') { SG-Fail 'DRYRUN_PLAN_SCHEMA_INVALID' } }
  if ($g.per_site -isnot [array] -or $g.site_total -ne $sites.Count -or $g.org_agent_total -ne $agents.Count -or $g.per_site.Count -ne $sites.Count) { SG-Fail 'DRYRUN_PLAN_SCHEMA_INVALID' }
  $perSite=@();$proofSites=@{}
  foreach ($e in $g.per_site) {
    SG-C2Keys $e @('scope','site_id','pages','total','proof')
    if ($e.scope -cne 'site' -or !$siteIds.ContainsKey([string]$e.site_id) -or $proofSites.ContainsKey([string]$e.site_id) -or [string]$e.pages -cnotmatch '^[1-9][0-9]*$' -or [string]$e.total -cnotmatch '^[0-9]+$' -or $e.proof -cne 'explicit-next-null+stable-total_count+unique-ids') { SG-Fail 'DRYRUN_PLAN_SCHEMA_INVALID' }
    if (@($agents | Where-Object { $_.site_id -ceq $e.site_id }).Count -ne $e.total) { SG-Fail 'DRYRUN_PLAN_SCHEMA_INVALID' }
    $proofSites[[string]$e.site_id]=$true
    $perSite+=,[ordered]@{scope='site';site_id=[string]$e.site_id;pages=$e.pages;total=$e.total;proof=[string]$e.proof}
  }
  # Preserve the prototype's fixed visibility warning, never arbitrary notes.
  if ($i.visibility -cne 'API default documented collection only; relay/deleted visibility requires review') { SG-Fail 'DRYRUN_PLAN_SCHEMA_INVALID' }
  $inventory=[ordered]@{organization_id=[string]$i.organization_id;msp_parent_id=[string]$i.msp_parent_id;sites=$sites;agents=$agents;paging=[ordered]@{site_pages=$g.site_pages;site_total=$g.site_total;org_agent_pages=$g.org_agent_pages;org_agent_total=$g.org_agent_total;per_site=$perSite};visibility=[string]$i.visibility}
  $payload=[ordered]@{source_sha=[string]$p.source_sha;mode='DryRun';inventory=$inventory;mutations_enabled=$false}
  if ((SG-Hash $payload) -cne $Plan.plan_hash -or (SG-Hash $p) -cne $Plan.plan_hash) { SG-Fail 'DRYRUN_PLAN_HASH_MISMATCH' }
  return [ordered]@{plan_hash=[string]$Plan.plan_hash;payload=$payload}
}

function SG-C2SavePlan($Store,$Plan,$Policy) {
  if ($Store.scope -cne 'DryRun') { SG-Fail 'AUDIT_STORE_SCOPE_INVALID' }
  $safe=SG-C2Projection $Plan $Policy
  $path='dryruns/organizations/'+$safe.payload.inventory.organization_id+'/plans/'+$safe.plan_hash+'.json'
  $created=SG-C1StorageRequest $Store 'POST' $path $safe
  if ($created.bucket -cne $Store.bucket -or $created.name -cne $path -or [string]$created.generation -cnotmatch '^[1-9][0-9]*$') { SG-Fail 'DRYRUN_CREATE_RESULT_UNKNOWN_NO_RESEND' }
  $generation=[string]$created.generation
  $read=SG-C1StorageRequest $Store 'GET' $path $null $generation
  if ($null -eq $read) { SG-Fail 'DRYRUN_READBACK_MISSING' }
  $verified=SG-C2Projection $read $Policy
  if ($verified.plan_hash -cne $safe.plan_hash -or (SG-Hash $verified) -cne (SG-Hash $safe)) { SG-Fail 'DRYRUN_READBACK_CONTENT_MISMATCH' }
  return [ordered]@{status='DRYRUN_DURABLE_VERIFIED';source_sha=$Policy.source_sha;plan_hash=$safe.plan_hash;gcs_object=('gs://'+$Store.bucket+'/'+$path);generation=$generation;site_count=@($safe.payload.inventory.sites).Count;agent_count=@($safe.payload.inventory.agents).Count;mutations=0}
}

function SG-C2Run($Policy,[string[]]$Arguments,$IdentityReader,$SecretReader,$DnsTransport,$Store) {
  $plan=SG-C1DryRun $Policy $Arguments $IdentityReader $SecretReader $DnsTransport
  return (SG-C2SavePlan $Store $plan $Policy)
}
