/** Browser adapter for the existing SMTP-backed /api/contact endpoint.
 * Deliberately inert until an HTTPS endpoint, production Turnstile sitekey and
 * the explicit `data-contact-api-enabled="true"` release switch are set.
 */

export function contactApiUrl(value) {
  if (value === '/api/contact') return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.pathname !== '/api/contact' || url.username ||
        url.password || url.search || url.hash) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function contactCanSubmit({ enabled, endpoint, sitekey }) {
  return enabled === 'true' && Boolean(contactApiUrl(endpoint)) && Boolean(sitekey) &&
    !['1x00000000000000000000AA', '2x00000000000000000000AB', '3x00000000000000000000FF'].includes(sitekey);
}

export function contactPayload(fields, turnstileToken) {
  return {
    inquiryType: fields.inquiryType,
    company: fields.company.trim(),
    name: fields.name.trim(),
    email: fields.email.trim(),
    phone: fields.phone.trim(),
    message: fields.message.trim(),
    privacyConsent: fields.privacyConsent === true,
    website: fields.website,
    turnstileToken,
  };
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('.contact-form');
  const button = form?.querySelector('button[type="submit"]');
  const status = document.getElementById('contact-send-status');
  const widget = form?.querySelector('.cf-turnstile');
  const endpoint = form?.dataset.contactApiUrl ?? '';
  const active = form && button && status && widget && contactCanSubmit({
    enabled: form.dataset.contactApiEnabled,
    endpoint,
    sitekey: widget.dataset.sitekey,
  });

  if (active) {
    button.disabled = false;
    button.removeAttribute('aria-disabled');
    status.textContent = '入力内容を確認のうえ、送信してください。';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (button.disabled || !form.reportValidity()) return;

      const turnstile = window.turnstile;
      const token = turnstile?.getResponse?.();
      if (!token) {
        status.textContent = '迷惑送信対策の確認が完了していません。確認後にもう一度お試しください。';
        return;
      }

      button.disabled = true;
      status.textContent = '送信しています…';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const body = contactPayload({
          inquiryType: form.elements.namedItem('inquiry_type').value,
          company: form.elements.namedItem('company').value,
          name: form.elements.namedItem('name').value,
          email: form.elements.namedItem('email').value,
          phone: form.elements.namedItem('phone').value,
          message: form.elements.namedItem('message').value,
          privacyConsent: form.elements.namedItem('privacy_consent').checked,
          website: form.elements.namedItem('website').value,
        }, token);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || result?.ok !== true) throw new Error('send_failed');
        form.reset();
        turnstile.reset?.();
        status.textContent = 'お問い合わせを受け付けました。担当者よりご連絡いたします。';
      } catch {
        status.textContent = '送信できませんでした。時間をおいて、もう一度お試しください。';
        button.disabled = false;
        turnstile?.reset?.();
      } finally {
        clearTimeout(timer);
      }
    });
  }
}
