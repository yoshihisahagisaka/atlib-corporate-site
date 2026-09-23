# WordPress同居VM 静的LPデプロイ手順

最終更新: 2026-09-23

## 1. 現行構成

atLIBコーポレートサイト本番は、GCPプロジェクト `atlib-corporate-site` 上の
WordPress環境 `corporate-site-wp` で公開している。

WordPressのドキュメントルート `/var/www/html/` 配下に、
WordPress本体と静的LPを共存させる。

例:

/var/www/html/
├── wp-admin/
├── wp-content/
├── wp-includes/
├── infravision-partner/
├── privacy-policy/
├── joshisu-kaizen/
└── recruit/

静的LPはWordPressテーマへ組み込まず、
`/var/www/html/<LP名>/` にHTML・CSS・画像・JavaScript一式を配置して公開する。

例:
- https://www.atlib.jp/infravision-partner/
- https://www.atlib.jp/privacy-policy/

## 2. ソース管理

ローカルリポジトリ:

C:\atlib\atlib-corporate-site-deploy

公開対象:

public\<LP名>\

InfraVision Partner LP:

public\infravision-partner\

プライバシーポリシー:

public\privacy-policy\

本番デプロイ前に、原則として以下を確認する。

git status
git branch --show-current
git log -5 --oneline

main / origin/main の状態と、working treeがcleanであることを確認する。

## 3. VMへの転送

例: InfraVision Partner LP

gcloud.cmd compute scp --recurse `
  .\public\infravision-partner `
  corporate-site-wp:/tmp/ `
  --project=atlib-corporate-site

例: privacy-policy

gcloud.cmd compute scp --recurse `
  .\public\privacy-policy `
  corporate-site-wp:/tmp/ `
  --project=atlib-corporate-site

## 4. 本番ドキュメントルートへ配置

InfraVision Partner LP:

gcloud.cmd compute ssh corporate-site-wp `
  --project=atlib-corporate-site `
  --command="sudo rm -rf /var/www/html/infravision-partner && sudo cp -a /tmp/infravision-partner /var/www/html/infravision-partner && sudo chown -R www-data:www-data /var/www/html/infravision-partner"

privacy-policy:

gcloud.cmd compute ssh corporate-site-wp `
  --project=atlib-corporate-site `
  --command="sudo rm -rf /var/www/html/privacy-policy && sudo cp -a /tmp/privacy-policy /var/www/html/privacy-policy && sudo chown -R www-data:www-data /var/www/html/privacy-policy"

## 5. ローカルと本番の一致確認

例: InfraVision Partner LP

$local = (Get-FileHash .\public\infravision-partner\index.html -Algorithm SHA256).Hash.ToLower()

$remote = gcloud.cmd compute ssh corporate-site-wp `
  --project=atlib-corporate-site `
  --command="sha256sum /var/www/html/infravision-partner/index.html"

Write-Host "LOCAL : $local"
Write-Host "REMOTE: $remote"

SHA256が一致していれば、ローカルのindex.htmlと本番配置ファイルは同一。

画像・CSS・JavaScript等を変更した場合は、必要に応じて対象ファイルまたは
ディレクトリ全体についても一致確認する。

## 6. デプロイ後確認

ファイル配置だけでリリース完了としない。

最低限、以下を確認する。

- 本番URLがHTTP 200で表示される
- PC表示
- スマートフォン表示
- 画像・CSS・JavaScriptの欠落がない
- CTAリンク
- フォーム入力・送信
- Sales Toolsへのリード登録
- TimeRex表示・lead_id引き渡し
- 通知メール
- GA4 / CTA計測
- privacy-policyリンク

サービス固有のE2E確認項目がある場合は追加する。

## 7. InfraVision Partner LP固有事項

URL:
https://www.atlib.jp/infravision-partner/

LP:
public\infravision-partner\index.html

Lead API:
https://sales.atlib.jp/api/infravision-partner-leads

計測:
- GA4
- Microsoft Clarity
- CTA位置: header / hero / floating_desktop_mobile
- GA4 event: cta_click
- GA4 event: generate_lead
- GA4 event: schedule_calendar_view
- UTM 5項目
- landingUrl
- referrer
- ctaSource

TimeRexは現在無料プランのためWebhookによる自動ステータス更新は使用しない。
日程確定後の営業ステータスはSales Tools管理画面で手動更新する。
将来のTimeRex有料化に備えたWebhook実装はSales Tools側に準備済み。

## 8. 運用原則

新しいLPを公開する際に、Cloud RunやWordPressテーマへの移植を新規検討し直さない。

原則:

Git管理
→ public/<LP名> を制作
→ commit / push
→ corporate-site-wp:/tmp へscp
→ /var/www/html/<LP名> へ配置
→ www-data所有へ変更
→ ハッシュ等で本番一致確認
→ E2Eテスト
→ リリース完了

構成変更が必要な場合のみ、別途設計判断を行う。

作業再開時は、インフラを再調査する前に本ドキュメントとGit履歴を確認する。
