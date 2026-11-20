# 業務KAIZEN先行公開 — service.atlib.jp（2026-11-21）

## 決定済みスコープ
- 公開: `https://service.atlib.jp/business-web/` と `/business-web/self-check/`。
- コーポレート `/services/` から誘導。LP全体の再設計・IT経営KAIZEN・情シスKAIZEN・パートナー募集LPは今回の対象外。
- 15問の無料診断/6観点判定、結果引継ぎ、無料相談、TimeRex連携を維持。新API・新DBは作らない。
- 正規のプライバシーポリシーは `https://www.atlib.jp/privacy-policy/`。
- パートナーLP2件は引き続き404。PR #72の公開停止を取り消さない。

## 既存依存・最小変更
- Corporate: PR #74（本PR）。公開サイトを含む現行運用系コードを再構築せず、Host条件・正規URL・サービス導線に限定。
- Sales Tools: PR #53。API `POST /api/business-web-consultation-leads` のCORSを `https://www.atlib.jp` と `https://service.atlib.jp` のみ許可。旧PR #52は今回適用しない。
- 無料診断 `public/business-web/self-check/self-check.js` は相談送信時に `sales.atlib.jp` のAPIへ送信。新サブドメインでの送信はPR #53に依存。
- `BUSINESS_WEB_REDIRECTS_ENABLED` の初期値はOFF。公開が合格するまで旧 `www.atlib.jp/business-web/*` は200のまま。

## 実行順序（No-Goを飛ばさない）
1. Read-only Preflight：現行Cloud Run 100% Revision/image、既存ヘッダー/採用/旧パートナー404、DNS/Certificate Manager/LB、Sales ToolsのOPTIONS応答と本番Migration 025の状況を確認。**出力は事実として記録、推測で埋めない**。
2. ソース側 `npm ci`、`npm run test:service-web`（実SMTP送信なし）。Sales Tools側はPR #53のCORS＋既存E2Eテストを検証。
3. 既存本番Revisionのimmutable imageをベースに、必要な変更だけをステージング候補Revision 0%へ適用。DNSが未設定でもURLを有効化して公開しない。
4. `service.atlib.jp` のDNS A/Certificate Managerの証明書を有効にし、実HTTPS/Host別配信と静的アセットを確認。未対応の際は先に公開しない。
5. Sales Tools PR #53を本番に適用。既存WWWのCORSを維持し、新OriginのOPTIONS許可を実際に確認。送信はStagingかSynthetic条件で、通知・リードの安全な後始末まで含めて確認。
6. 新LP候補を公開し、PC/スマホ、15問回答→結果表示→相談申込→管理画面へのデータ引継ぎ→メール→TimeRexのE2Eが通ることを確認。
7. 初回は旧URL301をOFF。新URLを安定確認後に限って `BUSINESS_WEB_REDIRECTS_ENABLED=true` を別Revisionで適用し、CDNキャッシュを必要範囲で無効化。
8. 旧URLの恒久的リダイレクトが確定したらcanonical/sitemap/Search Consoleとリンク確認、PRに証跡（Revision/digest/HTTP/E2E）を残す。

## 完了判定
- `service.atlib.jp/business-web/` 200、`/business-web/self-check/` 200、必要なCSS/JS/画像 200。
- `service.atlib.jp/infravision-partner/`、`/web-development-partner/` 404。
- コーポレートトップ/サービス/問い合わせ・採用・情シスKAIZENは現行どおり正常。
- 新OriginでのOPTIONS、診断15問・申込・通知・TimeRexは正常。エラー時に既存サイトが後退しない。
- 旧WWWからの301は本番E2E PASS後のみ。

## 状態
- GitHub実装済み。現行本番Revision/SSL/DNS/API稼働証跡未取得につき、**本番切替No-Go**。
