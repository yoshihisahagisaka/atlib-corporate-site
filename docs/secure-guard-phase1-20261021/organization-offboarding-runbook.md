# Secure Guard｜Organization起点解約E2E・無人認証 Fit/Gapと最小変更計画
2026-10-22 JST / 基準PR #44 HEAD 8747379dc443576d1de35d0e4fa1d78943d2fabf

## 現在の結論
コード資産の再利用はFit。実GCPのSecret/専用ID/Job/IAM/永続状態は確認できておらず、実機Dry Run・変更試験は保留。
今回追加するのはローカル検証済みのGET-only prototype、テスト、読み取り専用GCP棚卸し、実装計画。GCPリソース作成・IAM変更・Secret登録/取得・deploy・DNSFilter要求は0件。
キーの毎回手入力を廃止。旧単一Agentスクリプトと旧棚卸しスクリプトは実行停止の案内へ置換し、過去の手順を現行手順として使わない。
以後の現行Runbookは本書。過去PASS/未検証の履歴はreport.mdに保持する。

## 1. Canonicalのfresh確認
|資産|確認した正本と再利用箇所|根拠の限界|
|---|---|---|
|Corporate|main 1caa2eb、src/lib/secrets.ts blob b61808547aae809875546e224ab5df51b601bcc7、src/config.ts|ADCのSecret Manager SDK、Cloud Run secret注入と未設定時停止。SMTP/Form秘密をGuardへ流用しない|
|Sales Tools|main d35581cec3dbc7d4ca2938f2a9c664906ccc5316、src/lib/secrets.ts、docs/sales-tools-production-canonical-policy-20261003.md|Secret連携方式とSHA/revision証跡運用を再利用。既存productionの現revision/IAMは未照会|
|Secure Send|main 9c1b00230f5efe6ddbae2b8c3ef5e7d0f87787b7、src/lib/secrets.ts blob aa5508120ee5782f1ca1edc1ecd27ae485248d6a、cloudbuild.upload.yaml、Dockerfile|msp-zabbix / asia-northeast1-docker.pkg.dev/msp-zabbix/cloud-run-source-deploy / Node20 build/runtimeをコードで確認。現デプロイ状態と同一とは未確認|
|Guard方針|Corporate Issue #15|認証/監査パターン再利用、サービスのDB/IAM/Secrets/障害影響を無条件共有しない。商用専用project第一候補の判断を維持|
|ローカル|gcloudインストールあり、既定project msp-zabbixを読取|既存worktreeはPermission denied。gcloudはlogs/credentials.dbへのアクセス拒否。GCP IAM不足やSecret不存在と断定しない|

Secure SendのNode HTTPサービスimageはPowerShell Jobをそのまま実行できない。既存Artifact Registry/Cloud Buildの配置方法は再利用するが、サービスimage/SDKを使えることとPowerShell runtimeの存在を混同しない。
既存SDKのlatest固定は汎用取得処理。今回の破壊操作では、承認時のSecret数値versionを固定する差分が必要。

## 2. 実GCPのFit/Gap（機密payloadを取得しない）
|対象|現在状態|次の読み取り|
|---|---|---|
|project/region/Registry|既存source上は上記。実在/利用権限未確認|project/Registry metadata|
|Cloud Run services/jobs|実一覧未取得|既存job名、専用SA、image digest、task数/retry、secret参照だけ|
|DNSFilter Secret|名前/存在/version/期限/owner未確認|Secret名、enabled数値version、IAM policy。payloadは棚卸しで取得禁止|
|専用実行ID|現存未確認|Guard専用SAの有無、対象SecretのAccessor、不要権限|
|Scheduler|現存未確認|job名/状態、呼出先/認証方式を必要範囲で確認|
|永続監査/二重実行防止|Guard用store未確認|既存bucket/DB/lease/CASの流用可否、専用prefix/権限境界|
|API仕様|最新OpenAPI取得不可|認証済みJobからGET、schema/paginationと実response shapeを照合|

gcp-auth-fitgap-readonly.ps1 は既知候補project2つのRun/Job名、Secret名、SA名、Scheduler名を投影取得する。Secret payload、全env、OAuth token、credential exportを出力しない。
この環境からgcloud auth listがcredentials.dbアクセス拒否のため、実GCP棚卸し成功とは報告しない。正規のアクセス可能なセッションで同スクリプトを実行する必要がある。認証ファイルのコピー/新credential作成で迂回しない。

