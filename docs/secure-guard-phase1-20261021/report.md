# atLIB Secure Guard｜MSP商用化 Phase 1 残検証・一括承認パッケージ
作成日: 2026-10-21 JST / 状態: 承認前、DNSFilter変更操作0件

## 判断
商用サービス開始は保留。提案資料の制作は既存Issue #13の条件付き進行を維持する。
今回は既存記録の復元、サポート回答反映、オフライン10試験、変更承認パッケージまで完了。
実機GET、変更系実機試験、削除は未実施。実機接続と変更承認の取得後に結果を追記する。

## 1. Canonicalと調査証跡
- Repository: yoshihisahagisaka/atlib-corporate-site
- GitHub main: 1caa2eb1fec2d887a41130b0aa0fdf102493562b（2026-10-21 fresh GET）
- PR #7: merged。head 23b887d124a0b7915af9d74485c8903409d784f1。API、P0/P1/P1.5記録。
- PR #9: open、未マージ。head 932bf38662fe8c3db9eb27d97032ef72bc632abc。単一Site Rotate、顧客権限・RPA評価を含む。mainだけではこの追加証跡を再現できない。
- PR #6: open。head bbc0e8679b69f3bd25a35c45391a3204952e0480。公開Block Pageの配置証跡。
- Issue #8、#10〜#13、#15〜#17、#36: 本文とコメント一覧を取得。取得時コメント0件。
- 料金比較PR #14/#18は並行作業として確認。変更・再設計しない。
- ローカル C:\atlib\atlib-corporate-site と worktree-secure-guard-corporate はgit status/logがPermission denied。ローカルHEAD、未コミット差分、ブランチは未確認。既存作業は変更しない。
- main treeにAGENTS.mdなしを確認。プロジェクトsources/は読み取り専用、変更なし。
- 新規専用docsブランチをmainの上記SHAから作成し、本報告とオフラインモデルだけをDraft PRへ追加する。

## 2. 既存PASS・未検証・未解決
|領域|引き継ぐ確認済み事項|残項目|
|---|---|---|
|P1 Organization|一覧・詳細GET、02の外部ID、UIでCore Monthly作成済み|03 POSTは未実施。正式SKU・term指定・契約条件|
|P2 Site|API Network作成10678582、外部ID、Global Policy/Block Page割当PASS|複数Siteでの端末別運用・非干渉|
|P3 Policy|Global Policy 1510300、Block Page 70676の割当PASS|顧客固有例外の範囲・優先順位・監査・復帰|
|P4 Agent|Windows保護、Phishing/Malware/Botnet遮断PASS。02に2登録・Protected（10/18）|専用端末のSite移動、移動後Policy、終了、offline復帰|
|P5 Key|Network GETで既存Key取得可。10678570 Rotate HTTP200、直後/約1分後Protected、限定blockedログPASS|旧Key新規登録拒否、offline端末、複数Site非干渉、緊急操作競合、端末ブラウザ|
|P6 Provisioning|Network作成前の重複確認を既存PoCで実施|実運用台帳・キュー・分散排他・再実行・実API制限。今回モデル試験は後述|
|P7 数量|02: allocated=1、in_use=2、登録2。期間を変えてもin_use=2|月次確定請求数、確定時刻、仕入との照合|
|顧客権限|公式資料上のrole評価、簡易日本語画面＋標準詳細画面という方針|他社アクセス拒否、Key操作権限・監査の実機検証|

既存PASSは再実施しない。既存IDのfresh GETは、変更前の安全確認・現在値の確定のためにのみ行う。
PR #6単独ではExternal Block Page適用が未確認だが、後続PR #7/#9の割当・ログ確認は引き継ぐ。端末ブラウザ表示は別判定。

## 3. サポート回答によるFit/Gap更新
以下は今回ユーザーが提示したDNSFilter回答として採用。メール原文を今回再取得したという意味ではない。
|論点|更新判断|
|---|---|
|Organization external_id|作成時指定可能。以前の「公開入力schemaにないため未確認」をサポート確認済みに更新。ただし一意制約・冪等保証は未確認|
|MSP SKU一覧|現状なし。Distributor endpointでの代用やbasic→Coreの推定は禁止|
|課金開始|Organizationへのプラン・ライセンス割当時から発生するという回答を採用|
|最低ライセンス|Organizationごと最低1、agent 0でもtrial終了後は最低1対象|
|Site削除|Organizationのライセンス割当を減らさない|
|Organization削除|credit詳細は回答待ち。削除＝即時返金・完全取消とはしない|

未解決: 正式Core/Monthly SKU、正式payload/契約モデル、trial終了の正確な日時・timezone、自動有料移行、月次確定数量と取得手段、日割り・削除credit、最低月額の適用、1,000 Organizationの契約/サポート上限。
Issue #36のAllocatedツールチップと今回の割当時課金回答は、割当開始条件と最終数量定義の違いとして記録し、矛盾を推測で解消しない。請求数量の正式定義を待つ。
Organization 03のPOSTは保留。UI経由での作成も課金を伴い得るため回避手段にしない。

