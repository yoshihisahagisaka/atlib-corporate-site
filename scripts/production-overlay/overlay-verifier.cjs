'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function slash(value) { return value.split(path.sep).join('/'); }
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function files(root) {
  const result = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) result.push(slash(path.relative(root, absolute)));
    }
  }
  walk(root);
  return result.sort();
}

function balancedElement(html, marker, tagName) {
  const from = html.indexOf(marker);
  if (from < 0) throw new Error(`Protected block marker missing: ${marker}`);
  const tags = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'giu');
  tags.lastIndex = from;
  let depth = 0;
  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(from, tags.lastIndex);
  }
  throw new Error(`Protected ${tagName} block is unbalanced`);
}

function protectedBlocks(html) {
  const works = balancedElement(html, '<section class="work-section"', 'section');
  const mission = balancedElement(html, '<section class="mission-section', 'section');
  const contracts = [
    ['hero', '<div class="mainimg"', '<div class="brand-line"'],
    ['gallery', '<section class="motion-section', '<section class="mission-section'],
  ];
  const blocks = Object.fromEntries(contracts.map(([name, start, end]) => {
    const from = html.indexOf(start); const to = html.indexOf(end, from + start.length);
    if (from < 0 || to < 0) throw new Error(`Protected ${name} block marker missing`);
    return [name, crypto.createHash('sha256').update(html.slice(from, to)).digest('hex')];
  }));
  blocks.works = crypto.createHash('sha256').update(works).digest('hex');
  blocks.mission = crypto.createHash('sha256').update(mission).digest('hex');
  return blocks;
}

function verifyOverlay(baseRoot, candidateRoot, manifest) {
  const allowed = new Set(manifest.allowedFiles);
  const all = [...new Set([...files(baseRoot), ...files(candidateRoot)])].sort();
  const changed = [];
  const hashes = {};
  for (const relative of all) {
    const before = path.join(baseRoot, relative); const after = path.join(candidateRoot, relative);
    const beforeHash = fs.existsSync(before) ? hash(before) : null;
    const afterHash = fs.existsSync(after) ? hash(after) : null;
    hashes[relative] = { before: beforeHash, after: afterHash };
    if (beforeHash !== afterHash) changed.push(relative);
  }
  const unexpected = changed.filter((entry) => !allowed.has(entry));
  if (unexpected.length) throw new Error(`Unauthorized overlay changes: ${unexpected.join(', ')}`);
  for (const entry of manifest.allowedFiles) {
    if (!changed.includes(entry)) throw new Error(`Allowed file did not change: ${entry}`);
  }
  for (const tree of manifest.protectedTrees) {
    if (changed.some((entry) => entry === tree || entry.startsWith(`${tree}/`))) throw new Error(`Protected tree changed: ${tree}`);
  }
  for (const entry of manifest.protectedFiles) {
    if (hashes[entry]?.before !== hashes[entry]?.after) throw new Error(`Protected file changed: ${entry}`);
  }
  const baseHome = fs.readFileSync(path.join(baseRoot, 'public/index.html'), 'utf8');
  const candidateHome = fs.readFileSync(path.join(candidateRoot, 'public/index.html'), 'utf8');
  const beforeBlocks = protectedBlocks(baseHome); const afterBlocks = protectedBlocks(candidateHome);
  for (const name of Object.keys(beforeBlocks)) if (beforeBlocks[name] !== afterBlocks[name]) throw new Error(`Protected home block changed: ${name}`);
  return { changed, protectedBlocks: afterBlocks, hashes };
}

if (require.main === module) {
  const [baseRoot, candidateRoot, manifestPath, outputPath] = process.argv.slice(2);
  if (!baseRoot || !candidateRoot || !manifestPath || !outputPath) throw new Error('Usage: node overlay-verifier.cjs BASE_ROOT CANDIDATE_ROOT MANIFEST OUTPUT');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const result = verifyOverlay(path.resolve(baseRoot), path.resolve(candidateRoot), manifest);
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`PRODUCTION_OVERLAY_FILES=${result.changed.length} PASS\n`);
}

module.exports = { protectedBlocks, verifyOverlay };
