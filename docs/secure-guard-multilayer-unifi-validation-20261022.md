# Secure Guard × UCG-Ultra 多層防御実機検証・保留記録

Date: 2026-10-22 (JST)
Status: **検証一時終了／DNSFilter追加問い合わせは既存回答待ち／商用標準構成は未確定**
Scope: atLIB社内 UCG-Ultra / Windows Roaming Client、既存設定の限定的Pause試験。主に利用者提示の画面・PowerShell結果に基づく。

## 環境
- UniFi UCG-Ultra `atI-router02`、Network 10.6.106、UniFi OS 5.1.33。
- LAN Default `192.168.0.0/24`、Gateway `192.168.0.1`。
- CyberSecure Standard、IDS/IPS On・Notify and Block、Firewall動作ログあり。
- Content Filter `atLIB社内用`：Source Default、Filtering Basic、Ad Block ON、Always。
- 会社PC `atI2024011` (Beelink Mini S12 Pro, `192.168.0.105`) と自宅PC `atI20260003`：DNSFilter Agent 3.8.15、同じ Test Organization 02 / Secure Guard Test Site 02、Protected表示。
- 自宅のDNS Query Logは表示あり。会社PCの端末フィルターでは0件（調査時点）。

## 読み取り検証
- UniFi IDS/IPS「Threat Detected and Blocked」14件を確認。FlowにはFirewall Block、DNS Ad Blocking Blockを確認。
- 会社PC DNS：Ethernet `127.0.0.2`、Wi-Fi `192.168.0.1`（両方接続時）。Agent PID 33572が `127.0.0.2:53`、ICS SharedAccessが `0.0.0.0:53` で待受。DNSFilter Service ManagerのHTTPS接続を確認。
- Wi-Fiを切断しても、`nslookup -type=txt debug.dnsfilter.com 127.0.0.2` はCNAME/SOAのみでDNSFilter固有TXTを返さなかった。
- UniFi Flow：会社PCからGateway `192.168.0.1:53/UDP` への広告関連DNS問い合わせがAd Blockingで遮断された。
- 自宅PCの同じ診断TXTでは `serverip=103.247.36.36`、`region=TYO`、`networkid=10678578`、`policyid=1510300`、`policy_source=site` を取得。自宅Malware/Phishing等の独自Block Page表示を確認。

## A/B検証：UniFi Content Filter Pause
- A（有効）：会社PCの診断TXTはDNSFilter固有値を取得できず、Debug PageのThreatsはAllowed、DNS Query Log端末別0件。
- B（`atLIB社内用` をManage→Pause）：会社PCの診断TXTが `serverid=21201`、`serverip=103.247.36.36`、`region=TYO`、`myip=152.165.117.124`、`networkid=10678578`、`policyid=1510300`、`policy_source=site`、`local_ipv4_address=192.168.0.105` を返した。MalwareとBotnetのatLIB独自Block Page表示を確認。Debug Pageは主要Threats Blocked。
- B中のPhishingテストは一時的にnginx 503。自宅では同じPhishingテストが正常Block Page。会社側の503の原因・Query Logの回復は未確定。
- A'（Manage→Resume）：`atLIB社内用` がDefault / Basic / Ad Block / Alwaysで再表示され、Debug PageのThreatsがAllowedに戻った。ルール復旧を画面で確認。

## 判定と境界
1. **観測事実**：UniFi Content FilterのPause/Resumeと、会社PCのDNSFilter診断TXT・Debug Page判定の変化に明確な相関がある。干渉の強い証拠。
2. **未確定**：UniFiの具体的なDNSリダイレクト機構、DNSFilterの意図的な競合回避・フォールバック仕様、ICSの寄与、Phishing 503の原因、端末別Query Logの復旧。
3. **言ってはいけないこと**：「DNSFilterが自動的に保護を解除する仕様」「UniFiがMalware/Phishingを同等に遮断した」「Protected表示だけで実効保護PASS」。いずれも未立証。
4. **商用構成候補**：UCG-UltraはFirewall/IDS/IPS、Secure GuardはRoaming ClientのDNS防御、WindowsはDefender/Update。UniFi Content Filterの重複適用回避は有力候補だが、Secure Guard未導入端末の保護も考慮し標準確定は保留。
5. **導入検収案**：Agent Protectedだけでなく診断TXT、公式Malware/Botnet等のBlock Page、DNS Query Logの照合を必須候補とする。

## 決定事項・次工程
- 多層防御検証は**ここで一旦停止**。DNSFilterへの追加質問は、現在回答待ちの課金・契約・API関連質問の返信が来た後にまとめる。現時点で追加問い合わせを送らない。
- Secure Guard MSP商用化 Phase 1（Organization API作成、Site/Policy/端末、Provisioning、ライセンス照合、検証Organization早期削除）を優先して進める。Workの一括検証計画・変更系操作の承認パッケージを待つ。
- 試験用Organization削除は対象・影響確認後に別途明示承認。main/Production変更なし。
- DNSFilterへの後日質問：UniFi等のDNS Content Filterがある場合のRoaming Client動作、Protected表示と実効保護の差、意図的フォールバックかDNS介入か、推奨併用設定。
