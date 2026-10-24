# Secure Guard｜GCP Runtime TypeScript統一 Decision / 実装契約

Date: 2026-10-23 JST
Status: **統括承認・設計固定 / Workは実装とテストのみ**
Canonical: atlib-corporate-site Draft PR #44 (pre-decision HEAD d6c4b3a8eae99db64ff6db655a68f51d2f4343b0)。Sales Tools main Dockerfileは既存Node.js方式の参照資産であり、Sales ToolsへSecure Guardコードを組み込まない。

## 決定理由
Secure GuardのGCP JobはHTTPS REST、JSON検証、Secret Manager/GCS、hash、永続排他を行い、Windows固有のAPI/機能を必要としない。PowerShell選択の主な便益はWindows PoCコードの直接再利用だが、商用運用・保守・今後の登録/課金/監視APIとの共通化ではatLIB既存Node.js/TypeScript資産の方が合理的。既存のPowerShell C1/C2を無効化・削除せず、参照実装とfixture/受入証跡として保持する。

## 固定アーキテクチャ
- GCP Project msp-zabbix、region asia-northeast1、専用Cloud Run Job secure-guard-cancellation、既存Artifact Registry cloud-run-source-deploy。Node.js/TypeScriptで実装し、既存Sales Tools Dockerfileのmulti-stage、non-root、lockfile/npm ci、source SHA/digest追跡を参考にする。Sales Tools/Portalのソース・DB・IAM/Secret・稼働構成は変更しない。
- Runtime SA secure-guard-job-sa@msp-zabbix.iam.gserviceaccount.com、専用Secret secure-guard-dnsfilter-api-key（数値version固定、latest禁止）、専用GCS bucket候補 msp-zabbix-secure-guard-offboarding-audit。Build主体とRuntime主体は分離。Schedulerなし。
- C1/C2のGET専用DryRun、Organization 10220954 allowlist/親10220948変更禁止、全Site/Agent・独立集合照合、未知schema/pagination fail closed、実行identity/引数override拒否、秘密非出力、401/403停止、retry/fallbackなしを完全継承。
- GCS dryruns/organizations/{org-id}/plans/{plan-hash}.jsonへcreate-only(ifGenerationMatch=0)、create応答のbucket/name/generation検査、generation固定read-back、projection/hash/内容一致、秘密を含まないreceiptを継承。既存PowerShellのSG-HashとJSON順序に互換性を持たせ、fixtureを使い同一plan hashとなることを確認する。実レスポンス未確認のフィールドは推測で補完しない。
- C1のclaims/organizations、claims/operations、audit namespaceはTypeScript側でも同一契約の分離adapterとして移植するが、Job実行経路には接続しない。原子的claim/UNKNOWN/再送禁止/追記監査のfixtureを引継ぐ。C3実GCSと別承認まで変更APIへ接続しない。
- DNSFilter APIはGETのみ。アンインストール送信は無効、Organization DELETEは未実装。DryRun成功は解約承認ではない。

## 移植とテスト
- 既存PowerShell実装を参照し、API仕様/ページング/独立照合、projection、hash、GCS adapter、fail closedをTypeScriptへ移植。共有コードはSecure Guard専用moduleに閉じる。既存Sales Toolsに直接importさせない。
- API transport、Secret reader、identity reader、GCS clientを注入可能な境界に分離。実キーをテスト/ログ/ソースへ置かない。SDK/依存ライブラリは既存atLIBのNode.js/Google SDK方式を優先し、採用理由とlockfileを記録。
- C1/C2の既存fixtureを言語間契約テストに変換し、同一入力で同一inventory・plan hash・receipt/STOP判定を検証する。PowerShellの過去PASSをTypeScript PASSへ転記しない。Node.js版の全テストを新規実行し、実Buildは権限があればローカルのみ。GCP実Build/Job/実APIは別承認。
- TypeScript strict build、Node test、コンテナ静的検査、変更APIが存在しないこと、GCS claim経路がJobに未接続であることを受入条件とする。実GCPの権限/保持/Build SA/digestは既存SG-1未解決ゲートを維持。

## Workの許可・禁止
許可: PR #44の開発branchでNode.js/TypeScriptコード、Dockerfile、Cloud Build/Jobテンプレート、テスト、Runbook、実装結果を追加・更新しCommit。既存PowerShell/C1/C2契約・既存証跡を削除・書換えない。旧PowerShellの実行用manifestを新実装の本番正本として使わない。
禁止: アーキテクチャ/業務仕様変更、実GCP/Secret/IAM/DB変更、Cloud Build実行、Job起動、DNSFilter live GET/変更、Agent uninstall、Organization DELETE、main merge、Production変更。実装上の矛盾は統括へ差し戻す。

## 受入・次ゲート
1. TypeScript版の独立GET-only Job・GCS dryrun永続保存・claim分離adapterがBuild/テストPASSし、PowerShell fixtureと意味/ハッシュ互換。
2. PR #44に変更一覧・テスト件数・既知差分・未検証を記録。旧PowerShellは検証資産として保持。
3. SG-1のIAM/Build主体、GCS保持/アクセス、Secret登録、base image digest等は別途統括判断。Node.jsへ変更したためMicrosoft SDK base digestは不要になり、Node.js base imageの固定digestを構築前に確認する。
4. 実GCP構築・C2 live GETは別承認までNo-Go。C3/C4/C5の承認ゲートは継承。
