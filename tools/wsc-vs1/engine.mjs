import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APPROVED_INTRO = `# WebサイトのURLだけで、ここまで分かることをご存じですか？

会社のWebサイトのURLは、誰でも見ることができる情報です。

実は、このURLを手がかりに、インターネット上に公開されているさまざまな設定情報を調べることができます。

例えば、次のようなことです。

**Webサイトの通信が暗号化されているか**

お客様がWebサイトを閲覧する際の通信を守る仕組みについて、外部から確認できます。

**Webサイトにどのような保護設定があるか**

不正なプログラムの動作や、他サイトによる画面の悪用を抑えるための公開設定を確認できます。

**会社を装った偽メールへの対策**

対象ドメインに公開されているメール認証の設定から、なりすまし対策の方針を確認できます。

**特別な社内情報を調べているわけではありません**

今回の診断では、社内のパソコンや業務システムにログインしたり、機密情報を取得したりすることはありません。

インターネット上に公開されている情報を確認し、その意味を分かりやすく整理しています。

**大切なのは、結果を知ることから**

設定があるから絶対に安全、設定が見当たらないから危険、という単純なものではありません。

まずは、自社のWebサイトやメールにどのような仕組みが使われているのかを知り、必要に応じて管理担当者や保守会社へ確認することが大切です。

**このレポートが、自社のセキュリティについて考えるきっかけになれば幸いです。**`;

const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' ? value : null;
const html = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const evidence = (label, value) => `<li><b>${html(label)}：</b>${html(value === null ? '（値なし）' : value)}</li>`;

export function evaluate(input, { rulesPath, explanationsPath } = {}) {
  if (!isObject(input)) throw new Error('入力JSONはオブジェクトである必要があります。');
  const rules = rulesPath ? read(rulesPath) : { ruleVersion: 'WSC-R-1.0.0-draft' };
  const explanations = explanationsPath ? read(explanationsPath).entries : null;
  if (!explanations) throw new Error('固定解説ファイルが必要です。');
  const findings = [];
  const internalOnly = [];
  const add = (id, status, details) => {
    if (!explanations[id]) throw new Error(`固定解説が未定義です: ${id}`);
    findings.push({ id, status, ...explanations[id], details });
  };
  const http = isObject(input.http) ? input.http : null;
  const headers = http && isObject(http.headers) ? http.headers : null;
  const tls = isObject(input.tls) ? input.tls : null;
  const dns = isObject(input.dns) ? input.dns : null;
  const spf = dns && isObject(dns.spf) ? dns.spf : null;
  const dmarc = dns && isObject(dns.dmarc) ? dns.dmarc : null;

  if (tls && tls.status === 'VALIDATED' && tls.policyErrors === 'None') {
    add('TLS_VALID', '設定確認済み', [evidence('検証状態', tls.status), evidence('検証エラー', tls.policyErrors), evidence('通信方式', text(tls.negotiatedProtocol)), evidence('有効期限', text(tls.notAfter))]);
    if (Number.isInteger(tls.daysRemaining) && tls.daysRemaining >= 0 && tls.daysRemaining <= 30) add('TLS_EXPIRING', '追加確認推奨', [evidence('残日数', tls.daysRemaining), evidence('有効期限', text(tls.notAfter))]);
  } else if (tls && tls.status === 'VALIDATION_FAILED' && typeof tls.policyErrors === 'string' && tls.policyErrors !== 'None') {
    add('TLS_INVALID', '追加確認推奨', [evidence('検証状態', tls.status), evidence('検証エラー', tls.policyErrors)]);
  } else if (tls) internalOnly.push('TLS: 未定義または判定不能のTLS状態');

  if (http && http.status === 'OK' && headers) {
    const hsts = text(headers['Strict-Transport-Security']);
    const match = hsts && /(?:^|;)\s*max-age\s*=\s*(\d+)/i.exec(hsts);
    if (match && Number(match[1]) > 0) add('HSTS_ENABLED', '設定確認済み', [evidence('Strict-Transport-Security', hsts)]);
    else if (hsts === null || (match && Number(match[1]) === 0)) add('HSTS_DISABLED', '追加確認推奨', [evidence('Strict-Transport-Security', hsts)]);
    else internalOnly.push('HSTS: max-ageを判定できない形式');
    const csp = text(headers['Content-Security-Policy']);
    if (csp === null) add('CSP_HEADER_ABSENT', '追加確認推奨', [evidence('Content-Security-Policy', null)]);
    else if (csp.trim()) add('CSP_HEADER_PRESENT', '設定確認済み', [evidence('Content-Security-Policy', csp)]);
    else internalOnly.push('CSP: 空文字は未定義');
    if (text(headers['X-Frame-Options']) === null && csp === null) add('FRAME_HEADER_ABSENT', '追加確認推奨', [evidence('X-Frame-Options', null), evidence('Content-Security-Policy', null)]);
    if (text(headers['X-Content-Type-Options'])?.toLowerCase() === 'nosniff') add('NOSNIFF_ENABLED', '設定確認済み', [evidence('X-Content-Type-Options', headers['X-Content-Type-Options'])]);
  } else if (http) internalOnly.push('HTTP: OK応答ではないためヘッダー不在を判定しない');

  if (spf && spf.lookupStatus === 'FOUND' && Array.isArray(spf.records) && Number.isInteger(spf.recordCount) && spf.recordCount === spf.records.length) {
    if (spf.recordCount === 1 && typeof spf.records[0] === 'string' && /^v=spf1(?:\s|$)/i.test(spf.records[0])) add('SPF_PRESENT', '設定確認済み', [evidence('SPFレコード', spf.records[0]), evidence('レコード数', spf.recordCount)]);
    else if (spf.recordCount > 1) add('SPF_MULTIPLE', '追加確認推奨', [evidence('レコード数', spf.recordCount)]);
    else internalOnly.push('SPF: 形式が未定義');
  } else if (spf) internalOnly.push('SPF: DNS取得状態またはレコード型が判定不能');

  const p = dmarc && isObject(dmarc.tags) ? text(dmarc.tags.p)?.toLowerCase() : null;
  if (dmarc && dmarc.lookupStatus === 'FOUND' && Array.isArray(dmarc.records) && dmarc.recordCount === 1) {
    if (p === 'none') add('DMARC_NONE', '追加確認推奨', [evidence('DMARCレコード', dmarc.records.join(' ')), evidence('p値', p)]);
    else if (p === 'quarantine' || p === 'reject') add('DMARC_ENFORCING', '設定確認済み', [evidence('p値', p)]);
    else internalOnly.push('DMARC: p値が未定義');
  } else if (dmarc && dmarc.lookupStatus === 'NO_RECORD') add('DMARC_ABSENT', '追加確認推奨', [evidence('DNS取得状態', dmarc.lookupStatus)]);
  else if (dmarc) internalOnly.push('DMARC: DNS取得状態またはレコード型が判定不能');

  return { ruleVersion: rules.ruleVersion, contentVersion: read(explanationsPath).contentVersion, checkedAt: text(input.checkedAt), targetUrl: text(input.targetUrl), findings, internalOnly };
}

