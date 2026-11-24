'use strict';
const { test, expect } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

let server, baseUrl;
test.beforeAll(async()=>{
  const root=path.join(__dirname,'..','public','business-web','self-check');
  server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/self-check/'||url.pathname==='/self-check/index.html'){
      const enabled=url.searchParams.get('disabled')!=='1';
      const html=fs.readFileSync(path.join(root,'index.html'),'utf8')
        .replace('__ANONYMOUS_KPI_ENABLED__',enabled?'true':'false')
        .replace('__ANONYMOUS_KPI_SITE_KEY__',enabled?'mock-site-key-123456':'')
        .replace('__ANONYMOUS_KPI_API_ENDPOINT__',enabled?'https://kpi.test.example/api/public/business-kaizen/anonymous-events':'');
      res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return;
    }
    const file=url.pathname.endsWith('self-check.js')?'self-check.js':url.pathname.endsWith('self-check.css')?'self-check.css':null;
    if(file){res.writeHead(200,{'content-type':file.endsWith('.js')?'application/javascript':'text/css'});res.end(fs.readFileSync(path.join(root,file)));return}
    res.writeHead(404);res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  baseUrl=`http://127.0.0.1:${server.address().port}/self-check/`;
});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve))});

const turnstileScript=`(()=>{let next=0;const widgets=new Map();window.__turnstileRenderOptions=[];window.turnstile={render:(_el,options)=>{const id=++next;widgets.set(id,options);window.__turnstileRenderOptions.push({action:options.action,execution:options.execution,size:options.size});return id},execute:id=>setTimeout(()=>{const options=widgets.get(id);if(window.__turnstileFailure)options['error-callback']();else options.callback('mock-token-'+id)},0),remove:id=>widgets.delete(id)}})();`;
async function mockMeasurement(page,events,{apiFailure=false,turnstileFailure=false}={}){
  await page.addInitScript(value=>{window.__turnstileFailure=value},turnstileFailure);
  await page.route('https://challenges.cloudflare.com/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:turnstileScript}));
  await page.route('https://kpi.test.example/**',route=>{events.push(JSON.parse(route.request().postData()||'{}'));return apiFailure?route.abort('failed'):route.fulfill({status:202,contentType:'application/json',body:'{"accepted":true}'})});
}
async function begin(page){await page.getByRole('button',{name:'無料セルフチェックをはじめる'}).focus();await page.keyboard.press('Enter')}
async function answerThroughResult(page){
  for(let question=1;question<=15;question++){
    await page.locator('.option').first().click();
    await page.getByRole('button',{name:question===15?'結果を見る':'次へ',exact:true}).click();
  }
  await expect(page.locator('[data-diagnosis-result] h1')).toHaveText('今回の回答から見えてきたこと');
}

test('sends one start and complete per attempt with separate tokens and strict UTM payload',async({page})=>{
  const events=[];await mockMeasurement(page,events);
  await page.goto(`${baseUrl}?utm_source=google&utm_medium=cpc&utm_campaign=spring&utm_content=hero&utm_term=kaizen&email=never-send`);
  await begin(page);
  await page.locator('.option').first().focus();await page.keyboard.press('Enter');
  await expect.poll(()=>events.filter(event=>event.eventType==='diagnosis_start').length).toBe(1);
  await page.locator('.option').nth(1).click();
  await expect.poll(()=>events.filter(event=>event.eventType==='diagnosis_start').length).toBe(1);
  await page.getByRole('button',{name:'次へ',exact:true}).click();
  for(let question=2;question<=15;question++){await page.locator('.option').first().click();await page.getByRole('button',{name:question===15?'結果を見る':'次へ',exact:true}).click()}
  await expect(page.locator('[data-diagnosis-result] h1')).toBeVisible();
  await expect.poll(()=>events.filter(event=>event.eventType==='diagnosis_complete').length).toBe(1);
  expect(events[0].turnstileToken).not.toBe(events[1].turnstileToken);
  expect(await page.evaluate(()=>window.__turnstileRenderOptions)).toEqual([
    {action:'diagnosis_start',execution:'execute',size:undefined},
    {action:'diagnosis_complete',execution:'execute',size:undefined},
  ]);
  for(const event of events)expect(Object.keys(event).sort()).toEqual(['eventType','turnstileToken','utmCampaign','utmContent','utmMedium','utmSource','utmTerm'].sort());
  expect(events[0]).toMatchObject({utmSource:'google',utmMedium:'cpc',utmCampaign:'spring',utmContent:'hero',utmTerm:'kaizen'});
  await page.getByRole('button',{name:'最初からやり直す'}).click();await begin(page);await page.locator('.option').first().click();
  await expect.poll(()=>events.filter(event=>event.eventType==='diagnosis_start').length).toBe(2);
});

test('Turnstile and API failures never block answers or result rendering',async({page})=>{
  const turnstileEvents=[];await mockMeasurement(page,turnstileEvents,{turnstileFailure:true});await page.goto(baseUrl);await begin(page);await answerThroughResult(page);expect(turnstileEvents).toHaveLength(0);
  const apiEvents=[];await page.unrouteAll({behavior:'wait'});await mockMeasurement(page,apiEvents,{apiFailure:true});await page.goto(baseUrl);await begin(page);await answerThroughResult(page);
  await expect.poll(()=>apiEvents.length).toBe(2);await expect(page.locator('[data-diagnosis-result]')).toBeVisible();
});

test('Turnstile script load timeout ends measurement without blocking diagnosis or consultation',async({page})=>{
  await page.route('https://challenges.cloudflare.com/**',async route=>{
    await new Promise(resolve=>setTimeout(resolve,6000));
    try{await route.abort('timedout')}catch{}
  });
  await page.goto(baseUrl);await begin(page);await answerThroughResult(page);
  await expect(page.locator('[data-diagnosis-result]')).toBeVisible();
  await expect.poll(()=>page.locator('script[src*="challenges.cloudflare.com/turnstile"]').count(),{timeout:6500}).toBe(0);
  await page.locator('#consult').click();
  await expect(page.locator('#form')).toBeVisible();
  expect(await page.evaluate(()=>Boolean(window.turnstile))).toBe(false);
});

test('missing public configuration disables measurement without changing diagnosis',async({page})=>{
  const events=[];await mockMeasurement(page,events);await page.goto(`${baseUrl}?disabled=1`);await begin(page);await answerThroughResult(page);expect(events).toHaveLength(0);await expect(page.locator('[data-diagnosis-result]')).toBeVisible();
});

test('consultation submission and TimeRex handoff remain unchanged',async({page})=>{
  const events=[];await mockMeasurement(page,events);
  await page.route('https://sales.atlib.jp/api/business-web-consultation-leads',route=>route.fulfill({status:201,contentType:'application/json',body:'{"leadId":"lead-e2c-test"}'}));
  await page.goto(baseUrl);await begin(page);await answerThroughResult(page);
  await page.getByRole('button',{name:'診断結果を引き継いで、無料相談する'}).click();
  await page.getByLabel(/会社名/).fill('Example株式会社');await page.getByLabel(/お名前/).fill('山田 太郎');await page.getByLabel(/メールアドレス/).fill('test@example.test');
  await page.getByLabel(/プライバシーポリシー/).check();await page.getByLabel(/セルフチェックの回答・診断結果/).check();
  await page.getByRole('button',{name:'無料相談を申し込む'}).click();
  await expect(page.getByText('受付番号: lead-e2c-test')).toBeVisible();
  await expect(page.locator('#timerex-link')).toHaveAttribute('href',/timerex\.net\/.*lead_id=lead-e2c-test/);
});
