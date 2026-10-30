param([string[]]$ProjectIds=@('msp-zabbix','atlib-corporate-site'),[string]$Region='asia-northeast1')
$ErrorActionPreference='Stop'
# Metadata only: never secrets versions access, auth print-access-token,
# full service YAML/env, credentials export, or write/IAM/deploy commands.
function SG-GcloudMetadata([string]$Kind,[string[]]$Arguments) {
  $raw=& gcloud @Arguments 2>$null
  if ($LASTEXITCODE -ne 0) { return [ordered]@{kind=$Kind;state='UNAVAILABLE';data=$null} }
  try { return [ordered]@{kind=$Kind;state='READ';data=(($raw -join "`n") | ConvertFrom-Json)} }
  catch { return [ordered]@{kind=$Kind;state='UNPARSEABLE';data=$null} }
}
foreach ($project in $ProjectIds) {
  if ($project -notmatch '^[a-z][a-z0-9-]+[a-z0-9]$') { throw 'Invalid project identifier' }
  $result=[ordered]@{project_id=$project;observed_at_utc=[DateTime]::UtcNow.ToString('o');metadata=@()}
  $result.metadata+=,(SG-GcloudMetadata 'run_services' @('run','services','list',"--project=$project","--region=$Region",'--format=json(metadata.name,status.latestReadyRevisionName,spec.template.spec.serviceAccountName)'))
  $result.metadata+=,(SG-GcloudMetadata 'run_jobs' @('run','jobs','list',"--project=$project","--region=$Region",'--format=json(metadata.name)'))
  $result.metadata+=,(SG-GcloudMetadata 'secret_names_only' @('secrets','list',"--project=$project",'--format=json(name,createTime,replication)'))
  $result.metadata+=,(SG-GcloudMetadata 'service_account_names' @('iam','service-accounts','list',"--project=$project",'--format=json(email,disabled)'))
  $result.metadata+=,(SG-GcloudMetadata 'scheduler_names_only' @('scheduler','jobs','list',"--project=$project","--location=$Region",'--format=json(name,state)'))
  $result | ConvertTo-Json -Depth 15
}
# After exact candidates are known, separately read ONLY their IAM policies,
# numeric Secret version state, Job service identity/secret references/retry config,
# artifact repository metadata and dedicated audit-store IAM. Never access payload.
