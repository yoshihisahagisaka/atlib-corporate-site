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

## PR #60 Staging Origin allowlist fix at zero traffic (2026-11-15)

- Preflight matched GitHub Draft PR #60 and local HEAD
  `732697351128976e532fd1c9fc235445acc98ce1`. Staging revision
  `corporate-site-staging-00008-lok` remained at 100%, using image digest
  `sha256:6678a23e4ad306f7d58c73da5b4de7f105c2b1b767239eb29826dcda50ebe55e`.
- At approximately 2026-11-15 14:44:50 JST, a Google Cloud SDK YAML
  `--flags-file` was used with `gcloud run services update`, `--no-traffic`,
  and tag `pr60-originfix-20261115`. This avoided PowerShell 5.1 command-line
  dictionary parsing and changed only the two approved allowlist variables.
- New ready revision: `corporate-site-staging-00010-bib`. Tagged URL:
  `https://pr60-originfix-20261115---corporate-site-staging-y6htingfbq-an.a.run.app`.
  The Cloud Run revision sequence contains no `00009`; the prior rejected
  command did not create a revision.
- Read-back confirmed both old and current Staging service origins are present
  in `SITE_CONTACT_ALLOWED_ORIGINS`, and both corresponding hostnames are
  present in `SITE_CONTACT_TURNSTILE_HOSTNAMES`. Non-target environment
  variables, Secret references, runtime service account, IAM, ingress, min/max
  scaling, concurrency, and image digest are unchanged. `SITE_PUBLIC_MODE`
  remains absent.
- Traffic remains `corporate-site-staging-00008-lok=100%`; the new revision is
  tag-addressable at 0%. No promotion, form POST, Turnstile verification, or
  email transmission was performed.
- Tagged-URL GET checks returned HTTP 200 for `/healthz/`, the five new
  corporate pages, five representative existing LPs, `/robots.txt`,
  `/sitemap.xml`, and `/llms.txt`.
- The five new corporate pages retained CSP, `X-Frame-Options: SAMEORIGIN`,
  `X-Content-Type-Options: nosniff`, Referrer-Policy, Permissions-Policy,
  header and HTML noindex directives, canonical, and OGP metadata. Home-page
  JSON-LD remained present. The sitemap retained the five corporate URLs and
  other canonical URLs; robots and llms files retained the canonical origin.
- SHA-256 response-body hashes for `/business-web/`, `/recruit/`,
  `/infravision-partner/`, `/web-development-partner/`, and
  `/joshisu-kaizen/` matched the current 100% Staging revision. No severity
  ERROR entries were present for `corporate-site-staging-00010-bib` during the
  validation window.
- Production remained `corporate-site-00005-fbg=100%`, with the existing
  preview tag on `corporate-site-00006-xud`. Production, DNS, Cloudflare,
  Workspace, WordPress/Apache, IAM, and Secrets received zero changes.
- Remaining gate: separately approve Staging 100% promotion, then perform the
  canonical-service-URL browser and form E2E. The tagged URL is not an allowed
  form Origin and was intentionally not used for POST validation.

## PR #60 company-heading update at zero traffic (2026-11-15)

- Source commit: `321ba151dff43aa3e6c4fbf6201c672545bed04e`. The
  source worktree and Draft PR #60 HEAD matched before the build.
- Cloud Build `ddd4ff56-b74f-4c09-8717-79894d9c69a1`: SUCCESS. A unique,
  previously unused image tag `pr60-company-321ba15-20261115-01` was created
  for this source commit. Image digest:
  `sha256:b3079c34eafc62cab9ef9bbff15acd4f5982201f73f3573ccc9f5797fe70b59f`.
- New ready revision: `corporate-site-staging-00012-woj`, deployed with
  `--no-traffic --tag=pr60-company-20261115`. Tagged URL:
  `https://pr60-company-20261115---corporate-site-staging-y6htingfbq-an.a.run.app`.
