'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const getPort = async () => {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
};

async function withSite(redirects, check, retireItManagementWww = false) {
  const port = await getPort();
  const child = spawn(process.execPath,[path.join(__dirname,'..','dist','server.js')],{
    env:{...process.env,PORT:String(port),NODE_ENV:'test',SITE_PUBLIC_MODE:'public',
      BUSINESS_WEB_REDIRECTS_ENABLED:redirects?'true':'false',
      ITMGMT_WWW_RETIRE_ENABLED:retireItManagementWww?'true':'false',
      SMTP_HOST:'127.0.0.1',SMTP_USER:'synthetic-user',SMTP_PASSWORD:'synthetic-password',
      SMTP_FROM:'system@atlib.jp',FORM_HMAC_SECRET:'synthetic-only',
      SITE_CONTACT_TURNSTILE_SITE_KEY:'synthetic-site-key-123456',
      SITE_CONTACT_TURNSTILE_SECRET:'synthetic-only',SITE_CONTACT_ALLOWED_ORIGINS:''},
    stdio:'ignore'
  });
  const request=(url,host,forwardedHost)=>new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port,path:url,headers:{Host:host,...(forwardedHost?{'X-Forwarded-Host':forwardedHost}:{})}},res=>{
      const parts=[];
      res.on('data',v=>parts.push(v));
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(parts).toString('utf8')}));
    });
    req.on('error',reject);
    req.end();
  });
  try {
    let ready=false;
    for(let i=0;i<50;i++){
      try{ready=(await request('/healthz','www.atlib.jp')).status===200;if(ready)break;}catch{}
      await new Promise(r=>setTimeout(r,100));
    }
    assert.ok(ready,'synthetic site failed to start');
    await check(request);
  } finally {
    child.kill('SIGTERM');
    if(child.exitCode===null) await new Promise(r=>child.once('exit',r));
  }
}

