param([string]$ProjectId='msp-zabbix',[string]$Region='asia-northeast1',[switch]$LibraryOnly)
$ErrorActionPreference='Stop'
function Invoke-SGC03Read([string]$Section,[string[]]$Arguments) {
  $joined=$Arguments -join ' '
  $allowed='^(projects (describe|get-iam-policy)|artifacts repositories (list|describe|get-iam-policy)|builds (list|describe)|run (jobs|services) (list|describe|get-iam-policy)|secrets (list|describe|get-iam-policy|versions list)|iam service-accounts (list|get-iam-policy)|storage buckets (list|describe|get-iam-policy)|sql instances list|scheduler jobs (list|describe)|services list)( |$)'
  if ($joined -notmatch $allowed -or @($Arguments | Where-Object { $_ -eq '--format=json' }).Count -gt 0) { throw 'READ_ONLY_OR_PROJECTION_GATE_FAILED' }
  try {
    $raw=& gcloud @Arguments '--quiet' 2>$null
    if ($LASTEXITCODE -ne 0) { return [pscustomobject]@{section=$Section;state='UNAVAILABLE';data=$null} }
    $data=($raw -join "`n") | ConvertFrom-Json
    return [pscustomobject]@{section=$Section;state='READ';data=$data}
  } catch { return [pscustomobject]@{section=$Section;state='UNAVAILABLE';data=$null} }
  finally { $raw=$null }
}
function SG-C03Leaf([string]$Name) {
  $leaf=($Name -split '/')[-1]
  if ($leaf -notmatch '^[A-Za-z0-9_.@-]+$') { throw 'UNEXPECTED_RESOURCE_IDENTIFIER' }
  return $leaf
}
function Get-SGC03Plan([string]$Project,[string]$Location) {
  if ($Project -ne 'msp-zabbix' -or $Location -ne 'asia-northeast1') { throw 'C03_SCOPE_MISMATCH' }
  $jobProjection='metadata.name,spec.template.spec.taskCount,spec.template.spec.parallelism,spec.template.spec.template.spec.serviceAccountName,spec.template.spec.template.spec.maxRetries,spec.template.spec.template.spec.timeoutSeconds,spec.template.spec.template.spec.volumes.secret,spec.template.spec.template.spec.containers.image,spec.template.spec.template.spec.containers.resources,spec.template.spec.template.spec.containers.env.name,spec.template.spec.template.spec.containers.env.valueFrom.secretKeyRef,spec.template.spec.template.spec.containers.volumeMounts'
  $serviceProjection='metadata.name,status.latestReadyRevisionName,spec.template.spec.serviceAccountName,spec.template.spec.containers.image,spec.template.spec.containers.resources,spec.template.spec.containers.env.name,spec.template.spec.containers.env.valueFrom.secretKeyRef,spec.template.spec.containers.volumeMounts,spec.template.spec.volumes.secret,status.traffic.revisionName,status.traffic.percent'
  return [ordered]@{job_projection=$jobProjection;service_projection=$serviceProjection;project_flag=('--project='+$Project);region_flag=('--region='+$Location)}
}
if ($LibraryOnly) { return }
$plan=Get-SGC03Plan $ProjectId $Region
$projectFlag=$plan.project_flag; $regionFlag=$plan.region_flag
$report=[ordered]@{schema_version=1;project_id=$ProjectId;region=$Region;observed_at_utc=[DateTime]::UtcNow.ToString('o');mode='READ_ONLY_METADATA_NO_PAYLOAD';results=@();notes=@('No secret access, credential copy, token print, full env, container args, DB rows, GCS objects, or Scheduler HTTP body are collected.','READ means metadata returned; it is not an IAM or runtime PASS. Missing fields/failed requests stay unverified.')}
$probe=Invoke-SGC03Read 'project_probe' @('projects','describe',$ProjectId,'--format=json(projectId,projectNumber,lifecycleState)')
$report.results+=,$probe
if ($probe.state -ne 'READ') { $report.notes+='Project metadata unavailable: stopped before all detail reads.'; $report | ConvertTo-Json -Depth 40; exit 2 }
$report.results+=,(Invoke-SGC03Read 'project_iam' @('projects','get-iam-policy',$ProjectId,'--format=json(bindings,version,auditConfigs)'))
$report.results+=,(Invoke-SGC03Read 'enabled_apis' @('services','list','--enabled',$projectFlag,'--format=json(config.name,state)'))
$repos=Invoke-SGC03Read 'artifact_repositories' @('artifacts','repositories','list',$projectFlag,'--location=all','--format=json(name,format,mode,createTime,cleanupPolicies)')
$report.results+=,$repos
if ($repos.state -eq 'READ') {
  foreach ($repo in @($repos.data)) {
    if ($repo.name -notmatch ('^projects/'+[regex]::Escape($ProjectId)+'/locations/([a-z0-9-]+)/repositories/([a-zA-Z0-9_.-]+)$')) { continue }
    $repoLocation=$Matches[1];$repoId=$Matches[2]
    $report.results+=,(Invoke-SGC03Read ('repository_iam/'+$repoId) @('artifacts','repositories','get-iam-policy',$repoId,$projectFlag,('--location='+$repoLocation),'--format=json(bindings,version)'))
  }
}
foreach ($buildRegion in @('global',$Region)) {
  $builds=Invoke-SGC03Read ('builds/'+$buildRegion) @('builds','list',$projectFlag,('--region='+$buildRegion),'--limit=5','--format=json(id,status,createTime,serviceAccount,images,results.images,options.machineType,options.pool.name,sourceProvenance.resolvedRepoSource.commitSha)')
  $report.results+=,$builds
}
$jobs=Invoke-SGC03Read 'job_names' @('run','jobs','list',$projectFlag,$regionFlag,'--format=json(metadata.name)');$report.results+=,$jobs
if ($jobs.state -eq 'READ') {
  foreach ($job in @($jobs.data)) {
    $name=SG-C03Leaf $job.metadata.name
    $report.results+=,(Invoke-SGC03Read ('job/'+$name) @('run','jobs','describe',$name,$projectFlag,$regionFlag,('--format=json('+$plan.job_projection+')')))
    $report.results+=,(Invoke-SGC03Read ('job_iam/'+$name) @('run','jobs','get-iam-policy',$name,$projectFlag,$regionFlag,'--format=json(bindings,version)'))
  }
}
$services=Invoke-SGC03Read 'service_names' @('run','services','list',$projectFlag,$regionFlag,'--format=json(metadata.name)');$report.results+=,$services
if ($services.state -eq 'READ') {
  foreach ($service in @($services.data)) {
    $name=SG-C03Leaf $service.metadata.name
    $report.results+=,(Invoke-SGC03Read ('service/'+$name) @('run','services','describe',$name,$projectFlag,$regionFlag,('--format=json('+$plan.service_projection+')')))
  }
}
$secrets=Invoke-SGC03Read 'secret_names' @('secrets','list',$projectFlag,'--format=json(name,replication)');$report.results+=,$secrets
if ($secrets.state -eq 'READ') {
  foreach ($secret in @($secrets.data)) {
    $name=SG-C03Leaf $secret.name
    $report.results+=,(Invoke-SGC03Read ('secret_versions/'+$name) @('secrets','versions','list',$name,$projectFlag,'--format=json(name,state,createTime,destroyTime)'))
    $report.results+=,(Invoke-SGC03Read ('secret_iam/'+$name) @('secrets','get-iam-policy',$name,$projectFlag,'--format=json(bindings,version)'))
  }
}
$accounts=Invoke-SGC03Read 'service_accounts' @('iam','service-accounts','list',$projectFlag,'--format=json(email,disabled,uniqueId)');$report.results+=,$accounts
if ($accounts.state -eq 'READ') {
  foreach ($account in @($accounts.data)) {
    $report.results+=,(Invoke-SGC03Read ('sa_iam/'+$account.email) @('iam','service-accounts','get-iam-policy',$account.email,$projectFlag,'--format=json(bindings,version)'))
  }
}
$buckets=Invoke-SGC03Read 'bucket_metadata' @('storage','buckets','list',$projectFlag,'--format=json(name,location,storage_class,default_storage_class,uniform_bucket_level_access,public_access_prevention,retention_policy,soft_delete_policy,lifecycle_config,versioning_enabled)');$report.results+=,$buckets
if ($buckets.state -eq 'READ') {
  foreach ($bucket in @($buckets.data)) {
    $bucketName=([string]$bucket.name).Replace('gs://','').TrimEnd('/')
    if ($bucketName -notmatch '^[a-z0-9][a-z0-9._-]+[a-z0-9]$') { continue }
    $report.results+=,(Invoke-SGC03Read ('bucket_iam/'+$bucketName) @('storage','buckets','get-iam-policy',('gs://'+$bucketName),'--format=json(bindings,version)'))
  }
}
$report.results+=,(Invoke-SGC03Read 'sql_instance_metadata' @('sql','instances','list',$projectFlag,'--format=json(name,region,databaseVersion,settings.tier,settings.availabilityType,settings.backupConfiguration.enabled)'))
$schedulers=Invoke-SGC03Read 'scheduler_names' @('scheduler','jobs','list',$projectFlag,('--location='+$Region),'--format=json(name,state)');$report.results+=,$schedulers
if ($schedulers.state -eq 'READ') {
  foreach ($scheduler in @($schedulers.data)) {
    $name=SG-C03Leaf $scheduler.name
    $report.results+=,(Invoke-SGC03Read ('scheduler_auth/'+$name) @('scheduler','jobs','describe',$name,$projectFlag,('--location='+$Region),'--format=json(name,state,schedule,timeZone,httpTarget.httpMethod,httpTarget.oauthToken.serviceAccountEmail,httpTarget.oidcToken.serviceAccountEmail,retryConfig)'))
  }
}
$report | ConvertTo-Json -Depth 40

