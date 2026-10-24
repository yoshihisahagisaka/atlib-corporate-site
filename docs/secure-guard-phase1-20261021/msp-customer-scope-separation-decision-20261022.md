# Secure Guard｜MSP管理権限と顧客Organization運用権限の分離

Date: 2026-10-22 JST
Status: **ユーザー確定Decision**。前回のcustomer-login-single-system-decision-20261022.mdおよびcustomer-roles-approval-design-v1-20261022.mdを本決定で補足・優先する。

## 最上位原則
- 単一Secure Guardシステム・共通ログイン基盤・共通業務API/ジョブ/監査。顧客向けとatLIB向けに別々の業務システムを作らない。
- **顧客Organization内の管理者・運用者は、atLIB社員でも顧客社員でもよい。雇用主で権限を区別しない。**
- **MSP管理者はatLIB側の役割**（例：atLIB代表者）。全顧客横断のMSP管理権限は顧客Membershipから生じない。
- 顧客常駐のatLIB社員は顧客Organization MembershipのRoleで日常運用し、MSP権限を持つものとして扱わない。
- 同じ人がMSP管理者と顧客Organization管理者の両方を持つ場合も、権限スコープを操作時に明示し、監査する。MSP権限の暗黙の流用禁止。

## 認可スコープ
- MSP Scope: atLIB管理者に明示付与。MSP横断のOrganization/契約/ライセンス/標準Global Policy/高リスク操作・Secret運用。実際のAPI書込はバックエンドの専用IDと承認済みジョブ経由。
- Customer Scope: customer_org_idのMembershipにより、自Organizationの端末/Site/申請/棚卸し/利用者管理を許可。別顧客へのアクセス不可。
- Identity/Userは共通。Customer MembershipとMSP Role Grantは別テーブル/別権限判定（論理）。顧客RoleがMSP Roleへ昇格する経路を設けない。
- UIは同一アプリ内でscopeに応じて表示/操作を制限。UI表示制御だけでなくAPI、ジョブ、DBクエリ、監査で強制する。
- MSP管理者も通常顧客業務では顧客Scopeを明示するか、権限を限定した監査付き支援操作を使う。顧客へのなりすましは禁止。

## 暫定マトリクス（個別承認ルールは次工程）
| 操作 | MSP管理者 | 顧客Organization管理者 | 顧客Organization運用者 |
|---|---|---|---|
| 全顧客Organization/契約/請求管理 | 可 | 不可 | 不可 |
| 自Organization端末管理・棚卸し | 支援時のみ監査付き | 可 | 可 |
| 顧客内利用者の招待/失効 | 統制・支援 | 可（上限あり） | 不可 |
| Site/Policy分離 | MSP承認/統制 | 申請 | 申請 |
| 遮断解除申請 | 監査付き支援 | 可 | 可 |
| 遮断例外の最終承認 | MSP基準に従う | 別途付与権限がある場合のみ | 原則不可 |
| Global Policy変更 | 厳格な承認後 | 不可 | 不可 |
| MSP APIキー/Secret | 専用権限のみ | 不可 | 不可 |
| Organization作成/削除 | 承認済みJob経由 | 申請のみ | 不可 |

## 既存文書との関係
- customer-login-single-system-decisionの「atLIB内部管理アカウントではない」は**顧客先常駐運用者**を指す。MSP管理者という別スコープの存在を否定しない。
- customer-roles-approval-design-v1の3RoleはCustomer Scopeの役割案であり、MSP管理者を含まない。前回案の「atLIB側承認担当者も顧客Membershipで扱う」部分は、本決定に従いMSP Scopeによる承認も許すよう修正対象。
- 画面・認証基盤・業務ロジックの二重開発は不可。スコープと権限だけ分ける。

## 次の設計
- MSP管理者権限の付与/失効/緊急アクセス、二人承認条件。
- Customer Roleと追加承認権限の境界。
- MSPからの顧客支援操作の対象固定と監査。
- 異なるCustomer Organization間の越境拒否、MSP権限昇格拒否のテスト。
- PHP脆弱性対応中は設計・Git記録のみ。実機、GCP、DNSFilter変更、Production、Work実装指示なし。
