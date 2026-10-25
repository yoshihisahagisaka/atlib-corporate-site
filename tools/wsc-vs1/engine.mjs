import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The v7 introduction is approved source copy. It is intentionally emitted verbatim.
export const APPROVED_INTRO = `<p>会社のWebサイトのURLは、誰でも見ることができる情報です。</p><p>実は、このURLを手がかりに、インターネット上に公開されているさまざまな設定情報を調べることができます。</p><p>例えば、次のようなことです。</p><h3>Webサイトの通信が暗号化されているか</h3><p>お客様がWebサイトを閲覧する際の通信を守る仕組みについて、外部から確認できます。</p><h3>Webサイトにどのような保護設定があるか</h3><p>不正なプログラムの動作や、他サイトによる画面の悪用を抑えるための公開設定を確認できます。</p><h3>会社を装った偽メールへの対策</h3><p>対象ドメインに公開されているメール認証の設定から、なりすまし対策の方針を確認できます。</p><h3>特別な社内情報を調べているわけではありません</h3><p>今回の診断では、社内のパソコンや業務システムにログインしたり、機密情報を取得したりすることはありません。</p><p>インターネット上に公開されている情報を確認し、その意味を分かりやすく整理しています。</p><h3>大切なのは、結果を知ることから</h3><p>近年、企業や団体への不正アクセスや情報漏えいが相次いで報じられています。こうした被害は、事業の継続や取引先との信頼にも関わる問題です。</p><p>対策の第一歩は、まず自社の現状を知ることです。今回の診断で分かった公開設定を手がかりに、すでに行われている対策と、これから確認しておきたいことを整理してみましょう。</p><p class="intro-news-source">参考：IPA「不正アクセスによる漏えい等の事案を踏まえ、速やかに実施すべき対策等について」（2026年10月9日） <a href="https://www.ipa.go.jp/security/security-alert/2026/alert20261009.html">公的な注意喚起を見る</a></p><h3>このレポートが、自社のセキュリティについて考えるきっかけになれば幸いです。</h3>`;

