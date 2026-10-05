# atLIB Web配信・リリース運用 Runbook

更新: 2026-09-29。2026-09-29の実測を現行構成の根拠とする。過去の `docs/GCP移管_対応レポート.md` は移管時の履歴であり、現在の公開経路の証明として使わない。

## 最初に読む：公開配信元

- `https://recruit.atlib.jp/` と `https://www.atlib.jp/recruit/` は、確認時点で Apache/2.4.68 (Debian) から同じHTML（変更前 Content-Length 12950、ETag一致）を配信。`https://atlib.jp/recruit/` は `https://www.atlib.jp/recruit/` へ301。
- GCP project: `atlib-corporate-site`、VM: `corporate-site-wp`、zone: `asia-northeast1-a`（2026-09-29 RUNNING）。`msp-zabbix/msp-frontend-server` は**別プロジェクト**であり接続しない。
- `sudo apache2ctl -S` 実測：本番SSL vhost `/etc/apache2/sites-enabled/production-le-ssl.conf`、`ServerName www.atlib.jp`、`ServerAlias atlib.jp recruit.atlib.jp www.recruit.atlib.jp`、`DocumentRoot /var/www/html`。`wp-test.atlib.jp` は別vhost `000-default-le-ssl.conf`。
- 採用HTML実体: `/var/www/html/recruit/index.html`。2026-09-29のnote反映後、`find` で **14295 bytes** を確認。画像: `/var/www/html/recruit/images/workstyle/atlib_note_banner_final.png`。WP File Manager上では `html/recruit/`。
- 管理バーに「WordPress staging」と表示されても、その表示だけで配信先を判定しない。今回WP File Managerでアップロードした画像が本番公開URLに表示され、SSHで本番HTML更新を確認した。ラベルの由来は未確認。
- Cloud Run `corporate-site` は存在するが、**今回の採用公開サイト更新先ではない**。各LPの配信元は個別確認する。

## 2026-09-29 noteバナー反映実績

ローカル原本 `C:\atlib\atlib-corporate-site-deploy\public\recruit\index.html` と `public\recruit\images\workstyle\atlib_note_banner_final.png` の2ファイルを、WP File Managerから画像先行→公開画像URL確認→HTML上書きの順に反映。公開採用ページでバナー表示を確認。リンク先 `https://note.com/atlib`。他LP・WordPress本体は変更しない。

## 標準：IAP SSH接続（実行成功）

Windows PowerShell:

```powershell
gcloud.cmd compute ssh corporate-site-wp `
  --project=atlib-corporate-site `
  --zone=asia-northeast1-a `
  --tunnel-through-iap
```

実測 `hostname=corporate-site-wp`、ログインユーザー `YoshihisaHagisaka`、ホーム `/home/YoshihisaHagisaka`。IAPなし直接SSHの可否は未検証。IAP SSHは管理者の接続経路であり、一般公開WebサイトにIAP認証を要求する意味ではない。

VM内での読み取り専用確認:

```bash
hostname; whoami; pwd
sudo apache2ctl -S
sudo grep -R -n -E 'DocumentRoot|ServerName|ServerAlias' /etc/apache2/sites-enabled/
sudo find /var/www -type f -path '*/recruit/index.html' -printf '%p %s bytes\n'
stat /var/www/html/recruit/index.html
stat /var/www/html/recruit/images/workstyle
```

## IAP SCP転送（コマンド準備済み、転送自体は未検証）

**別のPowerShell**で実行。公開領域へ直接上書きせず、まずSSHユーザーのホームへ転送。以下のローカルパスは今回のリリース専用コピーなので次回は対象ファイルに置き換える。

```powershell
gcloud.cmd compute scp `
  "C:\atlib\recruit-note-release\public\recruit\index.html" `
  "corporate-site-wp:~/index_upload.html" `
  --project=atlib-corporate-site `
  --zone=asia-northeast1-a `
  --tunnel-through-iap

gcloud.cmd compute scp `
  "C:\atlib\recruit-note-release\public\recruit\images\workstyle\atlib_note_banner_final.png" `
  "corporate-site-wp:~/atlib_note_banner_final.png" `
  --project=atlib-corporate-site `
  --zone=asia-northeast1-a `
  --tunnel-through-iap