## 4. 対象台帳（過去証跡。現在値ではない）
|対象|ID・関係|扱い|
|---|---|---|
|MSP親 atLIB Inc.|Organization 10220948|Billingあり。削除・契約変更・今回の追加Rotate対象外|
|親の既存検証Site|10678570、旧証跡agent fab5ff1c-36c3-405d-ab49-f7ced202f309|既存業務端末の可能性があるため一切変更しない|
|Test Organization 02|10220954、SG-POC-ORG-002|実機確認の候補。10/18時点で2端末、現在の端末用途・全Site所属は未確認|
|既存Test Site 02|10678578、Organization 10220954|変更・削除しない|
|既存API Site 03|10678582、Organization 10220954、SG-POC-SITE-003|今回の変更・Rotate対象にしない|
|標準Global Policy|1510300|本体の編集禁止|
|Global Block Page|70676|本体の編集禁止|

## 5. 変更系操作の一括承認パッケージ v1
承認は本節のAのみを対象とする。B/C/Dは保留または別途明示承認であり、A承認では実行しない。
実行前に認証済みGETで親子関係、全ページの重複、Global属性、現在の割当を確認する。ID・名称が違う、既存同名がある、課金変更を要求される、想定外HTTP/設定差分がある場合は停止。
POSTの結果不明時は再送せず、外部ID・名称・親子関係を再GETして照合。不明なら人手レビュー。

### A: 新規・空Site 2件の作成（承認依頼、最大POST 2回）
対象Organization: 10220954。親MSP: 10220948。新規Site IDは未発行。
承認対象は下記の名前・external_id・親Organizationの組に限定し、成功応答のIDを直後GETで照合して実行台帳へ固定する。既存Siteの再利用・更新はしない。
|操作|正確なpayload|想定影響|復旧方法|
|---|---|---|---|
|POST /v1/networks 1回|network: {name: "Secure Guard Phase1 Standard Site 04", organization_id: 10220954, external_id: "SG-P1-SITE-004", policy_ids: [1510300], block_page_id: 70676}|新しい空の保護/Policy管理単位。IP登録・agent導入なし。Global本体は不変|既存保護への復帰操作は不要。作成結果を隔離・記録し、不要Site削除はCで別承認|
|POST /v1/networks 1回|network: {name: "Secure Guard Phase1 Exception Site 05", organization_id: 10220954, external_id: "SG-P1-SITE-005", policy_ids: [1510300], block_page_id: 70676}|同上。作成直後は標準設定と同じ。例外はまだ適用しない|同上|

前提: 最新schemaまたはDNSFilter確認済み仕様が上記入力を受け付けること、現在のtrial/契約上のSite追加影響を確認すること。未確認のまま送信しない。
成功条件: 201、返却IDのGET一致、Organization=10220954、external_id一致、Policy=1510300、Block Page=70676、agent/IPが0、既存Siteの設定差分なし。
この2件は既存Network作成PASSの再試験ではなく、以後の複数Site・例外隔離に必要な検証用リソースの準備である。
GETでsecret_keyを含む場合も応答本文は出力しない。Key発行/Rotate/削除、agent操作、ライセンス変更はAに含まない。

### B: Policy・端末・Key一貫試験（承認対象外、対象確定後に一括改訂）
現時点で専用端末のagent UUID、version、現所属、復旧経路、ローカル例外Policy ID、最新書込schemaがない。広い条件付き承認で代替しない。
必要な一括改訂内容:
1. Aの2 Site ID、専用の廃棄可能Windows試験端末1台のUUID/version、現所属/個別Policy/Block Page/タグの変更前snapshotを固定。既存02の2端末は用途不明なので使わない。
2. Global 1510300の設定を参照した隔離ローカルPolicyを作る正式endpoint/payload、割当先Site ID、変更前後の差分、無害なテストドメインと期待結果を確定。Global Universal Listとの優先順位も区別。
3. 標準Siteと個別Siteの両方で専用端末を移動し、有効Policy・Protected・公式テスト・他Site非干渉を確認。API関係だけで保護実証としない。
4. Keyは既存取得PASSを再試験しない。残項目に必要な試験SiteだけRotate 1回を上限とし、offline専用端末の復帰と他Site不変を確認。旧Key新規登録拒否は別の廃棄可能端末/VMを確保した場合のみ追加。
5. 月次/緊急競合は実APIに同時PATCHを投げない。ロック/世代/不明結果停止をモデルで確認し、実機は承認済み1 Rotateの直列制御だけ確認。
6. 終了・削除・remote uninstallのどれを行うか、対象UUID、保護停止/再出現/Pending Uninstall、MSI/secret store/管理者権限による復旧手順を明示する。
7. 例外復帰は試験Siteを1510300/70676へ戻す。端末は変更前snapshotへ戻す。Rotateに旧Key復元の保証はなく、現Keyで再登録する。廃止/再導入を含め操作上限と証跡をパッケージへ記載する。
顧客ユーザー招待・権限変更は本パッケージに含まない。#10〜#12の権限実機検証は未完了として残す。

