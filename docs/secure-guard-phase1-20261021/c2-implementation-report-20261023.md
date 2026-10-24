# C2永続DryRun計画｜実装結果・実行手順

2026-10-23 JST / Draft PR #44。開始HEAD・統括確定契約: `ccef51e83a5924d3b3b43441babaaf5b2bd6fbf2`。mainのfresh read: `1caa2eb1fec2d887a41130b0aa0fdf102493562b`。最優先は [C2固定契約](c2-dryrun-durable-plan-contract-20261023.md)。C1契約・既存コード/試験/Runbookを継承し、既存GCP棚卸しや設計はやり直していない。

## 実装結果と差分

|ファイル|内容|
|---|---|
|c2-durable-plan.ps1（追加）|既存SG-Hashとinventory projectionを検証、create-only保存、作成metadata・generation固定read-back・hash/内容照合、安全なreceipt。GET成功後のみ保存する統合関数|
|c1-gcs.ps1（最小修正）|既存HTTP/metadata token処理を再利用。dryruns namespace、DryRun/Claimsのアプリscope分離、GETのgeneration指定を追加。既存claimの既定動作は維持|
|c1-entrypoint.ps1|一時planだけの成功判定から、GET→DryRun専用store→永続保存/read-back済receiptへ変更。全引数拒否・実SA/Secret検査・異常時exit1を維持|
|Dockerfile / .dockerignore|新moduleをimageのCOPY許可へ追加。新build/deploy stepは追加しない|
|iam.proposal.json|専用bucket get/create案にC2対象範囲の説明を追記。権限の追加なし。prefixがIAMで自動分離されるとは扱わない|
|c2.tests.ps1 / c2-offline-results.json|新34試験と関連C1回帰46試験の結果|
|c2-syntax-results.json|PowerShell9ファイル構文結果|
|c1-build-runbook.md / organization-offboarding-runbook.md / 本報告|最新成功条件・検証・構築前ゲートの追記。過去C1の一時ファイル/未接続の記録は当時の履歴として保持|

manifestのSA・Secret mount数値版・Org policy・retry/task・CPU/memory等には変更不要。既存prototypeとC1 GET/auth/HTTP関数を変更せず再利用。顧客別のコード/Job、DB、Schedulerは追加していない。

## 保存・照合・停止

1. C1の全引数拒否、DryRunのみ、PoC allowlist/親拒否、実SA、数値Secret mountを検査する。キー取得/認証失敗で後続へ進まない。
2. 正式OpenAPI→Org親子→全Site/Agentページ→独立Org集合照合はC1のまま。DNSFilter transportはGET以外を拒否する。
3. C1が生成したplanを検証。既知のpayload/inventory/pagingキー・所属・件数・hashを確認し、未知の属性や任意メモ/Secret/raw bodyの追加は保存前に拒否する。prototypeが従来から持つ固定visibility警告は既存payload hashを維持するためその定数だけを許可し、任意文章を許可しない。
4. `dryruns/organizations/{org-id}/plans/{plan-hash}.json` へ `ifGenerationMatch=0` で1回だけ作成する。Org/Agent claimでも変更承認でもない。
5. 作成応答のbucket/nameと正の数値generationを検査する。応答欠落・不一致はUNKNOWN/STOP、再送も勝手な回復GETも行わない。412も上書きや既存成功扱いをせずSTOP。
6. 同じbucket/nameを `alt=media&generation={作成generation}` で1回だけ再取得する。未知属性/改ざん/Hash不一致/Org逸脱/内容不一致/404/権限不足はSTOP、Job exit1。read-back成功は以前の不明要求の再送許可ではない。
7. 全照合後のみ `DRYRUN_DURABLE_VERIFIED` receiptを返す。標準ログはstatus/source SHA/plan hash/GCS object名/generation/件数/mutations=0だけ。対象hostname/UUID、計画本文、キー、headers/token/raw response/例外本文はログへ出さない。

