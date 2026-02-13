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
    if (html) {
        this.logger.info(`HTML: ${html.substring(0, 50)}...`);
    }
    this.logger.info('--- MOCK EMAIL SEND END ---');
    return Promise.resolve();
  }
}

export function createMailerService(logger) {
    return new ConsoleMailerService(logger);
}
