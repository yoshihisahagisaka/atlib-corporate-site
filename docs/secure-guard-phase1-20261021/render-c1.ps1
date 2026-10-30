param(
  [Parameter(Mandatory)][string]$SourceSha,
  [Parameter(Mandatory)][string]$SecretVersion,
  [string]$ImageDigest,
  [string]$ProjectNumber,
  [Parameter(Mandatory)][string]$OutputDirectory
)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'c1-runtime.ps1')
if ($SourceSha -notmatch '^[a-f0-9]{40}$') { SG-Fail 'SOURCE_SHA_REQUIRED' }
if ($SecretVersion -notmatch '^[1-9][0-9]*$') { SG-Fail 'PINNED_SECRET_VERSION_REQUIRED' }
if ($ImageDigest -and $ImageDigest -notmatch '^sha256:[a-f0-9]{64}$') { SG-Fail 'IMAGE_DIGEST_REQUIRED' }
if ($ImageDigest -and $ProjectNumber -notmatch '^[1-9][0-9]*$') { SG-Fail 'VERIFIED_PROJECT_NUMBER_REQUIRED' }
if (!(Test-Path -LiteralPath $OutputDirectory -PathType Container)) { SG-Fail 'OUTPUT_DIRECTORY_REQUIRED' }
$policy=(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'runtime-policy.template.json') -Raw).Replace('__SOURCE_SHA__',$SourceSha).Replace('__SECRET_VERSION__',$SecretVersion)
SG-C1Policy ($policy | ConvertFrom-Json) @()
SG-WriteJson (Join-Path $OutputDirectory 'runtime-policy.json') ($policy | ConvertFrom-Json)
if ($ImageDigest) {
  $job=(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'job.template.yaml') -Raw).Replace('__SOURCE_SHA__',$SourceSha).Replace('__SECRET_VERSION__',$SecretVersion).Replace('__IMAGE_DIGEST__',$ImageDigest).Replace('__PROJECT_NUMBER__',$ProjectNumber)
  $s=[IO.File]::Open((Join-Path $OutputDirectory 'job.rendered.yaml'),[IO.FileMode]::CreateNew)
  try { $bytes=[Text.Encoding]::UTF8.GetBytes($job);$s.Write($bytes,0,$bytes.Length) } finally { $s.Dispose() }
}
