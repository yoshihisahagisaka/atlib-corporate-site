# Secure Guard｜C0-3詳細Fit/Gap・C1実装計画
作成: 2026-10-23 JST / 対象: msp-zabbix、asia-northeast1
作業開始PR #44 HEAD: c1d96033795addb2b0890ab2e85708e2d37b5672
前回実装基準: 3dbb9f8859b3b15f64ec1f72c6b12447cd4bce27
状態: **一次棚卸しを継承。C0-3追加実測はアクセス制約で未完。C1は具体名を持つ条件付き計画。作成承認依頼前。**

## 1. 引継ぎと承認境界
- GitHub mainはfresh GETで1caa2eb1fec2d887a41130b0aa0fdf102493562b。PR #44は基準SHAより進んでいるので巻き戻さず、現HEADへ追記。
- organization-offboarding-runbook.md、全20試験PASS、gcp-cancellation-resume-checkpoint-20261022.mdを読取。既存20試験は再実行しない。
- checkpointに記録されたユーザー実機一次棚卸し: Services7 / Jobs59 / Secrets33 / SA10 / Scheduler4（ENABLED2、PAUSED2）。一次名称一覧上でGuard専用Job/Secret/SAなし。これは「設定・IAM精査で不存在確認」ではない。
- customer/msp scope分離、standard-system-account-role-350pilot-decision-20261022.mdを引継ぐ。標準サービスの共通解約ジョブを作り、350台顧客専用の別システム・コードを作らない。
- PHP対応中STOPは今回の明示指示により**C0-3 read-onlyとC1計画作成だけ**再開。変更系・C2以降の実機は再開しない。
- MSP親10220948書込み禁止。PoC対象10220954のみ。Agent/Site/Hostnameをコードへ固定しない。Organization DELETEは独立最終承認を維持。

## 2. 今回の取得結果と証拠の限界
|対象|今回の確認|判定|
|---|---|---|
|PR/Runbook/最新Decision/main|GitHubからfresh読取、上記SHA/追加決定を確認|確認済み|
|gcloud CLI|インストールあり。auth listはlogs/credentials.dbへのPermission denied|実GCPの追加照会不可|
|既存ローカルrepo|C:\\atlib\\atlib-corporate-site のgit statusがPermission denied|ローカルHEAD/差分未確認。変更なし|
|一次棚卸し結果|ユーザー指示とGit checkpointの件数が一致|既存のユーザー実機証跡として継承|
|sg-gcp-fitgap-result.json|Library readはテキスト抽出不能。正規helperでのローカル取込もWindowsの拡張属性互換性で失敗|今回、ファイルの詳細本文は未読。個別名/IAMを読めたとはしない|
|C0-3実GCP metadata|認証DBアクセス制約により未取得。credentialコピー、権限迂回、API enableは未実施|未確認|
|新詳細collector|構文PASS、8 fixture試験PASS、実GCP要求0|コード検証。クラウドPASSではない|

ログインやAPIキーの再入力を依頼しない。正規にgcloudを利用できる既存セッションから、追加のmetadataだけを取得する。
一次棚卸し件数や既存PoCはやり直さない。追加collectorでのname listは各リソースの詳細照会対象を自動解決するためであり、既存PASSの再認定を目的としない。

