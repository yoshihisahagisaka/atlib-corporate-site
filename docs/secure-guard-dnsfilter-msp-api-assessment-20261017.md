# atLIB Secure Guard | DNSFilter MSP 大量展開・API一括調査

調査日: 2026-10-17 (JST)  
基準コミット: `2611979` (`main`)  
対象: DNSFilter MSP trial と公開されている DNSFilter API v1 / Distributor API  
対象外: 新規システム実装、本番設定変更、課金契約の変更

## 結論

**1,000社への「Organization作成 → Network作成 → 標準ポリシー／Block Page割当 → Site Key発行 → 導入パッケージ発行 → 利用状況取得」は、通常のMSP APIでかなりの部分を自動化できる設計である。**

ただし、商用化のGo判断はまだ保留とする。理由は、次の3点が実機またはDNSFilterへの確認待ちだからである。

1. MSP JWTで `POST /v1/organizations` を実行したときのSKU（Core/Plus）値、契約期間、External IDの扱い。
2. Global Policy／Global Block PageのIDをNetwork作成・更新APIで指定した際の実際の割当可否と、設定変更の反映範囲。
3. Organization一括作成と、1,000 Organization規模の契約・サポート上限。

`/v1/sites` が404だったのは仕様どおりの名称差であり、SiteはAPIでは **Network** として扱う。以後の検証対象は `/v1/networks` とする。

## 既存確認事項（再実施しない）

- Windows Roaming Clientの導入、Protected状態、Phishing／Malware／Botnet遮断はPASS。
- MSP Global Policy、External Block Page、2 Organization、2社目への共通設定割当はPASS。
- Organization作成ではSiteが自動作成されず、Global設定も自動適用されないことを確認済み。
- APIキー（30日）を発行済み。`GET /v1/organizations` はPASS、2 Organizationを取得済み。
- External Block Page PoCの公開・日本語パラメータ表示・TLS検証は別記録でPASS。

この調査ではキー／Site Keyを参照・出力せず、POST、PATCH、DELETEは実行していない。

## 確認区分

- **PASS（既存実機）**: 既存PoCで実測済み。
- **仕様確認**: DNSFilter公開OpenAPIまたは公式サポート資料で確認済み。atLIB権限での実行は未確認。
- **未確認**: 実機検証またはDNSFilter確認が必要。
- **非対応／Gap**: 一般MSP APIの公開仕様に該当操作がない、または要件を満たす仕様が公開されていない。

## API機能別 Fit / Gap