## 3. 採用候補: Cloud Run Job + 専用実行ID + Secret Manager
- PoCも専用Cloud Run Jobを手動起動し、実行時のキー手入力は0。将来同じJobをSchedulerが起動する。
- 実行SAは既存のGuard専用IDがあれば再利用。なければ専用SA1つを最小追加。default/既存Sales Tools/Sendの広い実行SAを無条件に使わない。
- DNSFilter専用Secretがあればowner/用途/version/IAMを確認して再利用。なければ専用Secret1つと初回versionを追加。初回登録は安全な管理経路で行う別作業で、チャット/ソース/一般ログを経由しない。
- Cloud RunのSecret volume機構を利用し、実行SA権限でmount。PowerShellにはmount先pathと数値Secret version参照だけを渡す。キー本体をargs/envの平文設定へ書かない。
- Job設定のSecret参照と数値versionを検査・固定し、実行時にはmetadata serverの実SA emailと期待SAを照合。パラメータのSecretVersionResourceだけではmountの真正性は証明できず、Job specのレビューが必須。
- 実際のキーはメモリだけでAuthorization headerへ使う。raw API body/header、exception body、secret fileのcat、PowerShell transcript/HTTP debugは禁止。メモリnull化は完全消去の保証とは表現しない。
- 不在/disabled/権限拒否/空key/期限切れ/401/403は全体停止。手入力、別key、より強いID、認証エラー後の自動再送へfallbackしない。
- DNSFilter identityの権限とGCP SA権限は別。APIキーはDNSFilter利用者の権限を継承するため、MSP横断権限をOrg限定権限と称さない。アプリ側の対象台帳/承認照合が必要。最小DNSFilter roleは実APIで確認。
- Scheduler用IDは実行SAと分離。対象Jobにrun.invokerだけを候補としSecret Accessorを与えない。Google APIのjobs:runにはOAuthを使用し、HTTPサービス向けOIDCと混同しない。
- Projectは実棚卸し後に確定。PoCの最小候補は既存msp-zabbix内の独立Job/SA/Secret/監査領域。Issue #15の商用専用project方針との比較を残し、既存本番サービスには組み込まない。候補は作成済み資産ではない。

## 4. 最小権限とキー更新
|identity|必要な限定権限|付けない権限|
|---|---|---|
|Guard実行SA|特定DNSFilter SecretのsecretAccessor、専用監査/claim領域の必要read/create、ログ送信に必要な権限|Secret admin、IAM変更、他サービスSecret閲覧、既存DB全体の管理|
|手動起動者/Scheduler caller|対象Jobの実行権限。固定argsの実行が基本|Secret payload閲覧、実行SAのcredential JSON発行、任意jobへのinvoker|
|deploy担当|専用Job更新とそのSAを指定できる必要権限。既存の正規deploy運用を使う|実行SAへdeploy権限を持たせない|
|Secret更新担当|対象Secretへのversion追加/確認/切替を運用で限定|runtime側でversion追加/破棄しない|

更新手順: DNSFilter側で専用userの新keyを正規手段で発行→Secret新versionへ安全登録→専用DryRun Jobで401なし/正しい対象GETを確認→実行Jobを新versionへ切替→旧versionへの実行参照がないことを確認→DNSFilter旧keyを正規操作で失効、Secret旧versionも運用方針に従い無効化。
DNSFilterのkey自動発行/失効API・最小role・最大期限は未確定で、完全自動rotation済みとはしない。期限/owner/version/確認日を台帳へ置き、期限前の更新監視を設計する。今回通知automationは作成していない。
認証失敗時にはOrg操作を送らず、失敗コード/Secret version参照/操作IDだけを記録する。

## 5. 二重実行と監査の永続化
Cloud Runのlocal filesystemや「task=1、retry=0」だけでは、次回実行/Scheduler重複を防げない。
本番化前の最小追加は専用永続台帳。既存の安全なstoreがあれば再利用、なければ専用GCS領域を候補とする。GCSの場合はSDKのgeneration前提条件でcreate-if-absent/CASし、GCS FUSEのFileMode.CreateNewを分散排他保証にしない。
- job operation_idは契約解約イベント/版とOrganizationから安定的に解決。毎回ランダム生成して重複回避をリセットしない。
- Org単位claimで同時処理を拒否。Agentごとにも同じ解約operationのrequest claimを送信前に永続化する。
- 原子的claim→変更前snapshot/plan hash保存→送信開始保存→1要求→HTTP結果保存。どの監査保存にも失敗したら後続変更を止める。
- 送信直前後にworkerが止まったらUNKNOWN。TTL失効や別実行IDを理由に自動再送しない。GET照合と人の判断を必要とする。
- Secret/Key/raw bodyは台帳へ入れない。UUID/Org/Site/実Hostname/状態/時刻/plan hash/承認version/HTTP code/実行IDを保存。
- 将来はretry=0/task=1/parallelism=1を補助制御にし、Schedulerの再配信は台帳で吸収。専用bucketの候補custom roleはobject get/create等必要最小限、delete/admin権限は別担当にする。実ACLとCASを試験してから確定。

