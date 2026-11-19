const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSecumieSlackNotifier } = require('../dist/services/secumieSlack');

const sampleUrl = 'https://hooks.slack.com/services/TTEST/BTEST/SECRET_TEST';

test('Slack notifier posts only company and target URL in plain-text block', async () => {
  const calls = [];
  const notify = createSecumieSlackNotifier(sampleUrl, async (url, options) => {
    calls.push({ url, options });
    return new Response('ok', { status: 200 });
  });
  await notify({ company: '株式会社例示', targetUrl: 'https://example.jp/' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, sampleUrl);
  assert.equal(calls[0].options.method, 'POST');
  const payload = JSON.parse(calls[0].options.body);
  assert.deepEqual(payload.blocks, [{
    type: 'section',
    text: {
      type: 'plain_text',
      text: 'SECU:MIE Web 暫定受付\n企業名：株式会社例示\n診断対象URL：https://example.jp/',
      emoji: false,
    },
  }]);
  assert.doesNotMatch(JSON.stringify(payload), /email|phone|union|private/u);
});

test('Slack webhook URL must be HTTPS and on the verified incoming webhook host', () => {
  assert.equal(createSecumieSlackNotifier(''), undefined);
  for (const url of [
    'http://hooks.slack.com/services/T/B/C',
    'https://hooks.slack.com.evil.example/services/T/B/C',
    'https://hooks.slack.com/services/T/B/C?leak=1',
    'https://evil.example/services/T/B/C',
  ]) assert.throws(() => createSecumieSlackNotifier(url), /Invalid SECUMIE_WEB_SLACK/);
});

test('Slack failure reports error to caller without leaking body or webhook URL', async () => {
  const notify = createSecumieSlackNotifier(sampleUrl, async () => new Response('secret details', { status: 403 }));
  await assert.rejects(() => notify({ company: '例', targetUrl: 'https://example.jp/' }), (error) => {
    assert.match(error.message, /rejected notification/u);
    assert.doesNotMatch(error.message, /SECRET_TEST|secret details/u);
    return true;
  });
});