| 領域 | 結果 | 公開仕様・根拠 | atLIBで残る確認 |
| --- | --- | --- | --- |
| Organization一覧 | PASS（既存実機） | `GET /v1/organizations` | 2 Organization取得済み。 |
| Organization作成 | 仕様確認 | `POST /v1/organizations`。本体は `organization`。必須は `name`, `managed_by_msp_id`。 | MSP JWTでの作成、入力可能な `managed_by_msp_id` をテスト。 |
| プラン／ライセンス数 | 仕様確認 | 作成・更新モデルに `sku`（文字列）と `quantity`（整数）がある。 | Core/Plusに対応するSKU値、変更時の課金処理を確認。 |
| 契約期間／トライアル期限 | 未確認 | 一般Organization作成モデルに契約期間・trial endの公開フィールドはない。 | 契約・請求APIの可用性をDNSFilterへ確認。 |
| Organization External ID | Gap | 組織の返却モデルには `external_id` があるが、一般作成モデルの公開入力にはない。`unique_id`はSSO login URL用途。 | 外部顧客IDの登録手段、冪等作成キーを確認。 |
| Organization一括作成 | Gap | 一般APIは単件 `POST /v1/organizations` と `PATCH /v1/organizations/bulk_update` のみ。作成bulkは公開されていない。 | 逐次・キュー方式で実装するか、専用bulk APIを依頼。 |
| Network一覧 | 仕様確認 | `GET /v1/networks`、MSP横断は `GET /v1/networks/msp/all?organization_id=...`。 | 現APIキーで2 Organizationを対象にGETする。 |
| Network作成 | 仕様確認 | `POST /v1/networks`。必須は `name`, `organization_id`。 | MSP JWTでの作成をsandbox用Organizationで実施。 |
| 複数Network作成 | 仕様確認 | `POST /v1/networks/bulk_create`。 | 最大件数、非同期ジョブの完了確認、部分失敗の扱い。 |
| Network詳細／更新 | 仕様確認 | `GET/PATCH /v1/networks/{id}`。 | ロック・同時更新・監査ログ。 |
| Network一括設定 | 仕様確認 | `POST /v1/networks/bulk_update` はID列または同一Organization内の `ids: all` に対して `policy_id`, `block_page_id` 等を更新できる。 | **全Organization横断の一発割当ではない**。1 Organizationずつのジョブとして検証。 |
| Global Policy割当 | 未確認 | Network作成・bulk updateの入力にpolicy IDがある。公式UIではGlobal PolicyをSite等の属性へ割り当てる。 | Global Policy IDをAPI指定できるかを実機で確認。 |
| Global Block Page割当 | 未確認 | Network作成・bulk updateの入力に`block_page_id`がある。公式UIではGlobal Block PageをSiteへ割り当てる。 | Global Block Page IDをAPI指定できるかを実機で確認。 |
| 新規Organizationへの標準設定 | Gap（自動ではない） | 既存PoCで自動作成・自動割当なしを確認。 | オーケストレータがNetwork作成時に明示指定する。 |
| 共通設定変更の全体反映 | 未確認 | Global Policy／Block Pageは複数Organizationで再利用可能。ただし「変更が全割当先へ即時反映」のAPI仕様は未確認。 | 1 Policy／Block Page変更後、2社目にも反映する回帰テスト。 |
| 顧客例外 | Fit（設計要） | Network／agent単位にpolicy・block pageを指定できる。 | Globalを置換する例外であるか、重ね合わせかを実機で確認。 |
| Site Key取得・発行 | 仕様確認 | `POST /v1/networks/{id}/secret_key`。 | 返却形式と一度だけ表示されるかを安全なsandboxで確認。 |
| Site Key失効／再発行 | 仕様確認 | `DELETE /v1/networks/{id}/secret_key`、`PATCH /v1/networks/{id}/secret_key`。 | 既存端末への影響、ローテーション猶予、再登録要否を確認。 |
| Organization別端末数 | 仕様確認 | `GET /v1/user_agents` は`organization_ids`等でフィルター可能。`GET /v1/user_agents/counts`もある。 | billing対象との一致、offline／deleted除外条件。 |
| Organization別ライセンス使用量 | 仕様確認 | `GET /v1/metrics/organization_usage/{id}`（期間必須）と`.../organization_usage_detailed/{id}`。 | 契約台数、課金対象、端末数の定義を照合。 |
| ライセンス数変更 | 仕様確認 | `PATCH /v1/organizations/{id}` はOrganization作成モデルを受け、`quantity`がある。 | 実際の契約変更・課金への影響は事前承認が必要。 |
| 契約超過時 | 未確認 | 公開APIに遮断／自動増枠ルールは記載なし。 | DNSFilterへ請求・保護継続・通知の仕様を確認。 |
| 端末の移管・設定変更 | 仕様確認 | `PATCH /v1/user_agents/{id}` の `network_id`, `policy_id`, `block_page_id`, `tags`。一括更新もある。 | Site移管時の端末再登録要否。 |
| 端末削除・遠隔アンインストール | 仕様確認 | `DELETE /v1/user_agents/{id}?queue_uninstall=true`、bulk delete API。Windows v2.0.1+のremote uninstall対応。 | offline時の保留、実行前の件数確認、監査・回復手順。 |
| オフライン端末の整理 | 仕様確認 | dashboardは最長365日の非活動期間でcleanup可能。 | API cleanupジョブの対象選定、誤削除防止期間。 |
| 重複登録／入替 | 未確認 | APIの明示的な重複解決仕様は確認できない。 | 同一端末の再登録、端末入替、旧端末削除の挙動を実機で確認。 |
| Windows MSIサイレント導入 | 仕様確認 | MSIへ `NKEY="<Site Key>"` を指定。Intune、GPO/MST、RMMの公式ガイドあり。 | 顧客環境のIntune／RMMでパイロット。 |
| MST | 仕様確認 | Orca transformで`SETCMD NKEY`を設定可能。DNSFilterは複雑化を避け、Siteごと1 transform程度を推奨。 | MSI版更新時のMST再検証。 |
| Site Key流出対策 | Fit（運用設計要） | Secret Keyのdelete／rotate APIあり。 | Keyを顧客へ平文配布せず、MDM/RMMのsecret機構または期限付き導入手順で扱う。ローテーション影響を実測。 |
| API認証・権限 | 仕様確認 | 一般APIは`Authorization` headerのJWT。キーは作成者ユーザーの権限を継承。 | 専用の最小権限MSP automation userで実行。 |
| APIレート | 仕様確認 | 1 Organizationあたり300秒で2,000 requests。429と`Retry-After`等のヘッダー。 | 実ワークロードで上限・dashboard操作との競合を測定。 |
| 1,000 Organization上限 | 未確認 | 公開仕様で契約上限／SLAは確認できない。 | DNSFilterへ明示確認。 |

