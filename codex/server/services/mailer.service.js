import { MailerAdapter } from '../../../mailer.adapter.js';

export class ConsoleMailerService extends MailerAdapter {
  constructor(logger) {
    super();
    this.logger = logger || console;
  }

  async send({ to, subject, text, html }) {
    this.logger.info('--- MOCK EMAIL SEND START ---');
    this.logger.info(`To: ${to}`);
    this.logger.info(`Subject: ${subject}`);
    this.logger.info(`Text: ${text}`);
    this.logger.info('--- MOCK EMAIL SEND END ---');
    return Promise.resolve();
  }
}

/**
 * Production-ready mailer using SendGrid's Web API.
 * Uses native fetch to avoid extra dependencies like nodemailer.
 */
export class SendGridMailerService extends MailerAdapter {
  constructor(apiKey, fromEmail) {
    super();
    this.apiKey = apiKey;
    this.fromEmail = fromEmail || 'noreply@scholomance.ai';
  }

  async send({ to, subject, text, html }) {
    if (!this.apiKey) {
      throw new Error('SENDGRID_API_KEY is missing');
    }

    const response = await fetch('https://api.sendgrid.com/v2/mail.send.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        to,
        from: this.fromEmail,
        subject,
        text,
        html: html || text
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid API error: ${error}`);
    }
  }
}

export function createMailerService(logger) {
    // Only use SendGrid if the API key is explicitly provided.
    // Otherwise, fallback to console logging so the app doesn't crash during setup.
    if (process.env.SENDGRID_API_KEY) {
        return new SendGridMailerService(
            process.env.SENDGRID_API_KEY,
            process.env.EMAIL_FROM
        );
    }
    
    if (process.env.NODE_ENV === 'production') {
        (logger || console).warn('[MAILER] SENDGRID_API_KEY is missing. Falling back to console logging.');
    }
    
    return new ConsoleMailerService(logger);
}
