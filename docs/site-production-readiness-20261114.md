# atLIB Corporate Site | Production公開準備（2026-11-14）

## 状態・変更許可境界

- **Production切替: NO-GO（未承認）**。本書と本PRはソースの公開準備のみ。
- 起点: Staging受入ソース `188f0586a55d03b7a9998a4bb1a337fb6095909c`（PR #59）。フォーム改修・レイアウト・送信者表示名の既存判断は再設計しない。
- 現行本番の配信経路については `docs/atlib_site_delivery_runbook_20260929.md` をCanonicalとし、Cloud Run `corporate-site` の存在をもって `www.atlib.jp` の実配信先とは断定しない。
- DNS、HTTPS LB、Cloud Run Revision/トラフィック、GCE/WordPress/Apache、Google Workspace、IAM、Secretは本PRでは変更しない。実顧客データ・実メール送信なし。

## Fit/Gapと今回の実装

| 領域 | 既存の証跡・原則 | 今回の公開候補 | 残るGate |
| --- | --- | --- | --- |
| PC/スマホUI | `corporate-site-staging-00007-g7h`、利用者スクショ受入済み | 既存CSS・フォームUIを維持 | 公開FQDNで再スモーク |
| 問い合わせ | SMTP Relay受信トレイ到達、From表示名のオフライン検証 | 既存API/SMTP/Turnstileを維持 | 実FQDN・本番Turnstile・SMTP egressで合成E2E |
| SEO | 5ページがプレビュー `noindex`、sitemap未収録 | canonical、OGP、Twitterカード、sitemap追加 | 本番HTTPのロボットヘッダー/HTML実測、Search Console |
| AIO | 既存robotsでAI系クローラーを明示許可 | Organization/WebSite JSON-LD、公式URLに基づく `llms.txt` | 実際のクローリング/検索反映は保証できず、公開後観測 |
| セキュリティヘッダー | 2026-10-05 Apache共通Canonical | HSTS・nosniff・Referrer・Permissionsを新配信経路にも実装。新5ページには専用CSP・frame-ancestors・X-Frame-Optionsを追加 | TLS/LB経由の実ヘッダー、Staging PC/モバイルのCSP回帰 |
| Staging分離 | NODE_ENV=productionでもnoindex | `SITE_PUBLIC_MODE=public` かつ正規Host一致のみ公開解除。既定はnoindex | LBがHostを正しく維持することを公開前検証 |
| 既存サイト | Apacheに採用サイト・LP・規約ページ | `recruit.atlib.jp` のホスト振分け、LPを変更せず保持 | 全URLインベントリと実HTTP差分 |

### 公開モードとレスポンスの契約

- `SITE_PUBLIC_MODE` は**明示的に `public` と設定した場合のみ**有効。未設定・その他値はすべてプレビュー扱い。`NODE_ENV` では判定しない。
- 加えて、`req.hostname` と生の `Host` ヘッダーの両方が `www.atlib.jp`、`atlib.jp`、`recruit.atlib.jp`、`www.recruit.atlib.jp` のいずれかに正確に一致すること。偽の `X-Forwarded-Host` だけでは解除しない。
- それ以外のURL（Staging、run.app、未知のドメイン）は、公開モードの値に関係なく `X-Robots-Tag: noindex, nofollow`。新5ページのプレビュー表示・HTML `noindex` も残す。
- 公開状態では新5ページのみプレビュー告知・`noindex` を応答時に取り除く。ソースのHTMLは非公開のままで、Staging表示を維持できる。フォームのサイトキーは従来通り応答時注入。
- `/index.html`、`/company/index.html` 等の新5ページの直指定、および末尾 `/` なしURLは公開時に正規URLへ301。既存の旧LPは変更しない。
- `atlib.jp` から `www.atlib.jp` への301は既存のルールを継続。`/recruit/` は採用サイト用に従来通り振分け。
- 本番切替後の `SITE_PUBLIC_MODE=public` 設定は配信設定変更に相当するため、**別途明示的なGo承認が必要**。

### SEO/AIOの範囲