## 正確なAPI候補

以下は公開OpenAPI `https://api.dnsfilter.com/docs/api.json` の2026-10-17取得内容である。実行する際はすべて `Authorization` headerを用い、秘密値をログに出さない。

| 用途 | エンドポイント | 成功時の主な応答 |
| --- | --- | --- |
| Organization一覧 | `GET /v1/organizations` | `data`配列（ページング）。 |
| Organization作成 | `POST /v1/organizations` | 201、`data`にOrganization。422は入力不正。 |
| Organization更新 | `PATCH /v1/organizations/{id}` | 200。 |
| Organization一括更新 | `PATCH /v1/organizations/bulk_update` | `success`フラグ。作成ではない。 |
| Network一覧 | `GET /v1/networks` | `data`配列。 |
| MSP Network取得 | `GET /v1/networks/msp/all?organization_id={id}` | 対象OrganizationのNetwork。 |
| Network作成 | `POST /v1/networks` | 201、`data`にNetwork。 |
| Network一括作成 | `POST /v1/networks/bulk_create` | job ID／進行状態はsandboxで確認する。 |
| Network一括更新 | `POST /v1/networks/bulk_update` | `ids`（CSVまたは`all`）＋`organization_id`＋設定値。 |
| Site Key操作 | `POST/DELETE/PATCH /v1/networks/{id}/secret_key` | create / revoke / rotate。 |
| Global候補を含むPolicy一覧 | `GET /v1/policies?organization_id={id}&include_global_policies=true` | Policy IDを取得。 |
| Block Page一覧 | `GET /v1/block_pages?organization_id={id}` | Block Page IDを取得。 |
| agent一覧 | `GET /v1/user_agents?organization_ids={ids}` | 状態、Site、Policy等のフィルター。 |
| agent更新／削除 | `PATCH/DELETE /v1/user_agents/{id}` | 移管、設定変更、削除。 |
| agent一括更新／削除 | `POST /v1/user_agent_bulk_updates`、`POST /v1/user_agent_bulk_deletes` | 非同期ジョブとして扱い、status endpointを追跡。 |
| 使用量 | `GET /v1/metrics/organization_usage/{id}?from=...&to=...` | Organization使用量。 |

### 作成時に使える公開フィールド

