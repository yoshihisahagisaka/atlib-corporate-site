import nodemailer, { type Transporter } from 'nodemailer';
import type { Config } from '../config';

export interface ContactFormData {
  inquiry_type: string;
  company: string;
  name: string;
  email: string;
  phone: string;
  message: string;
}

export interface EntryFormData {
  job_type: string;
  name: string;
  kana: string;
  birthday: string;
  gender_type: string;
  address: string;
  email: string;
  phone: string;
  history: string;
  message: string;
}

const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━';

export class Mailer {
  private readonly transporter: Transporter;

  constructor(private readonly config: Config['smtp']) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: false, // 587 + STARTTLS（Google Workspace SMTPリレーの標準構成。msp-customer-portalと同じ構成）
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
  }

  /** 元 confirm.php/send.php の管理者向けメール本文を踏襲。 */
  async sendContactNotification(to: string, data: ContactFormData): Promise<void> {
    const lines = [
      'お問い合わせがありました。',
      '',
      DIVIDER,
      '■ お問合せの種類',
      data.inquiry_type,
      '',
      '■ 会社名',
      data.company,
      '',
      '■ お名前',
      data.name,
      '',
      '■ メールアドレス',
      data.email,
      '',
    ];
    if (data.phone) {
      lines.push('■ 電話番号', data.phone, '');
    }
    lines.push('■ お問合せ内容', data.message, DIVIDER);

    await this.transporter.sendMail({
      from: this.config.from,
      to,
      replyTo: data.email,
      subject: '【お問い合わせ】WEBサイトからお問い合わせがありました',
      text: lines.join('\n'),
    });
  }

  async sendContactAutoReply(to: string, data: ContactFormData): Promise<void> {
    const lines = [
      data.company,
      `${data.name} 様`,
      '',
      'この度はお問い合わせいただき、誠にありがとうございます。',
      '以下の内容でお問い合わせを受け付けいたしました。',
      '',
      DIVIDER,
      '■ お問合せの種類',
      data.inquiry_type,
      '',
      '■ 会社名',
      data.company,
      '',
      '■ お名前',
      data.name,
      '',
      '■ メールアドレス',
      data.email,
      '',
    ];
    if (data.phone) {
      lines.push('■ 電話番号', data.phone, '');
    }
    lines.push(
      '■ お問合せ内容',
      data.message,
      DIVIDER,
      '',
      '担当者より改めてご連絡させていただきますので、',
      '今しばらくお待ちくださいますようお願い申し上げます。',
      '',
      '※このメールは自動送信されています。',
      '※ご返信いただいてもお答えできませんのでご了承ください。',
    );

    await this.transporter.sendMail({
      from: this.config.from,
      to,
      subject: '【自動送信】お問い合わせありがとうございます - atLIB株式会社',
      text: lines.join('\n'),
    });
  }

  /** 元 recruit/entry/confirm.php・send.php の本文を踏襲。 */
  async sendEntryNotification(to: string, data: EntryFormData): Promise<void> {
    const lines = [
      'エントリーがありました。',
      '',
      DIVIDER,
      '■ 応募職種',
      data.job_type,
      '',
      '■ お名前',
      data.name,
      '',
      '■ ふりがな',
      data.kana,
      '',
      '■ 生年月日',
      data.birthday,
      '',
      '■ 性別',
      data.gender_type,
      '',
      '■ ご住所',
      data.address,
      '',
      '■ メールアドレス',
      data.email,
      '',
      '■ 電話番号',
      data.phone,
      '',
      '■ 職歴',
      data.history,
    ];
    if (data.message) {
      lines.push('', '■ ご質問', data.message);
    }
    lines.push(DIVIDER);

    await this.transporter.sendMail({
      from: this.config.from,
      to,
      replyTo: data.email,
      subject: '【エントリー】採用サイトからエントリーありました',
      text: lines.join('\n'),
    });
  }

  async sendEntryAutoReply(to: string, data: EntryFormData): Promise<void> {
    const lines = [
      `${data.name} 様`,
      '',
      'この度はエントリーいただき、誠にありがとうございます。',
      '以下の内容で受け付けいたしました。',
      '',
      DIVIDER,
      '■ 応募職種',
      data.job_type,
      '',
      '■ お名前',
      data.name,
      '',
      '■ ふりがな',
      data.kana,
      '',
      '■ 生年月日',
      data.birthday,
      '',
      '■ 性別',
      data.gender_type,
      '',
      '■ ご住所',
      data.address,
      '',
      '■ メールアドレス',
      data.email,
      '',
      '■ 電話番号',
      data.phone,
      '',
      '■ 職歴',
      data.history,
    ];
    if (data.message) {
      lines.push('', '■ ご質問', data.message);
    }
    lines.push(
      DIVIDER,
      '担当者より改めてご連絡させていただきますので、',
      '今しばらくお待ちくださいますようお願い申し上げます。',
      '',
      '※このメールは自動送信されています。',
      '※ご返信いただいてもお答えできませんのでご了承ください。',
    );

    await this.transporter.sendMail({
      from: this.config.from,
      to,
      subject: '【自動送信】エントリーありがとうございます - atLIB株式会社 採用サイト',
      text: lines.join('\n'),
    });
  }
}