- Traffic remained `corporate-site-staging-00010-bib=100%`; the new revision
  is tag-addressable at 0%. Environment variables, Secret references, runtime
  service account, IAM, ingress, min/max scaling, and concurrency matched the
  current Staging revision. `SITE_PUBLIC_MODE` remained absent.
- Tagged-URL GET checks returned HTTP 200 for `/healthz/`, the five new
  corporate pages, five representative existing LPs, `/robots.txt`,
  `/sitemap.xml`, and `/llms.txt`.
- The `/company/` response no longer contains `ABOUT atLIB`, the five numbered
  English section labels, or the `MISSION`, `VISION`, and `VALUES` labels. It
  retains `企業理念`, `目指す未来`, `5つの行動指針`, the Japanese headings and
  body copy, `Let It Be`, representative messages, business content, and
  company information.
- The five new corporate pages retained CSP, `X-Frame-Options: SAMEORIGIN`,
  `X-Content-Type-Options: nosniff`, Referrer-Policy, Permissions-Policy,
  header and HTML noindex directives, canonical, and OGP metadata. Home-page
  JSON-LD remained present. Robots, sitemap, and llms files retained their
  canonical references.
- Response-body SHA-256 hashes for `/business-web/`, `/recruit/`,
  `/infravision-partner/`, `/web-development-partner/`, and
  `/joshisu-kaizen/` matched the current 100% Staging revision. No severity
  ERROR entries were present for `corporate-site-staging-00012-woj` during the
  validation window.
- PC and smartphone visual validation was not performed because the browser
  access host was unavailable. This is recorded as unverified, not PASS. No
  form POST, Turnstile E2E, SMTP connection, or email transmission occurred.
- Production remained `corporate-site-00005-fbg=100%`, with the existing
  preview tag on `corporate-site-00006-xud`. Production, DNS, load balancer,
  Workspace, WordPress/Apache, IAM, and Secrets received zero changes.
- Remaining gate: separately approve promotion of revision `00012-woj` to
  Staging 100%, then complete browser acceptance on the canonical service URL.

## PR #60 company-heading revision promoted to Staging 100% (2026-11-15)

- Owner reported that the revised company page passed real-screen visual
  review. Before promotion, Git and Draft PR #60 HEAD matched evidence commit
  `8ef7fab59b4f86e17f70b755024769be871acb23`; the worktree was clean.
- Preflight confirmed `corporate-site-staging-00010-bib=100%` and revision
  `corporate-site-staging-00012-woj` at 0%, Ready, using image digest
  `sha256:b3079c34eafc62cab9ef9bbff15acd4f5982201f73f3573ccc9f5797fe70b59f`.
  Environment variables, runtime service account, IAM, ingress, min/max
  scaling, and concurrency matched the recorded configuration;
  `SITE_PUBLIC_MODE` remained absent.
- Staging traffic was changed once to
  `corporate-site-staging-00012-woj=100%`. Revision
  `corporate-site-staging-00010-bib` remains available at 0% as the designated
  rollback target. No revision was deleted and no new image was built.
- The canonical Staging service URL returned HTTP 200 for `/healthz/`, the five
  new corporate pages, five representative existing LPs, `/robots.txt`,
  `/sitemap.xml`, and `/llms.txt`.
- The canonical `/company/` response excludes the approved English eyebrow,
  numbered section labels, and `MISSION`, `VISION`, and `VALUES` labels. It
  retains `企業理念`, `目指す未来`, `5つの行動指針`, Japanese headings/body,
  `Let It Be`, representative messages, business content, and company
  information.
- The five new corporate pages retained CSP, `X-Frame-Options: SAMEORIGIN`,
  `X-Content-Type-Options: nosniff`, Referrer-Policy, Permissions-Policy,
  header and HTML noindex directives, canonical, and OGP metadata. Home-page
  JSON-LD remained present; robots, sitemap, and llms canonical references
  remained valid.
- Response-body SHA-256 hashes for `/business-web/`, `/recruit/`,
  `/infravision-partner/`, `/web-development-partner/`, and
  `/joshisu-kaizen/` matched rollback revision `00010-bib`. No severity ERROR
  entries were present for revision `00012-woj` during the validation window.
