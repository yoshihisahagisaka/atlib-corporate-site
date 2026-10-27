# WSC CSV一括診断・配布準備 Fit / Gap（2026-10-27）

## Fit

- Phase 2AのCSV3列、1件ずつのSynthetic実行、失敗継続、停止・再開、重複防止、隔離保存を再利用する。
- `tools/wsc-delivery/delivery.mjs` は保存済みHTMLだけを入力にし、注入されたPDF出力アダプターで企業別PDFを受け取る。PDF名は `企業名_Webセキュリティ診断レポート.pdf`、ZIPは階層なしでPDFのみを収録する。
- 配布先一覧CSVは宛先を空欄に保つ。メール文案は送信機能を持たず、承認済み文案・宛先・送付目的が決まるまで本文を確定しない。
- Synthetic複数社で、VS1 HTML、PDF出力アダプター契約、ZIP、一覧、メール文案、保存整合性を検証する。

## Gap / STOP

- PIRA `https://pira.or.jp/` は実測対象候補であるが、管理主体・調査権限・完全URL・実施日時・実行者・一回限り承認は未承認である。実DNS/TLS/HTTPSは実行しない。
- Phase 2Cには安全な実通信機構があるが、承認済み実行者・承認ストア・実環境のPDFブラウザ出力アダプターを接続していない。`PDF_EXPORTER_REQUIRED` により、無設定でのPDF作成は停止する。
- 実測時はHTTPS GET 1回、DNS最大4回（メール未指定ならWeb照合のみ）、同時実行1、HTTPS 15秒、DNS各5秒、1 MiB、リダイレクト追跡なし、再試行なしを守る。
- 配布先・メール文案・外部配布は未承認であり、ZIPはSynthetic検証用にだけ生成した。
