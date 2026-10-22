# Secure Guard 共通顧客管理｜権限・承認フロー詳細設計 v1（提案）

Date: 2026-10-22
Status: **詳細設計案・未承認**。上位の「単一顧客ログイン／Organization Membership」原則は承認済み。
Related: customer-login-single-system-decision-20261022.md、PR #44。

## 不変条件
- 顧客社員もatLIB常駐社員も同じ顧客ログイン・同じUI/API/DB/ジョブ/監査。雇用主による権限差なし。
- 権限は個人User × 顧客Organization Membership × Roleで評価。顧客間のAPI/ジョブ/DBアクセスを拒否。共有アカウント・なりすまし禁止。
- DNSFilter APIキーはバックエンド専用。顧客ブラウザへ渡さない。
- 危険なサイトの例外解除は自動承認しない。申請者の自己承認禁止。対象顧客・Site・URL・期間を限定。
- Organization DELETEは顧客から直接呼び出せない。実機検証と承認済み解約ジョブを前提とする。
- 実機・GCP・Production変更とWork実装指示はPHP脆弱性対応中は停止。

## Role案
- org_admin：自社利用者招待・停止、契約閲覧、端末管理、申請。
- operator：自社端末管理、棚卸し、Site/Policy変更申請、遮断解除申請。
- viewer：自社状態・履歴閲覧のみ。
- 役割は所属会社に依存しない。ユーザーは複数顧客Organizationへの個別Membershipを持てる。

## 操作マトリクス案
| 操作 | org_admin | operator | viewer |
|---|---|---|---|
| 自社Site/Agent/登録台数・保護状況閲覧 | 可 | 可 | 可 |
| Agent登録・アンインストール要求 | 可 | 可 | 不可 |
| 月次棚卸し | 可 | 可 | 閲覧 |
| Site追加/Policy分離 | 申請 | 申請 | 不可 |
| 遮断解除 | 申請 | 申請 | 不可 |
| Site Key Rotate | 申請 | 申請 | 不可 |
| 自社Membership招待・失効 | 可（権限上限） | 不可 | 不可 |
| 契約・請求閲覧 | 可 | 原則不可 | 原則不可 |
| 解約申請 | 可 | 不可 | 不可 |
| Organization DELETE | 不可（承認済みバックエンドJobのみ） | 不可 | 不可 |

## 追加承認権限案
policy_exception_approve / site_change_approve / key_rotation_approve / contract_change_approve / cancellation_approve。
同一ログインの個人に限定付与。申請者と承認者の分離、承認対象のハッシュ/版固定、失効後の再認可を必須とする。
例外解除は、顧客の常駐運用チームの適格責任者が承認するケースと、PIRA顧客に対してatLIB側の担当者が承認するケースを同じワークフローで表現する。ただし後者のMembership付与・職務分離の具体的な方式は次工程で確定する。

## 承認フロー案
- 例外解除: 申請→重複/危険判定確認→人による承認/却下→対象限定API適用→GET照合→通知/監査→期限到来時の復帰。
- Site/Policy/Key: 変更前スナップショット→影響/承認→排他ジョブ→API→照合。結果不明なら停止。
- 解約: 顧客管理者申請→契約権限者承認→指定日時ジョブ→全Site/Agent取得→Uninstall要求→Pending確認→安全条件を満たした場合のみOrg DELETE→DNS/課金/監査照合。Pending直後DELETEの安全性は実機未検証のため無効。

## 共通画面案
ホーム、端末管理、Site・Policy、遮断解除申請、契約・請求、利用者管理、操作履歴。画面を分岐して別システム化しない。表示制御に加えAPIで強制認可。

## 次に統括レーンで決める論点
1. policy_exception_approveを誰が付与・剥奪できるか。PIRA顧客の承認担当者を同一顧客ログイン原則とどう両立するか。
2. 高リスク操作ごとの二人承認要否、危険度基準、期限上限。
3. 端末削除と契約数量変更の境界、月次登録数スナップショットの締め・異議対応。
4. 既存認証/顧客ID資産とのFit/Gapと物理DB分離。
5. 顧客OrganizationとDNSFilter OrganizationのID/権限対応、Membership招待/失効時のジョブ処理。

現段階では提案であり、実装承認ではない。
