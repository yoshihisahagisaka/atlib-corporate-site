# SG-1｜GCP構築前ゲート Read-only Fit/Gap
作成: 2026-10-23 JST / 対象: msp-zabbix、asia-northeast1
開始PR #44 HEAD: e9b46e8f96a5fc199779ab031da0ef8d2a273753
main fresh read: 1caa2eb1fec2d887a41130b0aa0fdf102493562b
範囲: 既存Canonical・実装・公式仕様の読取と、不足metadataの調査のみ。設計変更・実装・構築・承認判断は行わない。

## 1. 今回の結論と証拠の区別
- PR HEADは指定SHAと一致。C1/C2契約、C1 build Runbook、C2実装報告、C0-3 Fit/Gap、IAM案、Job templateをfresh読取。関連Dockerfile/Cloud Build/entrypoint/runtime/GCS/C2 module/既存collectorも照合。
- C0-3の225中224 READ、Registry個別GETによる補完、Services7/Jobs59/Secrets33/SA10/GCS7/SQL2/Scheduler4を**既存ユーザー実測として継承**。C0-3は再実行しない。C2の80 PASS/0 FAILも既存試験結果で、今回の再試験ではない。
- 追加の正規GCP照会は、未確認のRegistry個別IAM 1件だけ試行。ローカルgcloudのlogs/credentials.dbがPermission deniedで終了（exit1）。**GCP側の403/404を取得できておらず、クラウドIAM不足・不存在とは判定できない。** 以後のGCP照会を停止。
- 認証DBコピー、鍵持出し、別configuration/別identityへの回避、token表示、Secret payload取得は行わない。
- 既存 `sg-gcp-c03-detail-result.json` の詳細参照も試みたが本文を読み出せなかった。件数・既存結論はGit第11章とユーザー記録を継承し、個々のproject binding/build SAを読めたとはしない。過去のWindows取込問題を回避する独自ダウンロードは行わない。
- 今回新しい実GCP PASSはない。以下のPASSは、明記した静的コード/公式仕様の範囲だけ。GCP構築・C2実証への承認判断は行わない。

### 判定の定義
|記号|意味|
|---|---|
|PASS（静的/継承）|ソース・仕様が一致、または既存実測を継承。実IAM/実JobのPASSとは別|
|UNVERIFIED|今回実測なし、本文未読、実値未確定。不存在・機能不可を意味しない|
|BLOCKED|本Work環境のアクセス制約で照会が止まった事実。クラウド上の拒否判定ではない|

