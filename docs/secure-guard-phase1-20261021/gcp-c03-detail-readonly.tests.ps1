$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot 'gcp-c03-detail-readonly.ps1'
. $source -LibraryOnly
$results=@()
function Assert-Stop([scriptblock]$Action) { try { & $Action | Out-Null } catch { return }; throw 'Expected rejection' }
Assert-Stop { Invoke-SGC03Read 'forbidden' @('secrets','versions','access','1','--format=json(name)') };$results+=@{test='Secret payload access rejected';result='PASS'}
Assert-Stop { Invoke-SGC03Read 'forbidden' @('run','jobs','deploy','job','--format=json(metadata.name)') };$results+=@{test='Deploy command rejected';result='PASS'}
Assert-Stop { Invoke-SGC03Read 'forbidden' @('run','jobs','describe','job','--format=json') };$results+=@{test='Unprojected configuration rejected';result='PASS'}
$p=Get-SGC03Plan 'msp-zabbix' 'asia-northeast1'
foreach ($projection in @($p.job_projection,$p.service_projection)) {
 if ($projection -match 'env\.value(,|$)|containers\.args|containers\.command') { throw 'Unsafe configuration projection' }
}
$results+=@{test='Job and Service projections omit plaintext env/args';result='PASS'}
Assert-Stop { Get-SGC03Plan 'other-project' 'asia-northeast1' };$results+=@{test='Project scope cannot change';result='PASS'}
$script:mockMode='success';$script:mockCalls=@()
function gcloud {
 param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
 $script:mockCalls+=,($Arguments -join ' ')
 $global:LASTEXITCODE=0
 if ($script:mockMode -eq 'failure') { $global:LASTEXITCODE=1; return }
 $prefix=$Arguments[0..([Math]::Min(2,$Arguments.Count-1))] -join ' '
 if ($prefix -like 'projects describe*') { return '{"projectId":"msp-zabbix","projectNumber":"123","lifecycleState":"ACTIVE"}' }
 if ($prefix -like 'run jobs list*') { return '[{"metadata":{"name":"fixture-readonly-job"}}]' }
 if ($prefix -like 'run jobs describe*') { return '{"metadata":{"name":"fixture-readonly-job"},"spec":{"template":{"spec":{"template":{"spec":{"serviceAccountName":"fixture@project.iam.gserviceaccount.com"}}}}}}' }
 if ($prefix -like 'run services list*') { return '[{"metadata":{"name":"fixture-service"}}]' }
 if ($prefix -like 'secrets list*') { return '[{"name":"projects/msp-zabbix/secrets/fixture-secret"}]' }
 if ($prefix -like 'secrets versions list*') { return '[{"name":"projects/msp-zabbix/secrets/fixture-secret/versions/3","state":"ENABLED"}]' }
 if ($prefix -like 'iam service-accounts list*') { return '[{"email":"fixture@project.iam.gserviceaccount.com","disabled":false}]' }
 if ($prefix -like 'scheduler jobs list*') { return '[{"name":"projects/msp-zabbix/locations/asia-northeast1/jobs/fixture-scheduler","state":"PAUSED"}]' }
 if (($Arguments -join ' ') -match 'get-iam-policy') { return '{"bindings":[],"version":1}' }
 return '[]'
}
$r=Invoke-SGC03Read 'fixture' @('secrets','versions','list','fixture-secret','--format=json(name,state)')
if ($r.state -ne 'READ' -or $r.data[0].state -ne 'ENABLED') { throw 'Mock read failed' }
$results+=@{test='Metadata-only version list captured';result='PASS'}
$script:mockMode='failure'
$r=Invoke-SGC03Read 'fixture' @('projects','describe','msp-zabbix','--format=json(projectId)')
if ($r.state -ne 'UNAVAILABLE' -or $null -ne $r.data) { throw 'Failed request misclassified' }
$results+=@{test='Auth/API failure remains UNAVAILABLE';result='PASS'}
$script:mockMode='success';$script:mockCalls=@()
$report=(& $source | Out-String) | ConvertFrom-Json
if ($report.mode -ne 'READ_ONLY_METADATA_NO_PAYLOAD' -or !($report.results | Where-Object section -eq 'job/fixture-readonly-job') -or !($report.results | Where-Object section -eq 'secret_versions/fixture-secret')) { throw 'Detail flow incomplete' }
if (@($script:mockCalls | Where-Object { $_ -match 'versions access|print-access-token| deploy | add-iam| set-iam| create | delete | update | env\.value(,|\))|httpTarget\.body' }).Count) { throw 'Disallowed operation recorded' }
$results+=@{test='Full metadata fixture flow uses only read projections';result='PASS'}
[ordered]@{kind='offline_collector_fixtures';total=$results.Count;live_gcp_requests=0;results=$results} | ConvertTo-Json -Depth 8

