# IT経営KAIZEN LP v36 — フロント引き渡し

基準：LP v33のデザイン。v34追従CTA、v35申込UIを継承。v36はAPI未接続のフロント完成版。

## 実装場所
- `index.html`: `data-apply-open`（FV/PCヘッダー/スマホ追従/最終CTA）、`#apply` / `#apply35-form`、`#v36-application-ui`、`#v36-application-polish`。
- 申込UIはLP内モーダル。PC/スマホ対応。Escape、背景・閉じるボタン、フォーカス復帰、Tab循環。送信中は二重送信と閉じる操作を抑止。

## 入力とバリデーション
- `company` 会社名：必須、120文字以下。
- `name` 氏名：必須、100文字以下。
- `email` メール：必須、email形式、254文字以下。
- `phone` 電話：必須、30文字以下（厳密な電話番号形式は未定）。
- `consent` 個人情報取扱い同意：必須。正式なプライバシーポリシーURLが設定されるまでチェック・送信不可。
- HTML標準のrequired/email/maxlengthと、送信時のtrim・空欄・同意再確認。サーバ側検証は別途必須。

## 送信と表示
- 現状は正式API未接続で送信不可。仮API、DB、疑似成功は実装していない。
- `window.atlibDiagnosisApplication.configure({submitApplication, privacyPolicyUrl})` を正式接続時に呼ぶ。`submitApplication(values)` はPromiseを返す。`values={company,name,email,phone,consent}`。これはLP側の内部アダプタ契約であり、サーバAPIのrequest/response仕様ではない。
- 正式APIで受付成功を確認した後にのみ `{accepted:true, questionnaireUrl?:string}` を返す。アンケートURLが返れば完了表示にリンクを出す。未返却なら受付完了と後日案内を表示し、推測で遷移しない。自動遷移はしない。
- エラー時は成功扱いせず、汎用エラーを表示。受付状態が不明な場合は重複申込を避けるため受付状況確認を促す。重複送信・冪等性は開発レーンで正式仕様化する。
- API未接続案内は設定後に非表示。個人情報取扱いリンクは正式URLを設定。

## 開発レーンへの未完了事項
1. 現行Canonical/実装Fit/Gapに基づく正式API・状態・回答再開URL・通知仕様の決定。
2. 受付成功判定とURLのアダプタ実装、重複送信/タイムアウト時の扱い、認証・CSRF・スパム対策。
3. 正式プライバシーポリシーURL、同意文面・記録要件の確定。
4. 受付/アンケート完了の状態管理、メール/Slack/管理画面、診断処理起動条件。
5. 実環境E2E・表示/アクセシビリティ・セキュリティ検証、Production反映は別承認。

Git SHA：この納品はローカル成果物であり、Git commitは行っていない。基準のリポジトリSHAはこの環境で未検証。架空のSHAを記載しない。