Organizationは `name`, `managed_by_msp_id` が必須で、`sku`, `quantity`, `billing_contact_*`, `address`, `privacy_mode`, `enable_cybersight` が公開されている。Networkは `name`, `organization_id` が必須で、`policy_ids`, `block_page_id`, `external_id`, `ip_addresses_attributes`, `physical_address`, `local_domains`, `local_resolvers` を指定できる。

Core／Plusという商品名のSKU値、契約期間、Organization External IDについてはこの一般OpenAPIだけでは確定しない。値を推測してPOSTしてはならない。

## MSPとDistributorの違い

atLIBの試験環境はMSPであり、発行済みのJWTは「作成者ユーザーのMSP権限」を継承する。最小権限の専用automation userを作成して発行する。

Distributorは別契約・別権限であり、`/v1/distributors/*`を使う。認証もJWTではなく、Distributor IDとpre-shared secretのBearer値である。Distributor APIにはsub-organization作成、SKU add/remove、MSP作成・SKU管理、利用レポートがある。**MSP JWTでDistributor APIを前提にした設計にしない。**

## 1,000社向け推奨アーキテクチャ（最小構成）

```text
申込完了
  → Provisioning API / Queue（冪等キー: atLIB customer ID）
  → Secret Manager（DNSFilter JWT、顧客別Site Keyを短期保管）
  → DNSFilter: Organizationを1件作成
  → DNSFilter: Networkを1件以上作成し、Global Policy / Global Block Page IDを明示割当
  → DNSFilter: Site Keyを発行
  → 導入パッケージ発行（MSI URL + 顧客のMDM/RMM向け安全な設定情報）
  → atLIB管理DB（DNSFilter org/network ID、外部顧客ID、状態、監査イベント。Key本文は保存しない）
  → 日次同期（Organization / Network / agent / usage）
```

最小構成は、受付システム、非同期worker、暗号化secret store、状態DB、監査ログ、監視だけとする。DNSFilterを正本とし、atLIBのDBは対応付けとジョブの状態管理に限定する。作成ジョブは1社ずつに分離し、再実行時は外部顧客IDと返却IDの対応表で冪等にする。

1,000件の初回展開では、Organization作成をbulk化せず、キューでレート制御する。Networkは公式bulk endpointを採用候補とするが、部分失敗・再試行・上限をsandboxで確認するまで単件逐次も維持する。300秒あたり2,000 request／Organizationの上限を超えないよう、429時は`Retry-After`を尊重する。

### 標準設定と例外

- 標準: Global PolicyとGlobal Block PageのIDをNetwork作成時に明示指定する。Organization作成だけでは適用されない。
- 共通強制: MSP Global Universal Allow/Block Listを利用する。これは全Organizationと将来のPolicyにまたがる。
- 例外: 顧客固有のPolicy／Block PageをNetworkまたはagentへ明示割当する。例外理由、期限、承認者、復帰先のGlobal IDを管理DBに監査記録する。
- 一括変更: 各Organization単位のNetwork bulk updateジョブとして実装する。全Organizationを一回のAPI呼び出しで書き換える前提にしない。

## インストーラー配布方針

- 顧客がIntuneを使う場合は、DNSFilter MSIをLine-of-Business appとして配布し、`NKEY="<Site Key>"`をInstall commandに設定する。
- AD/GPO環境はMSI + MST（Orcaの`SETCMD NKEY`）を候補とする。公式はNetworkごとにMSTを増やし過ぎないことを推奨する。
- RMMがある顧客は、RMMのsecret variable／credential vaultから実行時だけSite Keyを渡す。メール添付、公開URL、Git、MST共有フォルダへの平文保存を禁止する。
- 漏えい疑いではSite Keyをrotateし、影響・既存agent挙動を確認してから再配布する。削除／rotationが既存agentの保護を切らないかは先にsandboxで検証する。

## DNSFilterへの確認事項

