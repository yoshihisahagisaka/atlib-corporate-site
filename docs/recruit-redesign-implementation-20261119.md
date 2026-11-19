# 採用サイト・リニューアル実装（2026-11-19）

## 目的と公開境界

- atLIB採用サイトの承認済みPC/スマホカンプに基づき、独立したHTML/CSS/JSと写真素材で実装。
- 公開中の `recruit.atlib.jp` は現行GCE/Apache配信を維持。承認後、`public/recruit/index.html` をプレビュー原本から公開用に生成する工程を追加した。本番実サーバーへの反映は別途検証する。
- 独立プレビュー：`public/recruit/redesign-preview/index.html`。実配信時の先頭パスは `/redesign-preview/`（採用サイトのホスト）または `/recruit/redesign-preview/`（コーポレート配下）。
- プレビューは `noindex,nofollow` のまま。公開用トップは `noindex` を持たず、SEO/OGP/アクセス解析等を現行採用トップから引き継ぐ。
- 承認後に提供されたライセンス識別コメント `<!--License20261119vzyRP-->` をプレビューのHTML `<head>` に１行のみ付与（表示には影響しない）。

## 実装内容

- ブランド：Emerald `#2DBE9D` 主軸、Navy `#1F3556`、CTA Orange `#F28C38`、低彩度Peachの円形アクセント。
- PC：FVでメインとサブの写真を重ねる。VALUES/WORK/PEOPLE/WORKSTYLE/RECRUITを一続きに構成。
- モバイル：FVの高さをビューポート固定にせず、写真は1枚のみ。独立した文字／画像要素のため画面幅に合わせて再配置。44pxメニューボタン、Escape・外部クリックで閉じる、戻るリンク、ページTOPボタン。320px幅ではnote見出しを意図的な改行に切り替える。
- ナビ：新トップと既存下層ページのPC/スマホメニューを `私たちの想い / 会社を知る / 人を知る / 働く環境 / 公式note / エントリー` に統一。「会社を知る」は `https://www.atlib.jp/company/` に直接リンクする。ヘッダーからコーポレートサイトへも遷移できる。
- 応募：独自エントリーフォームを廃止。`/entry/` は職種案内だけを行い、ITサポートエンジニアとITコンサルタントの確認済みIndeed求人に遷移する。氏名等の応募情報は採用サイトで収集しない。
- 公式note：現行採用サイトでも採用している `https://note.com/atlib` を継承。PEOPLEの直後、WORKSTYLEの前に編集記事風の専用セクションを配置し、日常・仕事・経営の想いを継続的に発信していることを伝える。オレンジCTAは新規タブで公式アカウントへ。スマホナビには `#note`、フッターには公式noteへの直接リンクを設置。記事タイトルや更新日を固定表示せず、内容が古く見えることを避ける。
- 画像：新規生成した人物・オフィス写真6点を個別WebP素材として使用。画像は文字やボタンを焼き込まない独立アセット。

## 公開前の残確認

1. PC/モバイル実機幅で画像・文字の折返しとナビ動作を目視確認。
2. 既存下層ページ（message/member/workstyle/requirements/policy/entry）の共通ヘッダー・スマホメニューの表示と遷移QA。
3. Indeedの職種別URLは2026-11-19に公開求人で存在を確認。掲載終了・URL変更時は `/entry/` のリンクを更新する。
4. コンテンツ承認、現行GA/Clarity/OGP/法務文書整合、`noindex`解除、本公開導線の切替は別リリース判断。

## 検証

`node --test tests/recruit-redesign-preview.test.cjs`

`node scripts/prepare-recruit-production.cjs`（承認済みプレビューから公開用トップを再生成）

`bash -n scripts/deploy-recruit-gce.sh`（本番転送・ロールバックの構文確認）

`npm run build`（既存Express/TypeScriptの回帰チェック）

- 2026-11-19 ブラウザー・プレビューQA：PC幅1332px、スマホ幅375px、最小320pxのCSS viewportでFV/公式noteを目視。スマホFVは自動高520〜563pxで1枚写真。各幅でbodyの `scrollWidth` と `clientWidth` が一致し横はみ出しなし。375pxでモバイルメニュー開閉→公式noteアンカー移動、メニュー自動閉じを確認。
- メンバー紹介、働く環境、募集要項の下層ページへの遷移をプレビュー環境で確認。公式noteの外部遷移先は現行サイトの既存URLと一致。実機デバイス上での最終確認と公開用ルート統合は未実施。

## 本番リリース候補（11/19 追加、GCE未反映）

- `public/recruit/index.html` は承認済み `redesign-preview/index.html` から生成。写真・スタイル・JSは既存 `redesign-preview/assets/` を参照し、原本の表示を変えない。
- `recruit.atlib.jp` と `www.atlib.jp/recruit/` の双方で解決する相対リンクに変換。下層ページも同じ `public/recruit/` 配下のソースを使用する。
- 現行GA4測定ID・Clarity ID・favicon・canonical・OGP・JSON-LDを引き継ぎ。ライセンス識別コメントは1回だけ保持。
- `node --test tests/recruit-redesign-preview.test.cjs` は14 PASS。`npm run build` とデプロイスクリプトの `bash -n` もPASS。Indeedの2求人は同日の公開ページで会社名・職種が一致することを再確認した。
- 本番GCEは `atlib-corporate-site/asia-northeast1-a/corporate-site-wp`、Apache `/var/www/html/recruit/`。Cloud Run切替やコーポレートサイト公開設定は操作しない。
- `scripts/deploy-recruit-gce.sh --apply` は Cloud Shell の認証済み環境で使用するもの。対象VM/VHostのread-only確認、バックアップ、ソースの段階配置、公開URLのスモーク検証、失敗時のバックアップ復元を行う。未検証のIAP SCP転送を初回操作に含むため、実行結果を必ず回収する。
- 採用フォームへの新規入力導線は撤去済み。ただし現行VM上の孤立した旧PHPエンドポイントの存在・廃止可否は、VM read-only調査前に断定しない。
- このワークスペースにはGCP SDKがなく、GCPコンソールも利用不可のため、上記スクリプトを実行したことや公開完了とは扱わない。