## 2. 項目別Fit/Gap
|領域|確認結果・根拠|判定/残ゲート|
|---|---|---|
|Canonical/branch|指定HEADとmainをGitHub fresh read。現在の契約・実装を維持|PASS（Git読取）|
|既存Registry|cloud-run-source-deploy / DOCKER / 東京はC0-3第11章の個別GETで確認済み|PASS（継承）。一覧再取得不要|
|Registry個別IAM|不足分1件を試行したがローカル認証DBに到達不可|BLOCKED（アクセス）、IAMはUNVERIFIED|
|Project IAM/継承|既存C0-3で取得済み、default Compute SA Editorの記録あり。今回はbinding詳細未読|UNVERIFIED。元JSONを再利用し、上位allow/deny・条件・groupを補完|
|Cloud Build実SA|既存C0-3にglobal/東京各最大5buildのserviceAccount/image結果あり。ただし本文未読|UNVERIFIED。既存証跡から抽出。既定SAと実BuildのSAを同一視しない|
|Build/Push方式|C0-3に東京Registryへのpush SUCCESS実績。今回cloudbuild.yamlはdocker build→専用imageをimagesでpush、deployなし|PASS（継承/静的）。実Build主体・writer・logWriter・pool/networkは未確認|
|専用image配置|既存repo内の新image名secure-guard-cancellationを使う契約。既存image名を変更しない|PASS（構成一致）。writer/cleanup/タグ制約・名前衝突はUNVERIFIED|
|Docker前提|専用Microsoft SDK base、pwsh、非秘密runtime-policy.json、40桁source SHA、COPY対象が必要。C2 moduleも同梱|PASS（静的）。実build/ベース内pwsh/Linux amd64はUNVERIFIED。前回Docker Engine接続拒否を継承、再試行なし|
|base digest|Dockerfileはmcr.microsoft.com/dotnet/sdk@sha256:<64桁>を要求。MicrosoftはSDK imageにPowerShell同梱と説明|取得方法確認。採用tag/OS/SDK版・実digestはUNVERIFIED。Workで選定/捏造しない|
|専用SA|secure-guard-job-sa@msp-zabbix.iam.gserviceaccount.com。C0-3名称上は未確認|現在の存在・不存在/disabled/IAMはUNVERIFIED|
|専用Secret|secure-guard-dnsfilter-api-key。既存33件の名称上はなしという記録|現在の存在・不存在/数値版state/IAMはUNVERIFIED。本文は取得しない|
|専用Job|secure-guard-cancellation。既存59件の名称上はなしという記録|現在の存在・不存在/spec/IAMはUNVERIFIED|
|専用bucket|msp-zabbix-secure-guard-offboarding-audit。既存7bucketと用途を分離する契約|現在の存在・global名利用可否/UBLA/PAP/retention/versioning/IAMはUNVERIFIED|
|既存監査bucket|C0-3ではCashflow/PPAP/Portal/Sales/Build用。PPAPは21日削除があり永続claim不適合|既存結果を継承。既存bucketの保持/IAM改変は対象外|
|GCS最小権限|IAM案は専用bucketのobjects.get/createだけ。公式でもread/createを別権限とし、上書きにはdeleteも必要|PASS（仕様一致）。継承でdelete/list/adminが付かない実効性はUNVERIFIED|
|Job YAML|公式v1 Job階層、namespace/project番号、task1/parallel1/retry0、timeout900、image digest、専用SA/Secret itemsの形が一致|PASS（静的）。placeholder未render、API受理・実specはUNVERIFIED|
|SA/Secret版/mount|entrypoint→実SA照合→数値version/resource/path整合→mount読取。latest/手入力fallbackなし|PASS（コード/過去fixture）。実SA/Secret mount/版同一性はUNVERIFIED|
|Job起動/override|IAM案roles/run.invokerは公式上run.jobs.runを含みrunWithOverridesを含まない。entrypointは全引数拒否・DryRun以外停止|PASS（静的/仕様）。他role/上位継承でoverrideを持たないかはUNVERIFIED|
|既存本番Secret|新専用Secretだけを参照し既存Sales/Portal/Send/PPAPのSecret/IAM/DBを変更するコードなし|PASS（差分/参照確認）。広域既存roleまで安全を実測したものではない|
|Logging/保存データ閲覧|receiptはsource SHA/hash/object/generation/件数/status/変更0。本文・hostname・例外/headers/token非出力|PASS（コード/過去fixture）。実Logging routing/閲覧者/view IAM・保持はUNVERIFIED|

## 3. C2コードと実証前提の照合
- DNSFilterはGET専用。POST/PATCH/DELETEはtransportで拒否、Org10220954/親10220948関係と全Site/Agent・独立集合を照合。未知schema/pagingは停止。**実responseは未取得のまま**。
- GCSの書込はDryRun scopeの `dryruns/organizations/{org}/plans/{hash}.json` だけ。Org/Agent claimとauditの実行経路には接続しない。
- 作成時ifGenerationMatch=0。412は上書き/既存成功扱いせず停止。作成後bucket/name/正数generationを検査し、同一generationを指定してread-backする。
- 許可済みprojection、payload hashと計画内容を照合。HTTP200/Job exit0だけでは受入成功としない。不明応答・metadata不一致・read失敗/改ざんはSTOP/exit1、自動再送なし。
- データはUUID/hostname等を含む内部計画。一般ログへ本文を出さないコードであっても、object閲覧/保持/個人情報分類の承認ゲートは消えない。正式保持年数や削除運用をWorkで決定しない。
- Job内の引数拒否と、IAMにrunWithOverridesを付けないことは別の制御。アプリのprefix制限もIAMによるprefix限定保証ではない。
- これらはソース確認と既存80試験の引継ぎ。今回はコード修正・再試験・実Build・実Job起動・DNSFilter GET・GCS保存を実施しない。

