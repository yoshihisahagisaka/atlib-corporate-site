# GET-only inventory; never prints raw API responses or Site Keys.
# Run in the user's trusted PowerShell session. No files are written.
# Successful collection alone does NOT prove complete pagination or authorize deletion.
$ErrorActionPreference = 'Stop'
$sgKey = $env:DNSFILTER_API_KEY
$sgHeaders = $null
try {
  if ([string]::IsNullOrWhiteSpace($sgKey)) {
    $sgSecure = Read-Host 'DNSFilter API Key (local input only)' -AsSecureString
    $sgPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sgSecure)
    try { $sgKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($sgPtr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($sgPtr); $sgSecure = $null }
  }
  $sgHeaders = @{Authorization = "Bearer $sgKey"; Accept = 'application/json'}
  $sgTargets = @(
    @{kind='organization'; path='/v1/organizations/10220954'},
    @{kind='network'; path='/v1/networks/msp/all?organization_id=10220948'},
    @{kind='agent'; path='/v1/user_agents?organization_ids=10220954'}
  )
  foreach ($sgTarget in $sgTargets) {
    $sgRaw = $null
    try {
      $sgRaw = Invoke-RestMethod -Method Get -Headers $sgHeaders -Uri ('https://api.dnsfilter.com' + $sgTarget.path) -TimeoutSec 30
      $sgRows = @()
      foreach ($sgItem in @($sgRaw.data)) {
        if ($null -eq $sgItem) { continue }
        $sgAttr = $sgItem.attributes
        if ($null -eq $sgAttr) { $sgAttr = $sgItem }
        $sgOrg = [string]$sgItem.relationships.organization.data.id
        if ([string]::IsNullOrEmpty($sgOrg)) { $sgOrg = [string]$sgItem.relationships.organization.id }
        if ([string]::IsNullOrEmpty($sgOrg)) { $sgOrg = [string]$sgAttr.organization_id }
        $sgSite = [string]$sgItem.relationships.network.data.id
        if ([string]::IsNullOrEmpty($sgSite)) { $sgSite = [string]$sgItem.relationships.network.id }
        if ([string]::IsNullOrEmpty($sgSite)) { $sgSite = [string]$sgAttr.network_id }
        # The MSP list can include other orgs; retain only the approved target.
        if ($sgTarget.kind -eq 'network' -and $sgOrg -ne '10220954') { continue }
        if ($sgTarget.kind -eq 'agent') {
          $sgRows += [ordered]@{id=$sgItem.id; organization_id=$sgOrg; network_id=$sgSite; status=$sgAttr.status; agent_state=$sgAttr.agent_state; version=$sgAttr.version}
        } else {
          $sgRows += [ordered]@{id=$sgItem.id; name=$sgAttr.name; external_id=$sgAttr.external_id; organization_id=$sgOrg; network_id=$sgSite}
        }
      }
      [ordered]@{
        observed_at_utc=[DateTime]::UtcNow.ToString('o')
        kind=$sgTarget.kind
        result='GET_SUCCEEDED'
        rows=$sgRows
        pagination='UNVERIFIED_SINGLE_RESPONSE'
        # Only presence, never URL/body (URLs may contain sensitive values).
        next_link_present=([bool]$sgRaw.links.next)
        meta_present=($null -ne $sgRaw.meta)
        notes='No absence/completeness claim; missing relationships or more pages require follow-up. No mutation permitted.'
      } | ConvertTo-Json -Depth 6
    } catch {
      $sgHttp = $null
      if ($null -ne $_.Exception.Response) {
        try { $sgHttp = [int]$_.Exception.Response.StatusCode } catch {}
      }
      [ordered]@{kind=$sgTarget.kind; result='GET_FAILED'; http_status=$sgHttp; notes='Response body and exception text withheld. No automatic retry.'} | ConvertTo-Json
    } finally {
      $sgRaw=$null; $sgItem=$null; $sgAttr=$null; $sgRows=$null
    }
  }
} finally {
  $sgHeaders=$null; $sgKey=$null; $sgPtr=$null; $sgSecure=$null
}
