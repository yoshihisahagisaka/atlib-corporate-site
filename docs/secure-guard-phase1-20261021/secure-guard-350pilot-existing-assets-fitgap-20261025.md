# Secure Guard｜350台初期運用に向けた既存資産 Fit/Gap

2026-10-25 JST / Draft PR #44。これは既存Decisionとリポジトリ内資産の棚卸しであり、新規アーキテクチャ・実装の提案ではない。

## 前提として確認したDecision

- 単一のSecure Guardログイン、UI、API、監査を顧客社員とatLIB常駐運用者が共有する。認可はCustomer Organization MembershipとRoleで判定する。
- MSP ScopeはCustomer Scopeから昇格しない。MSP権限と顧客権限は同一アプリ内で明示的に分離する。
- 顧客Organization IDを製品コードに固定しない。DNSFilter MSP APIキーはバックエンド専用で、ブラウザへ渡さない。
- 350台案件は顧客固有のアプリ／画面／Jobを作らない標準サービスの初回導入である。

## Fit/Gap

|初期運用項目|分類|既存根拠と次工程への制約|
|---|---|---|
|C2 GET-only inventory、DryRun計画、GCS create-only/read-back|既存資産をそのまま再利用|実環境E2E成功済み。Customer UIにDNSFilter keyを渡さず、バックエンドの固定Job契約を維持する|
|共通ログイン／Customer Membership／MSP・Customer Scope分離|最小差分で横展開|承認済みDecisionあり。現リポジトリのCorporate Siteにはログイン、Membership、認可API、顧客DB実装は確認できないため、既存の別システム資産の正式なCanonical確認が必要|
|Organization・Site・Agent閲覧、保護状況・利用台数|最小差分で横展開|C2は取得・所属整合のバックエンド証跡を持つ。顧客向けの認可済み読取API、表示用モデル、画面は未実装|
|遮断解除申請と承認|未実装|Roleと職務分離のDecision案はあるが、申請、二者承認、期限、実API適用、監査の実装と実機検証は未着手|
|顧客Membership・Role管理|未実装|Role案と境界Decisionはあるが、Identity provider、Membership永続化、招待／失効、サーバー側強制認可は未実装|
|操作履歴・監査|最小差分で横展開|C2は非秘密の実行receiptとDryRun計画を保存する。一方、顧客画面向け操作履歴、承認履歴、閲覧権限のデータモデルは未実装|
|DNSFilter管理画面による暫定運用|別途承認・実機検証が必要|標準Decisionは共通画面完成までの暫定利用を許容するが、350台PoCの対象範囲、担当者、FortiGate共存、請求対象台数の定義は実機／業務承認が必要|

## 初期管理画面の最小実装候補（実装承認前）

1. 共通ログイン後に、Membershipで固定された自Organizationのホームを表示する。
2. C2由来の安全な集計だけを用いて、Site数、Agent数、保護状態、最終DryRun receiptを表示する。DNSFilterの秘密・生応答・他Organizationのデータは表示しない。
3. viewer/operator/org_adminの顧客RoleとMSP Scopeをサーバー側で強制し、Membership外Organizationへのアクセスを拒否する。
4. 遮断解除は「申請」の保存と監査までに限定し、実API変更は承認フロー・別実機検証後まで接続しない。

## 次工程の承認・確認事項

- 既存atLIB認証・顧客管理・Web管理画面資産の所在と、利用できるCanonicalを正式確認する。
- Identity provider、Membershipの永続先、招待／失効、Role×操作、MSP支援操作の承認境界を決定する。
- 350台PoCの対象Organization／Site、担当者、FortiGate共存、端末・請求数量の定義を実機・業務承認で固定する。
- C3/C4/C5、Scheduler、Production deployは、このC2成功記録から自動的には承認されない。

GCP、DNSFilter、IAM、Secret、GCS、Productionへの変更はこのFit/Gap作成では0件。
