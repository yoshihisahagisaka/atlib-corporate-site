import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPROVED_INTRO, assertUrlMatch, evaluate, render } from './engine.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const json = (name) => JSON.parse(fs.readFileSync(path.join(root, 'fixtures', name), 'utf8').replace(/^\uFEFF/, ''));
const opts = { rulesPath: path.join(root, 'rules.json'), explanationsPath: path.join(root, 'explanations.json') };
const ids = (input) => evaluate(input, opts).findings.map(f => f.id);
const expected = JSON.parse(fs.readFileSync(path.join(root, 'expected-atlib.json'), 'utf8'));
assert.deepEqual(ids(json('atlib-security-check-v2.json')), expected.expectedFindingIds, 'atLIB regression');
assert.deepEqual(ids(json('synthetic-protected.json')), ['TLS_VALID','HSTS_ENABLED','CSP_HEADER_PRESENT','NOSNIFF_ENABLED','SPF_PRESENT','DMARC_ENFORCING'], 'protected synthetic');
assert.deepEqual(ids(json('synthetic-gaps.json')), ['TLS_INVALID','HSTS_DISABLED','CSP_HEADER_ABSENT','FRAME_HEADER_ABSENT','DMARC_ABSENT'], 'gap synthetic');
const unavailable = evaluate(json('synthetic-unavailable.json'), opts);
assert.equal(unavailable.findings.length, 0, 'failure never becomes a user finding');
assert.ok(unavailable.internalOnly.length >= 4, 'failure retained internally');
const company = {name:'<企業 & 会社>', headOffice:'A & B', url:'https://example-gaps.test/?x=<tag>'};
const first = render(evaluate(json('synthetic-gaps.json'), opts), company);
const second = render(evaluate(json('synthetic-gaps.json'), opts), company);
assert.equal(first, second, 'same input produces byte-identical HTML');
assert.ok(first.includes('&lt;企業 &amp; 会社&gt;') && !first.includes('<企業 & 会社>'), 'HTML escaping');
assert.ok(first.includes('<strong>&lt;企業 &amp; 会社&gt; 御中</strong>'), 'cover adds recipient suffix without changing source name');
assert.ok(first.includes('調査対象URL：https://example-gaps.test/?x=&lt;tag&gt;'), 'cover labels company URL');
assert.equal(company.name, '<企業 & 会社>', 'source company name remains unchanged');
const alreadyRecipient = render(evaluate(json('synthetic-gaps.json'), opts), { name:'既に御中 御中', url:'https://example-gaps.test/?x=<tag>' });
assert.ok(alreadyRecipient.includes('<strong>既に御中 御中</strong>') && !alreadyRecipient.includes('<strong>既に御中 御中 御中</strong>'), 'cover does not duplicate recipient suffix');
assert.ok(first.includes('WebサイトのURLだけで、ここまで分かることをご存じですか？'), 'v7 introduction title');
assert.equal(APPROVED_INTRO, fs.readFileSync(path.join(root, 'approved-introduction-v7.html'), 'utf8').replace(/\r\n/g, '\n').trimEnd(), 'v7 approved introduction is exact');
assert.match(first, /@media print/, 'print stylesheet is included');
assert.match(first, /window\.print\(\)/, 'browser print control is included');
assert.match(first, /\.report-section:not\(\.cover\)\{break-before:page/, 'print section starts');
assert.match(first, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)!important/, 'print overview two columns');
assert.match(first, /\.finding\{break-inside:avoid/, 'print card protection');
assert.match(first, /PUBLIC WEBSITE &amp; EMAIL SECURITY REVIEW/, 'v7 cover is included');
for (const approved of ['通信の暗号化ができています','暗号化通信を継続する設定があります','ファイルの誤った取り扱いを抑える設定があります','プログラムの読み込み制限について確認をおすすめします','他サイトへの画面表示の制限について確認をおすすめします','メールの送信元を示す設定があります','偽メールの隔離・拒否を求める設定にはなっていません']) assert.ok(render(evaluate(json('atlib-security-check-v2.json'), opts), json('atlib-company.json')).includes(approved), `approved atLIB FV: ${approved}`);
const protectedCompany = {name:'別企業', headOffice:'大阪府大阪市', url:'https://example-protected.test/'};
const protectedHtml = render(evaluate(json('synthetic-protected.json'), opts), protectedCompany);
const noAddressHtml = render(evaluate(json('synthetic-protected.json'), opts), { name:'所在地なし検証', url:'https://example-protected.test/' });
assert.ok(!noAddressHtml.includes('本店所在地'), 'head office is not rendered and is not required');
assert.ok(protectedHtml.includes('認証に失敗したメールへの対応方針が公開されています。'), 'unapproved FV IDs retain fixed observation');
assert.ok(!protectedHtml.includes('偽メールの隔離・拒否を求める設定にはなっていません'), 'absent finding is not rendered');
assert.ok(!protectedHtml.includes('<svg'), 'detail SVG illustrations removed');
assert.match(protectedHtml, /data:image\/png;base64,/, 'FV icons embedded');
assert.match(protectedHtml, /data:image\/jpeg;base64,/, 'cover image embedded');
const atlibReport = evaluate(json('atlib-security-check-v2.json'), opts);
const atlibHtml = render(atlibReport, json('atlib-company.json'));
for (const approvedCopy of [
  'Webサイトのアドレスが「https://」で始まっているのを見たことがあると思います。これは、Webサイトと利用者の間でやり取りする情報を暗号化し、第三者に盗み見られたり、途中で書き換えられたりすることを防ぐための仕組みです。', 'また、Webサイトの証明書は、接続先が正しい相手であることを確認するために使われます。ブラウザで「この接続ではプライバシーが保護されません」といった警告が表示される場合、証明書に問題があることなどが考えられます。', '暗号化されていない通信に第三者が介入すると、送信した情報を盗み見られたり、表示内容を書き換えられたりするおそれがあります。', '例えば、お問い合わせフォームに入力した氏名やメールアドレスなどが漏えいすれば、お客様への被害だけでなく、企業の信用問題にもつながりかねません。',
  'Webサイトのアドレスに「http://」と入力しても、自動的に「https://」へ切り替わることがあります。', 'HSTSは、ブラウザに対して、次回以降も暗号化されたHTTPS通信を使うよう指示する仕組みです。暗号化されていない通信へ戻ってしまう危険を減らします。', '利用者が暗号化されていない通信を使った隙に、第三者が通信へ介入し、偽のWebページへ誘導したり、通信内容を盗み見たりするおそれがあります。', '例えば、外出先のネットワークなどを利用している際に、通信を悪用される可能性があります。',
  'Webサイトには、メニューを開いたり、入力内容を確認したりするためのプログラムが使われています。', 'CSPは、こうしたプログラムをどこから読み込んでよいかなどを制限する仕組みです。万が一、不正なプログラムが入り込んだ場合でも、勝手な動作や情報の持ち出しを抑えるために役立ちます。', '正規のショッピングサイトに不正なプログラムが仕込まれると、本物の決済画面に見せかけた入力欄から、クレジットカード番号などを盗まれるおそれがあります。', '利用者は正規のサイトを使っているつもりなので、不正に気づきにくいことがあります。こうした被害が発生すれば、お客様の金銭被害だけでなく、企業の信用低下や取引停止にもつながりかねません。',
  'Webサイトの一部が、別のWebサイトの中に表示されているのを見たことがあるかもしれません。', '画面埋め込み制御は、自社のWebページが他のサイト内に勝手に組み込まれることを制限する仕組みです。悪意のあるサイトに自社の画面を利用され、利用者が気づかないうちに意図しない操作をさせられる攻撃を防ぐために役立ちます。', '例えば、悪意のあるサイトが正規のWebサイトの画面を重ねて表示し、利用者に別のボタンを押していると思わせながら、実際には正規サイト上の操作をさせることがあります。', 'こうした手口によって、利用者が意図しない設定変更や情報の送信などを行ってしまうおそれがあります。',
  'Webサイトでは、画像や文章、プログラムなど、さまざまな種類のファイルが使われています。', 'NOSNIFFは、ブラウザがファイルの種類を勝手に判断して、想定外の方法で扱うことを防ぐための仕組みです。', '例えば、本来はデータとして扱うべきファイルが、プログラムとして動いてしまうような危険を減らします。', 'Webサイトに置かれた画像や文章などのファイルが、ブラウザに誤ってプログラムとして扱われることがあります。', 'これを悪用されると、利用者が普通にWebサイトを見ているだけで、不正なプログラムが動き、情報を盗まれるおそれがあります。', 'こうした被害は、利用者の安全だけでなく、Webサイトを運営する企業への信頼にも影響する可能性があります。',
  '普段、会社のメールアドレスから取引先へメールを送ると思います。しかし、メールの差出人は偽装されることがあります。', 'SPFは、その会社のドメインからメールを送信してよいサーバーをあらかじめ登録しておく仕組みです。受信側が送信元を確認する際の手がかりになり、なりすましメールを見分けるために役立ちます。', '自社を装った偽メールが取引先に届き、偽の請求書や振込先変更の案内による詐欺被害につながるおそれがあります。', '例えば、普段から取引している会社の名前で振込先変更のメールが届けば、担当者が本物と信じて送金してしまう可能性があります。', '取引先が被害を受ければ、自社の信用にも影響しかねません。',
  '迷惑メールフォルダに、不審なメールが自動的に振り分けられた経験があると思います。', 'DMARCは、自社を装ったメールが認証に失敗した場合、受信側に対して隔離や拒否などの対応方針を伝える仕組みです。自社の名前を悪用した偽メールが取引先などに届く危険を減らすために役立ちます。', '自社を装った偽メールによって取引先に金銭被害や情報漏えいが発生し、自社の信用低下や取引停止につながりかねません。', '特に、取引先が自社からの正式な連絡だと思い込み、偽の請求書への支払いや機密情報の送信を行ってしまうことが考えられます。', '被害が広がれば、取引先との信頼関係の修復に長い時間を要する可能性もあります。'
]) assert.ok(atlibHtml.includes(approvedCopy), `approved customer copy: ${approvedCopy}`);
assert.match(atlibHtml, /どのような対策なのか/, 'protection explanation heading');
assert.match(atlibHtml, /対策が不十分だと、どうなるのか/, 'customer impact heading');
assert.match(atlibHtml, /warning-icon/, 'review findings use the warning triangle');
assert.ok(!atlibHtml.includes('原値：') && !atlibHtml.includes('RFC 8446') && !atlibHtml.includes('MDN CSP'), 'customer HTML excludes raw values and technical references');
assert.ok(!atlibHtml.includes('data-finding-id') && !atlibHtml.includes('ルール版：'), 'customer HTML excludes internal identifiers and versions');
assert.ok(atlibReport.findings.find((finding) => finding.id === 'TLS_VALID').details.some((detail) => detail.raw === 'Tls13'), 'raw protocol remains in the internal report');
assert.match(atlibHtml, /診断結果を、これからの対策につなげるために/, 'approved customer closing');
assert.equal(assertUrlMatch('https://EXAMPLE.test:443/', 'https://example.test/'), 'https://example.test/', 'presentation-only URL difference');
assert.throws(() => assertUrlMatch('https://example.test/', 'https://www.example.test/'), /一致しない/, 'different host rejected');
assert.throws(() => assertUrlMatch('http://example.test/', 'https://example.test/'), /一致しない/, 'redirect is not assumed');
console.log('WSC VS1 tests: PASS');
