'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const { protectedBlocks, verifyOverlay } = require('../scripts/production-overlay/overlay-verifier.cjs');

const allowed = ['public/index.html','public/services/index.html','public/company/index.html','public/works/index.html','public/contact/index.html','public/css/atlib-service-renewal.css'];
const manifest = { allowedFiles: allowed, protectedTrees: ['public/images','public/js'], protectedFiles: ['public/css/style.css','public/css/atlib.css','public/css/services.css'] };
const home = (renewal = '') => `<div class="mainimg">hero</div><div class="brand-line"></div>${renewal}<section class="work-section">works</section><section class="strengths-section"></section><section class="motion-section">gallery</section><section class="mission-section">mission</section><section class="contact-section"></section>`;
function write(root, relative, value) { const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value); }
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlib-overlay-')); const base = path.join(root, 'base'); const candidate = path.join(root, 'candidate');
  for (const dir of [base, candidate]) {
    write(dir, 'public/index.html', home());
    for (const item of allowed.slice(1, 5)) write(dir, item, 'base');
    for (const item of manifest.protectedFiles) write(dir, item, 'protected');
    write(dir, 'public/images/logo.png', 'image'); write(dir, 'public/js/main.js', 'script');
  }
  for (const item of allowed.slice(1, 5)) write(candidate, item, 'changed');
  write(candidate, 'public/index.html', home('<section class="renewal-section">approved</section>'));
  write(candidate, 'public/css/atlib-service-renewal.css', 'renewal');
  return { root, base, candidate };
}

test('Production overlay accepts exactly the six allowed files', () => {
  const data = fixture();
  try { assert.deepEqual(verifyOverlay(data.base, data.candidate, manifest).changed, allowed.slice().sort()); }
  finally { fs.rmSync(data.root, { recursive: true, force: true }); }
});

test('Production overlay rejects an unrelated asset change', () => {
  const data = fixture(); write(data.candidate, 'public/js/main.js', 'changed-script');
  try { assert.throws(() => verifyOverlay(data.base, data.candidate, manifest), /Unauthorized overlay changes/); }
  finally { fs.rmSync(data.root, { recursive: true, force: true }); }
});

test('approved Git Base to HEAD public diff is exactly the six-file manifest', () => {
  const repository = path.resolve(__dirname, '..');
  const manifestFile = JSON.parse(fs.readFileSync(path.join(repository, 'scripts/production-overlay/manifest.json'), 'utf8'));
  const changed = execFileSync('git', ['-C', repository, 'diff', '--name-only', manifestFile.baseCommit, manifestFile.headCommit, '--', 'public'], { encoding: 'utf8' }).trim().split(/\r?\n/u).filter(Boolean).sort();
  assert.deepEqual(changed, manifestFile.allowedFiles.slice().sort());
  const before = execFileSync('git', ['-C', repository, 'show', `${manifestFile.baseCommit}:public/index.html`], { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
  const after = execFileSync('git', ['-C', repository, 'show', `${manifestFile.headCommit}:public/index.html`], { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
  assert.deepEqual(protectedBlocks(after), protectedBlocks(before));
});