test('service host serves only the approved KAIZEN services with SEO and security controls',async()=>{
  await withSite(false,async request=>{
    const lp=await request('/business-web/','service.atlib.jp');
    assert.equal(lp.status,200);
    assert.match(lp.body,/https:\/\/service\.atlib\.jp\/business-web\//);
    assert.equal(lp.headers['x-robots-tag'],undefined);
    assert.match(lp.body,/<title>業務KAIZEN/);
    assert.equal(lp.headers['x-frame-options'],'DENY');
    assert.match(lp.headers['content-security-policy'],/frame-ancestors 'none'/);
    assert.match(lp.headers['content-security-policy'],/script-src 'self'/);
    assert.match(lp.headers['content-security-policy'],/style-src 'self' 'unsafe-inline'/);
    assert.match(lp.headers['content-security-policy'],/connect-src 'self' https:\/\/sales\.atlib\.jp/);
    const check=await request('/business-web/self-check/','service.atlib.jp');
    assert.equal(check.status,200);
    assert.match(check.body,/self-check\.js\?v=20261122-form1/);
    assert.match(check.body,/self-check\.css\?v=20261122-form1/);
    assert.equal(check.headers['x-frame-options'],'DENY');
    assert.match(check.headers['content-security-policy'],/frame-ancestors 'none'/);
    const js=await request('/business-web/self-check/self-check.js','service.atlib.jp');
    assert.equal(js.status,200);
    assert.match(js.body,/business-web-consultation-leads/);
    assert.match(js.body,/https:\/\/www\.atlib\.jp\/privacy-policy\//);
    assert.match(js.body,/https:\/\/www\.atlib\.jp\/#link3/);
    assert.doesNotMatch(js.body,/href="\/it-management-kaizen\/"/);
    assert.match(js.body,/class="panel application-panel"/);
    assert.match(js.body,/class="form-grid"/);
    assert.match(js.body,/class="form-consent"/);
    assert.match(js.body,/name="privacyConsent" type="checkbox" required/);
    assert.match(js.body,/name="diagnosisTransferConsent" type="checkbox" required/);
    assert.match(js.body,/name="email" type="email" autocomplete="email"/);
    const css=await request('/business-web/self-check/self-check.css','service.atlib.jp');
    assert.equal(css.status,200);
    assert.match(css.body,/\.form-grid\s*\{display:grid;grid-template-columns:repeat\(2,/);
    assert.match(css.body,/@media\(max-width:650px\).*\.form-grid\s*\{grid-template-columns:1fr/s);
    const image=await request('/business-web/assets/atlib-logo.png','service.atlib.jp');
    assert.equal(image.status,200);
    const sitemap=await request('/sitemap.xml','service.atlib.jp');
    assert.equal(sitemap.status,200);
    assert.match(sitemap.body,/https:\/\/service\.atlib\.jp\/business-web\//);
    assert.match(sitemap.body,/https:\/\/service\.atlib\.jp\/it-management-kaizen\//);
    assert.doesNotMatch(sitemap.body,/partner|joshisu-kaizen/);
    const robots=await request('/robots.txt','service.atlib.jp');
    assert.equal(robots.status,200);
    assert.match(robots.body,/Sitemap: https:\/\/service\.atlib\.jp\/sitemap\.xml/);
    assert.match(robots.body,/Allow: \/it-management-kaizen\//);
    for(const url of ['/contact/','/services/','/infravision-partner/','/web-development-partner/','/joshisu-kaizen/']){
      assert.equal((await request(url,'service.atlib.jp')).status,404,url);
    }
    const it=await request('/it-management-kaizen/','service.atlib.jp');
    assert.equal(it.status,200);
    assert.match(it.body, /rel="canonical" href="https:\/\/service\.atlib\.jp\/it-management-kaizen\/"/);
    assert.match(it.body, /property="og:url" content="https:\/\/service\.atlib\.jp\/it-management-kaizen\/"/);
    assert.match(it.body, /IT経営ビジョンセッション/);
    assert.match(it.body, /assets\/it-management-kaizen-v44\.js\?v=20261123-service1/);
    assert.doesNotMatch(it.body, /<script id="v34-cta-behavior"|<script id="it-kaizen-v41-diagnosis-cta"/);
    assert.equal(it.headers['x-robots-tag'],undefined);
    assert.equal(it.headers['x-frame-options'],'DENY');
    assert.match(it.headers['content-security-policy'],/script-src 'self'/);
    assert.match(it.headers['content-security-policy'],/style-src 'self' 'unsafe-inline'/);
    const itJs=await request('/it-management-kaizen/assets/it-management-kaizen-v44.js','service.atlib.jp');
    assert.equal(itJs.status,200);
    assert.match(itJs.body,/data-it-diagnosis-link/);
    const itLogo=await request('/it-management-kaizen/assets/it-management-kaizen-logo-v1.png','service.atlib.jp');
    assert.equal(itLogo.status,200);
    const itCorpLogo=await request('/it-management-kaizen/assets/atlib-corporate-logo.png','service.atlib.jp');
    assert.equal(itCorpLogo.status,200);
    // This legacy-only asset exists in public/it-management-kaizen, but is NOT
    // shipped to the service-host private LP directory. Never fall back to WWW.
    const legacyOnly='/it-management-kaizen/assets/it-management-kaizen-dialogue-visual-v1.png';
    assert.equal((await request(legacyOnly,'service.atlib.jp')).status,404);
    assert.equal((await request(legacyOnly,'www.atlib.jp')).status,200);
    assert.equal((await request('/it-management-kaizen/old/index.html','service.atlib.jp')).status,404);
    assert.equal((await request('/it-management-kaizen-other/','service.atlib.jp')).status,404);
    assert.equal((await request('/it-management-kaizen/','service.atlib.jp','www.atlib.jp')).status,404);
    assert.equal((await request('/it-management-kaizen/','www.atlib.jp')).status,200);
    const taggedPreview=await request('/it-management-kaizen/','preview-candidate.a.run.app');
    assert.equal(taggedPreview.status,200);
    assert.equal(taggedPreview.headers['x-robots-tag'],'noindex, nofollow');
    const policy=await request('/privacy-policy/','service.atlib.jp');
    assert.equal(policy.status,302);
    assert.equal(policy.headers.location,'https://www.atlib.jp/privacy-policy/');
    // An untrusted X-Forwarded-Host must not turn the service host into a corporate host.
    assert.equal((await request('/services/','service.atlib.jp','www.atlib.jp')).status,404);
    assert.equal((await request('/business-web/','service.atlib.jp','www.atlib.jp')).status,404);
    assert.equal((await request('/business-web/','www.atlib.jp','service.atlib.jp')).status,200);
    const existing=await request('/business-web/','www.atlib.jp');
    assert.equal(existing.status,200,'www LP preserved before redirect gate');
    assert.equal(existing.headers['content-security-policy'],undefined,'existing WWW static LP policy unchanged');
    const card=await request('/services/','www.atlib.jp');
    assert.equal(card.status,200);
    assert.match(card.body,/https:\/\/service\.atlib\.jp\/business-web\//);
    assert.match(card.body,/https:\/\/service\.atlib\.jp\/it-management-kaizen\//);
  });
});

test('www migration redirects are gated and keep query strings',async()=>{
  await withSite(true,async request=>{
    const r=await request('/business-web/self-check/?utm_source=campaign','www.atlib.jp');
    assert.equal(r.status,301);
    assert.equal(r.headers.location,'https://service.atlib.jp/business-web/self-check/?utm_source=campaign');
    assert.equal((await request('/business-web/','www.atlib.jp','service.atlib.jp')).status,200);
    assert.equal((await request('/business-web-other/','www.atlib.jp')).status,404);
    assert.equal((await request('/joshisu-kaizen/','www.atlib.jp')).status,200);
  });
});

test('IT経営KAIZEN old www URL is retired only when its separate gate is enabled',async()=>{
  await withSite(false,async request=>{
    const paths=[
      '/it-management-kaizen/',
      '/it-management-kaizen/assets/it-management-kaizen-v44.js?utm_source=campaign',
      '/it-management-kaizen/old/index.html',
    ];
    for(const url of paths){
      const r=await request(url,'www.atlib.jp');
      assert.equal(r.status,410,url);
      assert.equal(r.headers.location,undefined,url);
      assert.equal(r.headers['cache-control'],'no-store',url);
    }
    assert.equal((await request('/it-management-kaizen/','service.atlib.jp')).status,200);
    assert.equal((await request('/business-web/','service.atlib.jp')).status,200);
    assert.equal((await request('/business-web/','www.atlib.jp')).status,200);
    assert.equal((await request('/services/','www.atlib.jp')).status,200);
    assert.equal((await request('/contact/','www.atlib.jp')).status,200);
  },true);
});