```

転送後にサイズ・ハッシュ・内容・所有者/権限を確認。既存HTMLを日時付きバックアップしてから、画像→公開URLで画像検証→HTMLの順で配置。既存の所有者/権限を不用意に変えない。静的ファイル更新では通常Apache再起動不要。異常時はバックアップを戻し公開URLで復旧確認。**SCPの実転送・本番配置コマンドは未検証なので、初回はテストファイルで確認してから確定する。**

## 毎回の配信先確認・公開検証

```powershell
curl.exe -I https://recruit.atlib.jp/
curl.exe -I https://www.atlib.jp/recruit/
curl.exe -I https://www.atlib.jp/recruit/index.html
```

HTTP status、Server、ETag、Last-Modified、Locationを記録。Serverヘッダーだけで全インフラを断定しない。管理画面・実ファイル・公開URLを突合。公開後は画像GET、HTMLのリンク、PC/モバイル表示、必要ならフォームを確認する。無関係なローカル未コミットファイルを一括commit/deployしない。

## Cloud Runの今回の保留状態

旧Revision `corporate-site-00005-fbg` が100%トラフィック。noteバナー2ファイルを旧イメージにCOPYした `corporate-site:recruit-note-20260929` のCloud BuildはSUCCESS。新Revision `corporate-site-00006-xud` は `--no-traffic --tag=recruit-note-preview`、Ready=True、0%。タグURLの `/recruit/` は404、Host上書き試験もGoogle側404。**採用サイト反映のためにCloud Runのトラフィックを切り替えない。** 用途と影響を調査するまでタグ・Revisionを削除しない。

## 未確定

WP管理バーのstaging表記の由来、各LPごとの配信元、Cloud Runの現在の役割、SCP実転送、Git mainと手動反映したHTML/画像の同期。これらを確認済みとして扱わない。


---

## 2026-10-05 Corporate Web 共通セキュリティ Canonical

### 適用範囲

本項は `corporate-site-wp` の本番 Apache HTTPS VirtualHost を利用する Corporate Web の共通セキュリティ設定を記録する。

対象環境:

- GCP project: `atlib-corporate-site`
- VM: `corporate-site-wp`
- zone: `asia-northeast1-a`
- Apache config: `/etc/apache2/sites-available/production-le-ssl.conf`
- ServerName: `www.atlib.jp`
- ServerAlias: `atlib.jp`, `recruit.atlib.jp`, `www.recruit.atlib.jp`
- DocumentRoot: `/var/www/html`

同一 HTTPS vhost / DocumentRoot 配下へ配置される静的LPは、HTML個別実装ではなくApacheの共通レスポンスヘッダーを継承する。

SEO / AIO（canonical、OGP、JSON-LD、meta等）は各LPのコード側で管理する。API、CORS、認証、rate limit、入力検証等は各アプリケーション側の責務とする。

### 本番適用済み HTTP Security Headers

2026-10-05時点で以下を本番適用し、公開レスポンスで確認済み。

```apache
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
```

Apache `headers_module` も有効化済み。

適用時に以下を確認した。

```bash
sudo apache2ctl configtest
sudo systemctl reload apache2
systemctl is-active apache2
sudo apache2ctl -M | grep headers
```

実測結果:

- Apache config: `Syntax OK`
- Apache: `active`
- `headers_module (shared)`

### HSTS導入前のHTTPS確認

`includeSubDomains` 適用前に、把握している現存ホストについてHTTPS/TLSを実測した。

確認対象:

- `atlib.jp`
- `www.atlib.jp`
- `recruit.atlib.jp`
- `www.recruit.atlib.jp`
- `wp-test.atlib.jp`
- `apps-dev.atlib.jp`
- `apps-first.atlib.jp`
- `cashflow.atlib.jp`
- `ppap-upload.atlib.jp`
- `topology.zabbix.atlib.jp`
- `zabbix-admin.atlib.jp`
- `files.atlib.jp`
- `portal.atlib.jp`
- `sales.atlib.jp`

全対象でHTTPS接続が成立し、curl `ssl_verify_result=0` を確認した。HTTP statusは用途により200 / 301 / 302 / 401 / 403 / 404を含むが、TLS検証はいずれも正常だった。

HSTS `preload` は現時点では採用しない。

### `zabbix.atlib.jp` の整理

旧 `zabbix.atlib.jp` はSquarespace DNSのAレコードでZabbix VMの外部IP `34.85.69.73` を直接参照していた。

一方、現行FirewallではVMの80/443はGoogle Load Balancer系レンジからのみ許可されており、一般インターネットからのHTTP/HTTPSはtimeoutする構成だった。

現行Zabbix管理経路は以下。

`zabbix-admin.atlib.jp` → HTTPS Load Balancer → IAP → `zabbix-admin-bes` → `zabbix-server`

`msp-iap-urlmap` に `zabbix-admin.atlib.jp` は存在するが、`zabbix.atlib.jp` は存在しないことを確認した。

このためVMの80/443を再公開せず、不要となっていたSquarespace DNSの以下のレコードを2026-10-05に削除した。

```text
Type: A
Host: zabbix
Data: 34.85.69.73
```

削除後、`Resolve-DnsName zabbix.atlib.jp -Type A` でAレコードが返らないことを確認した。

`zabbix-admin.atlib.jp` および `topology.zabbix.atlib.jp` は削除対象ではない。

### 公開レスポンス検証

以下で共通ヘッダーの本番配信を確認済み。

- `https://www.atlib.jp/`
- `https://www.atlib.jp/infravision-partner/`
- `https://www.atlib.jp/web-development-partner/`

