# Secure Services 共通料金の統合分析

主資料は `integrated-pricing-analysis.md` / `Secure_Services_Integrated_Report.html`、編集用モデルは `Secure_Services_Integrated_Model.xlsx`。

## 範囲と読順

1. `canonical-sources.json` にCorporate Issue16/17、PR7/9/14、Send PR2/3の参照SHAを固定。
2. `assumptions.json` は実測・外部公表・仮定を区分した入力記録。DNS単価/最低額、共同分布、Guard運用、Send商用構成は確定値ではない。
3. Excelは現在選択条件を再計算する。`固定条件比較` と `scenario-comparison.csv` は作成時の2,079ケースで、入力編集に連動しない。
4. `selected-results.json` / `sensitivity.json` / 検証JSONで初回黒字・継続黒字・サービス別黒字・累積を確認。

料金の正式決定、Production、DB、サービス提供基盤、サブスクペイ、振込処理は変更していない。既存Guard基本5,000円・端末300円一律・基本50%配分は参照基準として維持。ExcelのG0は基本5,000円を固定した比較で、従量の累進/一律は選択式。

## 計算コードと出力

`model.mjs` は純粋なNode標準機能による計算、`source-send-rates.json` はSend PR3 74facb2の概算単価参照、`generate-offline.mjs` はExcel数式の宣言データ生成、`offline-sheet-capture.mjs` は通信のないメモリ内キャプチャ、`create-offline-cache.mjs` は独立計算値、`export-offline.py` はローカルXLSX出力。`report.mjs` と `verify-independent.mjs` は調査workspace配置を前提とする記録用ソース。

初回の外部ライブラリによるXLSX出力は自動承認レビューが外部テレメトリ要求を検知して拒否した。拒否された出力処理を再実行せず、外部通信のないローカル出力へ切り替えた。コードには当該エクスポーターの実行スクリプトを含めていない。

最終モデルは数式を保持し、独立計算のキャッシュを付け、主要値と式保持を読み戻して照合。Excelで入力を変えるとネイティブ再計算する設定。Excelネイティブ再計算自体はこの環境で未検証。

再生成はこの調査のworkspace構成（`services-work/`、`outputs/`、本analysis repo、Send参照checkout）を前提とする。これは商用の課金計算コードや配布アプリではない。将来の課金実装へ無条件転用しない。

## Gitの位置付け

Corporate PR14のbranchをbaseに専用分析branch/PRとして記録する。PR14を変更せず、本PRの差分だけを追加。mainマージと料金の採用は別承認。
