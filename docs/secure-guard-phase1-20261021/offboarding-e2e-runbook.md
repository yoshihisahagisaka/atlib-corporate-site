# Secure Guard API解約・削除E2E｜実行Runbook
2026-10-22 JST / 実機変更未実施 / Organization DELETEは未承認

## 固定対象と今回の権限
- Organization 10220954 / Site 10678578
- 残存自宅PC atI20260003 / agent 2a7659c5-68ec-4704-850f-e0f65347b2ee
- 会社PC atI2024011はユーザー報告でアンインストール済み。登録残骸の有無は全ページ一覧で別確認。
- MSP親10220948は変更禁止。親の維持確認GETだけ可能。
- ユーザーは上記自宅PCのリモートアンインストール要求1回を許可済み。再承認は不要。
- Organization DELETEは最終明示承認待ち。Site削除・IP解除・契約変更を暗黙に含めない。
- 既存の空Site作成AはこのE2Eに不要なので実施しない。

## 仕様確認の結果と境界
PR #7/#44で記録済みのAPI候補は DELETE /v1/user_agents/{id}?queue_uninstall=true。
queue_uninstallを付けないレコードDELETEやClean Upとは区別する。
最新の公式OpenAPI JSON取得は当方から失敗。API DocsのHTMLも本文を解析できず、今回の正式parameter確認は未完了。
第三者の転載仕様は実行根拠にしない。API不存在と断定せず、最新仕様を取得できる環境で下記スクリプトにより検証する。

公式Windows手順ではx64・Windows agent v2.0.1以上がremote uninstall対象。要求はPending Uninstallとなり、次回チェックイン後に処理、通常約5分。offlineなら復帰まで保留。一覧消失だけでWindows側完了を証明しない。
公式Organization管理資料では端末/Network/Relay等の依存解消を求め、Organization削除で全データ消失・DNS応答即停止を説明。APIの削除path/required parameter/成功応答や課金creditの詳細は別確認。

根拠:
- https://api.dnsfilter.com/docs/api.json
- https://help.dnsfilter.com/hc/en-us/articles/34957633714707-Uninstall-Windows-Roaming-Client-v2-0-1-or-higher
- https://help.dnsfilter.com/hc/en-us/articles/1500008108422-Manage-Roaming-Client-settings
- https://help.dnsfilter.com/hc/en-us/articles/1500008111521-MSP-Organization-management

## 1. 自宅PCのローカル観測（要求前）
自宅PCの管理者PowerShellで実施。社長が対象PC上で操作する。以下は読み取りだけ。
ホスト名の英大文字I/小文字l等を勝手に正規化しない。指定名と違えばUUID/実機の対応を確認して停止する。

~~~powershell
$env:COMPUTERNAME
Get-CimInstance Win32_OperatingSystem | Select-Object Caption,OSArchitecture
Get-CimInstance Win32_Service |
  Where-Object { $_.DisplayName -match 'DNSFilter|DNS Agent' } |
  Select-Object Name,DisplayName,State
Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -match 'DNSFilter|DNS Agent' } |
  Select-Object DisplayName,DisplayVersion
Get-DnsClientServerAddress | Select-Object InterfaceIndex,AddressFamily,ServerAddresses
Resolve-DnsName www.microsoft.com -DnsOnly
~~~

記録: 正確なサービス名/表示名、OS architecture、agent実version、接続中interfaceごとのDNS設定。
元のDHCP/static DNSはagent導入前情報/ネットワーク管理設定から別確認する。要求前のloopback設定を「復元先」として保存しない。
DNS/IP等のローカル詳細は必要な範囲だけ保護された手元へ保存し、PRへ丸ごと貼らない。
復旧用公式MSIとローカル管理権限、正しいDNS設定、installerを必要な場合に再取得できる手段を準備。
RMM/MDM等による自動再導入の有無を確認し、勝手に配布設定は変更しない。

