# Secure Guard TypeScript移行｜既存資産Fit/Gap・第1段階レビュー
Date: 2026-10-24 JST
Status: **移植途中・本番No-Go**。PR #44のTypeScript移行Decision b38a903とPowerShell C1/C2を正本として継承する。

## 確認した既存資産
- atlib-sales-tools/main Dockerfile: Node 20 bookworm-slim、multi-stage、npm ci、non-root、source SHA label。Secure GuardはJobなのでWebサーバー・Playwright・PostgreSQL・migrationをコピーしない。
- atlib-sales-tools/main src/services/slackNotifier.ts: Node標準fetch、AbortSignal.timeoutを使用。ただしbest-effort通知（失敗を握りつぶす）なので、Secure Guardのfail-closed APIクライアントへそのまま流用しない。
- atlib-sales-tools/main src/db/pool.ts: PostgreSQL接続資産。Secure Guard C1/C2はGCSを正とするため採用しない。
- Secure Guard organization-offboarding.ps1: API schema query検証、厳格pagination（links.next明示null、meta.total_count安定、ID重複禁止）、Org全体とSite別Agentの独立照合、unknown停止。参照実装として維持。
- C1 runtime、C2 durable plan、GCS claim adapterと旧オフラインfixture: 確定安全契約。旧PASSをTypeScriptのPASSとして転記しない。

## TypeScript実装の現状
- inventory.ts: GET専用inventoryの初期移植。plan.ts: policy/plan/hashとGET統合の初期移植。test/inventory.test.cjs、test/plan.test.cjs、tsconfig.jsonを追加済み。
- b0b6fa0で、GET transportに認証headerを明示的に渡す欠落を修正。Secret本文はGit/ログに出さない。
- **未検証**: これらTypeScriptファイルの実tsc/test PASS、PowerShell SG-HashとのJSON互換、OpenAPI $refの実fixture一致、GCS永続保存/claimのTypeScript移植、Node Docker/Cloud Build/Job実Build。以前の「6 PASS」の表現は現在のGitHub実行証跡では裏付けられないため、正式な受入PASSに数えない。

## 最小差分での進行とSTOP条件
1. Workまたは承認済みローカル実行環境で、まず既存TypeScript初期コードを strict tsc + node:test で実行し、失敗/欠落を実証する。GCP・DNSFilter実要求は0。
2. 統括はPowerShell fixtureとの1:1対応、文字列/数値/キー順/空配列/ソート/JSONハッシュの互換性を確定する。異なるhashが出た場合に既存承認値を捏造・無断変更しない。
3. 実行PASSを得てからC2 GCS read-back、C1 claim adapter、Job構成へ順次移植。既存Node Docker方式を参考にしつつ既存Sales Toolsの本番資産は変更しない。
4. 実GCPのBuild/Secret/IAM/Job/GCS、DNSFilter live GET、Agent uninstall、Organization DELETEは別承認までNo-Go。

## 統括が引き続き保持する判断
実GCPのSA/Registry/IAM、専用bucket保持・アクセス、Node base image digest、旧PowerShellと新TypeScriptのハッシュ同一性、C3以降の操作承認。Workに設計変更を委ねない。