### C: 新設Site/ローカルPolicyの削除（未承認）
A/Bの実測ID、agent/IP 0、割当解除、証跡保存、削除の復旧不可/新ID再作成、Organization license不減を確認して改訂承認を得る。A承認だけでDELETEしない。

### D: Organization削除（別途明示承認）
候補は10220954のみ。03は未作成で削除対象に存在しない。親10220948は除外。
必要条件は第10節。現在の2登録端末の保護影響が不明なので、今の状態で削除を承認依頼しない。

## 6. 今回の実機確認・証跡
|確認|今回の結果|
|---|---|
|GitHub main、PR/Issue取得|成功。上記SHA/対象を参照|
|既存ローカルgit status/log|Permission denied。既存作業の状態は未確認|
|API認証環境|現在のプロセスにDNSFILTER_API_KEYなし。秘密ファイルの探索・出力なし|
|ブラウザ|cua.getState 2回とも trusted Node process exited unexpectedly。認証済み画面確認に到達せず|
|最新公開OpenAPI GET|PowerShellはHttpRequestException、web取得もaccess不可。過去記録の仕様と区別|
|DNSFilter実機GET|未実施。接続不可をAPI/権限FAILとは判定しない|
|変更API・設定・端末操作|0件|
|Organization整理|未実施。対象/影響/明示承認待ち|

実機再開はAPIキーをチャットへ貼らず、同一実行セッションの安全な秘密供給または認証済みUIを利用する。
安全確認GETの順序: Organization一覧（全ページ）→10220954詳細→親IDでMSP Network全一覧→対象Network詳細の許可属性だけ抽出→全agentと所属/状態→Policy/Block Page→必要なusage/counts未確認構造のみ。
Network GETはsecret_keyを返すため、raw body/例外body/transcriptを保存しない。属性allowlistでID、関係、名前、external_id、状態のみ記録。
既存PASSのusage再測定は、変更前後比較が必要な時だけ行う。

## 7. オフライン試験結果
実行: node provisioning-rehearsal.cjs（Node、2026-10-21）。終了コード0、10/10 PASS、実ネットワーク要求0。
|試験|結果|
|---|---|
|1,000社×2 Siteの作成モデル、全件再実行|2,000件のみ作成、重複なし|
|POST成功後の応答消失|全ページ再照合で回収、再POSTなし|
|結果不明かつ検索に出ない|不明状態で停止、再POSTなし|
|送信前と確定した失敗|安全な再開|
|2 Site途中失敗|完了Site維持、失敗Siteだけ照合|
|External ID重複|手動レビューへ停止|
|429 Retry-After秒/HTTP-date/不正値|指定待機を下回らず、fallback backoff|
|緊急Rotateと月次ジョブ|古い世代の月次ジョブを拒否、同一要求を再送しない|
|Rotate応答timeout|不明状態で後続要求停止|
|異なる顧客のSite操作|所有関係で拒否|

限界: これは仕様理解のためのインメモリ参照モデル。実商用worker・実API・DB永続化・プロセス並列/lease期限・rate scope・eventual consistencyの実証ではない。
実装時は顧客ID/操作IDのDB一意制約、トランザクション/分散lease、再起動時の不明状態回収、監査権限、ランダムjitter、実HTTP 429とページング契約のadapter試験が必要。
POST/Rotateの不明結果を一般的HTTP retryに渡さない。429による変更拒否と通信切断による適用不明を区別する。

## 8. 管理モデル（既存方針を継承）
|実体|識別子・責任|
|---|---|
|共通顧客企業|atLIB customer_id（共通台帳#16）。会社名を主キーにしない|
|Guard契約|service_contract_id、契約状態、顧客請求ルールversion|
|DNSFilter Organization|customer_id/契約との対応、external_id、MSP親ID。一意保証はatLIB側で担保|
|Site/Network|Organization配下の複数管理単位。site_role、external_id、network_id、Policy/Block Page ID。物理境界とはみなさない|
|端末|agent UUID、所属Site、有効Policy、version、last seen、状態、廃止要求/保護終了を別管理|
|Policy例外|顧客/対象Site、理由、承認者、期限、変更差分、復帰先。Global本体は変更不可|
|Key運用|Siteごとのジョブ/世代/排他/不明状態。秘密本文は台帳/Git/一般ログへ保存しない|
|監査|操作ID、実行者、承認version、対象ID、開始終了、HTTP結果、許可属性の前後、復旧/検証結果|