1. MSP JWTで`POST /v1/organizations`を実行するための最小ロールと、`managed_by_msp_id`の取得方法。
2. Core／Plusの正確な`sku`値、`quantity`更新の課金反映、契約期間・trial endのAPI可否。
3. Organization作成に使えるExternal ID／冪等キーの正式フィールド。`external_id`が作成specにない理由。
4. 1,000 Organizationの契約上限、推奨concurrency、support/SLA、API利用条件。
5. `POST /v1/networks`／`bulk_update`でGlobal PolicyとGlobal Block PageのIDを指定できるか。Global変更が割当済みNetworkへ反映されるSLA。
6. `/v1/networks/bulk_create`のpayload、最大件数、job成功・失敗・再試行の仕様。
7. Site Key rotate/revokeが既存Windows agentへ与える影響と移行猶予。
8. 契約台数超過時の保護継続、請求、通知、API応答。
9. 同一端末の再インストール／重複登録／Site移管／offline cleanupの課金・識別規則。
10. JWTの自動ローテーションAPI、最大有効期間、専用automation userの推奨権限。

## 次の実機検証（状態変更前に個別承認）

1. **P0 / 読み取り**: `GET /v1/networks/msp/all?organization_id={既存ID}`、`GET /v1/policies?...include_global_policies=true`、`GET /v1/block_pages?...`、`GET /v1/user_agents?...`、usageを実行し、IDと返却形を確認する。秘密値はマスクする。
2. **P1 / sandbox書込み**: test OrganizationにNetworkを1件作成し、Global Policy／Block Page IDを指定。既存の2 Organizationは変更しない。
3. **P1 / key lifecycle**: 新test NetworkでSite Key発行、Windows agent 1台で登録、rotate後の既存agent挙動を確認する。
4. **P2 / bulk**: test Organization内に複数Networkを作成し、bulk create／bulk updateのjob、失敗、再試行を確認する。
5. **P2 / device lifecycle**: test agentのSite移管、offline状態、dashboard deleteとremote uninstallを検証する。実端末の削除・uninstallは対象と影響を提示したうえで承認を得る。
6. **P3 / scale rehearsal**: 10～20 Organization相当のsynthetic datasetで、レート制御、監査、冪等、例外、cleanupを検証する。1,000件書込みはDNSFilter確認後にのみ実施する。

## P0 + P1 実機検証結果（2026-10-17）

### 実行境界

- APIキーはWindowsユーザーの暗号化ファイルから同一ユーザー文脈でメモリ内にだけ読み込み、値を出力・保存していない。
- P0ではGETのみ、P1では承認済みの `POST /v1/networks` を1回だけ実行した。
- 既存Network、Global Policy本体、Global Block Page本体、Organization設定、ライセンス設定、Site Keyには変更を加えていない。
- PR #7が未統合のため、本節は同PRの既存評価記録へ追記する。別の重複文書は作成しない。

### P0: 読み取りAPI

| 検証項目 | 結果 | 実測結果 |
| --- | --- | --- |
| Organization 01取得 | PASS | `GET /v1/organizations/10220948` は200。`atLIB Inc.`、`current_license=msp_tier1`、trial 14日。 |
| Organization 02取得 | PASS | `GET /v1/organizations/10220954` は200。External IDは `SG-POC-ORG-002`、Network作成権限はtrue。 |
| MSP Network一覧 | PASS | `GET /v1/networks/msp/all?organization_id=10220948` は既存2件を返した。APIのこの`organization_id`はMSP親Organizationを渡す挙動であり、Organization 02を渡した場合は0件だった。 |
| Organization別Network関係 | PASS | `GET /v1/networks/10678578` の `relationships.organization.id=10220954` を確認。既存Site `Secure Guard Test Site 02` のPolicyは`1510300`、Block Pageは`70676`。 |
| Global Policy | PASS | `GET /v1/policies?organization_id=10220954&include_global_policies=true` は `1510300` / `atLIB Secure Guard - Standard Security` / `is_global_policy=true` を返した。 |
| Global Block Page | PASS | `GET /v1/block_pages?organization_id=10220954` は `70676` / `atLIB Secure Guard - External Block Page PoC` / `is_global=true` / redirect URLを返した。 |
| agent一覧 | PASS | Organization 01は1 agent（`active` / `protected`）、Organization 02は0 agent。削除済み・offline agentは今回の返却には含まれなかった。 |
| usage | PASS | `GET /v1/metrics/organization_usage/{id}` は両Organizationで200。Organization 02は`plan=basic`、`term=monthly`、`user_count=1`、期間内DNS requestは0。 |
| 請求対象ライセンスとの一致 | 未確認 | Organization 02の`current_license`は空、usageの`user_count=1`は得られたが、請求対象台数と同義である仕様は確認できない。 |

