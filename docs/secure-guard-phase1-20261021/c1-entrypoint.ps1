# Intentionally no param block: every supplied argument is rejected before I/O.
$ErrorActionPreference='Stop'
$entryArguments=@($args)
$VerbosePreference='SilentlyContinue';$DebugPreference='SilentlyContinue';$ProgressPreference='SilentlyContinue'
. (Join-Path $PSScriptRoot 'c2-durable-plan.ps1')
try {
  if ($entryArguments.Count) { SG-Fail 'ARGUMENT_OVERRIDE_FORBIDDEN' }
  $policy=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'runtime-policy.json') -Raw | ConvertFrom-Json
  SG-C1Policy $policy @()
  if ($env:CLOUD_RUN_JOB -cne $policy.job -or !$env:CLOUD_RUN_EXECUTION) { SG-Fail 'EXPECTED_CLOUD_RUN_JOB_REQUIRED' }
  $identityReader={
    try { Invoke-RestMethod -Uri 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email' -Headers @{'Metadata-Flavor'='Google'} -TimeoutSec 5 -MaximumRedirection 0 -Verbose:$false -Debug:$false }
    catch { SG-Fail 'RUNTIME_IDENTITY_UNAVAILABLE' }
  }
  $secretReader={param($path,$version,$expected)
    SG-MountedSecret $path $version $expected $identityReader
  }
  $store=SG-C1Store 'msp-zabbix-secure-guard-offboarding-audit' ${function:SG-C1Http} ${function:SG-C1MetadataToken} 'DryRun'
  SG-C2Run $policy @() $identityReader $secretReader ${function:SG-C1Http} $store | ConvertTo-Json -Compress
  exit 0
} catch {
  [ordered]@{state='STOP';code=(SG-C1StopCode $_);mutations=0} | ConvertTo-Json -Compress
  exit 1
}
