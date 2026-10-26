# WSC 4工程 Fit / Gap（2026-10-27）

## 接続した4工程

1. 単一URLは `tools/wsc-delivery/four-stage.mjs` の必須引数（URL、企業名、本店所在地）で受け付ける。CSVは既存Phase 2Aの必須3列を再利用する。
2. 単一URLは既存Phase 2Cの `createRestrictedNetworkProbe` に、既存Phase 2Dの一回限りURL拘束承認ストアを注入して取得する。
3. JSON 2.0を既存VS1の `evaluate` / `render` へ渡し、既存Phase 2Aの隔離ストアに診断JSON、判定JSON、HTML、整合性情報を保存する。
4. `runSingleUrlToPdf` は生成済みHTMLを明示注入されたブラウザPDFアダプターへ渡し、`%PDF`署名を確認して保存する。`browser-pdf.mjs` はローカルHTMLだけをEdge/Chrome互換のヘッドレス印刷へ渡し、URLを開かない。

## PIRA / Google 実測の状態

`https://pira.or.jp/` はPhase 2Dの対象候補であり、実測承認は未了である。Googleの企業情報は今回に限り社内動作確認用の仮入力を使用した。正式な企業情報はURLから推測していない。

2026-10-27に、統括指示により社内動作確認用の企業名・所在地を用い、`https://www.google.com/` を単発実行した。承認消費後のDNS照合およびHTTPS GET 1回の範囲で、TLS接続時に `CONNECTION_IP_MISMATCH` が発生した。検証済みDNS IPと実ソケット接続先が一致しないため、安全制御により取得を中止した。安全制御を緩和せず、診断JSON、判定JSON、HTML、PDFは生成しなかった。

## PDFの実環境検証

Synthetic HTMLからのPDF印刷をローカルEdgeヘッドレスで試行したが、この実行環境ではPDFが出力されず完了待ちとなった。従って、PDFアダプターのコードと`%PDF`検証契約はあるが、実ブラウザによるPDFレイアウト検証は未完了である。環境で動作するChrome/Edgeのヘッドレス印刷、または承認済みの代替PDFアダプターを指定して再検証する必要がある。

## STOP条件

- 実測レポート用の企業名・本店所在地が入力されない。
- 実行対象URL、調査許可、一回限り承認、実行者、保存先が未承認。
- 実PDF出力アダプターが正常なPDFを生成・検証できない。
- Phase 2Cの公開IP、TLS、DNS、時間・容量、リダイレクト安全制御を満たせない。

今回のGoogle実測は最後のSTOP条件に該当する。外部ネットワーク経路でDNS IPとソケット接続先を拘束できる構成が確認されるまで、実測を再試行しない。

2026-10-27のPIRA単発実行では、公開取得後にVS1 HTMLを組み立てる接続で `checkedAt と targetUrl が必要です` が発生し、HTML生成前に停止した。自動再試行は禁止のため、同一URLの再実行、残りの指定URLへの実測、PDF保存は行っていない。取得結果JSONの実際の形状と単一URLランナー間の接続契約を確認し、既存仕様に沿う最小修正が統括承認されるまでSTOPする。