数量は以下の4系統を独立保存する。
- Allocated Licenses: 割当設定。最低1・課金開始条件と関連するが、確定月次数量と同一とはしない。
- Roaming Clients in Use: DNSFilter詳細usage。過去の締め数量を復元できるとは確認されていない。
- 登録agent数: ページング/削除/offline定義を伴う登録情報の件数。使用量や請求数量と別。
- atLIB顧客請求数量: 契約ルールに基づく締めsnapshot。仕入の確定数量・訂正記録と照合し、現時点のIn Useから自動確定しない。

## 9. 1,000社の技術的制約
- Organization一括作成APIは既存公開調査では未確認。1社ごとキュー/照合。external_idはvendorの冪等キーとは未確認。
- Siteが平均2件なら2,000 Site。Site追加はlicense削減手段ではなく、Policy/端末運用の単位。
- rate上限は過去公開調査の「Organization当たり300秒2,000要求」を暫定参照。MSP横断での計数範囲・最新値は未確認。モデルPASSで実サービスSLAを主張しない。
- 仮定: 1社あたり1 Organization POST＋2 Site POST＋各GETなら最低6,000要求（Key、再照合、全ページ一覧、agent/usageは別）。実時間・費用の測定値ではない。
- 単件Rotate、顧客間隔離、低並列、429尊重、不明結果停止。全社同時変更をしない。
- 契約上限、推奨並列、bulk部分失敗、監査取得、最小権限identity、APIキー期限更新、offline復旧、日次同期ページングは残課題。
- RPA/人手は契約入力の暫定案のみ。無人1,000社運用の成立を証明しない。
- DNS保護通信はatLIB経由ではない。メタデータ/API/監査の拡張評価と保護トラフィックを混同しない。

## 10. 後処理・削除計画
基準日は2026-10-21 JST。ユーザー指定の「残り約10日」は計画上の概数で、終了日を10/31と断定しない。
1. 最優先でdashboard/サポートからtrial終了日時・timezone・自動移行条件を確認。
2. 今週中（10/23目標）に接続復旧、A/B対象確定、承認済み検証を完了。10/23に未完了でも残件・課金リスク・削除可否を統括へ報告。
3. 10/24までを目標に不要リソース台帳と削除承認パッケージを提出。終了がこれより早ければ前倒し。回答待ちのまま期限まで放置しない。
4. Organization 10220954の全Site、全agent、現使用者、保護状況、個別Policy、ライセンス/契約をfresh GET/UIで棚卸し。2台とも廃棄試験用とは推測しない。
5. 必要な端末を先に安全な保護先へ移す/承認済みuninstall。Query Logs/監査/試験結果から必要証跡だけ秘密非記録で保存。
6. 削除後の課金停止日、最低1、credit・日割り、復旧可否を確認。未回答ならそのまま不明と明記し、継続課金リスクとの比較を統括へ提示する。
7. 正確なOrganization/Site ID、agent影響、証跡、課金、不可逆性を提示し、Organization DELETEを別途明示承認後のみ実行。APIの正確な削除schemaも先に確認。
8. 再作成は同一ID/Key/履歴の復元ではない。新ID、新Key、必要な再導入となる可能性を明示。
9. 削除後GETの非存在、親10220948維持、残存端末保護、Billing表示・後日請求/creditを照合。Site削除だけでlicense減とはしない。

これは作業計画であり、自動リマインダーや予約削除は設定していない。

## 11. Go/No-Goの残条件
- 技術: 複数Site、例外優先順位/非干渉/復帰、専用端末移動/終了、offline/旧Key、監査、失敗時回復の実機証跡。
- Provisioning: 正式Core Monthly作成手順、API/UI readback、冪等・永続排他、再実行、429/ページング、1,000社契約条件。
- 課金: trial終了/自動移行、最低/確定数量、仕入明細、月途中追加削除/credit、顧客請求締めの定義。
- 運用: 端末保護復旧手段、Key秘密供給、責任者/窓口、監視・監査、顧客間アクセス拒否。顧客画面実装は#13の後工程を維持。
- 整理: 不要Organizationの明示承認削除または期限前の別方針決定。

現判定: 技術的見通しは条件付きFit、商用開始はNo-Go（未解決条件が残るため）。既存の保護機能PoCをFAILへ変更する判断ではない。

## 12. 2026-10-22 JST 条件付き承認受領・実行前確認
ユーザーはAのみ条件付き承認。対象は10220954内の上記空Site2件、名称/external_id/Policy/Block Page/POST上限を固定。端末移動、Policy変更、Key操作、DELETEは承認対象外。
承認の条件は認証/接続復旧、最新仕様とOrganization現在状態、全件重複確認、Site作成の課金/契約影響、既存Site/端末への非影響。条件未充足ではPOSTしない。

