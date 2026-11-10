# atLIB Secure Guard External Block Page PoC 記録

実施日: 2026-10-17 (JST)  
対象コミット: `26119795adab3ea1db8ce3fc1046e9bb5c97ab8f` (`main`)

## 目的

DNSFilter の External Block Page として、atLIB 独自の日本語 HTML を公開し、遮断時に対象ドメインおよびカテゴリを表示できることを検証する。遮断解除フォームは本 PoC の対象外。

## 本番配置

- GCP project: `atlib-corporate-site`
- VM / zone: `corporate-site-wp` / `asia-northeast1-a`
- 公開ファイル: `/var/www/html/secure-guard/blocked/index.html`
- 公開 URL: `https://www.atlib.jp/secure-guard/blocked/`
- 配置ファイル SHA-256: `ecd06987cf395df2faeadc5847660c7df0d74ed755e434855f73346dbdc3eef8`

IAP 経由でログインユーザーのホームへ転送後、ハッシュ一致を確認してから新規ディレクトリへ配置した。WordPress 本体、既存 LP、Apache 設定は変更していない。DNSFilter の Hosted Block Page は切り戻し用として変更していない。

## 検証結果

| 項目 | 結果 | 根拠 |
| --- | --- | --- |
| GitHub main の原本確認 | PASS | `main` は `2611979`、配置ファイルの SHA-256 が VM 上のものと一致。 |
| IAP 経由の転送 | PASS | `gcloud compute scp` の転送先を `~/...` ではなく `/home/YoshihisaHagisaka/secure-guard-blocked-upload.html` とすることで成功。 |
| 本番ファイル配置 | PASS | `index.html` は `www-data:www-data`、`0644`。`blocked/` は `www-data:www-data`、`0755`。 |
| 公開 URL | PASS | HTTP 200、`Content-Type: text/html`、`Content-Length: 3634`。 |
| 共通ヘッダー | PASS | HSTS、`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy` を公開レスポンスで確認。 |
| HTTPS 証明書 | PASS | TLS 検証を有効にした HTTPS リクエストが成功し、証明書エラーなし。 |
| HTML パラメータ表示 | PASS | `?domain=example.test&categories=Phishing` で `example.test` と「フィッシングサイトの疑い」をブラウザ実行時に表示。 |
| DNSFilter External Block Page 設定 | 未検証 | DNSFilter 管理画面はログイン画面まで到達。認証済みセッションがないため保存操作は未実施。 |
| DNSFilter Phishing 実遮断 | 未検証 | External Block Page 設定後に、DNSFilter の公式 Phishing テストで確認する。 |

## 次の手順

1. DNSFilter 管理画面で External Block Page に `https://www.atlib.jp/secure-guard/blocked/` を設定する。
2. Hosted Block Page は維持したまま、対象ポリシーに反映されることを確認する。
3. DNSFilter の Phishing テストを実行し、日本語表示、遮断ドメイン、カテゴリの値を実機で確認する。
4. 実機結果をこの記録へ追記する。

