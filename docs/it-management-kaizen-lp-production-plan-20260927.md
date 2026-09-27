# IT経営KAIZEN LP 制作方針・既存LP資産再利用記録

Status: Approved production approach / implementation not started by this record
Recorded: 2026-09-27
Scope: LP design and implementation method only. No production deployment, API/DB migration, or existing LP modification.

## 目的・前提
FV背景画像だけを繰り返し生成し、正式ロゴ・コピー・CTAを含むLP完成形を確認できない状態を避ける。InfraVision Partner / Web Development Partnerで確立した制作方法と共通基盤を再利用する。ただしIT経営KAIZENは経営者向けの別サービスであり、代理店募集のコピー、訴求、画像、商談ステータスを流用しない。

## 参照する既存資産
- 制作Canonical: `docs/partner-lp-visual-first-standard.md`（2026-09-21制定、09-22改訂）。
- 配置・確認Canonical: `docs/wordpress-static-lp-deployment.md`。
- 主起点: `public/infravision-partner/index.html`、同 `assets/`。完成FVとHTML/CSS・CTA・フォーム・計測の参照。
- 横展開の比較対象: `public/web-development-partner/index.html`、同 `assets/`。
- LP側の参照Git SHA: `47f0ee30483ab9562e54e38ee8e182fdae561cf5`。着手前に最新HEAD・作業ツリー・本番差分を再確認する。未コミットのInfraVision CTAスクロール補正を上書きしない。
- バックエンド参照: `C:\atlib\atlib-sales-tools-infravision-integrated` のInfraVision受付API・管理API・通知・フォーム導線。ただしWeb Development Partner専用バックエンド原本と投入後本番イメージの所在は未確定であり、これを確定済みテンプレートとして扱わない。

## 制作原則
**Web-layout + Visual-assets**。「コピーはHTML。理解はインフォグラフィック。雰囲気は画像。」
LPは連続した縦スクロールのWebページであり、16:9のフライヤーを積み重ねない。見出し・説明・正確な事実・CTA・フォーム・FAQ・計測・SEO/AIO・レスポンシブはHTML/CSS。画像は情景、背景、概念図、理解補助に限定。公式atLIBロゴは支給素材を使い、AIで再描画しない。サービスロゴは独立透過素材、長いタグラインは原則HTML。図解の見出し・説明もHTMLで保持する。

## FVの構造
1. 完成構図（正式ロゴ、コピー、説明、CTA、背景を含むPC・スマホ）を先に確認する。
2. その構図をHTMLテキスト・ロゴ素材・背景/右側ビジュアルに分解する。背景画像に見出し・説明・CTAを焼き込まない。
3. PCは広い広告キャンバスとして、左の読みやすいHTML領域と右の視覚要素を構成する。InfraVisionの参考値は文字領域55–57%、右側の意味ある視覚要素45–55%だが、IT経営KAIZENの固定値にはしない。
4. 白から情景へのグラデーション、オーバーレイ、余白、文字との重なりはCSSと素材構図を組み合わせて制御。重要な図が切れる`cover`を機械的に採用しない。
5. スマホはPC画像の縮小ではなく、文字→CTA→視覚素材の読み順に再構成。画像位置・倍率・トリミングを個別調整し、必要ならスマホ用素材を用意する。
6. ブラウザの完成表示を承認対象とし、画像単体を最終成果物とみなさない。

## FV承認チェック
PC・スマホの実表示を並べ、文字領域幅、正式ロゴのスケール、見出しの大きさと改行、説明文の可読性、ベネフィット密度、CTA幅・視認性、右側素材の倍率・トリミング、左右の視覚バランスを確認。コンテナ幅と文字サイズはセットで調整。AI画像内の日本語・ロゴ・架空の数値・実績を目視確認。背景画像の再生成は、HTML完成構図に対する具体的な不足が確認された場合に限定する。

## IT経営KAIZENでの実施順序
1. 現在のGit HEAD / status / 差分を確認し、既存LPと未コミット変更を保全する。
2. IT経営KAIZENの訴求・セクション順・正式ロゴ・FVコピー・CTA・アートディレクションを確定する。
3. InfraVisionのFV構造を参考に、別ディレクトリにIT経営KAIZEN専用HTMLモックを組む。背景は仮素材でよい。
4. PC・スマホの完成FVをブラウザで並べて確認し、文字・余白・CTA・画像配置を調整する。
5. 決まった配置に必要な背景/右側素材のみ生成し、CSSで統合する。画像寸法は配置から逆算し、16:9をデフォルトにしない。
6. FV承認後に全セクションを制作する。「技術・運用・管理 × 6つの改善視点」「サービス体系」は理解促進に有効な場合のみ図解化する。
7. ページ全体の縦スクロール、PC/スマホ、画像欠落、CTA、フォーム、計測、アクセシビリティ、SEO/AIOを検証する。Production反映は別承認。

## 再利用と変更境界
再利用候補: ヘッダー、FV骨格、セクションのリズム、レスポンシブ、固定CTA、UTM5項目、CTA位置、GA4/Clarity、honeypot、送信状態、プライバシー同意、TimeRex外部リンク、デプロイ・SHA256照合・E2E手順。
個別設計: 経営者向けコピー・画像・ロゴ配置、診断フォーム項目、同意バージョン、無料診断Caseへの接続、TimeRexイベント、通知文面、管理ステータス。
既存の診断APIへLPから直結する前提にしない（同一オリジン/CORS、strict schema、同意ゲートを検証）。Web Development Partner専用バックエンド原本未回収、既存017/018/019と無料診断側migration番号衝突があるため、ソース回収・DB整合前にSales Tools本番を上書きしない。既存LP、DB、API、本番環境はこの制作記録では変更しない。

## 避ける失敗
完成FV構図とアップロード用背景素材を混同すること、画像内にHTMLと重複する文字を入れること、重要部分を`cover`で切ること、文字背面に不自然な白パネルを追加すること、横幅だけ広げ文字が小さいままになること、フライヤー状のセクションを積み重ねること、画像単体の再生成を続けること。

## 記録の性質
これは既存Canonicalに基づくIT経営KAIZEN向け制作決定の記録。新LPの実装完了、フォーム・API接続完了、本番デプロイ完了を意味しない。