const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' ? value : null;
const html = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const evidence = (label, value, display = value) => ({ label, raw: value, display: display === null ? '（値なし）' : display });
const japaneseDate = (value) => {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return value;
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long', timeZone: 'Asia/Tokyo' }).format(new Date(value));
};
const tlsProtocol = (value) => value === 'Tls13' ? 'TLS 1.3' : value;
export function normalizeDiagnosisUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('企業URLまたは診断対象URLが有効な絶対URLではありません。'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('企業URLまたは診断対象URLは認証情報なしのHTTP(S) URLである必要があります。');
  const port = (url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80') ? '' : url.port;
  const pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '');
  return `${url.protocol}//${url.hostname.toLowerCase()}${port ? `:${port}` : ''}${pathname}${url.search}`;
}
export function assertUrlMatch(companyUrl, targetUrl) {
  const company = normalizeDiagnosisUrl(companyUrl);
  const target = normalizeDiagnosisUrl(targetUrl);
  if (company !== target) throw new Error(`企業URLと診断対象URLが一致しないため生成を停止しました。企業URL: ${company} / 診断対象URL: ${target}。リダイレクトや別ドメインは推測で同一視しません。`);
  return company;
}
const FV_COPY = Object.freeze({
  TLS_VALID: '通信の暗号化ができています', HSTS_ENABLED: '暗号化通信を継続する設定があります', NOSNIFF_ENABLED: 'ファイルの誤った取り扱いを抑える設定があります', CSP_HEADER_ABSENT: 'プログラムの読み込み制限について確認をおすすめします', FRAME_HEADER_ABSENT: '他サイトへの画面表示の制限について確認をおすすめします', SPF_PRESENT: 'メールの送信元を示す設定があります', DMARC_NONE: '偽メールの隔離・拒否を求める設定にはなっていません'
});
const SOURCES = Object.freeze({
  TLS_VALID: [['RFC 8446', 'https://www.rfc-editor.org/rfc/rfc8446']], TLS_EXPIRING: [['RFC 8446', 'https://www.rfc-editor.org/rfc/rfc8446']], TLS_INVALID: [['RFC 8446', 'https://www.rfc-editor.org/rfc/rfc8446']],
  HSTS_ENABLED: [['RFC 6797', 'https://www.rfc-editor.org/rfc/rfc6797']], HSTS_DISABLED: [['RFC 6797', 'https://www.rfc-editor.org/rfc/rfc6797']],
  CSP_HEADER_ABSENT: [['MDN CSP', 'https://developer.mozilla.org/ja/docs/Web/HTTP/Reference/Headers/Content-Security-Policy']], CSP_HEADER_PRESENT: [['MDN CSP', 'https://developer.mozilla.org/ja/docs/Web/HTTP/Reference/Headers/Content-Security-Policy']],
  FRAME_HEADER_ABSENT: [['MDN X-Frame-Options', 'https://developer.mozilla.org/ja/docs/Web/HTTP/Reference/Headers/X-Frame-Options'], ['MDN CSP frame-ancestors', 'https://developer.mozilla.org/ja/docs/Web/HTTP/Reference/Headers/Content-Security-Policy']],
  NOSNIFF_ENABLED: [['MDN X-Content-Type-Options', 'https://developer.mozilla.org/ja/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options']], SPF_PRESENT: [['RFC 7208', 'https://www.rfc-editor.org/rfc/rfc7208']], SPF_MULTIPLE: [['RFC 7208', 'https://www.rfc-editor.org/rfc/rfc7208']],
  DMARC_NONE: [['DMARC specification', 'https://www.rfc-editor.org/rfc/rfc7489']], DMARC_ENFORCING: [['DMARC specification', 'https://www.rfc-editor.org/rfc/rfc7489']], DMARC_ABSENT: [['DMARC specification', 'https://www.rfc-editor.org/rfc/rfc7489']]
});

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
    add('TLS_VALID', '設定確認済み', [evidence('証明書検証', tls.status, '成功'), evidence('検証エラー', tls.policyErrors, 'なし'), evidence('通信方式', text(tls.negotiatedProtocol), tlsProtocol(text(tls.negotiatedProtocol))), evidence('証明書の期限', text(tls.notAfter), japaneseDate(text(tls.notAfter)))]);
    if (Number.isInteger(tls.daysRemaining) && tls.daysRemaining >= 0 && tls.daysRemaining <= 30) add('TLS_EXPIRING', '追加確認推奨', [evidence('残日数', tls.daysRemaining), evidence('証明書の期限', text(tls.notAfter), japaneseDate(text(tls.notAfter)))]);
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
    if (csp === null) add('CSP_HEADER_ABSENT', '追加確認推奨', [evidence('Content-Security-Policy', null, '今回のHTTP応答にCSPヘッダーなし')]);
    else if (csp.trim()) add('CSP_HEADER_PRESENT', '設定確認済み', [evidence('Content-Security-Policy', csp)]);
    else internalOnly.push('CSP: 空文字は未定義');
    if (text(headers['X-Frame-Options']) === null && csp === null) add('FRAME_HEADER_ABSENT', '追加確認推奨', [evidence('X-Frame-Options', null, '今回のHTTP応答にX-Frame-Optionsヘッダーなし'), evidence('Content-Security-Policy', null, '今回のHTTP応答にCSPヘッダーなし')]);
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
  assertUrlMatch(company.url, report.targetUrl);
  const sectionOf = (id) => /^(TLS|HSTS)/.test(id) ? 'https' : /^(CSP|FRAME|NOSNIFF)/.test(id) ? 'web' : 'email';
  const groups = { https: report.findings.filter(f => sectionOf(f.id) === 'https'), web: report.findings.filter(f => sectionOf(f.id) === 'web'), email: report.findings.filter(f => sectionOf(f.id) === 'email') };
  const evidenceList = (f) => f.details.map(d => `<li><b>${html(d.label)}：</b><span class="value">${html(d.display)}</span>${d.raw !== d.display ? `<small class="raw">原値：${html(d.raw === null ? 'null' : d.raw)}</small>` : ''}</li>`).join('');
  const summary = (items) => items.map(f => `<div class="ov-item"><div><b>${html(FV_COPY[f.id] || f.observation)}</b><small>${html(f.details[0]?.display || f.title)}</small></div><span class="ov-status ${f.status === '追加確認推奨' ? 'review' : ''}">${html(f.status)}</span></div>`).join('');
  const source = (f) => (SOURCES[f.id] || []).map(([name, url]) => `<a href="${url}">${html(name)}</a>`).join(' ／ ') || (f.reference ? html(f.reference) : '');
  const finding = (f) => `<article class="finding ${f.status === '追加確認推奨' ? 'review' : ''}" data-finding-id="${html(f.id)}"><span class="tag">${html(f.status)}</span><h3>${html(f.title)}</h3><h4>今回の診断結果</h4><p>${html(f.observation)}</p><div class="evidence"><h4>そう判断した根拠</h4><ul>${evidenceList(f)}</ul><p>${html(f.evidenceExplanation)}</p></div><h4>なぜ大切なのか</h4><p>${html(f.knowledge)}</p><div class="action"><h4>次に確認すること</h4><p>${html(f.nextAction)}</p></div>${source(f) ? `<p class="source">技術的な参考資料：${source(f)}</p>` : ''}</article>`;
  const illustration = (kind) => kind === 'https' ? `<svg aria-label="閲覧者からWebサイトへ、暗号化された通信を示す概念図" role="img" viewBox="0 0 660 130"><rect x="20" y="30" width="175" height="75" rx="13"/><text x="108" y="75">閲覧者</text><path d="M200 67H460"/><path d="m445 56 18 11-18 11"/><rect x="240" y="25" width="180" height="80" rx="15" class="dark"/><text x="330" y="73" class="light">暗号化された通信</text><rect x="465" y="30" width="175" height="75" rx="13"/><text x="552" y="75">Webサイト</text></svg>` : kind === 'web' ? `<svg aria-label="Webページから閲覧者へ、読み込み・表示の制御を示す概念図" role="img" viewBox="0 0 660 130"><rect x="20" y="30" width="175" height="75" rx="13"/><text x="108" y="75">Webページ</text><path d="M200 67H460"/><path d="m445 56 18 11-18 11"/><rect x="240" y="25" width="180" height="80" rx="15" class="dark"/><text x="330" y="73" class="light">読み込み・表示の制御</text><rect x="465" y="30" width="175" height="75" rx="13"/><text x="552" y="75">閲覧者</text></svg>` : `<svg aria-label="送信元から受信側へ、SPFとDMARCを示す概念図" role="img" viewBox="0 0 660 130"><rect x="20" y="30" width="175" height="75" rx="13"/><text x="108" y="75">送信元</text><path d="M200 67H460"/><path d="m445 56 18 11-18 11"/><rect x="240" y="25" width="180" height="80" rx="15" class="dark"/><text x="330" y="73" class="light">SPF / DMARC</text><rect x="465" y="30" width="175" height="75" rx="13"/><text x="552" y="75">受信側</text></svg>`;
  const detail = (id, title, lead, items) => !items.length ? '' : `<section class="detail report-section" id="${id}"><h2>${title}</h2><p class="lead">${lead}</p><div class="illustration">${illustration(id)}</div><style>.illustration text{fill:#1F3556;stroke:none;font-size:20px;text-anchor:middle}.illustration .dark{fill:#1F3556}.illustration .light{fill:#fff}</style>${items.map(finding).join('')}</section>`;
  const review = report.findings.filter(f => f.status === '追加確認推奨');
  const date = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long', timeZone: 'Asia/Tokyo' }).format(new Date(report.checkedAt));
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(company.name)}｜Webセキュリティ診断レポート</title><style>:root{--navy:#1F3556;--orange:#F28C38;--green:#2DBE9D;--off:#F8FAFC;--line:#DCE5F0}*{box-sizing:border-box}html{background:var(--off);scroll-behavior:smooth}body{margin:0;color:var(--navy);font-family:"Yu Gothic","Meiryo",sans-serif;line-height:1.75}.topnav{position:sticky;top:0;z-index:3;background:#fffffff5;border-bottom:1px solid var(--line)}.nav-inner{max-width:1100px;min-height:68px;margin:auto;padding:10px 22px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font-weight:800;font-size:18px}.nav-links{display:flex;gap:18px}.nav-links a{color:var(--navy);font-weight:700;text-decoration:none;font-size:13px}.print-button{border:0;border-radius:9px;background:var(--navy);color:#fff;padding:11px 16px;font:700 13px inherit;cursor:pointer}.review-banner{text-align:center;background:#F7CA91;font-size:11px;font-weight:bold;padding:7px}.report-section{width:min(100% - 32px,1050px);margin:26px auto;padding:65px 68px;background:var(--off);border-radius:16px;box-shadow:0 8px 36px #15324512}.cover{min-height:690px;color:#fff;overflow:hidden;background:radial-gradient(circle at 80% 40%,#287F78 0%,#1F3556 44%,#152743 85%)}.cover-kicker{margin-top:115px;color:#91E6D2;font-size:13px;letter-spacing:.12em}.cover h1{font-size:clamp(36px,5vw,56px);line-height:1.4;letter-spacing:-.06em}.cover-sub{font-size:13px;letter-spacing:.16em;color:#D6E4F2}.cover-bottom{margin-top:120px;padding-top:32px;border-top:1px solid #7E99B2}.company span,.cover-details{display:block;color:#C1D0E2}.company strong{font-size:25px}.cover-details{display:flex;justify-content:space-between;margin-top:25px}.intro h2,.detail h2{font-size:30px;line-height:1.4}.intro-copy{font-size:15px}.intro-copy h3{color:#207B71;font-size:17px;margin:23px 0 3px}.intro-news-source,.source{font-size:11px;color:#60728A}.overview h2{font-size:35px;line-height:1.3}.overview h2 em{font-style:normal;color:#218D7B}.overview-main{display:grid;grid-template-columns:1fr 1fr;gap:18px}.overview-card,.finding{border:1px solid var(--line);border-radius:13px;background:#fff;overflow:hidden}.ov-head{padding:20px;background:#EDF8F5}.ov-head h3{margin:0;font-size:20px}.ov-list{padding:14px 18px}.ov-item{display:flex;justify-content:space-between;gap:9px;padding:15px 0;border-bottom:1px solid #E8EDF4}.ov-item:last-child{border:0}.ov-item b,.ov-item small{display:block}.ov-item small{font-size:12px;color:#657995}.ov-status,.tag{display:inline-block;align-self:flex-start;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:750;background:#E6F7F2;color:#176F5C;white-space:nowrap}.ov-status.review,.finding.review .tag{background:#FFF2E6;color:#98501B}.attention,.action{background:#FFF2E6;border-radius:12px;padding:20px;margin-top:22px}.attention h3{margin:0}.attention li{margin:8px 0}.lead{color:#60728A}.illustration{background:#EAF6F3;border:1px solid #CBE9E0;border-radius:14px;padding:20px;margin:20px 0 28px}.illustration svg{width:100%;height:110px;fill:none;stroke:#2DBE9D;stroke-width:4}.finding{border-left:5px solid var(--green);padding:24px 28px;margin:22px 0;break-inside:avoid}.finding.review{border-left-color:var(--orange)}.finding h3{font-size:21px;margin:10px 0}.finding h4{font-size:14px;color:#187E73;margin:18px 0 5px}.evidence{background:var(--off);border-radius:8px;padding:14px 18px;margin:14px 0}.evidence ul{margin:0;padding-left:18px}.evidence p{margin:7px 0 0}.action h4{color:#9D541C;margin:0 0 5px}.action p{margin:0}.final-card,.final-note{background:#EAF6F3;border-radius:12px;padding:24px;margin:18px 0}.final-card{background:#FFF2E6}@media(max-width:800px){.nav-inner{flex-wrap:wrap}.nav-links{order:3;width:100%;justify-content:space-between}.report-section{width:calc(100% - 16px);padding:36px 22px;margin:12px auto}.cover{min-height:580px}.cover-kicker{margin-top:90px}.cover-bottom{margin-top:105px}.cover-details{flex-wrap:wrap;gap:12px}.overview-main{grid-template-columns:1fr}.finding{padding:18px}.ov-item{flex-direction:column}}@media print{@page{size:A4;margin:15mm 13mm}.topnav,.review-banner{display:none!important}html,body{background:#fff}.report-section{width:100%;margin:0;padding:10mm 0;box-shadow:none;border-radius:0}.cover{min-height:245mm;padding:16mm;break-after:page}.finding,.overview-card,.attention,.final-card,.final-note{break-inside:avoid}.cover-bottom{margin-top:75mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><nav class="topnav"><div class="nav-inner"><span class="brand">atLIB <small>WEB SECURITY REPORT</small></span><div class="nav-links"><a href="#overview">診断概要</a><a href="#https">Webサイト</a><a href="#email">メール</a><a href="#next-steps">確認事項</a></div><button class="print-button" aria-label="印刷またはPDFで保存" onclick="window.print()">▣ PDFで保存・印刷</button></div></nav><div class="review-banner">内部デザインレビュー用｜対外配布不可</div><section class="cover report-section"><div class="cover-kicker">公開情報から見える、会社のセキュリティ</div><h1>Webセキュリティ<br>診断レポート</h1><div class="cover-sub">PUBLIC WEBSITE &amp; EMAIL SECURITY REVIEW</div><div class="cover-bottom"><div class="company"><span>診断対象企業</span><strong>${html(company.name)}</strong><span>本店所在地：${html(company.headOffice)}</span></div><div class="cover-details"><span>${html(company.url)}</span><span>${html(date)}</span></div></div></section><section class="intro report-section"><h2>WebサイトのURLだけで、ここまで分かることをご存じですか？</h2><div class="intro-copy">${APPROVED_INTRO}</div></section><section class="overview report-section" id="overview"><h2>今回の診断で<br><em>分かったこと</em></h2><p>対象URL：${html(report.targetUrl)} ／ 診断日時：${html(report.checkedAt)}</p><div class="overview-main"><div class="overview-card"><div class="ov-head"><small>CHECK AREA</small><h3>Webサイト</h3></div><div class="ov-list">${summary([...groups.https,...groups.web]) || '<p>表示対象の結果はありません。</p>'}</div></div><div class="overview-card"><div class="ov-head"><small>CHECK AREA</small><h3>メール</h3></div><div class="ov-list">${summary(groups.email) || '<p>表示対象の結果はありません。</p>'}</div></div></div>${review.length ? `<div class="attention"><h3>今回、確認をおすすめすること</h3><ol>${review.map(f => `<li>${html(f.title)}</li>`).join('')}</ol></div>` : ''}</section>${detail('https','Webサイトの通信を守る仕組み','暗号化通信と証明書について、今回の確認結果をご案内します。',groups.https)}${detail('web','Webサイトの表示・動作を守る設定','公開されている設定から、管理担当者への確認をおすすめする内容です。',groups.web)}${detail('email','自社を装った偽メールへの対策','対象メールドメインの公開DNS設定に基づく説明です。',groups.email)}<section class="detail report-section" id="next-steps"><h2>次に確認しておくとよいこと</h2><p class="lead">管理担当者や保守会社へ、以下の内容を確認する際にお役立てください。</p>${review.map(f => `<div class="final-card"><h3>${html(f.title)}</h3><p>${html(f.nextAction)}</p></div>`).join('')}<div class="final-note"><b>診断の範囲について</b><p>本診断はインターネット上に公開されているWebサイトやメールの設定を確認したものであり、企業全体のセキュリティ対策や安全性を評価するものではありません。</p><p>「追加確認推奨」は管理担当者や保守会社への確認をおすすめするものであり、atLIBによる追加調査を約束するものではありません。</p><p>ルール版：${html(report.ruleVersion)} ／ 解説版：${html(report.contentVersion)}</p></div></section></body></html>`;
}

function main() {
  const [inputPath, companyPath, outputPath, resultPath] = process.argv.slice(2);
  if (!inputPath || !companyPath || !outputPath) throw new Error('使い方: node engine.mjs input.json company.json output.html');
  const root = path.dirname(fileURLToPath(import.meta.url));
  const report = evaluate(read(inputPath), { rulesPath: path.join(root, 'rules.json'), explanationsPath: path.join(root, 'explanations.json') });
  fs.writeFileSync(outputPath, render(report, read(companyPath)), 'utf8');
  if (resultPath) fs.writeFileSync(resultPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ findingIds: report.findings.map(f => f.id), internalOnly: report.internalOnly }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
