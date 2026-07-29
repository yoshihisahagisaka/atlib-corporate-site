import { Router } from 'express';
import type { Mailer, EntryFormData } from '../services/mailer';
import type { Config } from '../config';
import { signFormFields, verifyFormFields } from '../lib/formToken';
import { escapeHtml, nl2br } from '../lib/html';

const FIELD_KEYS: (keyof EntryFormData)[] = [
  'job_type',
  'name',
  'kana',
  'birthday',
  'gender_type',
  'address',
  'email',
  'phone',
  'history',
  'message',
];

function sanitize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const HEAD = `	<!-- Google tag (gtag.js) -->
	<script async src="https://www.googletagmanager.com/gtag/js?id=G-1CBDCR2PD0"></script>
	<script>
	  window.dataLayer = window.dataLayer || [];
	  function gtag(){dataLayer.push(arguments);}
	  gtag('js', new Date());
	  gtag('config', 'G-1CBDCR2PD0');
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
	<!-- //Microsoft Clarity -->
	<meta charset="utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="format-detection" content="telephone=no">
	<meta name="keywords" content="" />
	<meta name="description" content="" />
	<link rel="icon" href="../images/favicon.png">
	<link rel="stylesheet" href="../css/common.css">
	<link rel="stylesheet" href="../css/top.css">
	<link rel="stylesheet" href="../css/contents.css">
	<link rel="stylesheet" href="../css/menu.css">
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Sawarabi+Gothic&display=swap" rel="stylesheet">`;

const FOOTER = `<footer>
	<div class="ft_cont">
		<div class="f-logo"><img src="../images/common/logo_ft.png" alt="atLIB"></div>
		<p class="f-copy">&copy;<script type="text/javascript">document.write(new Date().getFullYear());</script> atLIB株式会社 all rights reserved.</p>
	</div>
</footer>`;

function confirmPage(data: EntryFormData, timestampMs: number, signature: string): string {
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
<title>入力内容確認 ｜ atLIB株式会社 採用サイト</title>
${HEAD}
</head>
<body>
<header>
	<h1><a href="../"><img src="../images/common/h-logo.png" alt="atLIB採用サイト"></a></h1>
</header>

<main>
	<div class="page_header">
		<div class="inner_box-M">
			<div class="page_ttl">
				<p>CONFIRM</p>
				<h1>入力内容確認</h1>
			</div>
		</div>
		<div class="colorbox-01"><img src="../images/common/colorbox_h_lt.png" alt=""></div>
		<div class="colorbox-02"><img src="../images/common/colorbox_h_rt.png" alt=""></div>
	</div>
	<div id="entry" class="confirm_box">
		<section class="entry_form">
			<div class="inner_box-M">
				<div class="txt_box">
					<p>入力内容をご確認ください。</p>
				</div>
				<div class="conf_area">
					<div class="confirm-group">
						<div class="confirm-label">応募職種</div>
						<div class="confirm-value">${escapeHtml(data.job_type)}</div>
					</div>

					<div class="confirm-group">
						<div class="confirm-label">お名前</div>
						<div class="confirm-value">${escapeHtml(data.name)}</div>
					</div>

					<div class="confirm-group">
						<div class="confirm-label">ふりがな</div>
						<div class="confirm-value">${escapeHtml(data.kana)}</div>
					</div>

					<div class="confirm-group">
						<div class="confirm-label">生年月日</div>
						<div class="confirm-value">${escapeHtml(data.birthday)}</div>
					</div>

					<div class="confirm-group">
						<div class="confirm-label">性別</div>
						<div class="confirm-value">${escapeHtml(data.gender_type)}</div>
					</div>

					<div class="confirm-group">
						<div class="confirm-label">ご住所</div>
						<div class="confirm-value">${escapeHtml(data.address)}</div>
					</div>

					<div class="confirm-group">
						<div class="confirm-label">メールアドレス</div>
						<div class="confirm-value">${escapeHtml(data.email)}</div>
					</div>
${phoneRow}
					<div class="confirm-group">
						<div class="confirm-label">職歴</div>
						<div class="confirm-value">${nl2br(escapeHtml(data.history))}</div>
					</div>

					<div class="confirm-group">
						<div class="confirm-label">ご質問など</div>
						<div class="confirm-value">${nl2br(escapeHtml(data.message))}</div>
					</div>

					<div class="button-wrapper">
						<button type="button" class="btn-back" onclick="history.back()">戻る</button>
						<form action="send.php" method="POST" style="margin: 0;">
							${FIELD_KEYS.map((key) => `<input type="hidden" name="${key}" value="${escapeHtml(data[key])}">`).join('\n\t\t\t\t\t\t\t')}
							<input type="hidden" name="form_ts" value="${timestampMs}">
							<input type="hidden" name="form_sig" value="${signature}">
							<button type="submit" class="btn-submit">送信する</button>
						</form>
					</div>
				</div>
			</div>
		</section>
	</div>
</main>
${FOOTER}
</body>
</html>`;
}

function errorPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
	<title>送信エラー ｜ atLIB株式会社 採用サイト</title>
${HEAD}
</head>
<body>
	<main>
		<div class="page_header">
			<div class="inner_box-M">
				<div class="page_ttl">
					<p>ERROR</p>
					<h1>送信エラー</h1>
				</div>
				<div class="page_map"><p><span><a href="../">トップページ</a></span>　-　<span>送信完了</span></p></div>
			</div>
			<div class="colorbox-01"><img src="../images/common/colorbox_h_lt.png" alt=""></div>
			<div class="colorbox-02"><img src="../images/common/colorbox_h_rt.png" alt=""></div>
		</div>
		<section class="thanks_box">
			<div class="inner_box-M">
				<div class="txt_box">
					<p>申し訳ございません。<br>
						メール送信中にエラーが発生しました。<br>
					お手数ですが、時間をおいて再度お試しいただくか、お電話にてお問い合わせください。</p>
				</div>
				<a href="../index.html" class="btn-home">トップページへ戻る</a>
			</div>
		</section>
	</main>

	${FOOTER}
</body>
</html>`;
}

