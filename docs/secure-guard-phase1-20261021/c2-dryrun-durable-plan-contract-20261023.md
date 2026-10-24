# Secure Guard｜C2 GET専用DryRunの永続計画保存 実装契約
Date: 2026-10-23 JST
Status: 統括仕様固定。Workはコード・オフラインテストのみ。実GCP/実DNSFilterは別承認。
Canonical: PR #44 / C1 implementation contract a64677b / C1 code 2b4a32d。C1の安全境界を緩和しない。

## 決定
1. C2の成功定義は、専用Cloud Run Jobで無人認証GET→Organization起点の全Site/Agent・独立照合→秘密を含まない許可済み計画のGCS create-only保存→同一オブジェクトの再取得とhash/内容照合→安全なreceiptの記録。単にGETが200やJobが成功しただけではPASSにしない。
2. 既存の専用bucket候補 `msp-zabbix-secure-guard-offboarding-audit` を利用。新たなDB、別監査基盤、既存Sales/Portal Secretは利用しない。Bucket実在・権限・保持は構築承認ゲート。
3. 新規object namespace: `dryruns/organizations/{org-id}/plans/{plan-hash}.json`。plan hashは既存SG-Hashの対象payloadから算出した64桁小文字SHA256。JSON本文は既存のallowlisted inventory projectionのみ（Org ID、親ID、Site ID/name、Agent UUID/hostname/org/site/status/agent_state、paging evidence、source SHA、mode、mutations_enabled=false、hash）。API key、token、Authorization、raw HTTP body、個人のメール・任意メモ、例外本文を含めない。
4. objectのcreateはGCS `ifGenerationMatch=0` 必須。既存同一hashのobjectがあれば上書きせずSTOP（既存を勝手に成功扱いしない）。異なるhashは別objectとして残るが、過去の計画を承認済みとは扱わない。DryRun計画の保存はOrg claimでもAgent claimでもなく、変更APIの権限を一切与えない。
5. 作成応答が失われた場合はUNKNOWN/STOP。自動再送は禁止。GET再取得では対象bucket/object path、内容、hashを照合し、同じ計画であることを検証する。成功した再取得は過去の不明な書込の再送許可を意味しない。
6. C2のJob実行主体には専用bucketの対象範囲に限るobject get/createのみ。list/update/delete/Storage Admin禁止。既存C1 IAM proposalを流用し、対象bucketの権限境界を構築前に確認する。DryRun planとC3のclaim/auditは同一bucket内でprefix分離するが、GCS IAMのprefix限定を当然視しない。
7. Job実行時の引数override禁止、DryRun以外STOP、allowlist・親Org拒否・実行SA照合・数値Secret version固定・認証失敗STOPを継承。GET以外のDNSFilter APIを呼ばない。GCSへのcreate-only書込はDryRun計画の保存だけに限定する。
8. 計画本文を標準ログに出さない。ログ/receiptは非秘密のsource SHA、plan hash、GCS object名、generation、件数、status、mutation=0に限定。hostname等を一般ログへ出さない。C2実環境のGCS objectアクセス/保持期間と個人情報分類は構築前の承認ゲート。
9. C1の分離GCS claim adapterを破壊的APIへ接続しない。C3の排他・監査の実GCS検証、C4アンインストール、C5 Organization DELETEはそれぞれ独立承認。Org/Agent claim作成はC2の実証対象に含めない。
10. C1 entrypointが現状 `/work/review/plan.json` のみを書き、GCS adapterがentrypoint未接続である差分を最小修正する。C1の既存GET inventory関数、既存66件の結果を引き継ぐ。

## Work実装対象
- C1のGCS HTTP/metadata token adapterを再利用し、dryruns namespaceのcreate-only＋read-back専用関数を追加。
- entrypointでGET inventoryが成功した場合にだけ計画を保存し、再取得とhashを検証。失敗/不明ならJob exit nonzero。C1のfail-closed・秘密非出力を維持。
- 権限不足/412競合/HTTP不明/書込成功後読取失敗/読取内容改ざん/Hash不一致/Org逸脱/Secret失敗/Job override/DNSFilter変更API拒否のオフライン試験を追加。
- manifest/Runbook/IAM proposalの必要最小差分を更新し、Draft PR #44にCommit。既存実装とテストを無断で再設計しない。

## 実GCP着手前の停止ゲート
- Registry個別IAM、Build主体、Microsoft base image digest、Docker実build、専用SA、Secret数値version、Job spec、bucket名/UBLA/PAP/retention、GCS IAM、ログアクセス権を統括が確認・承認。
- 本番・既存Service/Secret/DB/IAMを変更しない。Secret本文をチャット・Git・Build argsへ渡さない。
- Workはコード/テスト/PRのみ。Cloud Build実行、GCP作成/変更、DNSFilter live GETも実行しない。

## 受入判定
C2コード実装PASSはオフラインfixture成功まで。C2実GCP PASSは別途承認された環境でJob→DNSFilter GET→GCS保存→read-back/hash→receipt照合を実証して初めて付与する。変更API要求0件を証跡で確認する。