今回prototypeのローカルplan/event書込はGET DryRunのレビュー用一時結果だけ。永続台帳adapterは未接続のため、RequestUninstall modeを無条件STOPにしている。Cloud Runをまたぐ排他を未実装のまま変更系PoCへ進めない。

## 6. Organization起点の取得・固定・実行
organization-offboarding.ps1 の入力はOrganizationIdとMspParentId。Agent UUID/Site ID/Hostnameは固定しない。
1. 専用runtime identityとSecret mountを確認して無人認証。
2. 公式OpenAPIでGET/filters/queue_uninstall型と説明/UUID型を検証。未取得/非対応では停止。
3. Organizationの存在・managed_by_msp関係を照合。
4. Organization別Network全ページ→各Site所属照合→Site別Agent全ページを取得。
5. Organization全体Agent一覧も独立取得し、Site別集合とUUID・Org・Site・実Hostname・状態が完全一致するか照合。孤立Agent/所属矛盾/重複/HTTP失敗は停止。
6. このprototypeのページングadapterは「links.next明示null終端＋meta.total_count安定＋UUID一意＋総数一致」だけを受理。これは採用済みのDNSFilter実仕様という意味ではない。未知shapeでは停止し、実responseの許可属性/metadata構造を確認後、adapterを最小修正する。
7. 生レスポンスにKeyが含まれ得るため、計画にはallowlist属性だけ保存。操作ID、plan hash、ページング証跡と予定要求を表示。
8. 将来の変更adapterは承認plan hashと直前GET一致、対応Windows/x64/version、現承認の対象数上限を確認して順次queue_uninstall。受理→Pendingの実API/画面観測を別状態として記録。
9. PendingでのOrganization削除は今回固有の破壊試験。最新Pending snapshotと削除影響/課金/復旧計画を提示し、最終明示承認を得るまで送信しない。現prototypeにOrganization DELETEは実装していない。

APIのdefault collectionがRelay/削除/非表示Agentを含む範囲は別途確認する。ページング証跡を得てもAPIが隠す状態まで全件取得できたと一般化しない。今回期待値は自宅PC1台だが、取得UUIDを選別して期待値へ合わせない。

### GET-only Dry Runの起動形（Job完成後、まだ未実行）
~~~powershell
pwsh -NoProfile -File organization-offboarding.ps1 -Mode DryRun -OrganizationId 10220954 -MspParentId 10220948 -AuditDirectory /work/review -SecretFilePath /var/run/guard-secrets/dnsfilter-api-key -SecretVersionResource projects/VERIFIED_PROJECT/secrets/VERIFIED_SECRET/versions/VERIFIED_NUMBER -ExpectedRuntimeServiceAccount VERIFIED_RUNTIME_SA
~~~
VERIFY表記は未確定の構成値であり、そのまま実行しない。Job deploymentでmount/path/数値version/SAを実資産へ確定する。ローカル実行で手入力にfallbackしない。/work/reviewは一時レビュー出力であり永続監査/claimではない。
Dry Run成功時は実Site/Agent一覧、ページング証拠、操作ID、plan hash、queue_uninstall候補が得られる。認証失敗/未確認shapeの場合はSTOPコードを保存し成功としない。

