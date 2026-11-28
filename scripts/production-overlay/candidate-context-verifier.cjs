'use strict';
const fs = require('node:fs');
const path = require('node:path');

const [contextArg, manifestArg, outputArg] = process.argv.slice(2);
if (!contextArg || !manifestArg || !outputArg) throw new Error('Usage: candidate-context-verifier.cjs CONTEXT MANIFEST OUTPUT');
const context = path.resolve(contextArg);
const manifest = JSON.parse(fs.readFileSync(manifestArg, 'utf8'));
const dockerfile = fs.readFileSync(path.join(context, 'Dockerfile'), 'utf8').replace(/\r\n/gu, '\n');
const effective = dockerfile.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
const expected = ['ARG BASE_IMAGE', 'FROM ${BASE_IMAGE}', ...manifest.allowedFiles.map((file) => `COPY overlay/${file} /app/${file}`)];
if (JSON.stringify(effective) !== JSON.stringify(expected)) throw new Error('Dockerfile FROM/COPY contract mismatch');
const found = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else found.push(path.relative(context, absolute).split(path.sep).join('/'));
  }
}
walk(context);
const expectedFiles = ['Dockerfile', ...manifest.allowedFiles.map((file) => `overlay/${file}`)].sort();
if (JSON.stringify(found.sort()) !== JSON.stringify(expectedFiles)) throw new Error(`Build context allowlist mismatch: ${found.join(', ')}`);
fs.writeFileSync(outputArg, `${JSON.stringify({ baseImage: manifest.baseImage, files: expectedFiles }, null, 2)}\n`);
process.stdout.write(`CANDIDATE_CONTEXT_FILES=${expectedFiles.length} PASS\n`);

