. (Join-Path $PSScriptRoot 'organization-offboarding.ps1') -LibraryOnly

function SG-C1Policy($Policy,[string[]]$Arguments) {
  if (@($Arguments).Count) { SG-Fail 'ARGUMENT_OVERRIDE_FORBIDDEN' }
  if ($Policy.mode -cne 'DryRun') { SG-Fail 'C1_DRYRUN_ONLY' }
  if ($Policy.project -cne 'msp-zabbix' -or $Policy.region -cne 'asia-northeast1' -or $Policy.job -cne 'secure-guard-cancellation') { SG-Fail 'DEPLOYMENT_SCOPE_MISMATCH' }
  if ($Policy.runtime_service_account -cne 'secure-guard-job-sa@msp-zabbix.iam.gserviceaccount.com') { SG-Fail 'EXPECTED_IDENTITY_INVALID' }
  if ($Policy.organization_id -notmatch '^\d+$' -or $Policy.msp_parent_id -notmatch '^\d+$' -or $Policy.organization_id -eq $Policy.msp_parent_id -or $Policy.organization_id -notin @($Policy.organization_allowlist)) { SG-Fail 'ORGANIZATION_NOT_ALLOWED' }
  if ($Policy.source_sha -notmatch '^[a-f0-9]{40}$') { SG-Fail 'SOURCE_SHA_REQUIRED' }
  if ([string]$Policy.secret_version -notmatch '^[1-9][0-9]*$') { SG-Fail 'PINNED_SECRET_VERSION_REQUIRED' }
  $expected='projects/msp-zabbix/secrets/secure-guard-dnsfilter-api-key/versions/'+$Policy.secret_version
  if ($Policy.secret_version_resource -cne $expected -or $Policy.secret_path -cne ('/var/run/guard-secrets/'+$Policy.secret_version)) { SG-Fail 'SECRET_VERSION_MISMATCH' }
}

function SG-C1Http([string]$Method,[string]$Uri,$Headers,$Body=$null) {
  $u=[Uri]$Uri
  if ($Method -notin @('GET','POST') -or $u.Scheme -cne 'https' -or $u.Port -ne 443 -or $u.UserInfo -or $u.Fragment) { SG-Fail 'HTTP_OPERATION_FORBIDDEN' }
  $dnsGet=($Method -ceq 'GET' -and $u.Host -ceq 'api.dnsfilter.com')
  $storageRead=($Method -ceq 'GET' -and $u.Host -ceq 'storage.googleapis.com' -and $u.AbsolutePath.StartsWith('/storage/v1/b/msp-zabbix-secure-guard-offboarding-audit/o/'))
  $storageCreate=($Method -ceq 'POST' -and $u.Host -ceq 'storage.googleapis.com' -and $u.AbsolutePath -ceq '/upload/storage/v1/b/msp-zabbix-secure-guard-offboarding-audit/o' -and $u.Query.EndsWith('&ifGenerationMatch=0'))
  if (!$dnsGet -and !$storageRead -and !$storageCreate) { SG-Fail 'HTTP_OPERATION_FORBIDDEN' }
  # One attempt only. Never return exception/header/raw error payload.
  try {
    $options=@{Method=$Method;Uri=$Uri;Headers=$Headers;TimeoutSec=30;MaximumRedirection=0;ErrorAction='Stop';Verbose=$false;Debug=$false}
    if ($null -ne $Body) { $options.Body=[Text.Encoding]::UTF8.GetBytes($Body);$options.ContentType='application/json' }
    $r=Invoke-WebRequest @options
    $parsed=$null
    if ($r.Content) { $parsed=ConvertFrom-Json -InputObject $r.Content -ErrorAction Stop }
    return @{status=[int]$r.StatusCode;body=$parsed}
  } catch {
    $status=0
    try { if ($_.Exception.Response) { $status=[int]$_.Exception.Response.StatusCode } } catch {}
    return @{status=$status;body=$null}
  }
}

function SG-C1DnsGet($Transport,[string]$Uri,[string]$Key) {
  $u=[Uri]$Uri
  if ($u.Scheme -cne 'https' -or $u.Host -cne 'api.dnsfilter.com' -or $u.Port -ne 443 -or $u.UserInfo -or $u.Fragment) { SG-Fail 'DNS_URI_NOT_ALLOWED' }
  $r=& $Transport 'GET' $Uri @{Authorization=('Bearer '+$Key);Accept='application/json'} $null
  return @{status=$r.status;body=$r.body}
}

function SG-C1DryRun($Policy,[string[]]$Arguments,$IdentityReader,$SecretReader,$Transport) {
  SG-C1Policy $Policy $Arguments
  $identity=& $IdentityReader
  if ([string]$identity -cne $Policy.runtime_service_account) { SG-Fail 'RUNTIME_SERVICE_IDENTITY_MISMATCH' }
  $key=$null;$invoke=$null
  try {
    $key=& $SecretReader $Policy.secret_path $Policy.secret_version_resource $Policy.runtime_service_account
    if ([string]::IsNullOrWhiteSpace($key) -or $key -match '[\r\n]') { SG-Fail 'SECRET_PAYLOAD_EMPTY_OR_INVALID' }
    $invoke={param($method,$uri)
      if ($method -cne 'GET') { SG-Fail 'C1_DRYRUN_ONLY' }
      SG-C1DnsGet $Transport $uri $key
    }.GetNewClosure()
    $spec=SG-Get $invoke 'https://api.dnsfilter.com/docs/api.json'
    $inventory=SG-Inventory $invoke $spec $Policy.organization_id $Policy.msp_parent_id
    $payload=[ordered]@{source_sha=$Policy.source_sha;mode='DryRun';inventory=$inventory;mutations_enabled=$false}
    return [ordered]@{plan_hash=(SG-Hash $payload);payload=$payload}
  } finally { $key=$null;$invoke=$null;$spec=$null }
}

function SG-C1StopCode($ErrorRecord) {
  $code='UNEXPECTED_ERROR_DETAILS_WITHHELD'
  if ($ErrorRecord.Exception -is [InvalidOperationException] -and $ErrorRecord.Exception.Message -cmatch '^[A-Z][A-Z0-9_]+$') { $code=$ErrorRecord.Exception.Message }
  return $code
}
