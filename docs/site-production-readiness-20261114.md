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
| セキュリティヘッダー | 2026-10-05 Apache共通Canonical | HSTS・nosniff・Referrer・Permissionsを新配信経路にも実装 | TLS/LB経由での実ヘッダー比較 |
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

`Content-Security-Policy`、`X-Frame-Options`、HSTS `preload` は**既存Canonicalどおり全サイト共通では未適用**。旧サイトにインラインJS/CSS、Google Tag、Clarity、CDN、Turnstile等の依存があるため、個別の埋め込み要件・外部origin・非違反ログ監視を棚卸しするまで強制しない。これは「セキュリティ設定完了」の誤表示ではなく、既存の非適用判断の継承。

アプリ固有対策は既存のものを保持：Turnstileのserver-side siteverify（hostname/action検証）、Origin完全一致、入力検証、honeypot、最小ログ、no-store、IP rate limit。Cloud Run複数インスタンス間でin-memory rate limitは共有されないため、Cloud Armorのedge rate limit等はProduction Gateで判定する。

## 本番公開前 Gate（未実施の操作はPASSとしない）

1. **配信経路・戻し先**：実DNS・HTTPS LB・証明書・Cloud Run service/Revision、現行Apache/WordPressの実接続を照合。`atlib.jp`、`www.atlib.jp`、両recruitホスト、LP・旧URLの一覧と戻し先を記録。現行VMとバックアップを残す。
2. **Production用設定**：Cloud Runに割当済の特定SA/Secret権限、Ingress/公開経路、コンテナ・最大インスタンス・concurrency、HTTPSリダイレクト、LB SSL/TLS、証明書有効期限を read-only で確認。StagingのSecretやテストTurnstileキーを使い回さない。
3. **メール・Turnstile**：正規Host `www.atlib.jp` のTurnstile Widget/Secret、`SITE_CONTACT_ALLOWED_ORIGINS=https://www.atlib.jp`、`SITE_CONTACT_TURNSTILE_HOSTNAMES=www.atlib.jp` を照合。送信SMTP envelope `system@atlib.jp` と表示名 `atLIB株式会社`、Production送信元IPのSMTP Relay許可、TLS、受信先ML、Reply-To、Gmail受信を合成1通で検証。レート制限/Cloud Armorを合わせて判定。
4. **セキュリティ・HTTP**：Hostの正規化、TLS/HSTS、上記ヘッダー、`/healthz`、フォームの失敗時403/503/502、`noindex` on run.app、`index` on public host、CORS、フォーム重複送信、静的キャッシュとブラウザ描画を確認。
5. **SEO・既存URL保全**：実Hostでcanonical、OGP、JSON-LD、robots、sitemap、`llms.txt`、構造化データの解析を確認。現行のLP/採用サイト/規約/画像と主要旧URLが404にならないこと、旧WordPressリンクを受入URLへリダイレクトできることを比較。Search Consoleへのサイトマップ送信は切替後。
6. **承認・ロールバック**：Staging/本番ホストでのPC・スマホ最終検証証跡、URL差分表、GCP設定差分、切替操作・想定停止時間・ロールバック操作を提示。**Go承認までDNS/LB/Traffic変更および公開モード有効化はしない。**

## 検証証跡（ローカル・外部送信なし）

- `npm run test:contact-api` → 25 PASS / 0 FAIL（TypeScript buildを含む）。
- 追加のHTTP起動テストは合成SMTP環境で `/`、`/contact/`、Stagingホスト、偽のforwarded Host、301、採用ホストを検証。外部Turnstile API・SMTP送信なし。
- 実GCP・実SMTP・Cloudflare・Search Console・公開DNSへの接続検証はここでは未実施。Production Go/No-Go判定に流用しない。
