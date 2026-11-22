'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../public/it-management-kaizen/index.html'),'utf8');
const diagnosis = 'https://sales.atlib.jp/it-management-kaizen/free-diagnosis/';

test('IT経営KAIZEN LP v37 preserves the approved value proposition and official service brand',() => {
  assert.match(source, /会社の未来を、/);
  assert.match(source, /未来から考える。事実で決める。実行し、変化を確かめる。/);
  assert.match(source, /技術・運用・管理/);
  assert.match(source, /設計Assessment/);
  assert.match(source, /IT経営KAIZEN 無料診断/);
  assert.match(source, /\/images\/brand\/it-management-kaizen-logo-v1\.png/);
  assert.match(source, /rel="canonical" href="https:\/\/www\.atlib\.jp\/it-management-kaizen\/"/);
  assert.match(source, /property="og:url" content="https:\/\/www\.atlib\.jp\/it-management-kaizen\/"/);
  assert.doesNotMatch(source, /v27 デザイン確認用|公開用ではありません|申込フォームのUI確認版/);
});

test('all four CTAs use the existing 7-question public intake and do not open a dead application modal',()=>{
  const anchors = [...source.matchAll(/<a\b[^>]*data-it-diagnosis-link[^>]*>/g)].map(x=>x[0]);
  assert.equal(anchors.length,4);
  anchors.forEach(a=>assert.ok(a.includes(`href="${diagnosis}"`)));
  assert.doesNotMatch(source, /href="#apply"|data-apply-open|id="apply35-form"|id="v36-application-ui"/);
  assert.match(source, /7問（約3〜5分）/);
  assert.match(source, /回答後に申込者情報を入力し、希望する日時を予約します。/);
  assert.match(source, /id="mobile-sticky-cta"/);
});

test('CTA query forwarding reuses only the existing UTM and acquisition fields',()=>{
  const script = source.match(/<script id="it-kaizen-cta-attribution">([\s\S]*?)<\/script>/);
  assert.ok(script);
  const links = Array.from({length:4},()=>({href:diagnosis}));
  const window={location:{search:'?utm_source=event&utm_campaign=2026&utm_term=kaizen&acquisition_source_type=referral&unapproved=private'}};
  const document={querySelectorAll(selector){assert.equal(selector,'a[data-it-diagnosis-link]');return links;}};
  vm.runInNewContext(script[1],{window,document,URL,URLSearchParams});
  links.forEach(link=>{
    const url = new URL(link.href);
    assert.equal(url.searchParams.get('utm_source'),'event');
    assert.equal(url.searchParams.get('utm_campaign'),'2026');
    assert.equal(url.searchParams.get('utm_term'),'kaizen');
    assert.equal(url.searchParams.get('acquisition_source_type'),'referral');
    assert.equal(url.searchParams.has('unapproved'),false);
  });
});
