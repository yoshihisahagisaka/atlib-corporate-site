# C1 build・構築準備・検証・切戻し

2026-10-23 JST。契約: [c1-implementation-contract-20261023.md](c1-implementation-contract-20261023.md)。本書は手順の成果物であり、GCP変更・Build実行・Secret登録・デプロイの承認ではない。今回は以下のクラウドコマンドを実行していない。

## ソースとローカル試験

PR #44の承認対象commitをcheckoutした既存repoで、`docs/secure-guard-phase1-20261021` を作業ディレクトリにする。既存 `organization-offboarding.ps1` の関数をdot-sourceで再利用する。別コピーをGitへ追加しない。

~~~powershell
pwsh -NoProfile -File ./organization-offboarding.tests.ps1
pwsh -NoProfile -File ./c1.tests.ps1
~~~

前者20件、後者46件はネットワーク不要。fixtureのGCS POSTはメモリだけであり、実GCP/DNSFilter要求ではない。追加8件のmetadata collectorは変更していないので再実行不要。

## 承認後に確定する入力

|入力|取得・固定方法|
|---|---|
|source SHA|レビュー済みPRの完全40桁SHA。`git rev-parse HEAD`と照合。既存未commit変更を混ぜない|
|PowerShell base image|Microsoft公式 `mcr.microsoft.com/dotnet/sdk@sha256:<64桁>` のlinux/amd64 SDK image。PowerShell同梱を確認してdigest固定。値未取得、捏造しない|
|Secret version|専用Secretの承認済み数値version。本文はこの準備作業で取得しない。latest/alias不可|
|project number|既存C0-3証跡/正式GETで確認したmsp-zabbixの数値project number|
|build identity|既存の承認済みBuild経路。Registry個別IAM/継承/deny確認前に流用しない。runtime SAとは別|
|image digest|成功したCloud Buildのresults.imagesで取得しRegistry metadataと照合。tagだけでJobを作らない|

コードはBase imageを独自配布せず、承認済みMicrosoft SDK digestを必須入力にする。初期値の空欄はデプロイ可能な設定ではない。

## ローカルrender → 後日Build

1. 対象commitのsource・既存prototype・新規ファイルをレビューする。`runtime-policy.template.json` の対象Org10220954/親10220948を確認。JobのOrg/Modeはこのimage内の設定だけから読み、実行引数/envで変更しない。
2. `render-c1.ps1 -SourceSha <実SHA> -SecretVersion <実数値> -OutputDirectory <新規出力先>` をローカル実行。生成した非秘密 `runtime-policy.json` をBuild contextの同名ファイルに配置する。既存出力を上書きしないため、再renderは新しいディレクトリを使う。
3. 明示的な構築承認後のみ、同ディレクトリのDockerfileを `cloudbuild.yaml` でBuildする。`_SOURCE_SHA` と `_POWERSHELL_BASE_IMAGE` は上記の確認済み非秘密値だけを渡す。Job実行SAをBuild identityへ流用しない。キーはbuild substitutions、args、contextへ一切含めない。
4. `.dockerignore` は必要な5個のps1/jsonとDockerfileだけをCOPY対象にする。Cloud Buildへのsource uploadも専用の非秘密staging directoryに必要ファイルだけを配置し、他の調査結果/認証ファイルを同梱しない。Buildの実行は今回禁止。
5. Build結果のbuild ID/source SHA/成果image digest/base digest/Secret版参照/承認versionを非秘密receiptへ記録する。Dockerfileのsource labelとbaked policyのSHA一致はBuild時に検査する。checkoutの内容がそのSHAと一致するかは提出前にも確認する。
6. Buildで使った同一SHA・同一Secret版を指定し、`-ImageDigest <実digest> -ProjectNumber <実番号>` 付きで別の新規出力先へ再renderする。生成policyがBuild時と完全一致することを比較してから、`job.rendered.yaml` をレビューする。違えばSTOPし、古いimageと新しいSecret mountを組み合わせない。

Dockerfile/Cloud BuildはBuild専用。deploy/IAM/Secret操作を自動実行するstepはない。Job templateの900秒/1CPU/1GiBは確定契約の初期候補値を表現し、性能実測とはしない。

## IAM・構築ゲート（今回適用なし）

`iam.proposal.json` は対象限定の差分案。project policyを置き換えるコマンドではない。runtimeは専用SecretのAccessor、専用bucketに限定するstorage.objects.get/create。delete/update/list、Editor/Owner/各Adminを付与しない。manual callerは対象Jobのinvoker、runWithOverridesを付与しない。