## 3. C0-3詳細Fit/Gap
|領域|既存資産/再利用判断|今回残る実測|
|---|---|---|
|Artifact Registry|Send main9c1b002のcloudbuild.upload.yamlに msp-zabbix / asia-northeast1 / cloud-run-source-deploy を確認済み。既存repo再利用が第一候補|repo実在/format/location、writer/reader IAM、cleanup、容量/費用。既存imageを上書きしない|
|Cloud Build|既存docker build→Artifact Registryの方法、SHA/digest記録を再利用|global/東京の最近5buildずつのSA・machine・成果image/digest。secret env/steps/argsは取得しない|
|Cloud Run Jobs|59件の既存基盤を再利用。専用Job追加候補、既存Jobの変更なし|全JobのserviceAccount/task/retry/timeout/image/Secret参照を投影。既存Guard相当があれば先に用途を照合|
|Service Accounts|10件。既存のGuard専用IDがあれば用途と最小権限を確認して再利用|各SA metadata/SA IAM、project/Secret/bucket/job IAMの横断照合。SA IAMだけで実効権限を判断しない|
|Secret Manager|33件。ADC/Cloud Run Secret注入方式はCorporate/Sales Tools/Sendの既存src/lib/secrets.tsを再利用|全Secretのversion番号/stateとresource IAM。継承IAM/条件も照合。payload/キー/認証tokenは取得しない|
|永続GCS監査/排他|既存bucketのロケーション/IAM/retention/lifecycleが適合する専用領域があれば再利用|metadata/IAMだけ。object一覧・本文は取得しない。顧客ファイルと同じ寿命/権限なら非採用|
|DB|既存のlease/audit設計パターンは再利用可能|Cloud SQL instance metadataのみ。接続/credential/row/DDLは対象外。shared production DBへ新表を追加しない|
|Scheduler|4件を維持。今は作成も有効化もしない|既存caller SA、OAuth/OIDC設定種別、retry、timezone。HTTP body/header/認証tokenは取得しない|
|本番影響|別Job/別ID/別Secret/専用監査に限定する設計でサービス改修を回避|実IAMの継承・quota・VPC依存が未確認。影響0を実測PASSとはしない|

DBは「同じprojectにある」だけでは再利用可としない。C1の暫定第一候補は専用GCS audit/claimで、既存production DB/移行ledgerを変更しない。GCS側も実ACL適合を確認するまで確定しない。

## 4. 次に必要なRead-only操作
追加コード: gcp-c03-detail-readonly.ps1。固定scope msp-zabbix / asia-northeast1。
取得:
1. project番号/状態、project IAM・auditConfig、enabled APIs（有効化はしない）。
2. Registry list/IAM、最近のCloud Build metadata。
3. Job名→全Jobの投影describe/IAM、Service名→全Serviceの投影describe。
4. Secret名→versions list/name/state、Secret IAM。versions accessはコードで拒否。
5. SA list/IAM、bucket metadata/IAM、Cloud SQL instance metadata。
6. Scheduler名→認証SA/方式の投影describe。body/headers/URI queryは出力しない。

~~~powershell
# 正規のgcloud認証が使える既存PowerShellで、取得したscriptを実行する。
# outputは非秘密metadataだが、内部IAM情報を含むため公開しない。
& .\gcp-c03-detail-readonly.ps1 |
  Set-Content -LiteralPath .\sg-gcp-c03-detail-result.json -Encoding UTF8
~~~

collectorはstdoutへ1つのJSONを返し、IAM/resource作成を含まない。project probe失敗なら以後を止める。部分的な権限不足/API未有効/欠落projectionはUNAVAILABLE/未確認として残す。自動enable/追加login/credential複製/再試行しない。
全JobのCLI argsや平文env値を出さず、image/runtime SA/task/retry/volume Secret参照だけを取得する。Secret version数はSecret数33と同義ではない。
形式差による空欄を「設定なし」と断定しない。collectorはreview入力であり自動Go判定をしない。

