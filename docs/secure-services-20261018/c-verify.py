"""Independent offline arithmetic implementation, not imported from JS model."""
import json, math
from pathlib import Path
p=Path('secure-services-business-analysis/docs/secure-services-20261018/c40-c50')
d=json.loads((p/'c-results.json').read_text(encoding='utf8'));c=d['cfg']
def near(a,b):
    assert abs(a-b)<1e-6*max(1,abs(a)),(a,b)
def send(seats,u,fx):
    tx,f,mb,dl,otp,scan,support=[[5,1,2,1,1.1,1,3],[20,2,10,1.5,1.8,2,8],[80,3,50,2,2.5,5,20]][min(u,2)]
    files=tx*f;ul=files*mb/1024;r=c['sendRates'];scale=min(1,1/ul,2/(ul*dl)) if u==3 else 1
    yen=(tx*.3+tx*dl*.2)*(r['cpuActive']+.5*r['memActive'])+(files*scan*.3+files/1000*20)*(r['cpuActive']+4*r['memActive'])+tx*(1+otp)*.1
    usd=files*(.005+(2+dl)*.0004)/1000+tx*(12/1048576*.5+8/1e6*.4)+ul*(28/30*.025+dl*.12)+files*3*.4/1e6
    return 50+seats*(2+scale*(yen+usd*fx)),(support+seats*.1)/60*4000
def calc(sc,u,mi,share,N):
    routes=[]
    for route in range(3):
        a=[]
        for b,pc in enumerate(c['pc']):
            for sector in range(2):
                em=math.ceil(c['employeeAnchor'][b]*c['sectorEmployeeFactors'][sector]);s=max(1,math.ceil(em*c['senderRates'][sector]*c['intensity'][sc]));w=c['pcWeights'][sc][b]*([.7,.3][sector])
                if (route!=1 and not 1<=pc<=100) or (route!=0 and s>50):continue
                gb=0 if route==1 else (3500 if pc<=10 else 5000);sb=0 if route==0 else (1200 if s<=10 else 2500)
                discount=1000 if route==2 else 0;gd=discount*gb/(gb+sb);sd=discount-gd
                gu=0 if route==1 else min(pc,10)*300+min(max(pc-10,0),20)*250+max(pc-30,0)*200;su=0 if route==0 else s*200
                si,ss=send(s,u,150)
                a.append((w,[0 if route==1 else pc,gb-gd,sb-sd,gu,su,0 if route==1 else 50+pc,0 if route==1 else (8+pc*.1)/60*4000,0 if route==0 else si,0 if route==0 else ss]))
        denom=sum(w for w,_ in a);routes.append([sum(w*v[k] for w,v in a)/denom for k in range(9)])
    mix=d['mixes'][mi];v=[N*sum(mix[j]*routes[j][k] for j in range(3)) for k in range(9)];pc,gb,sb,gu,su,gv,gs,sv,ss=v
    ng=N*(mix[0]+mix[2]);ns=N*(mix[1]+mix[2])
    def fixed(num,stages):
        if num==0:return 0
        r=next((r for r in stages if num<=r[0]),stages[-1]);return r[1]+r[2]
    dns=150*max(150,pc*.92) if ng else 0
    gp=(gb+gu)*.964-gb*share-gv-gs-fixed(ng,c['guardStages'])-dns
    sp=(sb+su)*.964-sb*share-sv-ss-fixed(ns,c['sendStages'])
    return gp,sp,gp+sp
for r in d['detail']:
    gp,sp,net=calc(r['sc'],r['u'],r['mi'],r['share'],r['n']);near(gp,r['gProfit']);near(sp,r['sProfit']);near(net,r['profit'])
for r in d['growth']:
    vals=[calc(1,1,r['mi'],r['share'],month*r['pace'])[2] for month in range(1,37)]
    cum=0;low=0
    for x,row in zip(vals,r['rows']):cum+=x;low=min(low,cum);near(row['cumulative'],cum)
    near(-low,r['maxFunding'])
result={'independentDetailRows':len(d['detail']),'growthCases':len(d['growth']),'tolerance':'1e-6 relative','status':'passed','scope':'Independent Python company-level prices/costs/DNS/stage/discount/payment and 36-month cumulative checks','nativeExcelRecalculation':'not verified'}
(p/'c-independent-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(result))
