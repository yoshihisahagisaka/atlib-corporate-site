# WSC VS1（内部レビュー用試作）

既存の診断JSONをネットワーク接続なしで評価し、単一HTMLを生成する汎用ツールです。サイトの公開コード・PowerShell取得コマンド・CSV一括処理は変更しません。

```powershell
node tools/wsc-vs1/engine.mjs tools/wsc-vs1/fixtures/atlib-security-check-v2.json tools/wsc-vs1/fixtures/atlib-company.json tools/wsc-vs1/out-atlib.html
node tools/wsc-vs1/test.mjs
```

## Fit / Gap

- Fit: 入力JSON、企業情報、日時、根拠値から決定論的にHTMLを生成する。atLIBは回帰用fixtureのみであり、企業名・所在地・URL・結果をハードコードしていない。
- Fit: `rules.json` と `explanations.json` を実行時に読み込む。未定義条件は推測せず、利用者向け表示をせず内部記録に残す。
- Fit: 固定解説は添付ドラフトをそのまま同梱し、承認済み「はじめに」は別ファイルとテストで全文一致を検証する。
- Gap: CSPメタ指定、CSPの強度・frame-ancestors、SPF完全構文、DMARC例外値、TLS取得側が出す `UNVERIFIED` の利用者向け文言は、統括記録どおりVS1では未対応。
- Gap: ブラウザの印刷確認はローカルHTMLを開いて手動確認する工程。自動化された視覚確認は含まない。