## 5. C1具体的なリソース差分案（未作成・名前衝突未精査）
前checkpointの候補名を継承し、独自の別系統へ再設計しない。
|対象|具体的な候補|差分/採否条件|
|---|---|---|
|project/region|msp-zabbix / asia-northeast1|既存基盤。新project作成なし|
|Artifact Registry|asia-northeast1-docker.pkg.dev/msp-zabbix/cloud-run-source-deploy/secure-guard-cancellation|既存repo内に新image名。既存Send/Sales Tools image名は変更しない。repo実在/IAMを先に確認|
|runtime SA|secure-guard-job-sa@msp-zabbix.iam.gserviceaccount.com|専用IDが存在すれば用途確認、なければ1件追加候補|
|DNSFilter Secret|projects/msp-zabbix/secrets/secure-guard-dnsfilter-api-key|既存専用Secretが適合なら再利用、なければ1件追加候補。初回安全登録は別承認作業|
|Cloud Run Job|secure-guard-cancellation|1Job、DryRun既定、task1/parallelism1/retry0、1vCPU/1GiB、timeout900sを初期案。実観測後に調整|
|Secret mount|/var/run/guard-secrets/dnsfilter-api-key|Secretの数値version nをJob specで固定。nはまだ未取得なので番号を作らない|
|audit/claim|候補bucket msp-zabbix-secure-guard-offboarding-audit、asia-northeast1|適合する既存専用storeがあれば再利用優先。なければ1bucket追加。global名の利用可否は未確認|
|image runtime|PowerShell対応の専用Job image、digest固定|既存Node20 HTTP imageではps1を実行できない。既存Cloud Build/Registry運用だけ再利用し、runtimeを明示|
|Scheduler|将来候補 secure-guard-cancellation-schedule|C1では作成しない。以前の00:05 JST案は未確定、今回有効化しない|
|Scheduler caller SA|将来候補 secure-guard-scheduler-sa@msp-zabbix.iam.gserviceaccount.com|runtime SAと分離。C1には作成しない|

これらは名称案であり実在/不存在/権限を確認済みと表示しない。詳細metadata取得後に「再利用/新設/既存変更なし」を確定し、正確な差分を一括承認対象にする。
Shared systemの標準解約機能として実装し、350台案件だけのJob/認証/管理画面は追加しない。
image digest、Secret数値version、Job service identityと実行引数allowlistを承認versionへ固定する。Job実行時overrideで対象Org/Modeを自由に拡張する権限は与えない。

## 6. IAM案とSecret運用
|主体|対象/権限案|制限|
|---|---|---|
|Guard runtime SA|対象Secret1件の roles/secretmanager.secretAccessor|project全SecretへのAccessorは付けない。継承で広がらないかproject IAMも確認|
|Guard runtime SA|専用GCS領域にstorage.objects.get/createの限定custom roleを候補|他bucket、object delete/update、IAM、Secret登録権限なし。create-only claimの仕様に限定|
|Cloud Build実行ID|対象Registryのwriterとbuildに必要な既存権限を確認|ビルドへDNSFilter keyを渡さない。source/contextへSecretを含めない|
|Job deploy担当|対象Jobの設定更新/対象runtime SAのactAs等、既存正規deploy経路を利用|runtime SAへdeploy/IAM管理権限を付けない|
|手動実行者|対象Jobの実行のみを候補|runWithOverridesの必要性と悪用範囲を別評価。secret payload閲覧不要|
|将来Scheduler caller|対象Jobのrun.invoker、Google jobs:runへOAuth|Secret Accessorを持たせない。HTTPサービス向けOIDCと混同しない|

SA IAM policyは「誰がそのSAを操作できるか」であり、「そのSAが何を操作できるか」はresource/project IAMと組み合わせる。条件付きbinding、group/上位継承/denyの未照会がある場合は実効最小権限未確認とする。
DNSFilter APIキーはDNSFilterの専用利用者権限を継承。GCP SAを専用化してもDNSFilter側のMSP権限がOrg限定になるわけではない。10220954だけをアプリallowlistと固定planで強制する。
Secretは数値version固定。キー更新: 安全な正規経路で新key登録→新数値versionのGET-only認証→Job参照切替→旧実行が残っていないことを確認→旧key失効/旧version無効化を別承認範囲で実施。
今回キー発行/登録/更新/アクセスは0件。期限の自動検知・DNSFilter key発行API可否は未確認。401/403/Secret取得失敗は全体停止し、手入力や強いidentityへfallbackしない。
disabled versionも料金上はactive扱いになり得るため、旧version無効化だけで保管課金0としない。