3ページすべてでHTTP 200と以下を確認した。

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

また `atlib.jp`、`www.atlib.jp`、`recruit.atlib.jp`、`www.recruit.atlib.jp` でもHSTSヘッダーの配信を確認済み。

### Business Web / 今後のLP

Business Webを同じ `www.atlib.jp` のApache HTTPS vhost / `/var/www/html` 配下へ公開する場合、上記HTTP Security Headersを継承する。

Business Web側ではSEO / AIOとアプリ固有セキュリティを管理し、同じ共通ヘッダーをHTMLへ重複実装しない。

ただし、配置先が同じDocumentRootであることだけを根拠に継承済みと判断せず、公開後に実レスポンスを確認する。

### 意図的に未適用の設定

以下は全サイト共通設定として現時点では適用しない。

- `Content-Security-Policy`
- `X-Frame-Options`
- HSTS `preload`

CSPはインラインJavaScript/CSS、外部サービス、各LP/Business Webへの影響を棚卸ししてから設計する。

`X-Frame-Options` はiframe/埋め込み要件を確認してから判断する。

HSTS `preload` は通常のHSTSより影響および解除コストが大きいため、別途判断する。

### バックアップ / ロールバック

HSTS導入前に以下のバックアップを作成した。

`/etc/apache2/sites-available/production-le-ssl.conf.bak-20261003-hsts`

Apache設定変更時は必ず `apache2ctl configtest` 成功後に `systemctl reload apache2` を実施する。構文エラー時はreloadしない。

障害時はバックアップまたは直前の正常設定へ復元し、`configtest` 後にreloadして公開レスポンスを再確認する。

### 運用上の重要事項

Corporate Webの共通HTTPセキュリティ設定をLPごとに再実装しない。

新規サブドメインを追加する場合、`Strict-Transport-Security: max-age=31536000; includeSubDomains` が既に運用されていることを前提とし、**公開開始時点から有効なHTTPS/TLSを必須とする**。

`Permissions-Policy` により現在 `camera`、`microphone`、`geolocation` を無効化している。将来これらのブラウザ機能を必要とするWeb機能を公開する場合は、共通ポリシーを事前に再評価する。

Apache / DNS / Load Balancerの構成変更時は、本RunbookとGit履歴を確認してから作業する。
