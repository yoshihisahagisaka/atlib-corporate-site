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