## 4. 既存資産の再利用評価
|資産|今回の評価|
|---|---|
|msp-zabbix / 東京Registry|固定契約の再利用先。実在を継承。新imageのpush権限はまだ実証していない|
|既存Build/Pushパターン|方式は再利用。実SAを元metadataで確定し、そのままGuard runtimeへ転用しない|
|C1/C2 code・IAM案・Job template|契約どおりの構築準備物として存在。実値と適用承認は別|
|C0-3 collector/JSON|全件再実行せず、元JSONのproject_iam/builds/選択リソースsectionを再利用。collector自体も改修しない|
|既存本番SA/Secret/DB/bucket|Guard向けに権限や寿命を変えて流用する操作はなし。専用候補の実在・適合確認待ち|
|過去試験/Runbook|C2 80 PASSと未実測ゲートを継承。新規試験結果は追加しない|

## 5. ユーザー既存セッションで必要な最小Read-only操作
以下は**未実行のコマンド一覧**。既存の正規gcloudセッションで、不足する項目だけを実行する。auth login/print-access-token/credential export/新identityへの切替は含めない。結果は内部metadataとして保持し、個人principalや全IAMを公開PRへ貼らない。
API未有効/権限不足なら停止し、enable/IAM変更を行わない。CLIのexit1だけで不存在と判定せず、stderrのHTTP/エラー種別を残す。自動再送しない。

### 5.1 先に既存JSONから抽出（GCP要求0）
`sg-gcp-c03-detail-result.json` の保存ディレクトリで実行する。これが今回不足のbuild SA/Project IAMを補う第一手であり、builds listやproject IAMの全再取得を代わりに行わない。

~~~powershell
$sgPrevious = Get-Content -LiteralPath .\sg-gcp-c03-detail-result.json -Raw | ConvertFrom-Json
$sgPrevious | Select-Object project_id,region,observed_at_utc
$sgPrevious.results |
  Where-Object { $_.section -in @('project_probe','project_iam','builds/global','builds/asia-northeast1','job_names','secret_names','service_accounts','bucket_metadata') } |
  ConvertTo-Json -Depth 40
~~~

- READでもdataのserviceAccount等が欠けていれば未確認。最新SUCCESSのBuild ID/region/source SHA/image digest/実SAをこの既存結果から選ぶ。
- SA自身のget-iam-policyは「誰がそのSAを利用できるか」。そのSAのRegistry/Secret/GCS/Logging権限はproject/resource IAMと別途照合する。
- 上位group/deny/条件を含まないproject policyだけでは実効最小権限PASSにならない。

### 5.2 未取得Registry個別IAM・設定（対象1件だけ）
~~~powershell
gcloud.cmd artifacts repositories get-iam-policy cloud-run-source-deploy --project=msp-zabbix --location=asia-northeast1 --format='json(version,bindings,etag)' --quiet
gcloud.cmd artifacts repositories describe cloud-run-source-deploy --project=msp-zabbix --location=asia-northeast1 --format='json(name,format,mode,cleanupPolicies,dockerConfig)' --quiet
~~~
既存のrepo存在/format確認を再認定するためでなく、未取得cleanup/docker tag制約を補う。元JSONに当該設定が揃っていれば2つ目は省略。
project_iamは5.1を再利用。個別policyにwriterがなくてもproject/上位のgrantがある可能性があるため、利用不可と即断しない。

