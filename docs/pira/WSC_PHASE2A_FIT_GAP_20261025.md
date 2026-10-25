# WSC Phase 2A Fit / Gap（2026-10-25）

## Canonicalと分離

基準は VS1 Draft PR #45 の `c8ed027c0fec0df54b458cad18094b189482e81a`。Phase 2Aは `tools/wsc-phase2a/` に限定し、VS1の判定・解説・HTMLデザイン・PowerShell v2原本を変更しない。

PowerShell v2原本は `C:\Users\YoshihisaHagisaka\Downloads\atlib-security-check-v2.ps1`（SHA-256 `9B679A6EFD9B9D32331D229BC4ED235B51A3E20950C6A88F0B66A8854A8F325E`）で確認した。atLIBドメインだけを許可する回帰基準であり、Phase 2Aから実行・改変しない。

## Fit

- CSVはUTF-8（BOM有無）で、必須3列 `企業名,本店所在地,URL` を厳格に検証する。将来の任意4列目 `メールアドレス` は受け付けるが、診断・送信には使用しない。
- CSV行番号、入力原本、正規化URL、決定論的な `company_id` を保持し、不正行と重複行を隔離する。同一URLの別企業を統合しない。
- Synthetic executorはHTTPS、443、認証情報なし、公開IPだけを許可する。IPv4/IPv6の私設・ループバック・リンクローカル・CGNAT・文書用・ベンチマーク用・マルチキャスト・予約・IPv4-mapped IPv6等、localhost、DNS再束縛、接続先IP不一致、リダイレクトを拒否する。
- executorは実際のネットワークtransportを実装しない。Synthetic probeだけを受け付けるため、未承認の外部アクセスは不可能である。
- `batch_id`、`company_id`、`diagnosis_run_id`、`report_id` と状態を分離する。中断後の再開、`RETRY_PENDING`、最大再試行後の `FAILED`、`REPORT_READY` の再実行抑止を実装する。
- ローカル隔離保管は企業別に診断JSON、判定JSON、HTML、企業入力、SHA-256整合性情報を保存し、パス逸脱と成果物上書きを拒否する。一時領域で全成果物を作成・検証後に正式領域へ確定し、途中失敗の一時領域は削除する。`REPORT_READY` が破損・欠損した場合は `REPORT_CORRUPT` として記録し、自動上書き・自動再生成しない。

## Synthetic検証

T1相当として5社のSynthetic CSVを使い、CSV取込、HTML生成、保管、途中中断、再開、冪等な再実行、整合性確認を自動テストする。SSRF相当、DNS変更、リダイレクト、接続先IP不一致、タイムアウト／再試行もモックで検証する。実企業への通信はしていない。

## 容量・費用の見積り

現行の自己完結HTMLは共通画像をdata URLで埋め込むため、atLIB生成例は約2.03 MB。診断JSON・結果JSON・整合性情報を1社あたり概算20 KBとして、10,000社は約20.5 GB（HTML約20.3 GB + JSON等約0.2 GB）を見込む。GCP Cloud Storageの保存単価、リージョン、保持・削除ポリシー、IAM、アクセスログの要件は未決定であり、費用を確定値として扱わない。

## Gap / STOP

- 任意企業へ実接続するtransportは未実装。PowerShell v2の取得ロジックを安全に再利用する派生実装、DNS解決と実ソケット接続先の結合、速度制御、実行権限は別途承認が必要。
- GCPバケット、IAM、保持期間、削除ジョブ、鍵管理、監査ログは未実装。ローカル保管は隔離方式の検証であり、Production保管ではない。
- T2（50社）、T3（500社）、T4（10,000社）、実サイト負荷、実行時間、実コストは未検証。
- メールドメインはWeb URLから推測しない。将来の入力契約で明示するまで、実診断の対象として扱わない。
