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

**同日追補：問い合わせ通知1通のGmail原本認証（read-only）**

- 利用者が提示した2026-11-14 00:53 JST受信済みメールの原本ヘッダーを確認。`system@atlib.jp` をenvelope/FromとしてGoogle SMTP Relayから送信され、Googleグループ経由で転送された経路である。
- 元の認証結果は **SPF PASS、DKIM PASS（`d=atlib.jp`、selector `google`）、DMARC PASS（header.from=`atlib.jp`）**。Googleグループ転送後の最終受信側でもPASSを確認。Relay受け入れの経路ではTLS 1.3使用。
- これで**当該1経路・当該1通**のalignmentと到達が確認できたが、SMTP Relay残りの送信経路、`spf.bmv.jp`の用途およびProduction新配信元の認証は未検証。既存DMARC `p=none` の強制力は上がらない。
- 当該メールの表示名は旧表示（アドレスのみ）。`atLIB株式会社`という新表示名の本当のメールでの確認は、後続のStagingデプロイ後に合成メッセージ1通を承認の上で送信して行う。原本のMessage-ID・受信先・本文・生ヘッダーはGitに記録しない。

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

## 次回Staging検証順序（PR #60 HEADの適用）

1. GitHub Draft PR #60の最新HEAD、現Staging Revision/100%配分、コンテナImage、環境変数の**キーとSecret参照先のみ**、SA、min/max/concurrency、Ingressをread-only確認する。環境変数値やSecret内容は証跡に貼らない。
2. PR #60 HEADの独立ImageをCloud Buildで作成する。既存Imageタグを上書きしない。Staging `corporate-site-staging`だけに新Revisionを**0%トラフィックのタグ付き**でデプロイし、現100%Revisionを維持する。`SITE_PUBLIC_MODE=public`をセットしない。
3. タグ付きURLで`/healthz/`、新5ページと代表旧LP・採用URLのHTTP/SEO/セキュリティヘッダー・`noindex`・プレビュー表示を確認する。ただしタグURLはTurnstile/Origin許可ホストと異なるため、フォームE2EのPASS判定には使わない。
4. HTTP GateがPASSしてから、既存Revisionを戻し先として記録したうえでStagingのみ新Revisionを100%へ切替。PC/スマホの画面、横スクロール、メニュー、スライダー、Web Font、CSPコンソール違反、Turnstileを正規Staging URLで確認する。
5. 明示的に合成メール1通の送信を許可された場合だけフォームE2Eを実施し、表示名、envelope、Reply-To、Googleグループ配送、SPF/DKIM/DMARCを確認。失敗時は自動再試行しない。Gate失敗時はStagingのトラフィックを記録済み旧Revisionへ戻し、原因と証跡を記録する。
6. Production切替・DNS・Workspace・既存WordPress・Secret/IAM変更は引き続きNO-GO。Staging PASS後に別途Production実配信経路・全旧URL保全・rollback・DMARC集計先のGo/No-Goを提示する。

## PR #60 zero-traffic Staging validation (2026-11-14)

- Canonical PR HEAD: `8c82af40354be3d05b65255603c70342cb107269`.
  Validation used the independent worktree
  `C:\atlib\worktree-site-pr60-20261114`; the existing PR #59 Staging
  worktree was not modified.
- `npm ci`, TypeScript build, and `npm run test:contact-api`: 26 PASS / 0
  FAIL. No external mail or form submission was performed.
- Pre-deployment Staging configuration: ingress `all`, min scale `0`, max
  scale `2`, concurrency `10`, runtime service account
  `corporate-site-staging@atlib-corporate-site.iam.gserviceaccount.com`.
  Environment variable names and the three existing Secret Manager references
  were recorded without reading secret values or SMTP credential values.
  `SITE_PUBLIC_MODE` was absent and remains unset.
- Cloud Build `1eda9cca-d5a0-42ef-93c9-bbc96337d380`: SUCCESS. Unique image
  tag `pr60-8c82af-20261114-01`; digest
  `sha256:6678a23e4ad306f7d58c73da5b4de7f105c2b1b767239eb29826dcda50ebe55e`.
- New revision `corporate-site-staging-00008-lok` was deployed with
  `--no-traffic --tag=pr60-8c82af`. Tagged URL:
  `https://pr60-8c82af---corporate-site-staging-y6htingfbq-an.a.run.app`.