- No rollback was required. No form POST, Turnstile E2E, SMTP connection, or
  email transmission was performed.
- Production remained `corporate-site-00005-fbg=100%`, with the existing
  preview tag on `corporate-site-00006-xud`. Production, source, image, DNS,
  load balancer, environment variables, IAM, Secrets, Workspace, and
  WordPress/Apache received zero changes.

## Production final preflight (read-only, 2026-11-15)

### Decision

**NO-GO.** The accepted Staging revision is complete, but the public delivery
path, Production application configuration, TLS certificate, legacy-path
parity, and Production-host acceptance gates are not complete. This section
records read-only observations and a proposed release/rollback sequence; it
does not authorize or perform Production changes.

### Gate 1: Git and evidence

| Check | Result | Classification |
| --- | --- | --- |
| Draft PR #60 HEAD | `9d2466bcbf8f236d34adcf32c7a4c6a16dc258ce` before this evidence-only update | Fit |
| Worktree | Clean before this evidence-only update | Fit |
| Accepted source/image | Source `321ba151dff43aa3e6c4fbf6201c672545bed04e`; digest `sha256:b3079c34eafc62cab9ef9bbff15acd4f5982201f73f3573ccc9f5797fe70b59f` | Fit |
| Staging state | `corporate-site-staging-00012-woj=100%`; `00010-bib=0%` rollback | Fit |
| Staging gates | HTTP/security gate and Owner company-page visual acceptance recorded PASS | Fit |
| GitHub CI | PR reports no status checks. Local tests and Cloud Build evidence exist, but there is no independent GitHub required check | Gap: record an explicit waiver or add an approved required check before release |
| Production state | `corporate-site-00005-fbg=100%`; no Production change was made in this preflight | Fit / No-Go retained |

No separately named ADR, Decision Log, or Production Ledger file was found.
The operative decisions are embedded in this file, the delivery runbook,
contact API readiness document, Staging deployment evidence, GCP migration
report, and Git history. Creating a new governance format is not required for
this release.

### Gate 2: current public route

Authoritative DNS and live routing were read on 2026-11-15 JST.

- Authoritative name servers are `nse1.squarespacedns.com` through
  `nse4.squarespacedns.com`; therefore the observed authoritative DNS provider
  is Squarespace DNS. Domain acquisition through Google Workspace does not
  change that observation.
- `atlib.jp` has A `34.146.160.232`, no AAAA. `www.atlib.jp` is a CNAME to
  `atlib.jp`. `recruit.atlib.jp` has A `34.146.160.232`, no AAAA, and
  `www.recruit.atlib.jp` is a CNAME to `recruit.atlib.jp`. Observed TTL was
  3600 seconds.
- HTTP redirects to same-host HTTPS. HTTPS `atlib.jp` redirects to
  `https://www.atlib.jp/`.
- All four HTTPS hosts currently terminate on GCE VM `corporate-site-wp`
  (`asia-northeast1-a`, external static IP `34.146.160.232`) and Apache, not
  Cloud Run or the prepared GCP load-balancer assets.
- Apache read-back through IAP showed `/var/www/html` as the Production
  document root and a TLS vhost for `www.atlib.jp` with aliases `atlib.jp`,
  `recruit.atlib.jp`, and `www.recruit.atlib.jp`. The same document root also
  contains WordPress, LP, recruitment, policy, and image assets.
- The live Let's Encrypt certificate has subject `www.atlib.jp`, SANs for all
  four hosts, and observed validity 2026-10-22 through 2027-01-20 UTC.