### P1: Network作成と標準設定割当

作成前にMSP親Organization配下のNetwork一覧を取得し、`Secure Guard API Test Site 03` と `SG-POC-SITE-003` の一致項目がないことを確認した。重複作成を避けたうえで、承認済みの次の内容だけを送信した。

```json
{
  "network": {
    "name": "Secure Guard API Test Site 03",
    "organization_id": 10220954,
    "external_id": "SG-POC-SITE-003",
    "policy_ids": [1510300],
    "block_page_id": 70676
  }
}
```

| 検証項目 | 結果 | 実測結果 |
| --- | --- | --- |
| API Network作成 | PASS | `POST /v1/networks` はHTTP 201。作成Network IDは `10678582`。 |
| Organization紐付け | PASS | 作成レスポンスおよび再GETで`relationships.organization.id=10220954`。 |
| External ID | PASS | 再GETで`SG-POC-SITE-003`。 |
| Global Policy割当 | PASS | 作成レスポンスおよび `GET /v1/networks/10678582` でPolicy `1510300`。 |
| Global Block Page割当 | PASS | 作成レスポンスおよび再GETでBlock Page `70676`。 |
| 既存Networkへの変更 | PASS | 既存Networkの更新・削除は行っていない。 |
| Site Key | 未検証 | 発行・取得は今回の承認範囲に含めず、秘密値は参照していない。 |
| Dashboard表示 | 未検証 | DNSFilter dashboardの認証済みUIセッションがないため、画面での確認は行っていない。APIの再GETはPASS。 |
| 課金・ライセンス影響 | 未確認 | ライセンス更新APIは呼んでいない。新NetworkはIP 0件・agent 0件で作成されたが、Network自体の課金影響は公開APIから確定できない。 |

### 実測できたレスポンス構造（秘密値除外）

- Organization: `data.id`, `data.attributes.name`, `external_id`, `current_license`, `current_mrr`, `allow_create_network`。
- Network: `data.id`, `data.attributes.name`, `external_id`, `block_page_id` と、`relationships.organization`, `relationships.policy`, `relationships.policies`, `relationships.block_page`。
- Policy: `data.id`, `attributes.name`, `organization_id`, `is_global_policy`。
- Block Page: `data.id`, `attributes.name`, `organization_id`, `is_global`, `block_redirect_url`。
- Usage: `organization_id`, `plan`, `term`, `user_count`, `wifi_count`, `total_requests`, `estimated_users`, `from`, `to`。

### 更新した判断

- **Provisioning可否**: Organization IDが確定した後のNetwork作成と、Global Policy／Block Pageの同時割当はAPIでPASS。顧客ごとの標準Networkを自動化する技術的前提は満たした。
- **Organization作成**: 最終構成では顧客ごとにOrganizationを作成する。この実機検証は別P1.5として必須であり、SKU、契約期間、External ID、ライセンス・課金への影響を承認前に確定する。
- **Site Key**: endpointは公開仕様上存在するが、ライフサイクルを含む実機検証は未実施。値をDB／Gitへ永続化しない方針を維持する。
- **1,000社展開**: Network部分はキュー型Provisioningで成立する見込み。ただしOrganization作成bulk不在、契約・SKU、課金台数、1,000 Organization上限はDNSFilter確認後に最終Go判断する。