## 7. 一括変更計画と段階別の実行境界
|段階|変更候補/範囲|現在の状態|
|---|---|---|
|C0 実GCP棚卸し|metadata/IAM/referenceの読み取りのみ。key payloadは読まない|実アクセス待ち。補助script作成済み|
|C1 最小GCP準備|確認済みproject内で不足する専用SA/Secret version/Job/監査領域/IAMだけ追加。image digest固定、DryRun既定、Schedulerはまだ作らない|実リソース名/既存との差分を取得後に具体化して承認依頼。今回は未作成|
|C2 認証・GET試験|手動起動、キー自動取得、主体一致、全Site/Agent取得、失敗時停止、秘密非出力|未実施。実測PASSのSHA/Secret version参照/Job execution IDをRunbookへ登録|
|C3 永続claim試験|専用領域で競合2実行/再起動/監査失敗/UNKNOWN停止を確認|実store未確定。未実装。変更系DNS要求は不可|
|C4 uninstall/Pending|固定planの承認範囲のみ順次要求。現在の自宅PC要求承認を継承し、一覧変更/追加対象は一括更新|最新schema/実GET/永続store PASS後。新たな認証承認を繰返し求めない|
|C5 Pending中Org削除試験|10220954のみ。正確なDELETE/依存Site/IP/データ消失/課金/復旧/最新Pendingを含む最終パッケージ|**未承認。DELETE禁止**|
|C6 Scheduler化|専用callerでJob起動、安定操作ID、再配信/重複防止、期限管理|将来候補。今回scheduleを設定しない|

C1に必要な正確なproject/SA/Secret/Job/bucket名・現IAMが未取得なので、未確認名を使ったgcloud作成コマンドを送らない。
既存リソース再利用ならその変更前spec/IAMを保存し、差分/復旧手順をレビュー。専用新規リソースなら停止/無効化で切戻し、他サービスのIAM/Secretを取り消す操作はしない。

## 8. Pending削除試験の観測・復旧
目的は「Org削除後に未処理uninstall要求が失われるか」の実証。失われる/継続するのいずれも事前に結論にしない。
会社PCはユーザー報告で手動uninstall済み。自宅PCは最新DryRunで発見したUUID/Org/Site/Hostnameの組を固定し、API上Pendingと端末上のservice存在を観測する。
最終承認取得後もDELETE直前にPendingをfresh GET/画面で再確認。既に完了していればPending削除試験の条件未成立として停止し、完了後削除の結果と混同しない。
承認パッケージに含めるもの:
- Organizationと親子関係、全依存Site/IP/Agent/ローカル設定、必要な別変更の正確な範囲。
- 削除による全データ消失・DNS応答即停止、API正式DELETE仕様、課金/creditの確認済みと未解決。
- 自宅PCのローカル管理権限、公式MSI/製品GUID、導入前のNIC/DNS設定、ネット不通でも操作できる担当/手段。
- service消失/残存、NIC DNS復元、通常名前解決/通信、再起動/再接続後の挙動、API/画面/請求表示を削除前・直後・1/5/15/30分・翌日で記録（計画値、SLAではない）。

Org削除でAPIのAgent状態を追えなくなるため、ローカルWindows観測を必須にする。Agent404やOrg404だけではuninstall完了PASSにしない。
Pending命令が失われサービス/loopback DNSが残った場合は仮説FAILを記録し、現地管理者が承認した手動uninstall/元のDNS設定復元で通信を回復する。公共DNSへ一律変更しない。自動復元FAILと手動復旧PASSを別記録。
保護の再導入が必要なら存続先/新規契約・Site・現Keyが必要で別承認。親10220948の設定を復旧手段として変更しない。
商用の通常解約ジョブへPending削除試験の順序を無条件採用しない。試験後、確認された命令の存続/端末復旧条件を根拠に通常解約の完了条件を決める。

## 9. 今回の検証証跡と実測基準
|検証|今回|
|---|---|
|既存GitHub Canonical/Secretコード/Cloud Build参照|読取成功|
|GCP credential/現資産/IAM取得|アクセス制限で未確認|
|GET Dry Runの実DNSFilter|未実施。無人認証/実job未準備|
|Organization起点取得・欠落/重複/所属・pagination停止|オフラインfixture PASS|
|無人認証のidentity不一致/latest拒否/mount不在/fixture読取|オフラインPASS。実GCP PASSではない|
|全20オフライン試験|20 PASS / 0 FAIL、live requests 0|
|PowerShell 3ファイル構文|PASS|
|Secret自動取得、rotation、401、durable claimの実GCP|未実施|
|uninstall/Pending/Org DELETE/Windows/DNS/請求E2E|未実施。変更HTTP0件|

実測PASSの基準は、正式schemaと実response、専用ID/Secret参照、Git SHA/image digest/Job execution ID、対象plan hash、前後時刻、Windows観測、請求確認を揃えた記録。モックPASSを解約Runbookの実機基準に昇格しない。
過去の確認済みAPI接続/自宅PCActive/Protectedはユーザー実機証跡として保持し、新しい無人認証のPASSとは区別する。

