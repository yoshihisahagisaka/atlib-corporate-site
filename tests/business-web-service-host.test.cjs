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

async function withSite(redirects, check) {
  const port = await getPort();
  const child = spawn(process.execPath,[path.join(__dirname,'..','dist','server.js')],{
    env:{...process.env,PORT:String(port),NODE_ENV:'test',SITE_PUBLIC_MODE:'public',
      BUSINESS_WEB_REDIRECTS_ENABLED:redirects?'true':'false',
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

test('service host serves Business KAIZEN only with approved SEO routes',async()=>{
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
    assert.doesNotMatch(sitemap.body,/partner|joshisu-kaizen/);
    const robots=await request('/robots.txt','service.atlib.jp');
    assert.equal(robots.status,200);
    assert.match(robots.body,/Sitemap: https:\/\/service\.atlib\.jp\/sitemap\.xml/);
    for(const url of ['/contact/','/services/','/infravision-partner/','/web-development-partner/','/joshisu-kaizen/']){
      assert.equal((await request(url,'service.atlib.jp')).status,404,url);
    }
    const policy=await request('/privacy-policy/','service.atlib.jp');
    assert.equal(policy.status,302);
    assert.equal(policy.headers.location,'https://www.atlib.jp/privacy-policy/');
    // An untrusted X-Forwarded-Host must not turn the service host into a corporate host.
    assert.equal((await request('/services/','service.atlib.jp','www.atlib.jp')).status,404);
    assert.equal((await request('/business-web/','service.atlib.jp','www.atlib.jp')).status,404);
    assert.equal((await request('/business-web/','www.atlib.jp','service.atlib.jp')).status,410);
    const existing=await request('/business-web/','www.atlib.jp');
    assert.equal(existing.status,410,'legacy www LP is retired, without redirect');
    assert.equal(existing.headers.location,undefined);
    assert.equal(existing.headers['cache-control'],'no-store');
    assert.equal(existing.headers['content-security-policy'],undefined,'existing WWW static LP policy unchanged');
    const card=await request('/services/','www.atlib.jp');
    assert.equal(card.status,200);
    assert.match(card.body,/https:\/\/service\.atlib\.jp\/business-web\//);
  });
});

test('retired www Business Web routes always return 410, even if legacy flag is set',async()=>{
  await withSite(true,async request=>{
    const r=await request('/business-web/self-check/?utm_source=campaign','www.atlib.jp');
    assert.equal(r.status,410);
    assert.equal(r.headers.location,undefined);
    assert.equal(r.headers['cache-control'],'no-store');
    assert.equal((await request('/business-web/self-check/self-check.js','www.atlib.jp')).status,410);
    assert.equal((await request('/business-web/','service.atlib.jp')).status,200);
    assert.equal((await request('/','www.atlib.jp')).status,200);
    assert.equal((await request('/services/','www.atlib.jp')).status,200);
    assert.equal((await request('/contact/','www.atlib.jp')).status,200);
    assert.equal((await request('/business-web/','www.atlib.jp','service.atlib.jp')).status,410);
    assert.equal((await request('/business-web-other/','www.atlib.jp')).status,404);
    assert.equal((await request('/joshisu-kaizen/','www.atlib.jp')).status,200);
  });
});