## P1.5 Organization自動作成・一貫Provisioning PoC（2026-10-17）

### 事前確認

作成候補は `atLIB Secure Guard - API Test Organization 03`、想定External IDは `SG-POC-ORG-003`、要求プランはCore / Monthly / 1 licenseである。

`GET /v1/organizations?name=atLIB%20Secure%20Guard%20-%20API%20Test%20Organization%2003` はHTTP 200、該当件数0だった。同名Organizationは未作成であることを確認した。既存リソースに対する更新・削除は行っていない。

### `POST /v1/organizations` 正式スキーマ確認

公開OpenAPIの `OrganizationCreate` は次を示す。

- 必須: `name`, `managed_by_msp_id`
- 任意: `billing_contact_*`, `address`, `unique_id`, `sku`, `quantity`, `privacy_mode`, `enable_cybersight` 等
- `sku` はenumなしの任意文字列。CoreまたはPlusに対応する有効値は公開されていない。
- 契約期間・term・trial endを作成時に指定する公開フィールドはない。
- `external_id` はOrganizationの取得レスポンスに存在するが、作成requestの公開スキーマにはない。`unique_id` はEnterprise SSOのcustom login URL用途であり、External IDの代替として扱わない。
- SKU一覧を返す公開パスはDistributor APIの `/v1/distributors/skus_available` に限られる。atLIBのMSP JWTで利用できることは確認していない。

### 実行結果

| 項目 | 結果 | 根拠・判断 |
| --- | --- | --- |
| 重複防止の事前検索 | PASS | 指定名称のOrganizationは0件。 |
| Core SKUの確定 | 未確認 | 公開OpenAPIにCoreのSKU enum／一覧がない。既存Organization 02のusage `plan=basic` をCoreと推測しない。 |
| Monthly termの指定 | 未確認 | Organization作成スキーマにtermフィールドがない。 |
| External IDの指定 | 未確認 | 作成スキーマに`external_id`がなく、既存の取得値を根拠に勝手なフィールド追加はしない。 |
| Organization POST | **未実施** | 要求されたSKU・term・External IDを正確に指定できないため、試行錯誤的なPOSTを行わず停止。 |
| Network作成／Global設定割当 | **未実施** | 前提となる新Organizationが未作成のため実施しない。 |
| Site Key | **未実施** | 新規発行・参照を禁止する範囲のため実施しない。 |
| 課金・ライセンス影響 | 未確認 | Organization POSTを行っていないため変化なし。作成時のSKU・quantityの請求動作はDNSFilter確認が必要。 |

### P1.5を再開するためのDNSFilter確認事項

1. MSP JWTで `POST /v1/organizations` を行う際のCore（Monthly、1 license）の正確な`sku`値。
2. Monthly termを作成時にどのAPIフィールドまたは契約設定で指定するか。
3. Organization作成時にExternal IDを保存する正式フィールド、または作成直後に安全に設定する正式API。
4. `managed_by_msp_id=10220948` がatLIB MSP配下Organization作成の正しい指定か。
5. `sku`と`quantity`を伴うOrganization作成による試験環境・請求・取消／削除の影響。
6. MSPが利用可能なSKU一覧取得API、またはサポートから受ける固定SKUマッピング。

回答を得た後、作成前に対象・正確なpayload・課金影響・切り戻し（新規OrganizationおよびそのNetworkのみを対象とする削除）の承認を改めて得る。その後にのみ、Organization作成→GET→Network作成→GETを1回ずつ実行する。

### P1.5 追加読み取り検証（2026-10-17）

既存Organization 02（`10220954`）を、管理画面でCore / Monthly / 1 licenseとして作成済みであることを基準に、公開APIから作成payloadへ転記できる値が得られるか追加確認した。