|事前条件|今回の確認結果|判定|
|---|---|---|
|API認証|現在の実行プロセスにDNSFILTER_API_KEYなし。秘密値を探索/表示せず|未充足|
|API接続/最新仕様|公開OpenAPIのGET再試行はHttpRequestException。最新本文なし|未充足|
|Organization現在状態/全Site/全端末|認証済みGETなし。過去証跡だけを現在状態としない|未確認|
|Site重複なし|最新全件棚卸しなし|未確認|
|Site作成課金/契約影響|Site削除がlicenseを減らさないという既回答だけでは、新設の影響なしを確定できない|未確認|
|既存保護への非影響|既存Site/端末の現在の所属と設定を取得できず|未確認|

結論: **POST未実施（0/2）、新規作成IDなし、作成後GET照合は非該当**。条件付き承認は保存し、Aの再承認は求めない。同一の承認内容を拡張しない。
このturnで利用可能なブラウザ/コンピュータ操作toolはない。過去の起動失敗とは区別する。
PR #44 headは開始時dcd697f9ffd03f1bb3b3c6760ffd04f2429b9757。PR #44/#36に追加コメントなしをfresh取得。
Production/main/既存顧客設定の変更なし。

### D-v1 削除承認パッケージ（緊急棚卸し版・実行承認依頼前）
|項目|確定・未確定の内容|
|---|---|
|削除候補Organization|10220954、過去external_id SG-POC-ORG-002。名前・親子関係はfresh GETで再確認が必要|
|削除対象外|MSP親10220948とそのSite10678570/既存端末。本パッケージで変更しない|
|配下Site候補|10678578、10678582（既存証跡）。これ以外がないとは未確認。今回04/05は未作成|
|紐づく端末|10/18証跡で2件。現在UUID/所属/利用者/用途/保護への影響は未確認。勝手に試験端末とみなさない|
|課金|Organization最低1、agent0でもtrial後対象、Site削除では割当不減。Organization削除credit/停止日、trial終了時刻/自動有料移行は未確認|
|不可逆性|同一ID/Key/履歴への復元保証なし。再作成は新リソースとなり再導入を要する可能性。正式仕様を確認|
|証跡|全Site/agent所属・保護状態、承認、試験結果、例外設定、請求条件をKey非記録で保存。Key/生レスポンスはGitへ保存しない|
|保護の移行/終了|端末所有者・用途確認後、承認済みの保護移行または終了を先行。現在は端末操作未承認なので実行しない|
|想定DELETE|正確なOrganization削除endpoint/schemaと削除対象IDを最新仕様で確定後、1件だけ明示承認依頼。Site/agent DELETEを暗黙に含めない|
|復旧|旧状態の完全復元は未保証。端末の保護復旧には別の確認済み保護先/再導入手段を事前確保|
|実行後確認|対象不在、親維持、必要端末のProtected、ライセンス/請求表示、後日の確定明細/creditを照合|
|実行可否|**HOLD。DELETE未承認・未実施。現在状態と課金確認が済んだ版を統括へ提出して明示承認を得る**|

優先順位: (1) trial終了の正確な日時と自動移行をdashboard/既存サポート回答で確認、(2) 10220954の全端末/全Site棚卸し、(3) 現存2端末の必要な保護継続手段と課金停止/creditの確認、(4) 削除承認版を提出。空Site作成より期限前の整理判断を優先する。
10/23の確認目標を維持するがtrial終了日を推測しない。期限/creditが未回答なら、その不明点と最低課金継続リスクを明記した判断材料を先に統括へ出す。削除を勝手に実行しない。

### 接続を復旧するためのGET専用補助手順
同ディレクトリの `get-cleanup-inventory.ps1` をDNSFilterへ接続できる信頼済みPowerShellで実行する。
既存のセッション環境変数がなければAPIキーをローカルで非表示入力する。キーをチャットへ貼らない。スクリプトはGETのみ、raw応答/Key本文を出力せず、許可属性だけをJSON表示する。ファイル書込・リトライ・変更操作なし。
実行例: `powershell -NoProfile -File .\get-cleanup-inventory.ps1` またはPowerShell 7の `pwsh -NoProfile -File .\get-cleanup-inventory.ps1`。実行ポリシーを変更/回避しない。
**現時点では単一応答の補助収集であり、ページングの完了・重複不存在・API契約値・保護非影響・DELETE適格性を証明しない。** 参照関係が不明な行や次ページがある場合は追加確認する。
PowerShell AST構文解析はPASS。実API/実レスポンスとの適合は未検証。実行後はキーを含まない上記の限定出力と、dashboardのtrial終了/契約条件を照合してDを確定する。

