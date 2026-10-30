# Secure Guard｜TypeScript C1初期互換性・統括受入記録
Date: 2026-10-24 JST
PR #44 HEAD / 検証対象: 3157f0d8586e1e69c06f9ec8c990827a720e4a09
Decision: **C1 GET inventory/policy/plan hash compatibility ACCEPTED WITH LIMITS; C2 GCS/Cloud Run LIVE NO-GO**.

## Work実行証跡（統括による再実行ではない）
- Node.js 20.20.2 / 24.18.0、TypeScript 7.0.2、PowerShell 7.6.5。
- strict tsc/通常emit両Node版PASS。inventory 9 PASS、plan 11 PASS、計20 PASS/0 FAIL/0 SKIP。
- 既存35 fixture: 受理/拒否・STOPコード・SHA256は35/35一致。生JSON文字列は32/35一致。
- 生JSONの差3件: Unicode U+0085/U+2028/U+2029と指数表記 1e-7 vs 1E-07。Hash計算用psJsonがPowerShell互換のため、hashは一致。PowerShell C2で通常/Unicode/U+2028 hostname計画3件受理。
- 既存fixture/goldenは不変更。GitHub/GCP/DNSFilter変更0。

## 統括受入範囲と制約
- GET inventoryの初期実装、Policy検証、DryRun計画hashの**既存fixture上の互換**のみ受入。全Unicode/数値・実API schemaに対する完全互換の証明ではない。
- C2移植ではGCSに保存するJSON本文と、PowerShell互換のhash対象bytesを区別する。create-only→generation固定read-back→payload再hash→厳密な内容照合を実装・テストする。単なるJSON.stringify同値/HTTP200/Job exit0は受入としない。
- 既存PowerShell C2/GCS adapterのnamespace、allowlisted projection、UNKNOWN/no-resend、claim分離、秘密非出力、DNSFilter変更API禁止を継承する。
- Node 20/24での初期試験PASSはDocker image・実HTTP・Secret・GCS・Cloud RunのPASSを意味しない。実環境構築は別承認まで禁止。
- Workの次作業は実行環境が必要なテストに限定。統括側で可能なコード・PR更新は直接実施し、既存資産を先に確認する。
