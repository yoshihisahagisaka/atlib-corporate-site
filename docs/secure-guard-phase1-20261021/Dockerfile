ARG POWERSHELL_BASE_IMAGE
FROM ${POWERSHELL_BASE_IMAGE}
ARG POWERSHELL_BASE_IMAGE
ARG SOURCE_SHA
ENV POWERSHELL_TELEMETRY_OPTOUT=1 DOTNET_CLI_TELEMETRY_OPTOUT=1
WORKDIR /app
COPY organization-offboarding.ps1 c1-runtime.ps1 c1-entrypoint.ps1 c1-gcs.ps1 c2-durable-plan.ps1 runtime-policy.json ./
RUN pwsh -NoLogo -NoProfile -NonInteractive -Command '. ./c1-runtime.ps1; if ($env:POWERSHELL_BASE_IMAGE -cnotmatch "^mcr.microsoft.com/dotnet/sdk@sha256:[a-f0-9]{64}$") { exit 1 }; $p=Get-Content ./runtime-policy.json -Raw | ConvertFrom-Json; SG-C1Policy $p @(); if ($p.source_sha -cne $env:SOURCE_SHA) { exit 1 }; $null=[IO.Directory]::CreateDirectory("/work/review")'
LABEL org.opencontainers.image.revision=${SOURCE_SHA}
ENTRYPOINT ["pwsh", "-NoLogo", "-NoProfile", "-NonInteractive", "-File", "/app/c1-entrypoint.ps1"]