## 13. 2026-10-22 JST ユーザー実機棚卸し受領・残ゲート集中
本節は第12節の該当する未確認項目を更新する。ユーザーの実機報告を証跡として受領し、当方による再実行はしていない。
- API接続・認証: **PASS（ユーザー実機）**。当方のプロセスへのキー供給とは別であり、接続失敗扱いに戻さない。
- Organization 10220954、既存Site 10678578 / 10678582: **PASS（ユーザー実機）**。
- 所属2端末 Active / Protected: **PASS（ユーザー実機）**。
- 会社PC agent ID先頭: 82500d2b…、自宅PC: 2a7659c5…。完全UUID、各端末の現在Site、version、OS/設定パスは未提示。省略IDをAPI操作へ使わない。
- 既存確認済みGETを繰り返さない。下記だけを残条件として扱う。

### A残条件の現在の判断
|残条件|今回の確認・必要証跡|判断|
|---|---|---|
|全ページ重複確認|MSP親10220948のNetwork一覧を全ページ走査。対象名2種とSG-P1-SITE-004/005を完全一致検索、各親Organizationを照合。現時点で単一応答の2 Site確認しか受領していない|未確認|
|最新Network作成仕様|公式API Docsはhttps://apidocs.dnsfilter.com/ → https://api.dnsfilter.com/docs。JSON本文は取得不可。公式UI資料ではRC専用SiteのIP空欄を許容するが、最新POST schemaの代用とはしない|未確認|
|Global Policy 1510300現在値|GET /v1/policies?organization_id=10220954&include_global_policies=true の必要ページでID/名称/is_global_policy/所有関係を確認。設定の本文を出力せず、変更しない|未確認|
|Block Page 70676現在値|GET /v1/block_pages?organization_id=10220954 の必要ページでID/名称/is_global/所属/redirect先の既定公開URLを確認。設定を変更しない|未確認|
|Site追加の課金影響|公式価格説明はRC端末単位、Networkは非agent通信量単位。空Siteそのものを課金単位とする記載は確認されなかった。ただしatLIB固有契約・自動割当・最低額への影響なしは未確定|未確認・推論のみ|

既存成功payloadは第5節Aから変更しない。現在の作成schemaでname、organization_id、external_id、policy_ids配列、block_page_idが受理されるか、IP/agent/契約を追加しない入力が許容されるか、成功201と返却IDの構造を確認する。schema差異があれば送信しない。
最新仕様取得はGET https://api.dnsfilter.com/docs/api.json の networks POST request定義と参照schemaだけを抽出する。Core SKUや契約変更はこのSite確認へ混ぜない。
全ページ確認はresponseのlinks/metaと公式ページング仕様に従う。nextリンク終端、取得ページ数、総件数/重複ID、同一ID再出現、最終ページを記録。ページング仕様不明・途中失敗・走査ループ時は「重複なし」を出さない。既存補助ps1は単一応答のためこれをPASSにできない。
候補名:
- Secure Guard Phase1 Standard Site 04 / SG-P1-SITE-004
- Secure Guard Phase1 Exception Site 05 / SG-P1-SITE-005
名前またはExternal IDが1件でも一致したら、POSTを止めて既存IDと所属を照合する。今回未作成のため、既存一致を勝手に「今回成功」としない。

当方環境には引き続き認証キーが供給されていないため、残GETは実行できていない。認証済みユーザーセッションから残対象のみ取得して引き継ぐ必要がある。ユーザーの接続PASS自体を再確認する作業は依頼しない。
課金については既存サポート質問への回答またはatLIB契約条件で「10220954にIP0/agent0、既存Global設定参照のSiteを2件追加し、plan/allocated/featuresを変えない場合」の影響を照合する。無断の追加問い合わせ送信はしない。
**現時点: 残ゲート未充足のためPOST 0/2、新規IDなし。A条件付き承認は継続、再承認依頼なし。**

### Organization削除試験 D-v2: 会社PC/自宅PCの保護継続と復旧
2台は実利用の会社PC・自宅PCと判明した。廃棄可能な隔離試験端末とみなさない。
推奨は先に両端末を存続する保護先へ退避してから、不要になった10220954を削除する計画。Organization削除で実利用PCの障害を意図的に起こす試験は、現在の承認範囲に含まない。
「削除に伴う障害挙動そのもの」の検証が必要なら、別の廃棄可能端末と隔離Organizationによる新規パッケージを作る。今回A承認でその準備を実行しない。

|準備|会社PC|自宅PC|
|---|---|---|
|端末識別|82500d2b…の完全UUID/現在Site/versionを確定|2a7659c5…の完全UUID/現在Site/versionを確定|
|操作権限|現地/ローカル管理者、業務停止可能な時間帯を確保|現地/ローカル管理者、在宅利用停止可能な時間帯を確保|
|復旧資材|対応する公式MSI、必要runtime、秘密供給手段、設定控えを端末から利用可能にする|同左。会社PCだけに復旧資材を置かない|
|復旧通信|DNS障害時もローカル操作と必要な配布手段が利用できることを事前確認|同左。インターネット経由の遠隔操作だけに依存しない|
|存続保護先|削除対象外Organization/Siteの正確なID、Policy/Block Page、契約、利用可能な現Keyを確定|同左。共通保護先でも双方の実通信/ログを別々に照合|

