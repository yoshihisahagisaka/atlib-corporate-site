import fs from'node:fs/promises';import{cfg,joint,routeStats,portfolio,breakEven,growth,basic}from'./model.mjs';
const root='secure-services-business-analysis/docs/secure-services-20261018/',out='outputs/secure-services-integrated-20261018';
const y=x=>Math.round(x).toLocaleString('ja-JP'),pc=x=>(x*100).toFixed(1)+'%',t=(h,rs)=>'| '+h.join(' | ')+' |\n| '+h.map(()=>'---').join(' | ')+' |\n'+rs.map(r=>'| '+r.join(' | ')+' |').join('\n');
const family=['Guardのみ','Sendのみ','セットのみ','混在40/30/30'],useNames=['低位','標準','高位','高位・容量上限'];const selected=routeStats(1,1,2,500,1);const bv=b=>`${b.first} / ${b.sustained} / ${b.both}`;
const current={...cfg,guardProgressive:false};const ref=routeStats(1,0,2,0,1,current),refBE=breakEven(ref,cfg.mixes[0],.5,current);
const jointSummary=[0,1,2].map(sc=>{const js=joint(sc),stats=routeStats(sc,1,2,500,1);const eligible=js.filter(r=>r.guard&&r.send),den=eligible.reduce((a,r)=>a+r.weight,0),mx=eligible.reduce((a,r)=>a+r.weight*r.pc,0)/den,my=eligible.reduce((a,r)=>a+r.weight*r.senders,0)/den,cov=eligible.reduce((a,r)=>a+r.weight*(r.pc-mx)*(r.senders-my),0)/den,vx=eligible.reduce((a,r)=>a+r.weight*(r.pc-mx)**2,0)/den,vy=eligible.reduce((a,r)=>a+r.weight*(r.senders-my)**2,0)/den;return{sc,stats,correlation:cov/Math.sqrt(vx*vy),quotedGuard:1-stats[0].eligible,quotedSend:1-stats[1].eligible,eligibleSet:den};});
const gp=n=>basic(n,cfg.guardPlans[1])+Math.min(n,10)*300+Math.min(Math.max(0,n-10),20)*250+Math.max(0,n-30)*200,sp=n=>basic(n,cfg.sendPlans[2])+n*200;
const sensitivity=[];for(const fx of [130,150,170])for(const unit of [.92,1.15]){const c={...cfg,fx,dnsUnit:unit},st=routeStats(1,1,2,500,1,c),p=portfolio(100,st,cfg.mixes[3],.4,c);sensitivity.push({fx,unit,p100:p.profit,be:breakEven(st,cfg.mixes[3],.4,c)});}
const altMode={...cfg,dnsMode:'add'},altStats=routeStats(1,1,2,500,1,altMode),allocated={...cfg,discountMode:'guard'},altAllocation=routeStats(1,1,2,500,1,allocated);
const md=`# atLIB Secure Services 共通料金・セット・レベニューシェア統合分析

調査日2026-10-18。料金の正式決定、Production/DB/認証/請求設定の変更、サービス実装を行っていない。Guard50%配分・基本5,000＋端末300円の既存基準を比較として保持する。

## 経営判断への回答

**第一の検証候補はGuard 2段階＋Send Dの2段階、基本料金からセット500円引き、共通40%配分。** 端末・送信者従量はatLIB100%帰属。両サービスとも「基本料金＋利用数」の2段階にそろえて説明し、料金表には顧客が払う合計額を表示する。これは正式料金や既存Guard配分の変更ではなく、Issue17に基づく統括への比較提案である。

Guard候補は1〜10台基本2,500円、11〜100台4,000円。端末は1〜10台300円、11〜30台250円、31〜100台200円を**追加分だけ**適用する累進候補。Send Dは1〜10送信者基本1,200円、11〜50送信者2,500円＋全送信者200円/名。Guard101台以上とSend51名以上は要見積。受信者は無料。

共通率40%は販売原資とatLIB余力の中間案。30%なら余力が増え、50%も標準利用では成立余地があるが、未確認MSP原価・サポート・Send高利用への余裕が減る。現行Guard50%を維持したまま契約条件を確認し、正式な共通率は別判断する。

基準の共同分布、標準利用、Guardのみ40%／Sendのみ30%／セット30%の契約構成では、継続黒字は30%配分23社、40%25社、50%29社。**Guard/Sendをそれぞれ黒字にするには48／53／60社**。全体黒字だけでSendの赤字を隠さず、サービス別の差引を判断基準として併記する。

## Canonicalと既存決定の確認

- Corporate PR14 head40b7610: PIRA公開構造、全国従業者規模ベンチマーク、Windows PCの仮説分布。PIRA企業別の実業種・従業員・PC実分布は未取得。
- Issue17: 基本＋従量、基本のみ共通率配分、割引後基本が原資、費用はatLIB負担。Issue16: 共通顧客・契約・請求台帳、サブスクペイ請求/入金連携、サービス提供基盤・DB/認証は独立。共通管理の実装は後工程で、今回コスト削減を先取りしない。
- Guard PR7 head23b887d（merged）: API Fit/Gap。PR9 head932bf38（open）: Key rotate、Network以降の実機結果と契約設定API等の残課題。1,000社商用Goは保留。実機PoC・API操作を再実行していない。
- Send PR2 caea47b、PR3 74facb2: 実請求照合、専用Cloud Run/SQL予算、人数・基本料金配分分析を再利用。PR本文の旧「実測未取得」説明より、74facb2のdocsにある請求取得済み追補を優先。
- 詳細SHA・Issue本文はcanonical-sources.json。Corporateの既存PR14をbaseに新規専用分析branchを作り、開発PRやmainを変更しない。

## 料金候補と顧客の入口

${t(['サービス/案','基本料金レンジ','1台/1名の月額','位置付け'],[
['Guard現行基準','全社5,000円＋端末300円一律','5,300円','既存基準・基本50%配分。今回変更しない'],
['Guard G2','1〜10台2,500円／11〜100台4,000円','2,800円','2段階・入口を下げ説明を単純化'],
['Guard G3','1〜5台2,000円／6〜20台3,000円／21〜100台4,500円','2,300円','より低い入口、境界が増える'],
['Send A','1〜10名1,500円／11〜50名3,000円','1,700円','2段階・比較上の高単価案'],
['Send C','1〜5名1,000／6〜10名1,500／11〜30名2,500／31〜50名4,000円','1,200円','小規模価格と細かな境界緩和を優先'],
['Send D','1〜10名1,200円／11〜50名2,500円','1,400円','2段階、6〜10/31〜50名でも説明しやすい']])}

G2+Dの最小セットは1PC＋1送信者で3,700円（単独合計4,200円−500円）。3PC＋2送信者なら${y(gp(3)+sp(2)-500)}円。PC台数と送信者数は同数と仮定しない。Guardの基本料金レンジはPC数、Sendは有効送信者数を使う。

## 同一企業内の相関をどう扱ったか

PR14の低位/基準/高位PC帯分布を再利用。各PC帯を共通の企業規模クラスとし、従業者規模アンカー4/10/25/60/120/200/400人を新規仮定した。現場中心型70%・事務営業設計型30%も仮定。現場型の従業者はアンカー×1.5、事務型×0.75を切上げ、送信者は従業者×職務率10%/30%×低位0.5/基準1/高位1.5を切上げ、最低1名とした。

${t(['Windows PC代表','企業規模アンカー・仮定','基準の現場型 従業者/送信者','基準の事務型 従業者/送信者'],cfg.pc.map((p,b)=>{const rs=joint(1).filter(r=>r.band===b);return[p,cfg.employeeAnchor[b],rs[0].employees+'/'+rs[0].senders,rs[1].employees+'/'+rs[1].senders];}))}

これはPIRA業種比率・企業規模・送信者実数を復元したものではない。現場型/事務型は職務構成の例で、特定業種を一律分類するものではない。前回Sendの全国従業者分布ベースの分析とは別の**同時分布感応度**として記録する。従業者・PC・送信者を一対一対応させず、同じ企業行で価格・割引・原価を計算してから加重平均する。

${t(['規模シナリオ','Guard価格対象率','Send価格対象率','セット対象率','Guardのみ平均PC','Sendのみ平均送信者','セットPC/送信者','セット内の仮相関係数'],jointSummary.map(x=>[['低位','基準','高位'][x.sc],pc(x.stats[0].eligible),pc(x.stats[1].eligible),pc(x.eligibleSet),x.stats[0].pc.toFixed(2),x.stats[1].senders.toFixed(2),x.stats[2].pc.toFixed(2)+' / '+x.stats[2].senders.toFixed(2),x.correlation.toFixed(2)]))}

Guard対象率にはPC0と101台以上の除外、Sendには51送信者以上の除外がある。0PCはSendを利用でき、両契約は両条件を満たす企業だけで条件付平均を取る。従って独立した平均PC×平均送信者を使わない。契約形態の40/30/30%も成約予測ではなく選択可能な仮定。市場10,000社と導入率は感度入力で、PIRA公表の集計範囲・重複・案内可能数は未確認。

## 基準の単独・セット単価と配分原資

${t(['契約形態・G2+D/500円引き','Guard基本net','Send基本net','Guard従量','Send従量','平均月額','基本配分原資','40%配分/社'],selected.map((r,k)=>[family[k],y(r.gBase),y(r.sBase),y(r.gUsage),y(r.sUsage),y(r.gBase+r.sBase+r.gUsage+r.sUsage),y(r.gBase+r.sBase),y((r.gBase+r.sBase)*.4)]))}

同じ企業がセット化したときの値引きは必ず500円。単独契約とセットの条件付顧客分布が異なるため、上表のGuard単独平均＋Send単独平均−セット平均が必ず500円になるわけではない。これは顧客内相関を無視して平均値を足す誤りを避けるための区別である。

${t(['G基本案','Send案','平均G単独','平均S単独','平均セット','混在40%配分100社差引','混在継続黒字/両サービス黒字'],[0,1,2].flatMap(g=>[0,1,2].map(s=>{const st=routeStats(1,g,s,500,1),p=portfolio(100,st,cfg.mixes[3],.4),b=breakEven(st,cfg.mixes[3],.4);return[cfg.guardPlans[g].name,cfg.sendPlans[s].name,y(st[0].gBase+st[0].gUsage),y(st[1].sBase+st[1].sUsage),y(st[2].gBase+st[2].sBase+st[2].gUsage+st[2].sUsage),y(p.profit),b.sustained+' / '+b.both];})))}

この9案表のG0は基本5,000円を保持し**従量だけ累進候補を適用した比較**。既存の5,000＋300円一律・50%基準を正式変更したものではない。同基準のGuard単独・基準分布は平均${y(ref[0].gBase+ref[0].gUsage)}円、継続黒字${refBE.sustained}社（同じ仮原価・運用予算）。

## 割引とサービス別按分

推奨する計算上の按分は割引前基本料金比。企業ごとにGuard割引=D×Guard基本/(Guard基本＋Send基本)、残額をSendへ按分する。各基本netは元基本−按分割引、配分は各基本net×共通率。従量・原価には値引きを適用しない。正式な請求・税・端数処理・途中解約ルールはIssue16で後工程判断。

${t(['セット割引','共通率','混在・平均配分/社','100社差引','継続黒字/両サービス黒字'],[500,1000,1500].flatMap(d=>[.3,.4,.5].map(sh=>{const st=routeStats(1,1,2,d,1),p=portfolio(100,st,cfg.mixes[3],sh),b=breakEven(st,cfg.mixes[3],sh);return[d,pc(sh),y((p.gShare+p.sShare)/100),y(p.profit),b.sustained+' / '+b.both];})))}

割引DによるatLIBの限界差引低下はD×(1−共通率−決済3.6%)。40%なら500/1,000/1,500円の値引きは282/564/846円の負担、配分原資はそれぞれ200/400/600円減る（1セット/社）。販売効果や成約率は未実測なので、大きい割引を先に採用しない。

Guard基本だけから割引を負担させる案は、全体差引を変えずにSendを保護できるが、サービス別の費用負担が偏る。100社混在40%では比例按分のGuard/Send差引${y(portfolio(100,selected,cfg.mixes[3],.4).gProfit)}/${y(portfolio(100,selected,cfg.mixes[3],.4).sProfit)}円に対し、Guard負担案は${y(portfolio(100,altAllocation,cfg.mixes[3],.4,allocated).gProfit)}/${y(portfolio(100,altAllocation,cfg.mixes[3],.4,allocated).sProfit)}円。帳票は両サービスを分離し、共通率・従量帰属・合計を照合する。

## DNSFilter・Send原価と決済・運用

DNS表示Core単価0.92USDはユーザー提示値で、MSPの確定仕入価格ではない。公式公開ページはMSP starts150USD/月、標準Coreの月額表示1.15USD（年額表示1.00USD）で、MSP割引・Tier・最低額の含まれ方は別契約。モデルは **MAX(150,0.92×Guard総台数)×為替** を一つのGuardポートフォリオへ一回適用し、最低額が追加固定料金なら **(150＋0.92×台数)** の代替も比較。既存の他顧客が最低額を埋めている前提は置いていない。0.92は端末あたり利益を保証しない。

Guardの変動infra50円/社＋1円/PC、support8分/社＋0.1分/PC、固定infra/運用2,000/8,000円→4,000/16,000円→8,000/32,000円→16,000/64,000円（月額）は新しい予算仮定で実測ではない。Guard契約数11/101/501社で増強する計画感度。通常請求・管理の人手をsupport/固定運用へ含め、共通台帳による削減を先取りしない。

Sendは74facb2の専用project/Cloud Run API/GCS直接/専用SQL/非同期scan min0/4GiBの原価モデル。固定infra22,011→26,511→48,511→78,511円＋固定運用8,000円、Send契約数11/101/501で増強。現行Production同期min1とは別で未実装。Scan短縮係数0.3、DB予算、運用・supportは仮定。7〜9月共有請求42,818円、Cloud Run5,388.88円・最小関連5,315.57円は請求レポート実績、scan9月約2,078円は配賦推計として区分した。

Sendの保存21＋soft-delete7日、DL0.12USD/GiB等は既存仮定。FX変更はDNSとSendのUSD従量に反映し、円建て校正済Run秒単価と円建て計画予算へ二重適用しない。決済3.6%は税込請求手数料等の実契約を未照合で、モデルは税別売上比の仮定。

${t(['100社・40%配分','売上','基本配分','DNS仕入','G infra/support/運用','S infra/support/運用','決済','atLIB差引','Guard差引','Send差引'],cfg.mixes.map((mix,k)=>{const p=portfolio(100,selected,mix,.4);return[family[k],y(p.revenue),y(p.gShare+p.sShare),y(p.dns),y(p.gVariable+p.gSupport+p.gFixed),y(p.sVariable+p.sSupport+p.sFixed),y(p.gPayment+p.sPayment),y(p.profit),y(p.gProfit),y(p.sProfit)];}))}

単独サービスに他方の固定費を課さず、混在・セットでは両方の費用を計上する。顧客企業数Nとサービス別契約数NG/NSは異なるため、増強境界もサービス別に判定。セットsupportはGuard＋Sendを足し、根拠なしの相乗削減を仮定しない。

## 共通率と月次利益成長

${t(['契約構成','共通率','初回/継続/両サービス黒字','10社','30社','50社','100社','300社','1,000社'],cfg.mixes.flatMap((mix,k)=>[.3,.4,.5].map(sh=>{const b=breakEven(selected,mix,sh);return[family[k],pc(sh),bv(b),...cfg.counts.map(n=>y(portfolio(n,selected,mix,sh).profit))];})))}

両サービス黒字は全ての有効サービスが黒字で、以降1,000社まで再赤字にならない最小N。Guardのみ/Sendのみでは対象サービスだけを判定する。検索範囲外は「範囲内なし」とし、顧客増加で必ず黒字になるとは扱わない。構成比による小数社・台数は期待値であり、実契約・個別見積で再計算する。

## 利用量増加・為替・最低額のリスク

${t(['Send利用頻度','混在40%配分100社差引','Guard差引','Send差引','全体継続/両サービス黒字'],[0,1,2,3].map(u=>{const st=routeStats(1,1,2,500,u),p=portfolio(100,st,cfg.mixes[3],.4),b=breakEven(st,cfg.mixes[3],.4);return[useNames[u],y(p.profit),y(p.gProfit),y(p.sProfit),b.sustained+' / '+b.both];}))}

容量上限例は送信者1名あたり月UL1GiB・DL予算2GiBの企業内プールで、高位要求の取扱量を約8.53%へ縮小する。高位support20分/社は減らさず、既存DLを突然拒否する実装を提案していない。上限を入れても問い合わせ/例外処理が多ければSendの赤字が残り、セットGuard利益で覆い隠さない。利用枠・超過時の追加枠/上位契約/停止条件・最大ファイル・期限・DL回数は正式決定前の確認事項。

${t(['為替','DNS USD/台仮定','100社混在40%差引','継続/両サービス黒字'],sensitivity.map(r=>[r.fx,r.unit,y(r.p100),r.be.sustained+' / '+r.be.both]))}

MSP最低150USDが単価費用へ加算される場合、100社の差引は${y(portfolio(100,altStats,cfg.mixes[3],.4,altMode).profit)}円、継続/両サービス黒字は${breakEven(altStats,cfg.mixes[3],.4,altMode).sustained}/${breakEven(altStats,cfg.mixes[3],.4,altMode).both}社。最低内包の基準より月22,500円悪化する。割引Tierを期待して原価を下げず、契約書と仕入請求で置換する。

## 初期赤字と累積回収

${t(['混在・月間新規数','共通率','単月黒字月','累積回収月','最大累積赤字','36月累積差引'],[1,3,10].flatMap(pace=>[.3,.4,.5].map(sh=>{const g=growth(selected,cfg.mixes[3],sh,pace);return[pace,pc(sh),g.first??'36月内なし',g.recovered??'36月内なし',y(g.maxFunding),y(g.cumulative36)];})))}

開始0社、各月冒頭に増加・月額全額認識、解約0の仮定。初期赤字は許容するが、許容額は決めていない。月3社・40%では単月9月目、累積16月目、最大運営赤字約209千円。初期開発/環境構築/営業/導入/事故/税/入金時差を除く。Excelの初期投資は空欄で「未算入」と表示し、入力時だけ累積計算へ控除する。

PR9のOrganization契約UI/RPA補完2〜5分/社は未実測の立上げ概算。1,000社では33〜83h、時給4,000円なら約133〜333千円で、この導入負担は上表に含まれない。APIによるCore/Monthly/license/External ID確定やRPA許容等の商用Go課題が解消していないため、財務上黒字でも1,000社提供の技術承認にはならない。

## 顧客心理・境界・組合案内

${t(['候補','1→入口','基本料金境界での増額','理解・案内上の評価'],[
['Guard現行一律','5,300円','基本段差なし','説明は最も単純だが少数PCで固定負担が大きい'],
['Guard G2','2,800円',`10→11PC: ${y(gp(11)-gp(10))}円（${pc((gp(11)-gp(10))/gp(10))}）`,'2段階。Send Dと10を共有するが測定単位は異なる'],
['Guard G3','2,300円','5→6PC 1,300円／20→21PC 1,750円','最小価格を下げる代わりに境界と料金表行が増える'],
['Send A','1,700円','10→11名1,700円（48.6%）','2段階だがDより入口・段差とも大きい'],
['Send C','1,200円','5→6名700／10→11名1,200／30→31名1,700円','小規模の最安入口。4段階の説明・管理が増える'],
['Send D','1,400円',`10→11名: ${y(sp(11)-sp(10))}円（${pc((sp(11)-sp(10))/sp(10))}）`,'2段階。Cより最小200円高いが、6〜10/31〜50では安い']])}

両利用数が同時に10→11になる例は、セット500円引き後${y(gp(10)+sp(10)-500)}→${y(gp(11)+sp(11)-500)}円、${y(gp(11)+sp(11)-gp(10)-sp(10))}円増。共通化しても段差は消えず、変更前の見積表示・反映時期・送信者定義・端末課金定義を明記する。顧客は台数/人数を少なく登録する誘因があるため、職務権限と請求スナップショットを分離して監査する。

組合向けは「基本料金の○%」と契約単価例を案内し、端末/送信者の従量が紹介原資ではないことを明示する。G2+Dの3PC/2送信者・500円引きなら基本net3,200円から30/40/50%は960/1,280/1,600円。PIRA・組合・紹介者の内部配分は今回決めない。原資額と利益を混同せず、セット値引きで原資も下がる点を説明する。

## 採用しない案・追加確認

G0基本5,000円は既存比較基準として維持するが、PIRAの少数PC仮説で入口が重く、新料金の第一候補にはしない。G3＋Send Cは最小セット3,000円となる低入口代替で、価格反応を確認する比較候補として残す。Cを否定したのではなく、今回は共通構造と申込の単純さを優先してDを基準にした。AはDに比べ高い価格・段差を説明する追加価値が未確認。セット1,000/1,500円は追加成約効果・運用削減の根拠がないため第一候補にしない。

正式決定に必要なのは、(1) MSP .92/150USDの契約・最低額・端末定義・Tier・請求反映、(2) 同じ企業の業種/従業者/PC/送信者/利用量/価格反応、(3) 実サポート時間と初期導入負担、(4) Sendスキャン性能・テナント境界・容量制御・専用環境の採用範囲、(5) セット按分/端数/税/途中追加・解約・返金、(6) 初期赤字許容額と獲得速度。100社程度の同意ある検証を目安に仮定を置換するが、今回顧客へ連絡していない。

## 成果物・検証・実行境界

Excelは為替、DNS単価/最低・方式、価格、共通率、割引/按分、同時分布、利用、容量、契約比率、導入率、新規数/解約、初期投資を編集できる。経営比較・1〜1,000社利益曲線・36月累積を再計算する。別表2,079ケースは作成時の固定比較で、編集しても再計算しない旨を明示した。全ケース再生成scriptとCSVを同梱。

既存モデルのSend変動費、3共通率、サービス別合計、DNS最低額一回適用、セット比例按分、FX/割引感応度、Send単独DNS0を照合。7シートの表プレビューを確認。初回Excel出力は自動承認レビューが外部Visual Studioテレメトリ要求（内容不明）を検知して拒否したため停止し、通信のないローカル生成へ変更した。拒否された出力処理を迂回して再実行していない。最終XLSXは数式を維持し、独立JS計算のキャッシュと主要値を照合。Excelネイティブ再計算は未検証。

本調査はGit分析資料のみ。Corporate既存PR14/Issue16/17、Guard PoC、Send開発branch、Production/DB/請求/料金設定を変更していない。mainへ未merge。独立DB/認証/サービス原価を維持し、共通顧客台帳を実装したことにはしない。

出典: https://github.com/yoshihisahagisaka/atlib-corporate-site/pull/14 、 /issues/16 、 /issues/17 、 /pull/7 、 /pull/9 ; https://github.com/yoshihisahagisaka/atlib-ppap-file-transfer/pull/3 （74facb2）; https://www.dnsfilter.com/pricing （2026-10-18）。
`;
await fs.writeFile(root+'integrated-pricing-analysis.md',md);
await fs.writeFile(root+'sensitivity.json',JSON.stringify({jointSummary,sensitivity,currentGuardReference:{basic5000:true,unitFlat300:true,share:.5,be:refBE},minimumAdd:{be:breakEven(altStats,cfg.mixes[3],.4,altMode)},allocationGuard:{be:breakEven(altAllocation,cfg.mixes[3],.4,allocated)}},null,2));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');let html='';const ls=md.split('\n');for(let z=0;z<ls.length;z++){const l=ls[z];if(l.startsWith('| ')){const rows=[];while(z<ls.length&&ls[z].startsWith('| '))rows.push(ls[z++]);z--;html+='<div class="scroll"><table>'+rows.filter((_,q)=>q!==1).map((r,q)=>'<tr>'+r.split('|').slice(1,-1).map(v=>`<${q?'td':'th'}>${esc(v.trim())}</${q?'td':'th'}>`).join('')+'</tr>').join('')+'</table></div>';continue;}const h=l.match(/^(#{1,3}) (.*)/);if(h)html+=`<h${h[1].length}>${esc(h[2])}</h${h[1].length}>`;else if(l)html+='<p>'+esc(l).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')+'</p>';}
const full=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Secure Services 統合料金分析</title><style>body{font-family:"Yu Gothic",Meiryo,sans-serif;background:#f8fafc;color:#203047;line-height:1.85;margin:0}main{max-width:1280px;margin:auto;padding:35px;background:white}h1{font-size:27px}h2{font-size:21px;border-bottom:2px solid #f28c38;margin-top:38px}p{font-size:14px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1f3556;color:white}th,td{padding:9px;text-align:left;border-bottom:1px solid #dde3ea}tr:nth-child(even){background:#f1f5f9}.scroll{overflow:auto}</style><main>${html}</main></html>`;await fs.writeFile(root+'Secure_Services_Integrated_Report.html',full);await fs.writeFile(out+'/Secure_Services_Integrated_Report.html',full);
console.log(JSON.stringify({report:out+'/Secure_Services_Integrated_Report.html',referenceBE:refBE,jointSummary:jointSummary.map(r=>({sc:r.sc,correlation:r.correlation,gPC:r.stats[0].pc,sSenders:r.stats[1].senders,set:[r.stats[2].pc,r.stats[2].senders]}))},null,2));