| Host/path | Current delivery | Release target | Classification |
| --- | --- | --- | --- |
| `atlib.jp/*` | GCE/Apache; apex redirects to `www` | LB/Cloud Run, preserving apex redirect | Cutover target |
| `www.atlib.jp/`, `/company/`, `/services/`, `/works/`, `/contact/` | GCE/Apache/WordPress-static mix | LB/Cloud Run accepted image | Cutover target |
| Five LPs under `www.atlib.jp` | GCE/Apache files | Preserve from the accepted image only after parity decision below | Blocked |
| Policy/terms and public assets under `www.atlib.jp` | GCE/Apache files | Preserve/redirect by an approved inventory | Blocked: inventory incomplete |
| WordPress public URLs such as `/wp-json/`, `/feed/`, `/wp-login.php`, `/wp-admin/` | Current VM/WordPress; sampled live endpoints exist while the candidate returns 404 | Explicit redirect, 410, or retirement decision | Blocked |
| `recruit.atlib.jp/*`, `www.recruit.atlib.jp/*` | GCE/Apache; both hosts observed serving the same current content | Keep on the VM in the initial corporate cutover | Maintain |

The five representative LP comparisons previously recorded between Staging
revisions did not prove parity with the live VM. Direct live-to-accepted-image
response comparisons produced:

| Path | Live VM vs accepted candidate |
| --- | --- |
| `/infravision-partner/` | Exact SHA-256 match |
| `/web-development-partner/` | Exact SHA-256 match |
| `/business-web/` | Mismatch (live 19,032 bytes; candidate 49,625 bytes) |
| `/joshisu-kaizen/` | Mismatch (live 66,998 bytes; candidate 64,844 bytes) |
| `/recruit/` | Mismatch (live 14,295 bytes; candidate 13,242 bytes) |

Additional samples showed exact parity for `/privacy-policy/` and the
favicon, but differences for `/customer-harassment-policy/`, `/policy/`, and
`/thanks.html`. No conclusion is made about which version is correct. The
Owner must designate the source of truth or approve intentional differences,
and the complete public static-asset/old-URL inventory must be reconciled
before switching `www.atlib.jp`.

Prepared GCP assets are incomplete and are not the live route:

- Reserved global IP `corporate-site-ip` is `136.69.71.191` and unused.
- Backend service `corporate-site-bes` points to serverless NEG
  `corporate-site-neg`, which points to Cloud Run service `corporate-site`.
- There are no global or regional forwarding rules and no target HTTP/HTTPS
  proxies. The only URL map is an unserved HTTP-redirect map.
- Existing Compute managed certificates are not usable: the multi-domain
  certificate is `PROVISIONING_FAILED_PERMANENTLY`, with domains
  `FAILED_NOT_VISIBLE`; other certificate resources are similarly failed or
  provisioning. This is consistent with DNS still pointing to the VM rather
  than an LB forwarding-rule IP.
- Certificate Manager is not enabled and was not enabled by this preflight.

Google documents that Compute managed certificates require public A/AAAA
records to point to the load balancer and that `FAILED_NOT_VISIBLE` can result
when they do not. For a migration, Certificate Manager DNS authorization can
provision a certificate before the target proxy serves traffic. See:
https://cloud.google.com/load-balancing/docs/ssl-certificates/google-managed-certs
and https://cloud.google.com/certificate-manager/docs/domain-authorization.

### Gate 3: Production application configuration

Read-only Production state:

| Item | Observed Production | Required for this release | Classification |
| --- | --- | --- | --- |
| Revision/traffic | `corporate-site-00005-fbg=100%`; `00006-xud=0%` tagged preview | Accepted digest deployed as a new 0% revision first | Gap |
| Image | Old digests (`00005`: `sha256:9d3bd...`; `00006`: `sha256:3c9b2...`) | Accepted `sha256:b3079...` | Gap |
| Runtime service account | Default Compute SA | Dedicated least-privilege runtime SA with Secret access only as required | Blocker |
| IAM | `allUsers` has `roles/run.invoker` | Retain only the LB-compatible invocation model selected by the canonical design | Review required; no change made |
| Ingress | `internal-and-cloud-load-balancing` | Same | Fit |
| Scaling/concurrency | min 0, max 20, concurrency 80 | Owner-approved public limits; Staging values must not be copied implicitly | Decision blocker |
| Existing env | Legacy SMTP names plus HMAC; SMTP host is `smtp.gmail.com:587` | Current contact API production variables and relay settings | Gap |
| Secrets | Legacy SMTP password and HMAC references | Production Turnstile secret and required SMTP secret references, with values never exposed | Gap |
| `SITE_PUBLIC_MODE` | Absent | `public` only at the explicitly approved Production release gate | Expected pre-release gap |
| Allowed origins | Absent | `https://www.atlib.jp` (apex remains redirect-only) | Blocker |
| Turnstile hostnames | Absent | `www.atlib.jp`; dedicated Production widget/secret verified | Blocker |
| SMTP | Legacy authenticated Gmail configuration | `smtp-relay.gmail.com:587`, `system@atlib.jp`, display name `atLIB株式会社`, customer Reply-To; verify relay authorization | Blocker |
| Diagnostic logs | Absent | Explicit Production policy; never log body, addresses, credentials, tokens, raw SMTP response, or sensitive stack content | Decision required |

