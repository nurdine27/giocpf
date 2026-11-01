import { Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { PrismaService } from './prisma.service';

const logger = new Logger('Email');
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export type Mail = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** Where replies from the recipient should go. */
  replyTo?: string;
  /** Resend tags (ASCII letters, numbers, _ and - only). Used for filtering in the Resend dashboard. */
  tags?: Record<string, string>;
  /** Prevents duplicate sends when a request is retried (Resend keeps it for 24h). */
  idempotencyKey?: string;
};

export type EmailProvider = 'resend' | 'smtp' | null;

export function emailProvider(): EmailProvider {
  if (!process.env.MAIL_FROM) return null;
  if (process.env.RESEND_API_KEY) return 'resend';
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  )
    return 'smtp';
  return null;
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('O envio de e-mail não está configurado (defina MAIL_FROM e RESEND_API_KEY).');
  }
}

/** Sends through Resend when RESEND_API_KEY is set, otherwise through SMTP. Throws on failure. */
export async function sendEmail(mail: Mail) {
  const provider = emailProvider();
  if (!provider) throw new EmailNotConfiguredError();
  const from = process.env.MAIL_FROM!;
  const replyTo = mail.replyTo ?? process.env.MAIL_REPLY_TO ?? undefined;
  const to = Array.isArray(mail.to) ? mail.to : [mail.to];

  if (provider === 'resend') {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        ...(mail.idempotencyKey ? { 'Idempotency-Key': mail.idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify({
        from,
        to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(mail.tags
          ? {
              tags: Object.entries(mail.tags).map(([name, value]) => ({
                name,
                value: value.replace(/[^\w-]/g, '_').slice(0, 256),
              })),
            }
          : {}),
      }),
    });
    const result = (await response.json().catch(() => null)) as {
      id?: string;
      message?: string;
      name?: string;
    } | null;
    if (!response.ok) {
      logger.error(
        `Resend ${response.status} ${result?.name ?? ''}: ${result?.message ?? 'sem detalhe'}`,
      );
      throw new Error('Falha no envio através do Resend.');
    }
    logger.log(`Resend enviou ${result?.id} para ${to.length} destinatário(s): ${mail.subject}`);
    return { provider, id: result?.id ?? null };
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const info = await transport.sendMail({
    from,
    to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo,
  });
  return { provider, id: info.messageId ?? null };
}

/** Fire-and-forget variant for notifications that must never break the main request. */
export function sendEmailInBackground(mail: Mail, context: string) {
  if (!emailProvider()) return;
  sendEmail(mail).catch((error) => logger.warn(`${context}: ${String(error)}`));
}

/** Institution inbox: admin setting first, then the INSTITUTIONAL_EMAIL environment variable. */
export async function institutionEmail(db: PrismaService) {
  const setting = await db.institutionSetting
    .findUnique({ where: { key: 'institutionEmail' }, select: { value: true } })
    .catch(() => null);
  const value = typeof setting?.value === 'string' ? setting.value.trim() : '';
  return value || process.env.INSTITUTIONAL_EMAIL || null;
}