Registry個別IAM/上位継承/deny、bucket global名、UBLA/PAP・保持・他主体のdelete権限、Build/deploy主体は既存の未解決ゲートを維持する。正式保持年数・手動claim解除方針は統括決定待ち。既存7bucket/本番DBへ追加領域やTTLを勝手に設定しない。Schedulerは作らない。

## 起動時のfail closedとC2

Entry pointは全引数を拒否する。image内policyがDryRun/固定project/region/Job/SA/allowlist/数値Secret参照と合わなければSecretへ触れる前に停止する。親はtarget不可。Cloud RunのJob名/executionとmetadataの実SAを照合してから、version番号をファイル名にしたmountを読む。キー・例外本文・headers・raw responseを出力しない。GETは1要求のみ、401/403/timeoutに再試行やキーfallbackを行わない。

Secretのversion検証は、baked policyの数値・resource・mountファイル名の整合性と、同一renderから生成したmanifestの固定版によるもの。Secret payloadからそのversion番号を逆算・証明する仕組みではない。C2起動前にfresh Job specの実SA・image digest・Secret名/数値key/path・空のargsを承認receiptと照合する。specが異なれば実行しない。実mount/SecretアクセスはC1未実測。

GET経路は正式OpenAPI→Organization親子→全Site→Site別全Agent→Org全体Agent独立照合を既存prototypeで行う。未知schema/paginationは停止。C1ではUninstall用schema確認をGET実行の必須条件にはしない。アンインストール機能への接続はない。

成功ログはSHA/plan hash/件数/変更0だけ。対象一覧はallowlist projectionの `/work/review/plan.json` に一時保存する。Job終了後の永続レビュー成果物取得は未接続であり、永続監査が済んだと扱わない。C2で対象planの受渡し方法を承認範囲内で確認し、C3承認後のGCS接続前に変更操作へ進まない。

## GCS adapterのfixture境界

`c1-gcs.ps1` はJob entrypointからimportされない。将来の接続用部品で、実GCSへ試験書込していない。`SG-C1Store` へ正式HTTP transportとmetadata token readerを渡せるが、C1テストは全てメモリmockを渡す。

安定operation ID = Org・承認済み解約event ID・契約版の固定順JSONのSHA256。event/版未提供ではSTOP。Org claimはoperation IDと独立する固定パスで、新しいIDを作っても再取得不可。

順序はOrg claim→plan hash/承認version/投影snapshotの追記event→Agent claim→send boundary event→（C1では要求なし）→fixture結果event。create全てに`ifGenerationMatch=0`。二実行の競合は412でSTOP、HTTP不明も再送しない。成功したcreateも結果不明のclaimも自動解除しない。

FixtureでsimulateしたHTTP受付は完了/Pendingとは扱わず、実行再開時のclaimは常にUNKNOWN/要手動解決。結果event保存失敗でもclaimを残す。GET/POST以外のstorage操作やTTL解除のコードはない。GCS preconditionはlive未実測のためC3試験が必要。

## 切戻し・停止

- C1内の差分取消しは開発branchの今回追加分のみ。本番の切戻し操作は今回はない。
- 後日のJob不具合は専用Jobの次回起動を止め、承認済み旧image digest/数値Secret版の組へ対象Jobだけを戻す。失効済み旧キーへの復帰は保証しない。Secret登録/キー失効は別工程。
- 専用IAM差分の不具合は今回追加したbindingだけを照合して取り消す。既存本番bindingを全置換しない。
- 監査/claim保存失敗、競合、途中停止はSTOP/UNKNOWN。監査原本とclaimを保持し、TTL削除・自動unlock・新operation IDによる再送をしない。人による解除方法は未決なので実装しない。
- DNSFilter変更経路は無効。Agent uninstall、Pending観測、Org DELETEと端末復旧はC4/C5の別承認まで実施しない。

## 公式実装根拠

- https://docs.cloud.google.com/storage/docs/json_api/v1/objects/insert （media uploadとifGenerationMatch=0）
- https://docs.cloud.google.com/run/docs/reference/yaml/v1 （Job構造）
- https://docs.cloud.google.com/run/docs/configuring/jobs/secrets （Secret volume）
- https://learn.microsoft.com/en-us/powershell/scripting/install/powershell-in-docker （SDK内PowerShell）