保護先は未決定。親10220948/既存10678570を無断で利用・変更しない。新Organization/Site作成、Key取得、端末再登録、uninstall/reinstall、設定変更はA対象外であり、D最終版にまとめて明示承認を得る。
Key本文・設定ファイル本文はGit/PRへ保存しない。設定控えに秘密があれば既存の保護された保存先だけで扱う。

#### 案1: 削除前に退避する（推奨、未実行）
1. 正確な端末UUIDと存続保護先ID、現行の個別設定/有効Policy、復旧資材・操作者・保護停止許容時間を固定する。
2. 別途承認後、1台ずつ公式の再登録手順で存続Siteへ移す。Windowsではサービス停止→該当versionのappsettings.jsonに存続先Site Keyを設定→サービス開始という公式案内がある。実際のファイルパス・サービス名は端末で特定してから手順確定する。
3. 再登録でUUIDが変わり得るので旧/新IDと物理PCの対応を記録。Active/Protected、有効設定、通常DNS、公式テストの遮断、該当端末のQuery Logを確認してから次の1台へ進む。
4. 10220954のactive agentだけでなく全登録・offline端末・全Site/IP/例外・利用者を棚卸しし、保護依存が残らないことを確認。削除する登録残骸の扱いも承認範囲を明示する。
5. その状態のsnapshot、正確な削除対象、削除の課金停止/credit、不可逆性を添えてOrganization DELETEを別途明示承認依頼する。
6. 承認後のみ削除。退避済み2台が削除後もActive/Protected、通信/遮断/ログを維持することを観測する。

#### 案2: 削除後に保護を復旧する（障害時の計画、実行未承認）
- Site削除によるoutageは公式明記。一方、Organization DELETEの端末挙動/猶予は今回公式根拠を得ていないため、同一挙動を実測事実として扱わない。最悪のDNS保護/名前解決停止に備える。
- 旧Organization/Site/旧Keyが復元可能とは仮定しない。必要な契約条件を満たす存続先または新規保護先を承認後に用意する。
- 削除済みSiteに依存する場合の公式復旧はSite再作成と新Keyを用いたagent再インストール。Organization再作成の契約/請求は別確認。単なる設定書換えだけで復旧できると保証しない。
- ローカル管理者が対応MSIで再導入し、存続先のKeyを秘密非記録で投入。サービス・DNS・保護・遮断・ログを確認する。必要なアンインストールの保護解除/パスワードも事前確保する。
- 保護/通信が戻らなければ次端末へ進まず、既知の保護経路へ戻すかベンダー手順へ切り替える。DNSを公共resolverへ変更して「保護復旧PASS」としない。
- この計画は案内のみ。DELETE、端末設定、Key取得/変更、インストール/アンインストールはいずれも未実行。

#### 削除前後の観測表（案1、監視時点はatLIB試験計画でありベンダーSLAではない）
|観測対象|削除前|削除直後/1分/5分/15分/30分/翌日|
|---|---|---|
|Organization/Site|削除対象全ID、存続先ID、親子関係、依存0、承認version|対象GETの結果と不存在の意味を確認。403/権限エラーを404不存在と混同しない。親/存続先が維持|
|会社PC・自宅PC|物理PC↔旧/新UUID、所属、version、Active/Protected、last seen|双方を個別に追跡。同一のstale statusだけで保護PASSとしない|
|端末通信|通常名前解決、許可ドメイン、ブラウザ、社内/VPN用途があればそれも基準化|同条件で比較。業務通信支障と保護状態を別記録|
|保護の実効性|公式無害なテストドメインの期待結果、Block Page、当該端末の限定Query Log|新しい通信の時刻と同端末ログを照合。前回のblocked履歴を流用しない|
|Site/Policy|有効Policy/Block Page/端末override、Global本体の比較基準|Global本体/他Site不変。変更をしない|
|数量/課金|Allocated、In Use、登録総数、MSP契約・trial期限、表示時刻|それぞれ独立観測。削除直後の表示で確定請求creditや顧客請求減額を断定しない|
|監査/復旧|実行者、承認、対象、復旧資材と担当|HTTP/時刻/結果/障害/対処を秘密非記録で保存。後日のinvoice/creditを照合|

Dの承認提出前に必要: 完全UUID/各所属、version/復旧パス、存続保護先の許可、両端末の復旧担当/時間帯、trial終了日時、Organization削除課金停止日/credit、正確なDELETE仕様。これが揃うまでDELETE禁止。