- Traffic after deployment: existing revision
  `corporate-site-staging-00007-g7h` remains 100%; new revision
  `corporate-site-staging-00008-lok` is tag-addressable at 0%.
- Post-deployment configuration comparison found no change to ingress,
  scaling, concurrency, runtime service account, environment-variable names,
  or Secret references. The template image is the only intended change.
- Tagged-URL HTTP checks returned 200 for `/healthz/`, `/`, `/company/`,
  `/services/`, `/works/`, `/contact/`, `/robots.txt`, `/sitemap.xml`, and
  `/llms.txt`.
- The five corporate HTML responses include the restrictive CSP without
  `unsafe-inline` or `unsafe-eval`, `X-Frame-Options: SAMEORIGIN`,
  `X-Content-Type-Options: nosniff`, the canonical Referrer/Permissions
  policies, `X-Robots-Tag: noindex, nofollow`, and HTML
  `<meta name="robots" content="noindex,nofollow">`. Canonical and OGP values
  point to `https://www.atlib.jp`; the home Organization/WebSite JSON-LD parsed
  successfully. HSTS is intentionally absent on the tagged `run.app` host and
  remains gated to approved public hosts.
- `robots.txt` references the canonical sitemap; `sitemap.xml` contains all
  five corporate URLs; `llms.txt` references the canonical public origin.
- Representative existing paths `/business-web/`, `/recruit/`,
  `/infravision-partner/`, `/web-development-partner/`, and
  `/joshisu-kaizen/` returned 200 and their response-body SHA-256 hashes matched
  the current 100% Staging revision.
- No ERROR log entries were present for the new revision at validation time.
  Production `corporate-site`, DNS, Workspace, WordPress/Apache, IAM, Secrets,
  and existing revisions were not changed.

## PR #60 Staging 100% promotion and acceptance (2026-11-14)

- Pre-switch checks passed: `corporate-site-staging-00007-g7h` served 100%,
  `corporate-site-staging-00008-lok` served 0%, and the new revision image
  digest matched
  `sha256:6678a23e4ad306f7d58c73da5b4de7f105c2b1b767239eb29826dcda50ebe55e`.
  Ingress, runtime service account, min/max scaling, concurrency,
  environment-variable names, and Secret references matched the recorded
  Staging configuration. `SITE_PUBLIC_MODE` remained absent.
- Staging traffic was changed once to
  `corporate-site-staging-00008-lok=100`. Post-switch inspection confirmed the
  new revision at 100% and the old revision at 0%. No revision was deleted.
- The canonical Staging service URL returned HTTP 200 for `/healthz/`, `/`,
  `/company/`, `/services/`, `/works/`, `/contact/`, `/business-web/`,
  `/recruit/`, `/infravision-partner/`, `/web-development-partner/`, and
  `/joshisu-kaizen/`.
- The five new corporate pages retained CSP, `X-Frame-Options: SAMEORIGIN`,
  `X-Robots-Tag: noindex, nofollow`, the HTML noindex directive, canonical,
  and OGP metadata. The home page retained Organization/WebSite JSON-LD.
  Existing LPs remained reachable and retained their existing header scope;
  CSP and X-Frame-Options were not newly applied to those legacy paths.
- No severity ERROR entries were found for
  `corporate-site-staging-00008-lok` during the post-switch validation window.
- Real-browser acceptance could not be started because the browser access
  host was unavailable. Therefore desktop 1366 px, mobile 390/375 px, visual
  layout, hamburger menu, slider, web fonts, images, horizontal overflow,
  browser-console CSP/JavaScript diagnostics, form field interaction, and
  Turnstile display/success are **not verified** and are not recorded as PASS.
  No form POST, CAPTCHA solve, or email transmission was performed.
- No rollback was performed: HTTP/security checks showed no major regression,
  while browser-only checks remain an explicit acceptance gap. Staging remains
  on `corporate-site-staging-00008-lok` at 100% pending browser acceptance.
- Production `corporate-site` remained unchanged at
  `corporate-site-00005-fbg=100%`, with the existing preview tag on
  `corporate-site-00006-xud`. Production, DNS, Workspace, WordPress/Apache,
  IAM, Secrets, service account, and scaling configuration received zero
  changes.
