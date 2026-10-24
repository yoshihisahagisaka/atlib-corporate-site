# Secure Guard TypeScript初期検証｜統括レビューと互換性修正契約
Date: 2026-10-24 JST
Canonical: PR #44、既存PowerShell C1/C2契約、TypeScript移行Decision b38a903。検証対象 e116994。ユーザー報告のNode24.18/TS7.0.2/PS7.6.5 ja-JP。
判定: **初期テスト14 PASS、標準emit TS5011、同一JSON比較27/35一致、8差。移植受入No-Go、実GCP No-Go。** 実行証跡はWork報告であり、統括による再実行ではない。

## 確定した修正
- tsconfig rootDir=src を明示（commit ba60b6b）。これにより標準emitのTS5011原因を修正する意図。再ビルドPASSは未確認。
- HashはPowerShell SG-Hashの実バイト列をgolden oracleとして固定。U+0085/U+2028/U+2029、指数表記、文字列/数値、キー順、空配列を検証し、同一fixtureでhash一致を必須にする。JS JSON.stringifyだけのhashを互換と扱わない。U+2028を含むTS planがC2でDRYRUN_PLAN_HASH_MISMATCHとなった実証を回帰fixtureに採用。
- OpenAPI parameters null: PowerShellと同じnull除外を再現し、null以外の不正schemaはSTOP。
- Site ID重複: PowerShell Hashtable相当のcase-insensitive重複判定を継承。ただしAPI値の大文字小文字を勝手に正規化して保存しない。
- OpenAPI root array: PowerShellと同じMISSING_OPERATION_get_/v1/organizations/{id} STOPへ統一し、受理しない。
- 大文字source SHA: PowerShell正規表現の受理と、source SHAの実commit一致/manifest/baked policyの完全一致は別ゲート。既存の数値版・Job・allowlist条件を緩和しない。
- total_count '+2': PowerShell TryParseの受理挙動との比較fixtureを維持。実API仕様での正式許容範囲は未実測であり、勝手に新規受理形式を増やさない。
- DNSFilter Bearer header受渡し修正 b0b6fa0 はGitに反映済みだが、HTTP transport/secret非出力/変更API拒否のE2Eは未実装・未検証。成功扱いしない。

## 受入試験
1. strict tsc --noEmit と通常emit、Node.js版初期14件の再実行。
2. 同一PowerShell fixture35件すべてで期待する受理/STOPコードとHash一致（または既存仕様の正当な差分を統括へ差戻し）。PowerShell golden値はコードに固定して、両言語で同じ誤りを作らない。
3. Node 20系での動作は別途確認。Node24/TS7のPASSを既存Sales Tools本番環境互換の証拠としない。
4. 実GCS・Cloud Run・DNSFilter、C3 claim/変更APIは別ゲート。旧PowerShellコード・既存fixtureは削除しない。

本記録は実装仕様の固定であり、GCP操作・デプロイ承認ではない。
