# 採用サイト・リニューアル実装（2026-11-19）

## 目的と公開境界

- atLIB採用サイトの承認済みPC/スマホカンプに基づき、独立したHTML/CSS/JSと写真素材で実装。
- 公開中の `recruit.atlib.jp` は現行GCE/Apache配信を維持し、既存 `public/recruit/index.html` は変更しない。
- 独立プレビュー：`public/recruit/redesign-preview/index.html`。実配信時の先頭パスは `/redesign-preview/`（採用サイトのホスト）または `/recruit/redesign-preview/`（コーポレート配下）。
- プレビューに `noindex,nofollow`。本公開時はSEO/OGP/アクセス解析等を現行採用トップから引き継ぐ。

## 実装内容

- ブランド：Emerald `#2DBE9D` 主軸、Navy `#1F3556`、CTA Orange `#F28C38`、低彩度Peachの円形アクセント。
- PC：FVでメインとサブの写真を重ねる。VALUES/WORK/PEOPLE/WORKSTYLE/RECRUITを一続きに構成。
- モバイル：FVの高さをビューポート固定にせず、写真は1枚のみ。独立した文字／画像要素のため画面幅に合わせて再配置。44pxメニューボタン、Escape・外部クリックで閉じる、戻るリンク、ページTOPボタン。
- ナビ：ページ内往復 `#values` / `#work` / `#people` / `#workstyle` / `#recruit`、採用TOP、既存下層ページへの導線、ヘッダー・モバイル・フッターでコーポレートサイトへのリンク。
- 画像：新規生成した人物・オフィス写真6点を個別WebP素材として使用。画像は文字やボタンを焼き込まない独立アセット。

## 公開前の残確認

1. PC/モバイル実機幅で画像・文字の折返しとナビ動作を目視確認。
2. 既存下層ページ（message/member/workstyle/requirements/policy）との遷移QA。
3. 正式な職種別Indeed募集URL確定後、募集要項からの導線を調整。未確認URLは設定していない。
4. コンテンツ承認、現行GA/Clarity/OGP/法務文書整合、`noindex`解除、本公開導線の切替は別リリース判断。

## 検証

`node --test tests/recruit-redesign-preview.test.cjs`

`npm run build`（既存Express/TypeScriptの回帰チェック）
