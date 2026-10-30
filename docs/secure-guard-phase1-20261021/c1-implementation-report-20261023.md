# C1実装結果（統括レビュー待ち）

2026-10-23 JST。開始HEAD/確定契約 `a64677b2be06d939c9d5ef2d3d504e09330f7696`、main `1caa2eb1fec2d887a41130b0aa0fdf102493562b`。Draft PR #44の同一branchに追記。契約と関連Decisionを読み、設計変更・再棚卸しは行っていない。

## 実装した機能とファイル

|ファイル|実装|
|---|---|
|Dockerfile / .dockerignore|PowerShell同梱Microsoft SDKのdigestを必須入力にする専用image。必要ファイルだけをCOPY。source SHA labelとbaked policy照合|
|cloudbuild.yaml|既存東京Registryの専用image名へbuild/pushする定義。deploy/Secret/IAM stepなし|
|runtime-policy.template.json / render-c1.ps1|PoC Org allowlistを共通コードから分離。SHA/数値Secret版のpolicyとdigest固定Job manifestをローカル生成|
|job.template.yaml|専用SA/数値Secret volume、task1/parallel1/retry0、初期候補900秒/1CPU/1GiB。Schedulerなし|
|c1-entrypoint.ps1 / c1-runtime.ps1|全引数override拒否、DryRun以外STOP、Org/親/allowlist検証、実SA照合、Secret mount読取、GET専用HTTP、401/403/不明応答で停止。キー手入力・retry/fallbackなし|
|c1-gcs.ps1|Jobから分離したGCS REST adapter。Org/Agent claim、安定event/契約版/Org hash、generation precondition、投影snapshot/plan hash/承認版の追記監査、結果監査、UNKNOWN/再送拒否|
|iam.proposal.json|Secret単位Accessor、専用bucket get/createのみ、限定Job invokerの適用案。未確定主体は空欄として維持|
|c1.tests.ps1 / c1-offline-results.json|新規46 fixtureと結果|
|c1-syntax-results.json|PowerShell7ファイル構文の証跡|
|c1-build-runbook.md|ローカルrender、後日Build/構築/実測のゲート、照合・停止・切戻し手順|
|organization-offboarding-runbook.md|最新C1索引・実装/実測の区別を追記|

既存 `organization-offboarding.ps1` / 同testsは**無変更**。既存関数をdot-sourceし、全Site・全Agent、独立Org集合照合と未知schema/pagination停止を再利用した。新たな顧客専用コード/Jobはない。原prototypeのRequestUninstall STOPも解除していない。

## 境界と動作

- 新Job entrypointは全引数を拒否し、image内policyからのみOrg/Modeを読む。envでOrg/Modeを渡しても無視する。実行者へrunWithOverridesを付与しないIAM案と併用する。deploy権限を持つ主体のimage差替えまで防ぐものではない。
- 実行SA一致→mount読取→公式OpenAPI→Org親子→全Site/Agentページ→独立集合照合。GET経路にUninstall APIへの要求はなく、transportでもDNSFilter POSTと全DELETEを拒否する。
- Secretの数値版/resource/ファイル名の整合を検査し、同一renderのmanifestに数値版を固定。実mount版の同一性はC2のfresh specとimage/receipt照合が必要。Secret本文を読み出して版を検査する追加APIや権限は導入していない。
- ログはSTOP codeか成功の件数/SHA/hashのみ。生レスポンスや例外本文・Authorization/GCP tokenを出さない。全対象のprojectionは一時 `/work/review/plan.json`。永続audit実測は未実施。
- GCS adapterは**entrypointに未接続**。Org claim→snapshot→Agent claim→送信境界event→fixture結果eventの順で原子的create。HTTP要求は実装・接続していない。HTTP受付は完了/Pending証明としない。claimはUNKNOWNのまま残す。adapterにはDELETE/update/TTL/unlock/自動resendなし。
- 安定operation ID未提供、plan hash/承認不一致、frozen AgentのUUID・Org・Site・実Hostname不一致、保存失敗、412競合、不明応答はSTOP。Org固定claimは異なるevent IDによる再実行も止める。

## 検証

|試験|今回の結果|
|---|---|
|新C1 fixture|**46 PASS / 0 FAIL**、実GCP/DNSFilter要求0|
|再利用prototype関連回帰|**20 PASS / 0 FAIL**。本体は無変更だが新wrapperが全取得/auth/hash関数を利用するため関連回帰として実行|
|既存metadata collector 8件|過去8 PASSを保持。collector無変更のため再実行なし|
|PowerShell構文|7ファイル、error0|
|Docker実build/container smoke|**未実施**。Docker Engineへの接続がpermission denied。権限回避・別Engineへの切替なし|
|YAML/Cloud Build実API受理|**未実測**。Jobの構造は公式v1仕様と照合、local render fixtureで数値版/digest/placeholder除去を検証。クラウドvalidation未実施|
|実SA/Secret mount/無人DNSFilter GET|未実施。C2|
|実GCSの原子的競合/再起動/監査|未実施。C3|
|アンインストール/Pending/Org DELETE|未実施。実行経路無効、DELETE実装なし|

今回実行したoffline合計は**66 PASS / 0 FAIL**。過去の追加8件を今回実行数へ加算しない。新46件は未認証/Secret欠落・版不一致/401・403/SA不一致/allowlist逸脱/未知schema・paging/Org・Site・Agent不一致/二runspace同時claim競合/再起動UNKNOWN/監査失敗/plan hash/override/秘密非出力/結果監査を含む。

二runspace試験も共有メモリmockの原子的TryAddであり、GCSサービス自体の実測PASSではない。途中停止はfixture保存失敗・再adapter生成で検証。Windowsサービス/DNS復旧とは区別する。

## 未実装・未確認・統括判断

1. 実Buildとimage digest、数値Secret版、project番号、Build/deploy identityは未確定のため、デプロイ可能な実値を捏造しない。パラメータ入力後のBuild・起動検証を次工程のゲートとする。
2. 正式な保持年数・手動claim解除・再実行の承認運用は契約どおり保留。既存Registry IAM/継承deny、bucket名/保持/実効権限も既存ゲートを維持する。
3. GCSのlive接続はC3 PASSと別承認まで実施しない。C2での対象一覧の永続受渡しはまだ実測していない。一時ファイルだけで監査完了と扱わない。
4. アンインストール送信許可/認可、Pending中Org削除の条件、Org DELETEコードはC4/C5の別承認領域。C1では補完しない。
5. 新たなアーキテクチャ変更を要する矛盾は検出していない。実Build未確認と上記保留項目を含め、統括レビュー待ち。C1コード/fixture PASSを実E2E PASSや商用Goとは判定しない。

**GCP変更0、Secret登録/実payload取得0、IAM変更0、deploy0、DNSFilter実要求0、Production/main変更0。** 既存Sales Tools/Portal/Send/PPAP/本番DB/Scheduler/親10220948に変更なし。PR更新後はレビュー待ちで停止する。
