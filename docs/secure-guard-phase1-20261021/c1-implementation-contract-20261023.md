# Secure Guard C1 実装契約（統括確定・2026-10-23）

Status: **統括設計固定 / Workは実装とテストのみ**。PR #44 / 基準 c4c085f。既存Runbook、C0-3実測、標準システム権限Decisionを優先し、矛盾時は勝手に解釈せずSTOPして報告。

## 目的と境界
- C1はソースコード・Dockerfile・Cloud Build定義・Job構成マニフェスト・最小IAMの適用案・オフラインテスト・実行Runbookを作る。GCP create/update/IAM/Secret version登録/deploy、DNSFilter live変更、Organization DELETE、main mergeは禁止。
- 既存prototypeの全Site/Agent取得・独立集合照合・未知schema/pagination STOPを継承。350台顧客専用の別コード・Jobは作らない。親10220948への変更禁止。C2 GET実証はC1とは別ゲート。
- 既存コード/テストは最小差分で再利用。既存20件と追加8件は過去PASSとして保持し、変更箇所に関連する試験のみ再実行。

## 固定アーキテクチャ
- GCP: msp-zabbix / asia-northeast1。既存Docker Registry cloud-run-source-deployを再利用。新イメージ名 secure-guard-cancellation。PowerShell対応専用コンテナ、source SHAとimage digestを追跡。
- Cloud Run Job名 secure-guard-cancellation。runtime SA secure-guard-job-sa@msp-zabbix.iam.gserviceaccount.com。Secret名 secure-guard-dnsfilter-api-key。専用監査bucket候補 msp-zabbix-secure-guard-offboarding-audit（global名の衝突は適用前確認）。Schedulerは今回作成しない。
- Job default DryRun。task=1、parallelism=1、retry=0、初期timeout=900s、1vCPU/1GiBは既存計画の候補値。実測値ではない。Secret volumeの数値versionをmanifestで固定。latest禁止。Job実SAと期待SA一致を起動時確認。
- Cloud Runの実行引数overrideによる別Organization/Mode指定を安全と見なさない。C1は破壊操作をJob実行経路に接続せず、DryRun以外は無条件STOP。対象OrganizationはPoC 10220954のallowlistを設定するが、共通実装内に顧客IDを恒久ハードコードしない。親10220948をtargetにしない。
- DNSFilter API keyはSecret volumeからのみ読み、キー・HTTPヘッダー・生レスポンス・例外本文・GCP tokenをGit/標準ログ/auditへ書かない。認証401/403、Secret不在、数値version不一致、identity不一致はfail closed。自動再試行・手入力fallbackなし。

## 永続監査・排他の実装契約
- Cloud Run local FileMode.CreateNewは分散排他として使用禁止。GCS API/SDKの generationMatch=0 による原子的create-onlyを使う。競合は既存claimを上書きせずSTOP。
- Org claim: claims/organizations/{org-id}/current。Agent claim: claims/operations/{stable-operation-id}/agents/{uuid}/uninstall。Audit event: audit/{stable-operation-id}/{event-id}.json。イベントは追記専用、runtimeはdelete/update不可。
- stable operation IDは承認済み解約イベントIDと契約版/Organizationに結び付ける。未提供時は変更操作STOP。ランダムIDを使って再実行制限を回避しない。
- 永続保存の順序: org claim→対象snapshot/plan hash/承認version記録→agent claim→送信開始イベント→最大1要求→結果イベント。保存失敗は後続変更STOP。送信前後のcrash/タイムアウト/応答不明はUNKNOWN。TTL切れや新Job実行を理由に自動再送しない。
- C1でGCS adapterの実装とfixture/mock競合・crash・権限失敗試験を行う。ただしlive変更経路への接続/解除はC3実GCP PASSと別途承認後。監査保持期間、解除・手動解決の運用は後述の保留ゲートに従い、勝手に自動削除・自動claim解除を実装しない。

## IAM・秘密管理
- runtime SAにEditor/Owner/Secret Admin/Storage Adminを付けない。専用SecretにだけAccessor、専用GCSへのget/create最小権限。deploy主体とruntimeを分離。既存Sales Tools/Portal/Send/PPAPのSecret、IAM、DB、サービス、Schedulerを変更しない。
- Secret初回登録・version更新は別承認の安全な経路。ソース、CLI引数、標準ログ、PRにキーを含めない。version切替→新version GET確認→旧キー失効は別工程。
- project IAMには既存default Compute SAのEditorがあるため、これをruntimeへ流用しない。Registry個別IAM/継承権限/上位deny等の未確認はC1デプロイ承認ゲートとして残す。

## Workが設計判断してはならない項目（保留）
1. 監査・claimの正式保持年数、法務/契約要件、管理者による手動解除・再実行承認の運用。
2. Organization DELETEのAPI実行コードとPending中削除の安全条件（C5で独立承認）。C1で実装しない。
3. C4のアンインストール送信許可と承認スコープのUI/認可方式。C1では変更APIはSTOPのまま。
4. DNSFilter最新OpenAPI/pagination実レスポンス差分。推測補完禁止、C2で実GET検証。
5. 既存Registry IAM・GCS bucket名/retention・実効権限の最終適用値。C1は適用案とチェック手順を出すだけ。

## 受入基準
- Buildableな専用コンテナ/Job設定、固定数値Secret versionのテンプレート、Git SHA→digest追跡、GET-only起動経路。
- C1オフラインテスト: 未認証/Secret不在/401・403/実SA不一致/allowlist逸脱/未知schema・pagination/Org・Site・Agent所属不一致/同時claim競合/再起動UNKNOWN/監査失敗/plan hash不一致/引数override拒否/ログ秘密非出力。各PASS/FAILと未実測を明記。
- Live DNSFilter変更0、GCP変更0、main変更0。WorkはDraft PR #44へコミットと証跡を追加して停止。
- 本契約に矛盾する実装上の制約が判明したら設計変更せず、具体的な該当箇所・選択肢・影響だけを統括へ返す。