## 7. 監査・排他案
既存prototypeのFileMode.CreateNewは同一filesystemの試験に限る。Cloud Runのtask/retry設定やlocal fileは別実行をfenceしない。
C1で準備する永続storeの実装案:
- Org単位claim: claims/organizations/{org-id}/current。GCS generationMatch=0のcreate-only。既存claimがあれば新しいoperation_idでも停止。
- Agent単位claim: claims/operations/{stable-cancellation-id}/agents/{uuid}/uninstall。対象UUIDはDryRun結果から取得し、送信前にcreate-only。
- audit: audit/{stable-cancellation-id}/{event-id}.json。各eventは新object。削除/上書き権限をruntimeに付けない。
- 解約イベント/契約版からstable cancellation IDを割当。毎回random operation IDにして再送防止をリセットしない。
- claim・対象snapshot・送信開始を永続化→要求1回→受付/UNKNOWN/event保存。永続保存できなければ変更APIへ進まない。
- claim取得後送信前のcrashもUNKNOWN/要照合。TTLやlease timeoutで自動再送しない。HTTP結果不明時はGET照合/人の解決へ送る。
- claim解除/次の契約版へ進む操作は限定管理手順。runtimeが自己判断でdeleteしない。初期PoCではclaimを自動回収しない。
- plan hash/承認version/runtime SA/Secret版参照/image digest/Job execution ID/対象組/HTTP code/時刻だけ保存。Key、token、raw responseは保存禁止。

GCSはSDKまたは正式RESTのpreconditionを利用し、FUSE上のローカルfile排他で代用しない。Secret ManagerとのGCP tokenはworkload identityで取得しメモリだけに保持する将来実装で、C0-3ではtoken取得自体をしない。
顧客Hostname/UUIDは内部運用情報として専用auditに限定。公開PRには必要な最小証跡とhash/件数を記録する。
既存bucketのTTLが数日でclaimを消す、他runtimeにdelete権限がある、retention/IAM境界が合わない場合は、そのbucketを変更せず専用bucket案を選ぶ。既存DBを使うなら専用表/role/migrationの影響承認が必要で、今回は採用しない。

## 8. 費用（推計であり実GCP請求ではない）
- 新SA/Job定義/IAM binding自体の数を増やすことと、CPU実行/Secret version/保存/操作課金を分離する。
- 最小モデル: 1vCPU+1GiBで300秒を20実行/月、Secret1version、build20分/回。これは今回の実測時間ではない。
- Cloud Run公式表示参考単価: CPU $0.000018/vCPU秒、RAM $0.000002/GiB秒を当てると20回で$0.12。表示選択/東京SKU/契約通貨の最終単価は未確認で、東京正式見積りとはしない。
- Secret Managerは参考$0.06/active version・location月、access $0.03/10,000回。既存33Secretと共有無料枠の残量は未確認。2version保有なら保管分は概ね倍、disabledもactiveの定義に含まれる。
- default pool e2-standard-2参考$0.006/分なら20分buildは$0.12。実machine/pool/region/free quotaは詳細取得後に確定。
- 上記3項目の参考小計は$0.30。Registry image保存、GCS容量/作成/読取、Logging、転送、DNSFilter仕入、税/為替を含まない。全体月額/上限として提示しない。
- GCSは容量G GiB・write W・read Rとして G×地域保存単価 + W×classA単価 + R×classB単価 + soft-delete/version保持分。Tokyo SKU・保持量・既存store適否未確認のため金額確定しない。
- このためC1承認版には実Registry/bucket/location/SKUと実行上限/タイムアウト/監査保持を追記。新Cloud SQLや常時VM/VPC connectorを必要なく追加しない。
料金根拠（2026-10-23取得）: https://cloud.google.com/run/pricing 、https://cloud.google.com/secret-manager/pricing 、https://cloud.google.com/build/pricing 、https://cloud.google.com/storage/pricing

