import { describe, it, expect } from 'vitest';
import { MailerService } from '../../codex/server/services/mailer.service.js';
import { SmtpMailerAdapter } from '../../codex/server/services/smtp.client.js';

describe('MailerService - Postfix Alias', () => {
  it('correctly maps the postfix provider to SmtpMailerAdapter', () => {
    // Mock environment for postfix
    const originalProvider = process.env.MAIL_PROVIDER;
    const originalHost = process.env.SMTP_HOST;
    
    try {
      process.env.MAIL_PROVIDER = 'postfix';
      process.env.SMTP_HOST = 'localhost';
      process.env.EMAIL_FROM = 'test@scholomance.ai';

      const mailer = new MailerService();
      
      expect(mailer.provider).toBe('postfix');
      expect(mailer.adapter).toBeInstanceOf(SmtpMailerAdapter);
    } finally {
      process.env.MAIL_PROVIDER = originalProvider;
      process.env.SMTP_HOST = originalHost;
    }
  });

  it('is case-insensitive and trims the provider string', () => {
    const originalProvider = process.env.MAIL_PROVIDER;
    try {
      process.env.MAIL_PROVIDER = ' POSTFIX  ';
      process.env.SMTP_HOST = 'localhost';
      
      const mailer = new MailerService();
      expect(mailer.provider).toBe('postfix');
    } finally {
      process.env.MAIL_PROVIDER = originalProvider;
    }
  });
});
