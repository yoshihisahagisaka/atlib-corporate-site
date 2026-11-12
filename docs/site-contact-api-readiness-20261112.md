# 新コーポレートサイト：問い合わせ受付API（2026-11-12）

## 目的と境界

- WordPress廃止に合わせ、新しい静的コーポレートサイトの `/contact/` から受ける問い合わせを、既存の Google Workspace SMTP実装でMLへ通知する。
- 新規 Gmail API/OAuth 実装は行わない。既存 `src/services/mailer.ts`、`src/config.ts`、GCP Secret Manager パターンを再利用する。
- 本変更は **コードおよびモックテストのみ**。GCPへのデプロイ、SMTP送信、DNS/LB/WordPressの変更は含まない。

## Git / Canonical の照合

| 資産 | 確認結果 |
| --- | --- |
| `atlib-corporate-site/src/services/mailer.ts` | Nodemailer、認証付きSMTP 587/STARTTLS、問い合わせML通知と `Reply-To` が実装済み |
| `atlib-corporate-site/src/config.ts` | `SMTP_*`、`corporate-site-smtp-password`、フォームHMAC秘密情報が既存 |
| `atlib-msp-customer-portal/src/services/mailer.ts` | 同系統の SMTP送信が既存 |
| `docs/atlib_site_delivery_runbook_20260929.md` | Cloud Run `corporate-site` は現行公式サイト配信元と断定できない。公開ソースは当時 GCE/Apache |
| 新しい非公開Site | フォームUIとTurnstileテストウィジェット、サーバー検証の試作コードはあるが送信停止中 |

## 今回追加

- `POST /api/contact`：既存Expressへ追加。旧 `/confirm.php`・`/send.php` と採用フォームは変更なし。
- `OPTIONS /api/contact`：許可済み HTTPS Origin のプリフライトのみ許可。
- JSON入力の必須項目、同意、メール形式、ハニーポット、上限サイズを検証。
- Turnstile Siteverify：成功・許可Hostname・`contact` Action の全条件をサーバーで確認。ネットワークエラーも拒否。
- 通知先は `contact@atlib.jp` **のみ**（ML）。メール本文の入力者アドレスを既存Mailerの `replyTo` に使用。
- 旧実装の `database@atlib.jp` 追加通知と顧客自動返信は、新フォームでは継承しない。
- 15分間に同一IPから5回までの既存 in-memory レート制限を設定。
- 未設定、異常なOrigin、Bot検証失敗、SMTP失敗はすべて fail closed。本文・メールアドレスをアプリログへ追加出力しない。

## 環境変数（既存パターンを継続）

| Key | 設定方法・注意 |
| --- | --- |
| `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_FROM` | 既存のCorporate Cloud Run設定を**読み取り専用で確認**し、そのまま活用 |
| `SMTP_PASSWORD` | 既存 `atlib-corporate-site/corporate-site-smtp-password` を Secret Manager から注入（実値をGitに記録しない） |
| `SITE_CONTACT_TURNSTILE_SECRET` | Turnstile本番Secretを別途 Secret Managerから注入。未設定ならAPIは503 |
| `SITE_CONTACT_ALLOWED_ORIGINS` | HTTPS Originの完全一致リスト。非公開サイト試験時と将来の `https://www.atlib.jp` を必要な時期だけ明示 |
| `SITE_CONTACT_TURNSTILE_HOSTNAMES` | Siteverifyが返すホスト名の完全一致リスト。ワイルドカード不可 |

旧フォームの `FORM_HMAC_SECRET` は現状どおり残す。新APIは確認画面・HMAC再送フローを必要としない。

## 検証

```text
npm ci --ignore-scripts
npm run test:contact-api

TypeScript build: PASS
site-contact-api.test.cjs + smoke-site-contact-email.test.cjs: 11 PASS / 0 FAIL
```

テストでのSMTPとSiteverifyはモック。実GCP/Google Workspaceへの送信は行っていない。

### 実SMTPメール1通の隔離検証（送信許可：2026-11-13）

ユーザーから `contact@atlib.jp`（Google Workspace ML）へのテスト送信許可あり。
現行Cloud Run `corporate-site` を変更せず、既存 `Mailer` と既存 Secret Manager の認証情報で**1通だけ**試すためのコマンドを追加。

`gcloud` で `atlib-corporate-site` に認証済みのWindows端末に、PR #58のブランチをクリーンにチェックアウトしてNode.js 20以降で以下を実行する：

```powershell
npm ci
npm run build
node scripts/smoke-site-contact-email.cjs --check
# --check でSMTP_USER / SMTP_FROM / ホスト / ML送信先を確認してから実送信
node scripts/smoke-site-contact-email.cjs --send
```

- `--check` はCloud Runの現在の環境設定を読み取るだけで、秘密情報にはアクセスせずメールも送らない。
- `--send` はSecret Manager内の既存SMTPパスワードをプロセス内でだけ使用し、宛先固定のテストを**1回**実行する。標準出力・Git・ファイルにはパスワードを出さない。
- 旧Cloud Runの `corporate-site-00005-fbg` 100%、`corporate-site-00006-xud` タグのみという構成は変更しない（2026-11-13再照合）。
- ログの `SMTP ACCEPTED` はSMTPサーバー受領を意味し、ML全員への配送保証ではない。受信側で件名、テスト照合ID、From、To、Reply-ToおよびML配信を確認する。
- この試験はSMTP単体検証であり、新APIやTurnstile、サイトフォームのE2EをPASSとするものではない。

## 実環境のSTOP条件

1. Cloud Runの **どのサービスとホスト名で新APIを公開するか** を現行GCP/LB設定と照合し、既存 `corporate-site` の無関係なRevision/トラフィックを変更しない。
2. 現行SMTPユーザー・送信者エイリアス・Secretの使用権限を読み取り専用で確認する（2026-09-29記録ではユーザー `yoshihisa.hagisaka@atlib.jp`、From `system@atlib.jp`）。
3. `contact@atlib.jp` MLの配送ポリシーと送信元を確認する。
4. Cloudflare Turnstileの対象Hostname・Secretを実環境に合わせる。非公開Siteのテストサイトキーを本番キーと混同しない。
5. 現行in-memory IPレート制限はCloud Runの複数インスタンス間で共有されない。Cloud Armor等の外側の制限、または共有ストアを使う必要性を本番スケールに合わせて判定する。
6. 静的Siteとの接続はAPI Origin・CORS・HTTPS・DNS/LB経路を確認してから有効化。サイトの送信ボタンは引き続き無効。
7. テスト用の送信先・送信者でE2Eを検証し、エラー応答、メールヘッダ（From/To/Reply-To）、二重送信、ML配送を確認する。
8. 既存WordPressフォームの切替と `www.atlib.jp` の公開は別承認とする。