## 9. C1実装・テスト・切戻しの具体的順序
1. 今回collectorの結果を既存一次証跡と照合し、Guard候補名の衝突/既存用途、Registry、build/runtime ID、Secret IAM/version、監査storeを確定。
2. C1承認パッケージに全対象名/現IAM→差分/費用/復旧/image digest/Secret版確定手順を記載。現在は追加実測不足なのでGCP作成承認を求めない。
3. 承認後のみ専用ID/不足Secret/専用audit領域/IAMを準備。初回Secret登録は安全経路で一度だけ。キーをソース・console outputへ出さない。
4. sourceSHA固定で専用Job imageをbuild、対象image digestを記録。既存サービスimage/trafficに触れない。
5. JobはDryRun既定、Org allowlist10220954、親10220948書込み不可、task1/retry0、数値Secret mount。作成後にspec投影/実行IDを照合。
6. C2手動起動で、実SA一致/Secret無人取得/正式OpenAPI/Org親子関係/全Site/全Agent/ページングを確認。成功planとhash、期待件数1/実UUID/実Hostnameを保存。期待に合わせてフィルターを追加しない。
7. C3: 2実行のclaim競合、worker再起動、監査保存失敗、401/403、Secret版無効/欠落、曖昧結果の再送停止を専用fixtureで検証。実APIへ重複変更要求を発生させない。
8. C4: 承認plan一致と最新対象/サポートversion確認後、許可範囲のAgentへ順次queue_uninstall。HTTP受付とPendingを別記録。
9. C5: Pending中Org削除の正確な仕様/依存/データ消失/課金/復旧/最新Pendingを最終パッケージにし、別途最終承認を取得。承認待ちにuninstall完了したらPending削除試験は条件未成立として停止。
10. 削除後はAPI/管理画面に加え端末service/DNS/通信と後日請求/creditを照合。親維持のGETだけ許可。

切戻し:
- C1/C2認証/Job不具合: 新Jobを停止・以後の起動を止める。Schedulerは未作成なので旧4件に触れない。必要なら承認済みの旧image digest/Secret数値versionへJobだけ戻す。古いkeyが失効済みなら単純rollback不可。
- IAM誤り: 今回追加した専用bindingだけをレビュー後取り消す。既存本番identityのbindingを一括置換しない。audit/claimを消して再送可能にしない。
- GCS/監査不具合: storeを残して全変更停止。claim/監査をTTLで消さない。原本から照合して手動解決。
- Pending/削除後障害: ローカル管理者・MSI/GUID・導入前NIC/DNS情報を用いる復旧を事前準備。公共DNSへの一律変更、親OrgやGlobal Policyの変更を復旧手段にしない。自動完了FAILと手動復旧PASSを分離。

## 10. 今回の変更・検証・未完了
- Git変更: 詳細collector、8 fixture試験と結果、本報告、Runbookへの索引追記だけ。
- 既存20/20は引継ぎ。変更していないため再実行なし。新8試験はread-only gate、平文config投影拒否、scope、version metadata、API失敗、詳細照会flowを確認。
- gcloud auth listの読取試行以外の実GCP追加要求は未実施。Secret payload/token取得、resource/IAM/Secret登録/deploy、DNSFilter変更APIは0。
- C0-3の実測は未完。実metadataが到着するまで、再利用可否/IAM最小性/最終費用/名前衝突をPASSにしない。
- 一次棚卸しの成功・既存承認履歴は維持。C1具体案は準備したが、未知設定を埋めた最終承認パッケージとはしない。


## 11. 2026-10-23 実GCP C0-3補完結果（ユーザー正規セッション）

