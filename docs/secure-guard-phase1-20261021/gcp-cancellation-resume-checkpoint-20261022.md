# Secure Guard 解約E2E・GCP無人実行｜再開チェックポイント（2026-10-22）

## STOP判断
PHP脆弱性対応を優先し、ユーザーの明示指示によりGCP・DNSFilter実機操作、デプロイ、IAM/Secret変更、Agentアンインストール、Organization DELETE、Cloud Scheduler設定を**すべて保留**する。今はWorkへの実装指示も出さない。再開はユーザーが明示したときのみ。これは実行予約ではない。

## Canonical / 証拠
- Repository: yoshihisahagisaka/atlib-corporate-site
- Draft PR #44, branch docs/secure-guard-msp-phase1-validation-20261021, checkpoint head 3dbb9f8859b3b15f64ec1f72c6b12447cd4bce27
- 調査スクリプト: docs/secure-guard-phase1-20261021/gcp-auth-fitgap-readonly.ps1
- 2026-10-22のユーザー実行によるGCPメタデータ調査（出力は会話添付「貼り付けたテキスト（1）(20261022-020355).txt」）。秘密本文取得なし。

## 調査結果（msp-zabbix）
- Cloud Run Services 7、Jobs 59、Secret Manager Secrets 33、Service Accounts 10、Scheduler Jobs 4（ENABLED 2、PAUSED 2）。
- 一覧上、Secure Guard専用Secret・Job・実行IDは見当たらない。名称一覧の結果であり、権限・全設定の精査ではない。
- 別プロジェクト atlib-corporate-site の調査はCloud Scheduler API not enabledエラーで途中停止。不存在とは断定しない。
- 既存稼働基盤 msp-zabbix を最有力配置先とし、再利用・専用化をFit/Gapで確定する。既存Secretの中身やIAM詳細、Job実行構成は未確認。

## 再開時の実装候補（未承認・未実装）
- Secure Guard専用Service Account（仮 secure-guard-job-sa）
- Secret ManagerのDNSFilter APIキー（仮 secure-guard-dnsfilter-api-key）：手入力なし。Secret本文・APIキーはGit、一般ログ、チャットに出さない。専用IDに最小権限、ローテーション・認証失敗停止。
- Cloud Run Job（仮 secure-guard-cancellation）：手動起動PoC。将来Cloud Schedulerで解約翌日00:05 JSTの起動を検討。スケジューラは今回未作成。
- 永続ジョブ台帳／監査／排他（既存DB等のFit/Gap後に決定）。単なるローカル一時ファイルでは再起動・複数ワーカーを防げない。
- Organization ID起点→全Siteをページングで取得→全Agentをページングで取得→所属・重複・対象を検証→各Agentへqueue_uninstall要求→Pending確認→承認された条件でOrganization DELETE→端末DNS・通信・管理画面・請求・監査確認。
- Agent UUIDやSite IDを実装に固定しない。POST/DELETE不明応答の自動再送禁止。秘密の非記録、最小権限、結果不明停止。
- 最初は無人認証でGET専用Dry RunをPASSさせる。変更系操作は別途承認、特にOrganization DELETEは個別の最終承認が必要。
- オフライン20試験PASSは実GCP・実APIのE2E PASSではない。商用化Go判定も未承認。

## 検証対象と既存実績
- Test Organization 02: 10220954、Site 10678578/10678582。MSP親10220948は変更禁止。
- 会社PC atl2024011は管理画面からアンインストール済み・DNS復元確認。自宅PC atl20260003はActive/Protected（最後の実測時点）。
- OpenAPIでは DELETE /v1/user_agents/{id} に queue_uninstall:boolean があることを確認。ただしAPIリモートアンインストール実機要求は未実施。
- Pending Uninstall状態でOrganizationを削除した場合の挙動を検証したいというユーザー意向。ただしオンライン/オフラインの保証は未確定。事前復旧手段と対象照合必須。
- 空Site2件の承認パッケージAは条件付き承認のみ、POST 0件。現在の削除検証を優先する場合は不要なSite新設を再評価する。
- DNSFilter課金条件、トライアル終了日時・自動移行・Organization削除creditなどは回答待ち。期限が近い場合は再開時に優先確認する。

## 再開時の最初の一手
1. PHP脆弱性対応が落ち着き、ユーザーから再開指示が出るまで一切変更しない。
2. PR #44とGit/docs Canonical、現GCPのfresh read-only情報を照合。過去PASSを繰り返さない。
3. 専用SA/Secret/Job/永続台帳の最小差分計画をWork向けに作成し、ユーザー承認を得る。
4. 承認後、GET-only Dry Run → APIアンインストール → Pending → Organization DELETEの順に検証。DELETEは独立承認。
5. 実測PASS部分のみ正式な解約Runbookへ記録。無条件の自動削除や翌日00:05稼働は現時点では未確定。

再開呼び出し例：「Secure GuardのGCP無人解約E2Eを、PR #44の2026-10-22チェックポイントから再開して」