## 2. 最新API仕様＋Organization/Agentの直前確認
同じフォルダの agent-uninstall-once.ps1 はデフォルトGETだけ。
~~~powershell
.\agent-uninstall-once.ps1
~~~
APIキーは既存DNSFILTER_API_KEY、なければローカル非表示入力。チャット/Gitへ貼らない。raw応答・Key・例外bodyを出力しない。
latest schemaにsingle-agent DELETEとqueryのqueue_uninstall:booleanがない、参照schemaを解決できない、追加必須parameter/bodyがある、ID/所属/hostname不一致の場合はSTOP。
schemaでqueue_uninstallの説明が実アンインストール要求であることも人が確認。boolean存在だけから動作を推測しない。
Organization=10220954、agent UUID完全一致、Site=10678578、hostname一致、状態を照合する。
この段階でAPI GETが404、既にPending/削除状態、別端末・別Siteなら要求しない。

## 3. uninstall要求を1回だけ実行（既承認）
Windows x64、実version>=2.0.1を手順1で確認した後のみ実施。
~~~powershell
$sgActualVersion = Read-Host '対象PCで確認したagentの実version'
.\agent-uninstall-once.ps1 -QueueUninstall -VerifiedAgentVersion $sgActualVersion -WindowsX64Verified
~~~
ユーザーが確認した実versionを入力する。最低対応versionを実versionとして代入しない。
スクリプトは再度最新schema/対象を直前照合する。これは変更直前の安全確認であり、既存PoCのやり直しではない。
変更は対象agentのqueue_uninstall=true要求だけ。成功HTTPは受理であって実機完了ではない。
送信前にTEMPへUUID固定のattempt markerを原子的に作成し、同じ端末での再実行を防ぐ。markerは秘密を含まず削除/再作成しない。
このguardは単一PC/ユーザーの補助。別PC/別TEMP/並行プロセスから実行しない。実行者1名・1セッションに固定。
timeout/切断/不明HTTP/エラー時もmarkerを残し、要求を再送しない。GET/管理画面で状態を確定してから統括へ報告する。
現スクリプトはOrganization DELETEを実装しない。実レスポンス未検証のため、schemaと関係を確認できない場合は安全側で停止する。

## 4. Pendingから実機完了まで観測
要求後0/1/5/10/15分を計画目安にGET/管理画面を観測。ベンダーSLAではない。長いsleepの自動ループは不要。
- Agent詳細GET: 正式schemaのGET /v1/user_agents/{id}。status/agent_state/必要な時刻だけ抽出。
- UI: Pending Uninstall → 消失の遷移を時刻付き記録。agent APIのstate enumを推測しない。
- API 404だけでuninstall成功としない。レコード消失と端末側完了を分離。
- 自宅PC上で手順1のサービス/製品/DNS/名前解決を再取得。対象サービスがStoppedではなく消失していること、製品の削除、必要なNICのDNSが元のDHCP/static設定へ戻ったこと、通常の名前解決成功を確認。
- OSのDnscacheサービスは残っていて正常。DNSFilterに属さないWindowsサービスを削除しない。
- DNS応答成功だけでは正しいresolver復元を証明しない。DoH/キャッシュ/別NICの影響を考慮し、構成値と新規問い合わせを照合する。
- offlineでPending継続なら端末をオンラインにしGET観察。要求再送、Organization削除、Key Rotateで解消しようとしない。
- Pendingを観測できないまま完了した場合は「中間状態未観測」とし、捏造しない。
- 自動再導入/agent再出現があれば失敗原因を確認し、ゼロ判定や削除へ進めない。

## 5. 全ページAgent棚卸し
正式仕様の GET /v1/user_agents?organization_ids=10220954 を使用。状態フィルターを付けず、offline/uninstalled/pendingの扱いを仕様で確認する。
response links/metaと公式pagination定義を読んでから続きを取得する。page/page_size等を推測しない。
全ページ成功、終端の根拠、ページ数、unique UUID数、状態別件数、Organization一致を記録。
nextなしだけでAPIに全件が含まれると保証できないschemaなら保留。権限/filterで欠ける可能性も評価。
会社PCの登録残骸が残れば、今回許可のない追加DELETEをしない。残UUIDと状態を報告し別操作を提案。
Agent0件＋自宅PCのローカルuninstall完了＋会社PCの既報告を区別して記録。台数減少とlicense/顧客請求減額を同一視しない。