### 今回参照した公式資料（2026-10-22取得）
- https://help.dnsfilter.com/hc/en-us/articles/1500008110281-Create-a-Network-Site （RC専用SiteのIP空欄を許容。UI仕様）
- https://help.dnsfilter.com/hc/en-us/articles/4991568454035-Pricing-license-types （RC端末数/Network通信量の基準。atLIB契約の最終請求条件ではない）
- https://help.dnsfilter.com/hc/en-us/articles/43809316077715-Sales-managed-MSP-subscription-management （sales-managedの割当/使用数説明。atLIBがこの契約型とは未確定）
- https://help.dnsfilter.com/hc/en-us/articles/49903446066835-Reassign-a-Roaming-Client-to-a-different-Site-or-Organization （Site削除outage/再導入、削除前再登録の公式手順）
- https://help.dnsfilter.com/hc/en-us/articles/1500008104822-Install-Windows-Roaming-Client （対応installer、現地導入、通信/フィルタ確認）

## 14. API解約・削除E2E指示受領（2026-10-22）
新たなユーザー指示により、自宅PC atI20260003 / agent 2a7659c5-68ec-4704-850f-e0f65347b2ee / Site 10678578 に対する正式APIのremote uninstall要求1回は承認済み。会社PC atI2024011はユーザー報告でuninstall済み。従前の「2台とも保護中」を現在状態として扱わない。
Organization 10220954 DELETEは削除直前の最終明示承認待ち。親10220948書込み禁止。

実行手順・観測・復旧・削除ゲートは [offboarding-e2e-runbook.md](offboarding-e2e-runbook.md)、実行補助は [agent-uninstall-once.ps1](agent-uninstall-once.ps1)。
正式Help CenterでWindows対応条件/Pending挙動、Organization削除の全データ消失・DNS応答即停止を確認。最新API JSONの今回取得は失敗しており、queue_uninstall APIの現在仕様は実行時の公式schemaで検証する。第三者API転載を実行根拠にしていない。
デフォルトGET、変更は指定Agentのqueue_uninstall候補1回に限定。markerと不明結果時停止。Organization DELETEはコードに含めない。
検証: PowerShell AST PASS、モック正常GET preflight PASS、queue_uninstall欠落時STOP/exit1 PASS。実HTTP/実Windows適合は未検証。モック中のlive request 0。
当方プロセスに認証情報なし・端末制御なしのため実機GET/要求/Windows確認/全ページゼロ確認/Organization削除は未実施。今回の変更系HTTPは0件。API不存在と断定したものではない。
公開API経路の確認不能時は停止する。代替は公式UI Delete & Uninstallまたは現地MSI uninstallだが、API E2Eの成功に算入せず、勝手に代替実行しない。

## 15. Organization起点・無人認証要件への更新（2026-10-22）
現行Runbookを [organization-offboarding-runbook.md](organization-offboarding-runbook.md) とする。
入力Organization→親子関係→全Site→各Site全Agent→Org全Agentとの集合照合→操作ID/plan hash/許可属性固定、というGET-only prototypeを追加。
Agent UUID/Site ID/HostnameはハードコードせずAPI値を使用。重複/所属矛盾/ページング未知/件数不一致/HTTP失敗で停止する。
最新APIの実response/paginationは未取得。prototypeの明示next終端+meta.total_countによる厳格adapterが現APIへ適合するとはまだ確認していない。
自宅PC1台を期待するが、対象UUIDを事前選別しない。会社PCはユーザー報告で手動uninstall済み。

無人認証必須: キー手入力fallbackを廃止し、専用Cloud Run Jobの実行SA＋Secret Manager mountを採用候補とした。runtime SA照合と数値version固定をコードの前提にする。
旧agent-uninstall-once.ps1/get-cleanup-inventory.ps1は停止案内へ置換し、旧手入力/単一UUID固定の手順は現行基準として使わない。
既存Corporate/Sales Tools/SendのSecret連携方式、Sendのmsp-zabbix東京Registry/Cloud Build、Corporate Issue15の分離方針をfresh sourceで確認。実GCPのSecret名/専用SA/Job/IAMはgcloud credentials.dbアクセス拒否で未確認。
詳細Fit/Gap、対象確定後の最小GCP差分、最小権限、数値Secret version更新、Scheduler OAuth起動、永続監査/claim案を現行Runbookに記載。
現在のローカルplanファイルはCloud Run間の分散排他ではない。永続adapter未接続のためRequestUninstall modeはSTOP、Organization DELETEは未実装・最終承認待ち。

今回検証: オフライン20/20 PASS（fixtureのみ、実HTTP0）、PowerShell3ファイル構文PASS。実GCP/実DNSFilter GET DryRun、Secret実取得、uninstall/Pending、Org削除後のWindows/DNS/通信/課金は未実施。
実測PASSのSHA/Job execution/image digest/Secret数値version参照/plan hash/対象前後/Windows証跡を揃えたものだけ、将来の解約Runbookの実機基準へ採用する。
次の作業は gcp-auth-fitgap-readonly.ps1 による実metadata取得と、正確な専用ID/Secret/IAM/Job/監査storeを確定すること。APIキーpayloadや手入力は要求しない。