GCS adapterのstoreをDryRun scopeで生成し、claim/audit prefixへの要求をアプリで拒否する。C1のclaim関数はC3向けの分離部品として残るが、Jobの経路では呼ばない。bucket IAMのprefix限定を実証したという意味ではない。

## オフライン試験

~~~powershell
pwsh -NoProfile -File ./c2.tests.ps1
~~~

C2 testは既存C1 fixtureを再利用し、関連する46件の回帰を一度実行してから新規試験を実行する。C1 testのchild entrypoint試験も新entrypointのoverride拒否を検証する。実API transportやmetadata readerは起動しない。

|範囲|今回結果|
|---|---|
|C2新規|**34 PASS / 0 FAIL**|
|C1関連回帰|**46 PASS / 0 FAIL**|
|今回実行合計|**80 PASS / 0 FAIL**、live requests0|
|既存prototype20・metadata8|過去PASSを維持。今回は無変更領域として再実行なし。今回件数に加算しない|
|PowerShell構文|9ファイル、error0|
|実Build/実Secret/実GCS/実DNSFilter|未実施|

新規試験: 正常保存・generation固定再取得・同一hash競合・異なるhashの並存・空inventory・作成後応答喪失（mock上は保存済み）・作成/読取401/403/不明・404・作成bucket/path/generation不一致・read-back内容/Hash/Org改ざん・未知秘密属性拒否・GCP認証なし・Secret/実SA/override失敗時の保存禁止・claim prefix拒否・秘密を含まないreceipt/STOP・DNSFilter POST/PATCH/DELETE拒否。

mockメモリ保存の結果であり、GCSサービスや実IAMのPASSではない。C2コード実装のオフライン受入範囲を満たす。C2実GCP PASSは付与しない。

## 承認後の構築・実測・切戻し手順（今回は実行しない）

- 既存 [C1 build手順](c1-build-runbook.md) のsource SHA/digest/数値Secret版/実SA・spec照合を使用。C2 module入りの新しいsource SHAからbuildする。既存imageのままJobを成功扱いしない。
- 統括がRegistry個別IAM・Build主体・Microsoft base digest・Docker実build、専用SA/Secret実版、bucket名/UBLA/PAP/retention/get-create権限、ログアクセス/計画の個人情報分類を確定・承認するまでGCP操作を行わない。保持年数や新しい権限を実装側で決めない。
- 別途承認された実Jobでのみ、DNSFilter GET全取得→専用GCS create→read-back/hash→receiptを照合する。receiptのSHA/hash/object/generation/件数を実行証跡と一致させ、変更API要求0を確認する。計画本文を一般ログや公開PRへ貼らない。
- 競合/保存不明/読取失敗は次の起動を止め、存在し得るobjectを保持する。自動再送・上書き・新hash捏造・削除による回避をしない。過去のobjectを承認済み計画へ自動昇格しない。
- コード差分の切戻しは今回のcommit対象だけ。後日のJob切戻しは承認済み旧image digest/数値Secret版の組へ対象Jobだけを戻す。旧キーが失効済みなら復帰保証なし。既存本番IAM/Service/DBは変更しない。保存済みDryRun objectやclaimの自動削除はしない。
- Org/Agent claimのlive接続はC3、アンインストールはC4、Organization DELETEはC5の独立承認。今回の保存機能はその実行権限を与えない。

## 未確認と判断待ち

実Build/Job起動/Secret mount、DNSFilter実response schema/paging、GCSの実応答・IAM・保持・ログアクセスは未実測。上記の構築前ゲートは統括判断を維持。新たなアーキテクチャ判断が必要な矛盾は検出していない。C1境界を緩める仕様変更なし。

**GCPリソース変更0、Cloud Build実行0、IAM変更0、Secret登録/実取得0、deploy0、DNSFilter実API要求0、Agent操作0、Organization DELETE0、Production/main変更0。** Draft PR #44更新後、統括レビュー待ちで停止。

generation指定GETの根拠: https://docs.cloud.google.com/storage/docs/json_api/v1/objects/get
