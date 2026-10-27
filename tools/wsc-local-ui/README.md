# WSC 社内用ローカル操作画面

`start-wsc-ui.cmd` をダブルクリックすると、Windows PC上のローカル画面を開きます。外部公開やクラウド接続は行いません。

## 操作

1. 単一URL診断では、企業・団体名、HTTPS URL、出力先フォルダを入力します。
2. CSV一括診断では、既存の3列CSV（`企業名,本店所在地,URL`）と出力先フォルダを選択します。
3. `診断開始` を押します。CSVは1社ずつ処理し、完了済みの保存済み成果物は再利用します。
4. 生成物は選択したフォルダ内の `WSC_<入力ハッシュ>/delivery/` に保存されます。PDF、ZIP、一覧CSV、メール文案は既存 `wsc-delivery` を使います。

Windowsの標準ダイアログはCSVと出力先の選択だけに使用します。単一URL・CSVのライブ実行は、既存のPhase 2C/2D安全制御と既存の単一URLランナーをそのまま経由します。

## オフライン再生テスト

`node tools/wsc-local-ui/test.mjs` は保存済み診断JSONをSynthetic executorへ注入します。DNS、TLS、HTTPS通信は行いません。
