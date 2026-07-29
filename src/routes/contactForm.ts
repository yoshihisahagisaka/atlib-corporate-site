import { Router } from 'express';
import type { Mailer, ContactFormData } from '../services/mailer';
import type { Config } from '../config';
import { signFormFields, verifyFormFields } from '../lib/formToken';
import { escapeHtml, nl2br } from '../lib/html';

const FIELD_KEYS: (keyof ContactFormData)[] = ['inquiry_type', 'company', 'name', 'email', 'phone', 'message'];

function sanitize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const TRACKING_TAGS = `<!-- Google tag (gtag.js) -->
	<script async src="https://www.googletagmanager.com/gtag/js?id=G-BNM2L9LTL2"></script>
	<script>
	  window.dataLayer = window.dataLayer || [];
	  function gtag(){dataLayer.push(arguments);}
	  gtag('js', new Date());
	  gtag('config', 'G-BNM2L9LTL2');
	</script>
	<!-- //Google tag (gtag.js) -->
	<!-- Microsoft Clarity -->
	<script type="text/javascript">
		(function(c,l,a,r,i,t,y){
			c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
			t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
			y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
		})(window, document, "clarity", "script", "xtjmp7ly4g");
	</script>
	<!-- //Microsoft Clarity -->`;

function confirmPage(data: ContactFormData, timestampMs: number, signature: string): string {
  const phoneRow = data.phone
    ? `
					<div class="confirm-group">
						<div class="confirm-label">電話番号</div>
						<div class="confirm-value">${escapeHtml(data.phone)}</div>
					</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
	<title>入力内容の確認 ｜ atLIB株式会社</title>
	<meta charset="utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="format-detection" content="telephone=no">
	<link rel="icon" href="images/favicon.ico">
	<meta name="twitter:card" content="summary_large_image" />
	${TRACKING_TAGS}
	<link rel="stylesheet" href="css/style.css">
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap" rel="stylesheet">
</head>
<body>
<header>
	<div class="h-logo"><h1><a href="index.html"><img src="images/h_logo.png" alt="atLIB株式会社"></a></h1></div>
</header>

<main>
    <section class="confirm_box" id="sec-contact">
		<div class="inner_box-M">
			<h3>入力内容をご確認ください</h3>

			<div class="conf_area">
				<div class="confirm-group">
					<div class="confirm-label">お問合せの種類</div>
					<div class="confirm-value">${escapeHtml(data.inquiry_type)}</div>
				</div>

				<div class="confirm-group">
					<div class="confirm-label">会社名</div>
					<div class="confirm-value">${escapeHtml(data.company)}</div>
				</div>

				<div class="confirm-group">
					<div class="confirm-label">お名前</div>
					<div class="confirm-value">${escapeHtml(data.name)}</div>
				</div>

				<div class="confirm-group">
					<div class="confirm-label">メールアドレス</div>
					<div class="confirm-value">${escapeHtml(data.email)}</div>
				</div>
${phoneRow}
				<div class="confirm-group">
					<div class="confirm-label">お問合せ内容</div>
					<div class="confirm-value">${nl2br(escapeHtml(data.message))}</div>
				</div>

				<div class="button-wrapper">
					<button type="button" class="btn-back" onclick="history.back()">戻る</button>
					<form action="send.php" method="POST" style="margin: 0;">
						${FIELD_KEYS.map((key) => `<input type="hidden" name="${key}" value="${escapeHtml(data[key])}">`).join('\n\t\t\t\t\t\t')}
						<input type="hidden" name="form_ts" value="${timestampMs}">
						<input type="hidden" name="form_sig" value="${signature}">
						<button type="submit" class="btn-submit">送信する</button>
					</form>
				</div>
			</div>
    	</div>
	</section>
</main>
<footer>
	<p class="txt-S"><strong>atLIB株式会社</strong></p>
	<p class="f-copy">&copy;<script type="text/javascript">document.write(new Date().getFullYear());</script> atLIB株式会社 all rights reserved.</p>
</footer>
</body>
</html>`;
}

function errorPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
	<title>送信エラー ｜ atLIB株式会社</title>
	<meta charset="utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="format-detection" content="telephone=no">
	<link rel="icon" href="images/favicon.ico">
	<meta name="twitter:card" content="summary_large_image" />
	${TRACKING_TAGS}
	<link rel="stylesheet" href="css/style.css">
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap" rel="stylesheet">
</head>
<body>
	<header>
		<div class="h-logo"><h1><a href="index.html"><img src="images/h_logo.png" alt="atLIB株式会社"></a></h1></div>
	</header>

	<main>
		<section class="thanks_box">
			<div class="inner_box-M">
				<h3>送信エラーが発生しました</h3>
				<div class="txt_box">
					<p>申し訳ございません。<br>
						メール送信中にエラーが発生しました。<br>
					お手数ですが、時間をおいて再度お試しいただくか、お電話にてお問い合わせください。</p>
				</div>
				<a href="index.html" class="btn-home">トップページへ戻る</a>
			</div>
		</section>
	</main>
</body>
</html>`;
}

export function createContactFormRouter(mailer: Mailer, config: Config): Router {
  const router = Router();

  router.post('/confirm.php', (req, res) => {
    const data: ContactFormData = {
      inquiry_type: sanitize(req.body?.inquiry_type),
      company: sanitize(req.body?.company),
      name: sanitize(req.body?.name),
      email: sanitize(req.body?.email),
      phone: sanitize(req.body?.phone),
      message: sanitize(req.body?.message),
    };

    if (!data.company || !data.name || !data.email || !data.message) {
      res.redirect('index.html');
      return;
    }
    if (!isValidEmail(data.email)) {
      res.redirect('index.html');
      return;
    }

    const timestampMs = Date.now();
    const signature = signFormFields(config.formHmacSecret, timestampMs, data as unknown as Record<string, string>);

    res.type('html').send(confirmPage(data, timestampMs, signature));
  });

  router.post('/send.php', async (req, res) => {
    const data: ContactFormData = {
      inquiry_type: sanitize(req.body?.inquiry_type),
      company: sanitize(req.body?.company),
      name: sanitize(req.body?.name),
      email: sanitize(req.body?.email),
      phone: sanitize(req.body?.phone),
      message: sanitize(req.body?.message),
    };
    const timestampMs = Number(req.body?.form_ts);
    const signature = sanitize(req.body?.form_sig);

    if (!verifyFormFields(config.formHmacSecret, timestampMs, data as unknown as Record<string, string>, signature)) {
      res.status(400).send('不正なアクセスです');
      return;
    }

    try {
      await mailer.sendContactNotification(config.contactNotifyEmail, data);
      await mailer.sendContactAutoReply(data.email, data);
      res.redirect('thanks.html');
    } catch (err) {
      console.error('contact form mail send failed', err);
      res.type('html').send(errorPage());
    }
  });

  return router;
}