The Production service currently behaves as a prepared/legacy Cloud Run
backend, not the live website. No forwarding rule/proxy connects the prepared
NEG to the Internet and public DNS points to the VM. This observation does not
prove the service has no other historical use.

The implementation supplies per-instance in-memory rate limiting (five
requests per 15 minutes) and trusts one managed proxy hop. No Cloud Armor
security policy exists or is attached to `corporate-site-bes`. Cloud Armor is
recommended for an external application, but existing decisions do not make
its implementation an unconditional launch prerequisite. The release is
blocked until the Owner explicitly accepts the initial Turnstile plus
application-rate-limit posture and conservative scaling, or separately
approves a Cloud Armor policy. A later Cloud Armor implementation can then be
managed independently.

### Gate 4: SEO/AIO and security

Implementation review confirms the five new pages contain title,
description, canonical, OGP and Twitter metadata; the home page includes
Organization/WebSite JSON-LD; and canonical `robots.txt`, `sitemap.xml`, and
`llms.txt` are included. The sitemap lists the five corporate pages plus the
approved policy and LP URLs. `SITE_PUBLIC_MODE=public` combined with an exact
published host removes preview labels/noindex only on the five new pages;
`run.app` remains noindex. Apex redirect and recruitment-host routing are
implemented.

The application implements HSTS `max-age=31536000; includeSubDomains`
without preload, CSP and `X-Frame-Options` for the five corporate pages, and
global `nosniff`, Referrer-Policy, and Permissions-Policy. It deliberately
does not impose the new corporate CSP on existing LP or recruitment content.
This matches the established decision. Production-host response and browser
verification remains mandatory because release-mode output has not yet been
observed on the real host.

Current public DNS publishes DMARC `p=none` without `rua`. Existing evidence
records one authenticated Staging relay message with SPF, DKIM, and DMARC
PASS. DMARC enforcement and aggregate reporting are email-governance
improvements, not blockers for the website release under the existing
decision; manage them independently. A single approved Production synthetic
contact E2E, including Google Group delivery, inbox receipt, From/Reply-To and
SPF/DKIM/DMARC headers, remains a release acceptance gate.

### Final Fit/Gap and blockers

Completed gates:

- Accepted Staging revision, immutable image digest, HTTP/security gate, and
  Owner company-page visual acceptance.
- Contact API implementation, Turnstile server verification, relay method,
  safe SMTP diagnostics, and one prior Staging E2E are evidenced.
- Current DNS, VM/Apache, Cloud Run, serverless NEG/backend, certificate, and
  public-host routing have been read back without mutation.

Production blockers:

1. Resolve/approve every live-to-candidate LP, policy, legacy URL, and public
   asset difference; define redirects or 410 responses for retired WordPress
   URLs.
2. Complete and approve the external HTTPS LB design from the already
   reserved IP/backend/NEG: HTTPS URL map, target proxies, forwarding rules,
   and a certificate that is ACTIVE before DNS cutover.
3. Approve the certificate path. The lowest-risk proposal is Certificate
   Manager DNS authorization, which requires separately approved API/resource
   creation and Squarespace DNS authorization CNAME records. Do not depend on
   the currently failed Compute certificates.
