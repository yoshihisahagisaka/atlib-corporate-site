const assert = require('node:assert/strict');
const test = require('node:test');
const nodemailer = require('nodemailer');
const { Mailer } = require('../dist/services/mailer.js');

const contact = {
  inquiry_type: 'サービスについてのご相談',
  company: 'テスト株式会社',
  name: 'テスト太郎',
  email: 'tester@example.com',
  phone: '',
  message: '送信者表示名の検証',
};

const entry = {
  job_type: 'エンジニア',
  name: 'テスト太郎',
  kana: 'テストタロウ',
  birthday: '2000-01-01',
  gender_type: '回答しない',
  address: 'テスト',
  email: 'tester@example.com',
  phone: '0000000000',
  history: 'テスト',
  message: '',
};

test('各サイトメールの表示名はatLIB株式会社で、送信元アドレスは維持される', async () => {
  const mailer = new Mailer({
    host: 'smtp-relay.gmail.com',
    port: 587,
    user: 'sender@example.com',
    password: 'not-used',
    from: 'system@atlib.jp',
  });

  const messages = [];
  // 実ネットワークには接続しない。Mailerが作成した送信オプションだけを確認する。
  mailer.transporter = {
    async sendMail(options) {
      messages.push(options);
      return { messageId: 'offline' };
    },
  };

  await mailer.sendContactNotification('contact@atlib.jp', contact);
  await mailer.sendContactAutoReply('tester@example.com', contact);
  await mailer.sendEntryNotification('contact@atlib.jp', entry);
  await mailer.sendEntryAutoReply('tester@example.com', entry);

  assert.equal(messages.length, 4);
  for (const message of messages) {
    assert.deepEqual(message.from, {
      name: 'atLIB株式会社',
      address: 'system@atlib.jp',
    });
  }
  assert.equal(messages[0].replyTo, 'tester@example.com');

  // Nodemailer内蔵のオフライン転送で実際のMIMEとSMTPエンベロープを確認する。
  const offlineTransport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const info = await offlineTransport.sendMail(messages[0]);
  assert.equal(info.envelope.from, 'system@atlib.jp');
  assert.deepEqual(info.envelope.to, ['contact@atlib.jp']);
  const rawMessage = info.message.toString('utf8');
  // MIMEヘッダーのRFC準拠折り返しは検証前に展開する。
  const unfoldedHeaders = rawMessage.split('\r\n\r\n')[0].replace(/\r\n[ \t]+/g, ' ');
  assert.match(unfoldedHeaders, /^From: .*<system@atlib\.jp>/m);
  assert.match(unfoldedHeaders, /^From: =\?UTF-8\?/m);
  assert.match(rawMessage, /^Reply-To: tester@example\.com/m);
});