- 新5ページ: `/`、`/company/`、`/services/`、`/works/`、`/contact/`。HTMLに固有title/description（既存）、canonical、OGP、Twitterカードを配置。`og:image` は既存の公開候補画像を参照。
- ホームにOrganizationとWebSiteのSchema.org JSON-LD（`@id`は既存のBusiness Webと一致）。会社住所等は既存掲載事実だけを使用。口コミ評価・FAQ・検索結果順位など事実未確認のマークアップは追加しない。
- sitemapへ5ページ、プライバシーポリシー、カスタマーハラスメント方針、Business Webを加え、既存LPは保持。旧 `/policy/` はアクセスを維持し、正規の `/privacy-policy/` へcanonicalを示す。廃止リダイレクトは未実施。
- `robots.txt` の既存クローラー許可とSitemap指定を維持。`llms.txt` は補足的な公式サイト案内で、AI検索での掲載・引用を保証するものではない。
- `public/business-web/self-check/` の個別 `noindex` は保持。旧デザイン案 `/it-management-kaizen/` はsitemapに追加しない。

### セキュリティ: 確定と保留

共通Canonical（`docs/atlib_site_delivery_runbook_20260929.md` §2026-10-05）に従い、Cloud Run配信経路では以下を維持する。

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains  # 正規Hostのみ
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

`Content-Security-Policy`、`X-Frame-Options`、HSTS `preload` は**既存Canonicalどおり全サイト共通では未適用**。旧サイトにインラインJS/CSS、Google Tag、Clarity、CDN、Turnstile等の依存があるため、旧LP・採用サイトへは波及させない。

ただし、2026-11-10のatLIB Webセキュリティ診断でCSPと画面埋め込み制御が「追加確認推奨」となったため、**新コーポレート5ページのHTMLレスポンスだけ**に以下を実装した。

- CSP: `default-src 'self'`、`base-uri 'self'`、`object-src 'none'`、`form-action 'self'`、実使用ソースに限定した`script-src`/`style-src`/`font-src`/`img-src`/`connect-src`/`frame-src`。実行可能な`unsafe-inline`/`unsafe-eval`は許可しない。
- 許可外部依存: `ajax.googleapis.com`（jQuery）、`cdnjs.cloudflare.com`（jquery.inview・Font Awesome）、`fonts.googleapis.com`/`fonts.gstatic.com`（フォント）、`challenges.cloudflare.com`（Turnstile）。Turnstileの`script-src`と`frame-src`はCloudflare公式CSP案内に従う。
- 画面埋め込み制御: `frame-ancestors 'self'`（CSP）と`X-Frame-Options: SAMEORIGIN`。これらは新5ページにのみ応答時付与する。
- **未実施**: 実StagingでのTurnstile表示・送信、フォント、スライダー、スマホメニューのブラウザ回帰。ローカルHTTP検証だけではCSP実運用のGoとはしない。

### Webセキュリティ診断との残差（2026-11-10診断）

| 指摘 | 今回の対処 | Go判定 |
| --- | --- | --- |
| CSP | 新5ページのみ実装、旧LP/採用サイトは既存Canonicalどおり未変更 | Stagingブラウザ受入待ち、サイト全体は未解消 |
| 画面埋め込み | 新5ページへframe-ancestorsとX-Frame-Options | Stagingブラウザ受入待ち、旧ページは別途評価 |
| DMARC | 2026-11-14の利用者PowerShell実測で`v=DMARC1; p=none`。`rua`なし。GWS管理画面でDKIM認証中、SMTPリレールール3件有効を確認 | **未対応**。集計先、送信者の整合、段階的なenforcementは未決定 |

DMARCはWebアプリではなくatlib.jpの公開DNS/メール認証の責務。受信側の隔離・拒否を安易に有効化すると正規送信が失敗するため、Google Workspace管理画面のDKIM状態、現在利用中のSMTP Relay条件、全正規送信システムのSPF/DKIMアラインメントとDMARCレポート集計先を確認してから、`none` → `quarantine` → `reject` の段階移行を別承認で決定する。DNS・Workspaceの更新は本PRでは実施しない。

**2026-11-14 利用者提供のread-only証跡（設定変更なし）**