4. Deploy the accepted digest as a new Production 0% revision with the
   approved service account, secrets, exact origins/hostnames, Production
   Turnstile widget, SMTP relay, scaling/concurrency, and release logging
   policy. Each is a separate change gate.
5. Record the GitHub-CI waiver or establish an approved required CI gate.
6. Decide the initial Cloud Armor/rate-limit posture explicitly.
7. Complete pre-cutover production-host testing through the LB, followed by
   browser/mobile, SEO/security, logs, and the single approved synthetic
   contact E2E. `SITE_PUBLIC_MODE=public` must not be set before that gate.

Independent follow-up items (not launch blockers under current decisions):

- DMARC enforcement policy and `rua` reporting.
- Cloud Armor implementation after an explicit initial-risk acceptance.
- WordPress/VM retirement, cleanup of failed certificates/orphaned resources,
  and any cost optimization only after a defined retention period.
- IaC adoption, HSTS preload, IPv6, and enhanced monitoring; none should be
  introduced implicitly during cutover.

### Proposed cutover and rollback runbook (not executed)

1. Freeze the approved source/digest. Resolve all blockers above and record
   Owner decisions. Back up the VM/WordPress state and retain the VM, its
   static IP, and the old Cloud Run revision.
2. In a separately approved maintenance change, optionally reduce relevant
   DNS TTL from 3600 to 300 at least one existing TTL in advance. Preserve
   recruitment DNS on `34.146.160.232`.
3. Provision the Production Turnstile widget/secret, dedicated runtime SA,
   exact environment, relay configuration, and accepted image as a new 0%
   revision. Read back an exact diff before routing any traffic.
4. Complete the external HTTPS LB on reserved IP `136.69.71.191`. Prefer a
   DNS-authorized, ACTIVE certificate so TLS can be validated before moving
   the public A record. Keep existing LP paths on the same Cloud Run backend
   only after the parity decision.
5. While public DNS still points to the VM, route the Production Cloud Run
   service to the accepted revision and test the LB with SNI/Host
   `www.atlib.jp` using an explicit client-side IP override (for example,
   `curl --resolve`) and an approved browser hosts override. Verify redirects,
   all corporate/legacy paths, assets, release-mode SEO, TLS, headers, logs,
   Turnstile, and one authorized synthetic form submission. The LB serverless
   NEG cannot infer application health by itself, so this application check is
   mandatory.
6. At the approved window, change only the corporate apex A record from
   `34.146.160.232` to `136.69.71.191`; `www` follows its existing apex CNAME.
   Do not change `recruit.atlib.jp` or `www.recruit.atlib.jp` in this release.
   Expected engineered outage is zero with an ACTIVE certificate and verified
   LB, but mixed old/new delivery can persist for the DNS TTL (currently up to
   approximately one hour). Announce this as propagation impact, not zero-risk.
7. Monitor LB 4xx/5xx and latency, Cloud Run errors/instances, Turnstile
   rejection rates, SMTP success/failure classification, Group/inbox delivery,
   TLS/certificate state, crawl/noindex/canonical output, and representative
   corporate/LP/recruitment paths.

Rollback triggers include TLS/certificate failure, widespread 5xx or broken
assets, missing legacy routes, CSP/JavaScript/Turnstile failure, contact mail
failure, unintended noindex/canonical output, or a material error-rate/latency
increase. Roll back by restoring the apex A record to `34.146.160.232`, then
confirming VM HTTPS and all retained paths. If the fault is revision-specific
and the LB path is otherwise sound, route Cloud Run back to the recorded old
revision. Do not delete either revision, LB resources, certificates, VM, or
static IP during the observation period. Verify authoritative DNS and multiple
resolvers, all four hosts, TLS, five corporate pages, retained LP/policy
routes, recruitment hosts, and logs after rollback.

### Final recommendation

Remain **NO-GO**. Staging acceptance is complete, but Production release must
not start until the seven blockers above have explicit evidence and approval.
No Production, DNS, LB, Apache/WordPress, IAM/Secret, Workspace, Cloudflare,
form, SMTP, or merge operation was performed by this preflight.