export function createEntryFormRouter(mailer: Mailer, config: Config): Router {
  const router = Router();

  router.post('/recruit/entry/confirm.php', (req, res) => {
    const data: EntryFormData = {
      job_type: sanitize(req.body?.job_type),
      name: sanitize(req.body?.name),
      kana: sanitize(req.body?.kana),
      birthday: sanitize(req.body?.birthday),
      gender_type: sanitize(req.body?.gender_type),
      address: sanitize(req.body?.address),
      email: sanitize(req.body?.email),
      phone: sanitize(req.body?.phone),
      history: sanitize(req.body?.history),
      message: sanitize(req.body?.message),
    };

    const requiredOk =
      data.name && data.kana && data.birthday && data.address && data.email && data.phone && data.history;
    if (!requiredOk || !isValidEmail(data.email)) {
      res.redirect('index.html');
      return;
    }

    const timestampMs = Date.now();
    const signature = signFormFields(config.formHmacSecret, timestampMs, data as unknown as Record<string, string>);

    res.type('html').send(confirmPage(data, timestampMs, signature));
  });

  router.post('/recruit/entry/send.php', async (req, res) => {
    const data: EntryFormData = {
      job_type: sanitize(req.body?.job_type),
      name: sanitize(req.body?.name),
      kana: sanitize(req.body?.kana),
      birthday: sanitize(req.body?.birthday),
      gender_type: sanitize(req.body?.gender_type),
      address: sanitize(req.body?.address),
      email: sanitize(req.body?.email),
      phone: sanitize(req.body?.phone),
      history: sanitize(req.body?.history),
      message: sanitize(req.body?.message),
    };
    const timestampMs = Number(req.body?.form_ts);
    const signature = sanitize(req.body?.form_sig);

    if (!verifyFormFields(config.formHmacSecret, timestampMs, data as unknown as Record<string, string>, signature)) {
      res.status(400).send('不正なアクセスです');
      return;
    }

    try {
      await mailer.sendEntryNotification(config.entryNotifyEmail, data);
      await mailer.sendEntryAutoReply(data.email, data);
      res.redirect('thanks.html');
    } catch (err) {
      console.error('entry form mail send failed', err);
      res.type('html').send(errorPage());
    }
  });

  return router;
}