## 6. Organization DELETE前の正式仕様・依存・最終承認
OpenAPIからOrganization削除operationのpath、method、id型、required parameter/body、成功HTTP、エラーを特定し、その抜粋を確認。取得できなければAPI DELETEを提示/送信しない。
GETで全Site、IP/hostname/NAT/Relay等の依存、ローカルPolicy/Block Page/ユーザー/必要データを確認。Site候補10678578/10678582に限定せず全ページ確認する。Global本体は対象外。
公式UI手順はSite依存解消を要求するが、Organization APIがcascadeするか、先にSite DELETEが必要かはAPI仕様/ベンダーで別確認。
Site/IP変更が必要なら、その正確なIDと操作を最終パッケージへ含める。今回指示で事前に実施しない。
保存が必要な検証証跡は秘密を除いて退避。Organizationのデータが削除後に復元可能とはみなさない。
課金: agent0でもOrganization最低1対象という既回答を維持。削除停止日/日割り/credit/確定請求/最低月額との関係は未回答を明記。API/UI表示0をcredit確定としない。
最終承認パッケージ:
1. 10220954のID/名称/外部ID/親子関係、全依存IDと必要操作の完全リスト。
2. 全Agent棚卸し結果と2 PCの終了/通信正常証跡。
3. 正式DELETE仕様、不可逆データ損失、復旧可否、課金条件の確認結果/残不明。
4. 正確な要求、実行回数最大1、成功/不明結果時のGET確認。親10220948への書込み0。
5. この内容を提示してOrganization削除直前の明示承認を得る。
最終承認前はここでSTOP。Organization DELETEコマンドは未提供・未実行。

## 7. 削除承認後の観測（未実施）
対象GETの成功/404/403を区別し、認証/権限エラーを不存在とみなさない。
親10220948のGET成功、Organization一覧全ページで対象消失、管理画面の表示を照合。必要な存続Policy/Block PageはGETで維持確認だけ行う。
管理画面と請求明細/credit/有効契約を日時付き照合し、後日請求も確認する。表示遅延や返金条件を推測しない。
自宅PC/会社PCで通常名前解決と業務通信が維持されることを確認。

## 復旧手順
- Pendingのまま: 端末online/サービス/チェックインを観測。送信を繰り返さない。
- 端末uninstall失敗: API E2E失敗として記録。UI Delete & Uninstallや現地MSI uninstallは代替案であり勝手に併用しない。手動作業へ移行する判断を統括へ返す。
- service消失後にDNS不通: ローカル管理者が導入前に確認したNIC設定へ戻す。DHCPと確認済みNICだけreset候補、staticなら確認済みの正しいresolverを復元。全NIC一律resetや公共DNSへの無断変更は禁止。直した場合は「自動復元FAIL、手動復旧PASS」と分離。
- 保護を戻す必要がある場合: Organization/Siteを削除せず保持した状態で、現行の許可されたSite Keyと対応MSIで再導入する案を提示。再導入は今回のuninstall要求に暗黙に含めず、実行前に方針確認する。
- Organization削除後: 同じID/履歴/Keyの復元保証なし。必要なら新規契約/Organization/Site/Keyで再導入となるため別承認。親やGlobal本体を復旧手段として変更しない。

## 今回の検証結果
- PR #44開始HEAD: ae7cdf35bcdd9f3021e9a5a857db4455e3354723。
- ユーザー報告: 会社PC uninstall済み、自宅PCの正確なUUID/所属を受領。
- 公式Help Center: remote uninstall対応条件/Pendingの挙動、Organization削除の全データ消失/DNS応答即停止を確認。
- 最新OpenAPI JSON: 当方取得失敗。API機能「存在しない」とは判定しない。
- 実機GET/remote uninstall要求: 認証情報と端末制御が当方にないため未実施。変更0件。
- スクリプト: PowerShell構文解析PASS。実API適合・Windows実機・pagination・課金確認は未検証。
- 単なるレコードDELETEへの置換なし。Organization DELETE/他対象変更0件。
