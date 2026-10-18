// Reuse the established offline formula workbook. No network-dependent exporter.
import fs from 'node:fs/promises';
const dest='outputs/secure-services-c40-c50-20261018';await fs.mkdir(dest,{recursive:true});
let gen=await fs.readFile('services-work/generate-offline.mjs','utf8');
gen=gen.replace("from'./model.mjs'","from'./c-model.mjs'").replaceAll('outputs/secure-services-integrated-20261018',dest);
gen=gen.replace("['セット基本割引',500]","['セット基本割引',1000]");
// Match exact numeric controls; fail if the historical source has changed.
if(gen.includes("['セット基本割引',500]"))throw Error('discount replacement failed');
gen=gen.replace("10,2500,100,4000,100,4000","10,3500,100,5000,100,5000");
gen=gen.replace("put(sum,'H4',500)","put(sum,'H4',1000)");
const start=gen.indexOf("const snap=sh['固定条件比較']"),end=gen.indexOf('for(const s of [cv,gr])',start);
if(start<0||end<0)throw Error('snapshot markers missing');
gen=gen.slice(0,start)+`const snap=sh['固定条件比較'],all=JSON.parse(await fs.readFile('secure-services-business-analysis/docs/secure-services-20261018/c40-c50/c-results.json','utf8'));put(snap,'A1','C-40 / C-50 全288ケース（作成時固定表）');put(snap,'A2','入力変更には連動しない。動的再計算は経営比較・利益曲線・累積回収。感度詳細は別CSV/JSON。');head(snap,4,['契約構成','市場規模0低1基準2高','利用0低1標準2高3高上限','シェア率','売上/社','基本/社','従量/社','配分/社','初回黒字','継続黒字','両サービス黒字','10社','30社','50社','100社','300社','1000社']);snap.getRangeByIndexes(4,0,all.rows.length,17).values=all.rows.map(r=>[r.label,r.sc,r.u,r.share,r.avgRevenue,r.avgBasic,r.avgUsage,r.avgShare,r.first,r.sustained,r.both,...r.profits]);snap.freezePanes.freezeRows(4);snap.getRange('E5:Q292').setNumberFormat('#,##0;(#,##0);"-"');snap.getRange('D5:D292').setNumberFormat('0%');\n`+gen.slice(end);
// Keep formula layout intact; selected rate 2 = 40%, rate 3 = 50%.
gen=gen.replace("await fs.writeFile(out+'/offline-workbook-data.json',JSON.stringify(wb.dump()));",`put(i,'A92','C案指定：Guard 3500/5000、Send 1200/2500、パック基本1000引。率2=40%、率3=50%。');put(i,'A93','50%パック時 B36=2/7,B37=1.5/7,B38=.5。70%時1.2/7,.9/7,.7。入力は仮定。');put(i,'A94','各サービス基本20円減はC42/E42/G42とC48/E48/G48/I48を各20減。パック最終20円減はさらにB17=980。');put(i,'A95','高利用混在の作成時比較はc-sensitivity.csv。動的モデルのB18=2は全Send高利用、3は容量上限。');put(sum,'A42','C案：今回指定料金を優先。固定条件比較は今回288ケース。30%は参考、40%と50%を比較。');await fs.writeFile(out+'/offline-workbook-data.json',JSON.stringify(wb.dump()));`);
gen=gen.replaceAll('288','144').replaceAll('Q292','Q148');
gen=gen.replace('G2二段階','C Guard').replace('作成時の2,079ケース','作成時のC案144ケース').replace('仮説: Guard2段階＋SendD、セット500円、共通率30/40/50%。正式決定ではない。','C案指定料金・セット1000円引。30%は参考、40%と50%を比較。正式決定ではない。');
await fs.writeFile('services-work/c-generate.mjs',gen);
let cache=await fs.readFile('services-work/create-offline-cache.mjs','utf8');
cache=cache.replace("from'./model.mjs'","from'./c-model.mjs'").replaceAll('outputs/secure-services-integrated-20261018',dest).replaceAll('500','1000');
// Above global replacement only changes old discount values and 1000 helper bounds? restore 1000->2000 risks: use targeted source instead.
cache=await fs.readFile('services-work/create-offline-cache.mjs','utf8');cache=cache.replace("from'./model.mjs'","from'./c-model.mjs'").replaceAll('outputs/secure-services-integrated-20261018',dest).replace('routeStats(1,1,2,500,1)','routeStats(1,1,2,1000,1)').replace('Math.min(500,gb+sb)','Math.min(1000,gb+sb)').replace("'H4',500","'H4',1000");
await fs.writeFile('services-work/c-cache.mjs',cache);
let py=await fs.readFile('services-work/export-offline.py','utf8');py=py.replaceAll('outputs/secure-services-integrated-20261018',dest).replaceAll('Secure_Services_Integrated_Model.xlsx','Secure_Services_C40_C50_Model.xlsx');
py=py.replace("==25","==22").replace("==53","==55").replace('166147.98665653652','197167.98665653646').replace("'selectedBE40':25","'selectedBE40':22").replace("'bothServicesBE40':53","'bothServicesBE40':55");
py=py.replace("[60,85,86,87,88,89,90]","[60,85,86,87,88,89,90,92,93,94,95]");
py=py.replace("earlier authored formulas verified with Artifact Tool before blocked export","reused formula structure; C defaults independently verified; native recalculation unverified");
py=py.replace('wb.calculation=CalcProperties',"from c_extra_sheets import add_sheets\nadd_sheets(wb)\nwb.calculation=CalcProperties");
py=py.replace('assert len(wb.sheetnames)==7','assert len(wb.sheetnames)==9');
await fs.writeFile('services-work/c-export.py',py);
console.log('Prepared safe offline C workbook scripts');