### 5.3 既定Build SA・上位IAM（不足時だけ）
~~~powershell
gcloud.cmd builds get-default-service-account --project=msp-zabbix --region=asia-northeast1 --quiet
gcloud.cmd projects get-ancestors msp-zabbix --format='json(type,id)' --quiet
~~~
get-defaultは現在の既定値で、5.1の過去の実Build SAや今後の明示指定主体と同義ではない。今後のBuild主体をWorkで選ばない。
5.1で実SA欄が欠落した特定Buildだけ、既知ID/既知regionを指定して補う（Build再実行は禁止）:

~~~powershell
# 下記2変数は5.1の実値で置換する。未確定のまま実行しない。
gcloud.cmd builds describe $sgKnownBuildId --project=msp-zabbix --region=$sgKnownBuildRegion --format='json(id,status,serviceAccount,images,results.images,options.machineType,options.pool.name)' --quiet
~~~

上位folder/organizationが返り、既存証跡にpolicyがない場合だけ、その実IDに対して以下を実施する。数値を推測しない。

~~~powershell
gcloud.cmd resource-manager folders get-iam-policy $sgKnownFolderId --format='json(version,bindings)' --quiet
gcloud.cmd organizations get-iam-policy $sgKnownOrganizationId --format='json(version,bindings)' --quiet
# attachment pointは得られたproject number / folder / organizationに限る。
gcloud.cmd iam policies list --attachment-point=$sgKnownAttachmentPoint --kind=denypolicies --format='json(name,uid,displayName)' --quiet
~~~

attachment point例の形は `cloudresourcemanager.googleapis.com/projects/{実project番号}`（folder/organizationもその実ID）。listでdenyがあってもrules未読なら未確認、必要なpolicyのread-only get/Console閲覧だけを追加する。group構成/上位deny/実行制約を読めなければ実効権限はUNVERIFIEDのまま。全組織の権限棚卸しへ拡大しない。

### 5.4 専用候補4件の正確な単体GET
C0-3全件一覧ではなく、候補名の現在状態だけを確認する。

~~~powershell
gcloud.cmd iam service-accounts describe secure-guard-job-sa@msp-zabbix.iam.gserviceaccount.com --project=msp-zabbix --format='json(email,uniqueId,disabled)' --quiet
gcloud.cmd secrets describe secure-guard-dnsfilter-api-key --project=msp-zabbix --format='json(name,replication)' --quiet
gcloud.cmd run jobs describe secure-guard-cancellation --project=msp-zabbix --region=asia-northeast1 --format='json(metadata.name,spec.template.spec.taskCount,spec.template.spec.parallelism,spec.template.spec.template.spec.serviceAccountName,spec.template.spec.template.spec.maxRetries,spec.template.spec.template.spec.timeoutSeconds,spec.template.spec.template.spec.volumes.secret,spec.template.spec.template.spec.containers.image,spec.template.spec.template.spec.containers.resources,spec.template.spec.template.spec.containers.volumeMounts)' --quiet
gcloud.cmd storage buckets describe gs://msp-zabbix-secure-guard-offboarding-audit --format='json(name,project_number,location,uniform_bucket_level_access,public_access_prevention,retention_policy,versioning_enabled,soft_delete_policy,lifecycle_config)' --quiet
~~~

|結果|記録方法|
|---|---|
|成功metadata|存在を確認し、ID/project/用途の一致を検査。用途不一致なら別物として停止|
|明示NOT_FOUND/404|その時刻・scopeのnot-foundを記録。閲覧権限や親scope確認がなければ確定的不存在に一般化しない|
|403/PERMISSION_DENIED|不存在としない。権限不足/状態UNVERIFIED|
|ローカル認証DB/ネットワーク/API未有効/その他失敗|取得失敗として区別。不存在としない|

