# Secure Guard｜標準システム・アカウント権限・350台初回導入 決定記録

Date: 2026-10-22 JST
Status: **APPROVED / Business & Architecture Decision**
Canonical: PR #44, prior decisions customer-login-single-system-decision-20261022.md, msp-customer-scope-separation-decision-20261022.md. This decision supersedes proposals for special customer-specific UI, staff proxy flow, identity/person linking, and complex account switching.

## 確定事項
1. **今回の350台案件に固有のアプリケーション機能・画面・API・ジョブは開発しない。** 標準Secure Guardサービスの初回導入事例とする。
2. 顧客とatLIB常駐運用チームは**同じ顧客向けSecure Guardシステム**を使う。顧客向けとatLIB常駐向けの別システム/別画面/別ロジック/別認証は作らない。
3. **1アカウント = 設定された役割とアクセス可能な顧客Organization範囲**。権限はログインアカウントの設定をサーバーで検証する。メールドメインや雇用主から自動付与しない。
4. Roleの基本区分はMSP管理者（atLIB）、顧客Organization管理者、顧客Organization運用者、顧客Organization閲覧者。顧客内管理者・運用者はatLIB社員でも顧客社員でもよい。
5. 同じ人間がMSP管理用アカウントと客先運用用アカウントなど複数アカウントを持てるが、**別アカウントとして独立管理**。同一人物の自動紐付け・権限合算・複雑な切替機能は作らない。
6. MSP管理権限はatLIBが明示付与し、顧客Roleからの昇格は不可。顧客アカウントは許可されたOrganizationのみ操作可能。MSP横断権限と顧客内権限を分離。
7. 単一の共通認証基盤でGoogle/Microsoft等を選択可能にする設計は検討対象だが、**@atlib.jp Googleドメイン限定のログインに依存しない**。認証プロバイダの採用・実装範囲は未決定。
8. 標準の端末管理、Site/Policy分離、遮断解除申請・承認、月次棚卸し、請求数量確定、解約ジョブを全顧客に同じ仕様で提供する。高リスク操作の承認・監査・秘密分離は継続。
9. 顧客別の初期設定（Organization/Site、Policy、アカウント付与、PoC、端末配布、運用引継ぎ）は標準手順で実施する。**顧客別設定は顧客別コード開発ではない**。
10. 初回導入時に共通管理画面が未完成ならDNSFilter管理画面で暫定運用可能。ただし恒久的な別システムは作らない。

## 初回350台案件の既決条件
- 提案訴求6項目：悪性ドメイン遮断、社内外保護、端末ごとの可視化、利用状況によるPolicy分離、運用・遮断解除対応、PoC段階導入。
- PoC 10台・約2週間・無償を基本案。FortiGate共存はatLIB内部の確認事項として顧客提案には記載しない。実効保護が確認できなければ本格展開前に解消。
- 月額基本5,000円/社＋実登録端末300円/台・月（運用費込み、税別）、350台時110,000円/月。今回レベニューシェアなし。標準初期費300,000円を今回限定0円。
- 請求対象の有効登録定義、月次締め、月途中増減、DNSFilter仕入数量・課金条件は未確定。確定前に実利用・Allocated・登録数を混同しない。
- 既存常駐運用チームが顧客Organizationの通常運用者/管理者として対応。PIRA経由では顧客社員が同じ操作をする。

## 既存設計案の扱い
- 過去の「atLIB社内アカウントで顧客を選択して代理操作する」モデルは**不採用**。
- MSP管理者用の権限スコープは残すが、独立した業務システムを意味しない。
- 複数Membershipや同一人物のアカウントリンク、複雑なスコープ切替は初期要件としない。必要になった場合は別途Business Decision。
- 前回の権限マトリクスは詳細案であり、承認フローの個別権限・自己承認禁止などは次工程で詰める。

## 次工程（設計のみ）
1. 共通画面の最小機能を定義（顧客ホーム、端末一覧/追加/削除、Site/Policy、申請/承認、棚卸し/契約数、アカウント管理、操作履歴）。
2. Role×操作の最小マトリクスと承認ゲートを確定。MSP管理者と顧客Roleの境界テストを明文化。
3. 350台顧客PoC/初回導入Runbook、料金・月次請求定義、提案資料を並行して仕上げる。
4. 既存Git/docs/CanonicalとのFit/Gap後、Workに標準機能の最小差分実装のみ指示する。
5. PHP脆弱性対応中はGCP/DNSFilter実機、IAM/Secret、デプロイ、Production/main変更、Work実装指示を停止。Git/docs決定記録のみ実施。