- TXT `atlib.jp`: `v=spf1 include:_spf.google.com include:spf.bmv.jp ~all`
- TXT `_dmarc.atlib.jp`: `v=DMARC1; p=none`（集計レポートを受け取る`rua`なし）
- GWS DKIM: `atlib.jp`、ステータス「DKIMでメールを認証しています」。
- GWS SMTP Relay: 「コーポレートサイト LPのフォームからの送信」「Lobelia 企業価値診断メール」「atLIB Corporate Site - Cloud Run」の3ルールが有効。ただし許可IP/認証/TLS詳細はこの一覧だけでは未確認。
- SPFに許可されている`spf.bmv.jp`の実送信用途・正規性、これら3ルールと実際の送信元のSPF/DKIM alignment、送信先でのAuthentication-Resultsは未確認。
- 次の人手確認: 3ルールの詳細（送信者制約、許可IP、TLS・SMTP認証）、実送信した3経路のGmail「メッセージのソースを表示」、DMARC集計先アドレスまたはレポート管理ツールの選定。**実メールの宛先と本文・個人情報、Secretは証跡として共有しない**。

アプリ固有対策は既存のものを保持：Turnstileのserver-side siteverify（hostname/action検証）、Origin完全一致、入力検証、honeypot、最小ログ、no-store、IP rate limit。Cloud Run複数インスタンス間でin-memory rate limitは共有されないため、Cloud Armorのedge rate limit等はProduction Gateで判定する。

## 本番公開前 Gate（未実施の操作はPASSとしない）

1. **配信経路・戻し先**：実DNS・HTTPS LB・証明書・Cloud Run service/Revision、現行Apache/WordPressの実接続を照合。`atlib.jp`、`www.atlib.jp`、両recruitホスト、LP・旧URLの一覧と戻し先を記録。現行VMとバックアップを残す。
2. **Production用設定**：Cloud Runに割当済の特定SA/Secret権限、Ingress/公開経路、コンテナ・最大インスタンス・concurrency、HTTPSリダイレクト、LB SSL/TLS、証明書有効期限を read-only で確認。StagingのSecretやテストTurnstileキーを使い回さない。
3. **メール・Turnstile**：正規Host `www.atlib.jp` のTurnstile Widget/Secret、`SITE_CONTACT_ALLOWED_ORIGINS=https://www.atlib.jp`、`SITE_CONTACT_TURNSTILE_HOSTNAMES=www.atlib.jp` を照合。送信SMTP envelope `system@atlib.jp` と表示名 `atLIB株式会社`、Production送信元IPのSMTP Relay許可、TLS、受信先ML、Reply-To、Gmail受信を合成1通で検証。レート制限/Cloud Armorを合わせて判定。
4. **セキュリティ・HTTP**：Hostの正規化、TLS/HSTS、上記ヘッダー、**新5ページのCSPとframe-ancestors、X-Frame-Optionsの実配信**、`/healthz`、フォームの失敗時403/503/502、`noindex` on run.app、`index` on public host、CORS、フォーム重複送信、静的キャッシュとブラウザ描画を確認。CSPコンソール違反、外部フォント、スライダー、スマホメニュー、Turnstile成功・送信フローを含める。
5. **SEO・既存URL保全**：実Hostでcanonical、OGP、JSON-LD、robots、sitemap、`llms.txt`、構造化データの解析を確認。現行のLP/採用サイト/規約/画像と主要旧URLが404にならないこと、旧WordPressリンクを受入URLへリダイレクトできることを比較。Search Consoleへのサイトマップ送信は切替後。
6. **承認・ロールバック**：Staging/本番ホストでのPC・スマホ最終検証証跡、URL差分表、GCP設定差分、切替操作・想定停止時間・ロールバック操作を提示。**Go承認までDNS/LB/Traffic変更および公開モード有効化はしない。**

## 検証証跡（ローカル・外部送信なし）

- `npm run test:contact-api` → 26 PASS / 0 FAIL（TypeScript buildを含む）。
- 追加のHTTP起動テストは合成SMTP環境で `/`、`/contact/`、Stagingホスト、偽のforwarded Host、301、採用ホストを検証。外部Turnstile API・SMTP送信なし。
- 実GCP・実SMTP・Cloudflare・Search Console・公開DNSへの接続検証はここでは未実施。Production Go/No-Go判定に流用しない。