| 確認対象 | 結果 | 実測・判断 |
| --- | --- | --- |
| Organization詳細 | PASS | `GET /v1/organizations/10220954?include_current_mrr=true` は200。`external_id=SG-POC-ORG-002`、`current_license`空、`plan_details=null`、`current_mrr=0`、`trial_days=null`。 |
| Organization Subscription relationship | PASS（存在確認） / 未確認（値） | relationship名は`subscription`だが、`data=null`でSubscription ID・SKU・term・license数は返らない。related URLも返らない。 |
| Billing GET | PASS（API呼出） / 未確認（契約値） | `GET /v1/billing?organization_id=10220954` は200だが、返却bodyは空。支払方法・契約プランを返す値は得られない。 |
| Usage | PASS | `GET /v1/metrics/organization_usage/10220954` は`plan=basic`、`term=monthly`、`user_count=1`を返す。 |
| `basic`とCoreの同一性 | **未確認** | 現行価格資料はCoreを公開するが、OpenAPIの`sku`値／usage `plan=basic`／Coreの対応表を公開していない。既存のlegacy Basicと現行Coreを同一SKUと推測しない。 |
| 作成時のterm指定 | **未確認** | OpenAPIにはSKU resourceの`term` enum（monthly/annual）がある一方、`OrganizationCreate`にtermフィールドはない。SKU文字列への符号化規則は公開されていない。 |
| External IDの作成後設定 | **未確認** | `PATCH /v1/organizations/{id}`も`OrganizationCreateSpec`を使い、`external_id`を公開していない。Organization ProfileはdashboardでExternal IDを管理することを案内するが、公開APIの対応操作は確認できない。 |

この追加確認後も、P1.5のPOST条件は満たさない。特に、trial期間中でも不正なSKUを含むPOSTは別SKU・想定外の契約状態を作るおそれがあり、実行しない。

#### 再開条件（更新）

DNSFilterから次のいずれかを取得するまでOrganization作成は保留とする。

1. atLIB MSP用のCore Monthly SKU文字列と、`quantity=1`を含む正式なPOST例。
2. MSP JWTで利用できるSKU／Subscription GET endpointと、Organization 02のCore設定を示す応答。
3. trial中のMSP sub-organizationを、SKU・term・quantity・External IDを安全に指定して作成する公式手順。

これらを得た後にのみ、同名・External IDの重複GET→Organization POSTを1回→Organization GET→Network POSTを1回→Network GETの順で再開する。

## 公式根拠

- [DNSFilter一般API OpenAPI](https://api.dnsfilter.com/docs)（API仕様本体: `https://api.dnsfilter.com/docs/api.json`）
- [Distributor Development Guide](https://api.dnsfilter.com/docs/distributors)
- [API Keys](https://help.dnsfilter.com/hc/en-us/articles/21169189058323-API-Keys)
- [API Rate Limits](https://help.dnsfilter.com/hc/en-us/articles/38202811088403-API-Rate-Limits)
- [MSP Organization management](https://help.dnsfilter.com/hc/en-us/articles/1500008111521-MSP-Organization-management)
- [Create a Network Site](https://help.dnsfilter.com/hc/en-us/articles/1500008110281-Create-a-Network-Site)
- [Create Global Policies](https://help.dnsfilter.com/hc/en-us/articles/1500008108702-Create-Global-Policies-to-use-in-any-MSP-Organization)
- [Manage Roaming Client settings](https://help.dnsfilter.com/hc/en-us/articles/1500008108422-Manage-Roaming-Client-settings)
- [Windows agent v2.0.1+ uninstall](https://help.dnsfilter.com/hc/en-us/articles/34957633714707-Uninstall-Windows-Roaming-Client-v2-0-1-or-higher)
- [Windows agent via Active Directory](https://help.dnsfilter.com/hc/en-us/community/posts/34246321821075)
- [Windows agent via Intune](https://help.dnsfilter.com/hc/en-us/community/posts/34265444707347)