GCS名はglobal namespace。404でも将来の作成権/組織制約/他者の先行取得は保証できず、**GETだけでは利用予約・構築成功PASSにできない**。403は権限不足等を示し、名前利用可能とは判定しない。bucketが読めたらproject番号も既存project_probeと照合し、他projectのbucketを操作しない。

### 5.5 5.4で存在を確認できた対象だけ追加GET
存在しないリソースにIAM/versions照会を連打しない。既存JSONに同一対象の詳細があれば再取得せず再利用する。

~~~powershell
gcloud.cmd secrets versions list secure-guard-dnsfilter-api-key --project=msp-zabbix --format='json(name,state,createTime)' --quiet
gcloud.cmd secrets get-iam-policy secure-guard-dnsfilter-api-key --project=msp-zabbix --format='json(version,bindings)' --quiet
gcloud.cmd iam service-accounts get-iam-policy secure-guard-job-sa@msp-zabbix.iam.gserviceaccount.com --project=msp-zabbix --format='json(version,bindings)' --quiet
gcloud.cmd run jobs get-iam-policy secure-guard-cancellation --project=msp-zabbix --region=asia-northeast1 --format='json(version,bindings)' --quiet
gcloud.cmd storage buckets get-iam-policy gs://msp-zabbix-secure-guard-offboarding-audit --format='json(version,bindings)' --quiet
~~~
Secret versions listはstate/番号だけ。versions access、キー、token、平文env/args、GCS object本文は取得しない。実argsの確認が必要な場合は、一般ログへ値を表示しないmetadata presenceの確認手順が必要であり、今回のコマンドでは生argsを取得しない。

### 5.6 Cloud Loggingの未取得metadataだけ
projectの閲覧roleは5.1を再利用。sinkのdestinationから実際のlog bucket/locationを解決し、該当する保存先とviewだけを読む。ログentry本文は今回取得しない。

~~~powershell
gcloud.cmd logging sinks list --project=msp-zabbix --format='json(name,destination,disabled,includeChildren)' --quiet
# 返されたdestinationの実bucket/locationだけを指定する。推測値で実行しない。
gcloud.cmd logging buckets describe $sgKnownLogBucket --project=msp-zabbix --location=$sgKnownLogLocation --format='json(name,retentionDays,locked,lifecycleState)' --quiet
gcloud.cmd logging views list --bucket=$sgKnownLogBucket --project=msp-zabbix --location=$sgKnownLogLocation --format='json(name)' --quiet
gcloud.cmd logging views get-iam-policy $sgKnownLogView --bucket=$sgKnownLogBucket --project=msp-zabbix --location=$sgKnownLogLocation --format='json(version,bindings)' --quiet
~~~

外部project/GCS/BigQuery等のdestinationがある場合、勝手に全サービスを調べずアクセス境界をUNVERIFIEDとして報告する。閲覧者、保持、転送先とBuild主体のlogWriterを照合する。Secret非出力のコード確認だけでLogging閲覧制御をPASSにしない。

### 5.7 Microsoft digestの正式取得方法（registry metadataのみ）
Microsoft公式はPowerShell同梱の.NET SDK imageを案内。Workで採用SDK版/tagを決めない。統括が選定した実tagに対して、Docker公式のregistry inspectionを使用する。

~~~powershell
# sgApprovedBaseTagは統括が確定した実tag。空欄/仮値のまま実行しない。
docker buildx imagetools inspect "mcr.microsoft.com/dotnet/sdk:$sgApprovedBaseTag"
~~~

これはregistry manifestの照会で、build/pull/runではない。返されたtop-level digestとlinux/amd64のmanifest digestを区別して記録し、採用するdigestを同じregistryで再照会して対応を確認する。tag、platform、取得時刻、実digestを残す。Dockerfileへは `mcr.microsoft.com/dotnet/sdk@sha256:{確認した64桁}` の形で渡す。tag/index digestを根拠なくamd64実体digestと同一視しない。SDK内のpwshと実build成功は後日の承認済み工程で確認する。

