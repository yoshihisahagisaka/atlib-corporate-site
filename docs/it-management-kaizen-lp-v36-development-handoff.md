# IT経営KAIZEN LP v36 — 無料診断開発レーン引き継ぎ

## 位置づけ
- LPデザイン基準はv33。v36はCTA・LP内申込フォームのフロント引き渡し版。
- WordPressへの配置・本番公開は無料診断開発レーンのリリース工程。現段階では未公開。
- Git pushは未完了。実際のリポジトリ・ブランチ・commit SHAは登録後に確定する。未確認のSHAを転記しない。

## 成果物
- `index.html` — LP、CTA、申込モーダル、フロントバリデーション、APIアダプタ境界。
- `assets/` — 画像10点。HTMLと同じ階層構造で配置すること。
- `HANDOFF.md` — フロント実装の詳細と未完了事項。
- `DEVELOPMENT_HANDOFF.md` — 本資料。

## フロント実装
- CTA: `data-apply-open`（FV、PCヘッダー、スマホ追従、最終CTA）。LP内の同一申込モーダルを開く。
- モーダル/フォーム: `#apply`、`#apply35-form`。関連スタイル: `#v36-application-ui`、`#v36-application-polish`。
- 入力: `company` 会社名 必須・120字以内、`name` 氏名 必須・100字以内、`email` メール 必須・email形式・254字以内、`phone` 電話 必須・30字以内、`consent` 個人情報取扱い同意 必須。
- 入力検証: HTML required/email/maxlengthに加え、送信時のtrim、空欄・同意確認。サーバ側検証は別途必要。
- UI: Escape/背景/閉じるボタンで閉じる、フォーカス復帰・Tab循環。送信中は二重送信・閉じる操作を抑止。
- 現在、正式API・プライバシーポリシーURL未設定のため送信不可。仮API、DB、疑似成功は実装していない。

## 接続境界（サーバAPI仕様ではない）
`window.atlibDiagnosisApplication.configure({ submitApplication, privacyPolicyUrl })`

`submitApplication(values)` は Promise を返す。values は `{company,name,email,phone,consent}`。正式APIで申込受付成功が確認された場合のみ `{accepted:true, questionnaireUrl?:string}` を返す。回答URLがあれば完了表示にリンクを出し、URLがなければ受付完了と後日案内を表示する。自動遷移はしない。エラー時は成功扱いしない。

## 確定した顧客導線・重要条件
LP CTA → LP内フォーム → **申込受付成功** → アンケート画面 → 回答送信 → 完了画面・メール → 内部通知・管理画面。
申込受付とアンケート回答完了は別状態。アンケート途中離脱後も申込情報を保持し、回答URLから再開可能にする。申込受付だけで診断・分析・レポートを誤起動させない。

## 開発レーン担当・未完了
1. 既存Canonical/DB/API/メール/Slack/管理画面のFit/Gap、正式連携仕様の確定。
2. 申込API・受付成功判定・回答再開URL・状態管理・通知・管理画面・診断起動条件の接続。
3. 重複送信・タイムアウト・受付不明時の扱い、認証・CSRF・スパム対策、サーバ側バリデーション。
4. プライバシーポリシーURL、同意文面・同意記録の確定。
5. 申込から回答完了までのPC/スマホE2E、アクセシビリティ、セキュリティ検証。
6. WordPress配下への配置・公開。既存API変更、DB migration、Production反映は別承認。

## Gitへの登録
想定する既存配布作業ディレクトリ: `C:\atlib\atlib-corporate-site-deploy`。既存Git履歴・docs・現在ブランチ・未追跡ファイルを先に確認すること。配布先パスは既存構成と開発レーンで確定し、他レーンの作業中ファイルを巻き込まずLP一式を登録する。push後にリポジトリURL・branch・commit SHA・配置パスを本資料に追記する。