## 公式構成根拠
- https://docs.cloud.google.com/run/docs/configuring/jobs/secrets
- https://docs.cloud.google.com/run/docs/configuring/jobs/service-identity
- https://docs.cloud.google.com/run/docs/execute/jobs-on-schedule
- https://docs.cloud.google.com/run/docs/container-contract
- https://docs.cloud.google.com/secret-manager/docs/manage-access-to-secrets


## 2026-10-23 C0-3 / C1再開記録

詳細は [C0-3 Fit/Gap・C1計画](gcp-c03-fitgap-c1-plan-20261023.md) を参照。
既存一次棚卸しと20/20 PASSを継承。追加metadataは実行環境のgcloud認証DBアクセス制約で未取得。詳細collectorの新規オフライン8/8 PASSは実GCP認証・実API・永続排他のPASSではない。
GCP/DNSFilter変更0件。C1具体名/IAM/監査/費用/切戻し案は条件付き計画であり作成承認前。Organization DELETEは別途最終承認が必要。


## 2026-10-23 C1固定契約のコード実装（最新）

[C1実装結果](c1-implementation-report-20261023.md) / [build・構築準備手順](c1-build-runbook.md) を追加。
C0-3の実測はFit/Gap報告の第11章で補完済み。本Runbookの過去の「アクセス待ち」「未実装」記録は各時点の履歴であり、最新状態は本追記と固定契約を優先する。
C1はGET専用entrypoint、数値Secret mount/実SA確認、専用image/Jobテンプレート、分離したGCS claim/audit adapterを実装。新46＋関連回帰20=66 PASS/0 FAIL、過去metadata8 PASSは継承。実BuildはDocker Engineアクセス拒否により未実測。
GCS adapterのJob接続・実GCP認証GET・永続排他・uninstall/Pending/Org DELETEは未実施。新GET経路はDryRun以外STOP。prototypeのRequestUninstall STOPも維持。Organization DELETEは未実装・別途最終承認。
キー/Secret payload取得、GCP/IAM/deploy、DNSFilter実要求は0件。正式保持/手動解除、Registry IAM/実効権限、実version/image digestは保留ゲート。統括レビュー待ちで停止。


## 2026-10-23 C2永続DryRun計画（最新）

[C2固定契約](c2-dryrun-durable-plan-contract-20261023.md) / [実装結果](c2-implementation-report-20261023.md)。最新entrypointはGET結果をGCS dryruns/organizations/{org}/plans/{hash}.jsonへcreate-only保存し、作成metadataとgeneration固定read-back/hash/内容の一致後だけ成功receiptを返す。一時ファイルだけでの成功判定は廃止。
新34＋C1関連回帰46=80 PASS/0 FAIL（offline、実要求0）。以前のprototype20とmetadata8は履歴PASSを継承し再実行なし。C2実GCP PASSは未付与。実Build/Secret mount/DNSFilter GET/GCS保存と照合は別承認のゲート。
Org/Agent claim・変更APIのlive接続は無効。Uninstall/Organization DELETE/自動claim解除は実装・有効化しない。GCP/DNSFilter変更0件、main変更なし。統括レビュー待ちで停止。

## 2026-10-25 C2実環境E2E成功（最新追記）

`secure-guard-cancellation-zk95b` はexit 0で完了した。実行Imageは`sha256:bf7c4626bc426a7940d0703124b6290f3ed67f77b138280b91806db3bf47731c`、Source SHAは`230865cf4649228872ff81aad27cfd90c0884020`である。

Cloud LoggingでPOLICYからGCS_READBACKまでの全SG_PHASE COMPLETE、NETWORK_GET COMPLETE、Site 2、Agent 1、DryRun `mutations: 0`を確認した。plan hash `6eebef76bc63ae3a468854306b4f32dbe66e77ceee78f975038d6b5cbe307169`は、`dryruns/organizations/10220954/plans/`配下のgeneration `1792936630217425`のcreate-only objectと一致する。GCS_READBACK COMPLETEおよび`DRYRUN_DURABLE_VERIFIED` receiptを確認した。本文、hostname、Agent UUID、Secret、Token、DNSFilter生応答はRunbookへ記録しない。

この成功はC2に限定する。再実行、C3 claim/audit、C4 Agent uninstall、C5 Organization DELETE、Scheduler、商用開始は別承認であり、今回の成功を根拠に自動的に有効化しない。