## 6. 実GCP受入・異常停止・切戻しの確認条件（承認ではない）
既存C2契約/Runbookをそのまま照合する:
1. 承認source SHA→Build ID→成果digest、base digest、実Build/deploy identityを対応付ける。
2. Jobの実SA/数値Secret版/name/path/固定DryRun/PoC allowlist/image digest、起動者の限定権限とoverride非付与を実spec/IAMで確認する。
3. Org親子と全ページ・独立集合の証拠を得る。期待端末数へ合わせてUUID等を除外しない。
4. GCS create-only→作成metadata→同generation read-back→hash/内容一致→安全なreceiptを揃え、変更API要求0を照合する。Job exit0やGET200だけでPASSとしない。
5. 401/403/Secret欠落/SA不一致/未知schema・paging/保存不明/412/read-back不一致は停止。再送・claim解除・object削除・hash捏造を行わない。
6. 切戻しは承認済み専用Jobの旧image/Secret版の組と専用差分に限定するという既存手順を維持。失効済み旧キーへの復帰は保証しない。監査/plan/claimは自動削除しない。C3/C4/C5とOrganization DELETEの独立承認はそのまま。

本工程では上記試験を実行しない。既存本番への変更を伴う判断や正式保持期間/解除運用は統括へ残す。

## 7. 不足情報・作業終了時の状態
**Workで取得できなかったもの**: Registry個別IAM/cleanup/tag制約、既存JSONの実Build SA/project bindings詳細、現専用4資産のGET、bucket設定/IAM/継承deny、現Job/Secret metadata、Logging routing/view IAM、Microsoft実digest。
**不足の閉じ方**: まず5.1のローカル抽出（再調査ではない）、次に不足した個別GETのみ。失敗項目はUNVERIFIEDで返す。C0-3の全件再取得は不要。

構築前に未解決なのは、Registry/Build実主体・実効権限、専用資産の現状態、base/成果digest・実build、Secret数値版/Job spec/起動権限、bucket名/UBLA/PAP/retention/versioning/IAM、ログアクセス/計画データ分類、既存の正式保持・手動解除運用ゲート。ここで承認/Go判定は行っていない。

今回Gitへの変更は**本調査Markdown 1件追加だけ**。コード/設定/Runbook修正0、再試験0、C0-3再実行0、GCPリソース/IAM/Secret/Cloud Build/deploy/Job起動0、DNSFilter実API/Agent/Organization DELETE0、Production/main変更0。調査報告提出後に停止する。

## 8. 公式照合先（2026-10-23参照）
- Artifact Registry IAM: https://docs.cloud.google.com/artifact-registry/docs/access-control
- Build既定SAと変更: https://docs.cloud.google.com/build/docs/cloud-build-service-account-updates
- Build既定SA GET: https://docs.cloud.google.com/sdk/gcloud/reference/builds/get-default-service-account
- Cloud Run Job YAML: https://docs.cloud.google.com/run/docs/reference/yaml/v1
- Cloud Run Secret mount: https://docs.cloud.google.com/run/docs/configuring/jobs/secrets
- Cloud Run IAM roles: https://docs.cloud.google.com/run/docs/reference/iam/roles
- GCS namespace/設定: https://docs.cloud.google.com/storage/docs/buckets
- GCS permissions: https://docs.cloud.google.com/storage/docs/access-control/iam-permissions
- Logging access: https://docs.cloud.google.com/logging/docs/access-control
- IAM deny list: https://docs.cloud.google.com/sdk/gcloud/reference/iam/policies/list
- Microsoft SDK/PowerShell: https://learn.microsoft.com/en-us/powershell/scripting/install/powershell-in-docker
- Registry manifest/digest inspection: https://docs.docker.com/reference/cli/docker/buildx/imagetools/inspect/
