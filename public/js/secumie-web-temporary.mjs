import { contactCanSubmit, contactPayload } from './contact-form.mjs';

function oneLine(value) {
  return String(value ?? '').replace(/[\r\n\u2028\u2029]+/gu, ' ').trim();
}

export function validTargetUrl(value) {
  try {
    const url = new URL(oneLine(value));
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function temporaryIntakeMessage({ unionName, registeredAddress, targetUrl }) {
  if (!oneLine(unionName) || !oneLine(registeredAddress) || !validTargetUrl(targetUrl)) {
    throw new Error('invalid_intake');
  }
  return [
    '【SECU:MIE Web／国連協総会 無料Webセキュリティ診断・暫定受付】',
    `所属組合：${oneLine(unionName)}`,
    `本店所在地：${oneLine(registeredAddress)}`,
    `診断対象URL：${oneLine(targetUrl)}`,
    '対応方法：atLIBによる後日確認・診断結果のご案内',
    '情報提供：協会・組合への自動提供なし（別途同意までatLIB受付のみ）',
  ].join('\n');
}

if (typeof document !== 'undefined') {
  const form = document.getElementById('secumie-temporary-form');
  const button = form?.querySelector('button[type="submit"]');
  const status = document.getElementById('intake-status');
  const success = document.getElementById('intake-success');
  const widget = form?.querySelector('.cf-turnstile');
  const endpoint = form?.dataset.contactApiUrl ?? '';
  const active = form && button && status && success && widget &&
    form.dataset.intakeEnabled === 'true' &&
    contactCanSubmit({ enabled: 'true', endpoint, sitekey: widget.dataset.sitekey });

  if (!active) {
    if (status) status.textContent = '現在お申し込みの準備中です。お急ぎの場合はatLIBお問い合わせ窓口をご利用ください。';
  } else {
    button.disabled = false;
    button.removeAttribute('aria-disabled');
    status.textContent = '入力内容と同意事項を確認のうえ、お申し込みください。';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (button.disabled || !form.reportValidity()) return;

      const fields = form.elements;
      const targetUrl = fields.namedItem('targetUrl').value;
      if (!validTargetUrl(targetUrl)) {
        status.textContent = 'WebサイトURLは https:// から始まるアドレスをご入力ください。';
        return;
      }
      const turnstile = window.turnstile;
      const token = turnstile?.getResponse?.();
      if (!token) {
        status.textContent = '迷惑送信対策の確認が完了していません。確認後にお試しください。';
        return;
      }

      button.disabled = true;
      status.textContent = 'お申し込みを送信しています…';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const message = temporaryIntakeMessage({
          unionName: fields.namedItem('unionName').value,
          registeredAddress: fields.namedItem('registeredAddress').value,
          targetUrl,
        });
        const body = contactPayload({
          inquiryType: 'other',
          company: fields.namedItem('company').value,
          name: fields.namedItem('name').value,
          email: fields.namedItem('email').value,
          phone: fields.namedItem('phone').value,
          message,
          privacyConsent: fields.namedItem('privacyConsent').checked,
          website: fields.namedItem('website').value,
        }, token);
        const response = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body), signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || result?.ok !== true) throw new Error('send_failed');
        form.hidden = true;
        success.hidden = false;
        turnstile.reset?.();
      } catch {
        status.textContent = '送信完了を確認できませんでした。お手数ですが、atLIBお問い合わせ窓口へご連絡ください。';
        button.disabled = false;
        turnstile?.reset?.();
      } finally {
        clearTimeout(timer);
      }
    });
  }
}