export function render(report, company) {
  for (const key of ['name', 'headOffice', 'url']) if (!text(company?.[key])) throw new Error(`企業情報 ${key} が必要です。`);
  if (!report.checkedAt || !report.targetUrl) throw new Error('checkedAt と targetUrl が必要です。');
  const cards = report.findings.map((f) => `<article class="finding ${f.status === '追加確認推奨' ? 'review' : 'confirmed'}"><p class="status">${html(f.status)}</p><h3>${html(f.title)}</h3><h4>今回の診断結果</h4><p>${html(f.observation)}</p><h4>そう判断した根拠</h4><ul>${f.details.join('')}</ul><p>${html(f.evidenceExplanation)}</p><h4>なぜ大切なのか</h4><p>${html(f.knowledge)}</p><h4>次に確認すること</h4><p>${html(f.nextAction)}</p>${f.reference ? `<p class="reference">技術出典（ドラフト記載）：${html(f.reference)}</p>` : ''}</article>`).join('');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${html(company.name)} Webセキュリティ診断 VS1</title><style>body{font-family:system-ui,sans-serif;max-width:920px;margin:auto;padding:28px;color:#18212b;line-height:1.7}.banner{background:#6b2c2c;color:white;padding:12px;font-weight:bold}.meta{background:#f4f6f8;padding:16px}.finding{border-left:6px solid #247a4d;padding:16px;margin:18px 0;background:#f7fbf8}.finding.review{border-color:#a06a00;background:#fffbf2}.status{font-weight:bold}.reference{font-size:.9em;color:#555}@media print{body{max-width:none;padding:10mm}.finding{break-inside:avoid}.banner{border:1px solid #000;color:#000;background:#fff}}</style></head><body><p class="banner">内部レビュー用試作（VS1）— 対外配布・安全性評価には使用しないでください</p><h1>Webセキュリティ診断レポート</h1><section class="meta"><p><b>企業名：</b>${html(company.name)}<br><b>本店所在地：</b>${html(company.headOffice)}<br><b>対象URL：</b>${html(company.url)}<br><b>診断日時：</b>${html(report.checkedAt)}<br><b>ルール版：</b>${html(report.ruleVersion)} ／ <b>解説版：</b>${html(report.contentVersion)}</p></section><section><h2>はじめに</h2>${APPROVED_INTRO.split('\n\n').map(p => `<p>${html(p).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/^# /, '')}</p>`).join('')}</section><section><h2>今回の確認事項</h2><p>設定確認済み：${report.findings.filter(f => f.status === '設定確認済み').length}件／追加確認推奨：${report.findings.filter(f => f.status === '追加確認推奨').length}件</p></section><section><h2>Web・メール設定の詳細</h2>${cards || '<p>利用者向けに表示できる判定はありません。</p>'}</section><footer><p>これは公開Web・メール設定の確認であり、企業全体のセキュリティや安全性を評価するものではありません。</p><p>固定解説・判定条件はレビュー中のドラフトを使用しています。取得失敗・未定義値は利用者向けに表示せず、内部証跡で扱います。</p></footer></body></html>`;
}

function main() {
  const [inputPath, companyPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !companyPath || !outputPath) throw new Error('使い方: node engine.mjs input.json company.json output.html');
  const root = path.dirname(fileURLToPath(import.meta.url));
  const report = evaluate(read(inputPath), { rulesPath: path.join(root, 'rules.json'), explanationsPath: path.join(root, 'explanations.json') });
  fs.writeFileSync(outputPath, render(report, read(companyPath)), 'utf8');
  console.log(JSON.stringify({ findingIds: report.findings.map(f => f.id), internalOnly: report.internalOnly }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