証跡: ユーザー取得の `sg-gcp-c03-detail-result.json`（2026-10-23T02:14:45Z、内部資料。Gitには格納しない）および東京Artifact Registryの個別CLI照会。既存一次棚卸しを再実施したものではない。

- 詳細collector: 225セクション中READ 224、UNAVAILABLE 1（artifact_repositories）。READは照会成功でありIAM実効性のPASSではない。
- 不足分の独立GET: `gcloud artifacts repositories list --project=msp-zabbix --location=asia-northeast1` で `cloud-run-source-deploy` / DOCKERを確認。Repository個別IAM・cleanup policyは未取得なので権限評価は未完。
- Project `msp-zabbix` はACTIVE。Cloud Buildで東京Registryへのimage push SUCCESSの実績あり。ただし既存build SAの権限をGuard runtimeへ転用しない。
- Cloud Run Jobs 59、Services 7、Secret 33、Service Accounts 10、Scheduler 4。名称一覧上Guard専用Job/Secret/SAなし。新設候補の名前衝突は構築直前に再確認。
- GCS bucket 7。既存bucketはCashflow/PPAP/Portal/Sales Tools/Build用。特にPPAPは21日削除ルールを持ち、Guardの永続claim/audit用途に不適。既存bucketのIAM・retentionを変更せず、専用bucket新設を推奨。
- Cloud SQLは既存2インスタンス。共有DBへGuard用schemaを追加しない。Scheduler既存4件は変更せず、新規SchedulerもC1では作らない。
- Secret Managerの33 Secretでversion stateと個別IAM metadataを取得。Guard専用Secretは一覧上なし。新規SecretはGuard runtime SAだけへ個別Accessorを付与し、数値version固定。project IAMの既存editor/owner等による広い権限・上位継承・denyを含む実効権限は別途評価する。
- 既存Project IAMにはdefault Compute SAのEditor bindingがある。Guard Jobには流用しない。既存本番サービス・SA・SecretのIAMを今回変更しない。

### C1最小差分・承認前ゲート

1. 既存Registry `asia-northeast1-docker.pkg.dev/msp-zabbix/cloud-run-source-deploy` 内へ専用image `secure-guard-cancellation` を新規配置する候補。個別IAM/write経路・cleanup・digest固定を確認してから構築。
2. 新規候補: runtime SA `secure-guard-job-sa@msp-zabbix.iam.gserviceaccount.com`、Secret `secure-guard-dnsfilter-api-key`、Cloud Run Job `secure-guard-cancellation`、専用GCS bucket `msp-zabbix-secure-guard-offboarding-audit`。いずれも未作成。GCS bucketのglobal name availability/retention・UBLA・public access preventionを事前検証。
3. IAMはSecret単位Accessor、監査bucketへの限定get/createと原子的generation precondition、対象Jobの限定起動権限。実行SAにEditor、Secret Admin、既存本番DB権限、広域Storage Adminを付与しない。
4. JobはDryRun既定、task=1/retry=0、数値Secret version mount、実行SA照合、Org allowlistと承認plan hashを強制。Cloud Run local fileだけでは排他不可。永続claim/audit adapterがPASSするまで変更APIをSTOP。
5. C1構築・IAM変更・Secret登録・deployは未承認。C2 live GET、C4 uninstall、C5 Organization DELETEも未実施。親Organization 10220948変更禁止、テストOrganization 10220954のみ対象。Organization DELETEは別途最終明示承認。
6. 構築前にRegistry個別IAMと専用新規資産の名称衝突・GCS設計・project/上位IAM影響を最小限確認し、正確な変更前後差分と復旧手順を提示する。C0-3のmetadata収集は実施済みとし、全件再調査はしない。

判定: **C0-3 metadata収集は補完完了。C1構成案は実測に基づき具体化済み。ただしRegistry IAM・実効権限・bucket設定等の最終ゲートが残るため、C1変更実行はHOLD。**
