# WSC 4工程 Fit / Gap（2026-10-27）

## 接続した4工程

1. 単一URLは `tools/wsc-delivery/four-stage.mjs` の必須引数（URL、企業名）で受け付ける。本店所在地は任意であり、レポートには表示しない。CSVは既存Phase 2Aの必須3列を再利用する。
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

## 指定3サイト実測（2026-10-27）

統括の実測再開指示に基づき、修正済み単一URLランナーで以下を各1回、同時実行なし・自動再試行なしで実行した。各サイトで公開DNSとHTTPS GETを既存の公開IP、TLS、時間、容量、リダイレクト安全制御の下で取得し、JSON 2.0、既存VS1の判定JSON、HTMLをローカル隔離ストアへ保存した。

| 企業・団体名 | 対象URL | HTTP | 結果 |
| --- | --- | ---: | --- |
| 一般社団法人 国際連携推進協会 | `https://pira.or.jp/` | 200 | TLS確認済み、HSTS/CSP/画面埋め込み制御は追加確認推奨 |
| 株式会社YOｰZAN | `https://yo-zan.com/` | 200 | TLS確認済み、HSTS/CSP/画面埋め込み制御は追加確認推奨 |
| 東京ビジネス交流会 | `https://e-tbk.com/` | 200 | TLS確認済み、HSTS/CSP/画面埋め込み制御は追加確認推奨 |

HTMLファイルの存在、SHA-256、入力URLと診断JSONの対象URL、および判定JSONの整合性を確認した。本店所在地は入力・診断JSON・HTMLへ追加していない。

PDFは、通常印刷による保存を試みる前段で、実行環境のブラウザポリシーがローカル `file:` URLの表示を拒否したため未検証である。ポリシーの回避や別のPDF変換基盤の追加は行っていない。したがって、PDF保存結果は未生成であり、ユーザーがローカルブラウザでHTMLを開いて通常印刷を実行できる環境、または承認済みのPDFアダプターが必要である。

## メールDNS照会の再開（2026-10-27）

単一URLランナーの固定 `mailDomain: null` を撤去し、既存のURL正規化結果の `hostname` を既存Phase 2CのSPF・DMARC照会処理へ渡すようにした。ポート、パス、クエリは照会対象に含めず、`www` の削除や別ドメインへの置換は行わない。

Node DNSの `ENODATA` と `ENOTFOUND` は、該当TXTレコードが存在しないことを示す否定応答として `NO_RECORD` に分類した。タイムアウトその他のDNS失敗は従来どおり `UNVERIFIED` としており、取得失敗を未設定と扱わない。

| 対象URL | SPF | DMARC | 既存VS1への反映 |
| --- | --- | --- | --- |
| `https://pira.or.jp/` | `v=spf1 a:www3859.sakura.ne.jp mx ~all` | `NO_RECORD` | `SPF_PRESENT`、`DMARC_ABSENT` |
| `https://yo-zan.com/` | `v=spf1 include:_spf.onamae.ne.jp include:_spf.ex-pa.jp ~all` | `NO_RECORD` | `SPF_PRESENT`、`DMARC_ABSENT` |
| `https://e-tbk.com/` | `v=spf1 a:www522b.sakura.ne.jp mx ~all` | `NO_RECORD` | `SPF_PRESENT`、`DMARC_ABSENT` |

PIRAのSPF値とDMARC不存在は、指定されたPowerShell確認結果と一致した。3サイトすべてで取得結果JSON、判定JSON、HTMLをローカル隔離ストアへ保存し、既存VS1の固定文章・判定ルール・デザインは変更していない。

## Web・メール公開設定の再実測（2026-10-27）

承認済みSHA `0233028f7abb95f2ca349290cf713487c2e49e6b` を用い、各サイトを同時実行なし・自動再試行なしで再測定した。既存の公開IP、TLS、時間、容量、リダイレクト安全制御を維持し、HTTPS GET、対象ホスト名のSPF TXT照会、DMARC TXT照会を実行した。各結果からJSON 2.0、既存VS1判定JSON、HTML、既存Edge印刷方式のPDFをローカル隔離領域へ保存した。

| 企業・団体名 | 実測日時（JST） | HTTP / TLS | SPF | DMARC | Finding ID |
| --- | --- | --- | --- | --- | --- |
| 一般社団法人 国際連携推進協会 | 2026-10-27 07:24:18 | 200 / VALIDATED / TLSv1.3 | `v=spf1 a:www3859.sakura.ne.jp mx ~all` | `NO_RECORD` | `TLS_VALID,HSTS_DISABLED,CSP_HEADER_ABSENT,FRAME_HEADER_ABSENT,SPF_PRESENT,DMARC_ABSENT` |
| 株式会社YOｰZAN | 2026-10-27 07:24:29 | 200 / VALIDATED / TLSv1.3 | `v=spf1 include:_spf.onamae.ne.jp include:_spf.ex-pa.jp ~all` | `NO_RECORD` | `TLS_VALID,HSTS_DISABLED,CSP_HEADER_ABSENT,FRAME_HEADER_ABSENT,SPF_PRESENT,DMARC_ABSENT` |
| 東京ビジネス交流会 | 2026-10-27 07:24:38 | 200 / VALIDATED / TLSv1.3 | `v=spf1 a:www522b.sakura.ne.jp mx ~all` | `NO_RECORD` | `TLS_VALID,HSTS_DISABLED,CSP_HEADER_ABSENT,FRAME_HEADER_ABSENT,SPF_PRESENT,DMARC_ABSENT` |

PIRAのSPF値と `_dmarc.pira.or.jp` の不存在は、指定されたPowerShell確認結果と一致した。取得失敗・未確認は今回の実測JSONにはなく、顧客向けHTMLにも未確認表示を追加していない。HTMLの企業名・対象URLと診断JSONを照合し、各PDFはA4・8ページ、PDF署名、SHA-256を確認した。PIRA PDFは表紙、はじめに、診断概要、詳細、最終ページを画像で確認し、メール欄と既存固定文章の反映、文字・カードの欠落がないことを確認した。
