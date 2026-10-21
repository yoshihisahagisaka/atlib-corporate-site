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
