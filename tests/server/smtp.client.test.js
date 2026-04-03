/* @vitest-environment node */
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { SmtpMailerAdapter } from '../../codex/server/services/smtp.client.js';

class FakeSmtpSocket extends EventEmitter {
  constructor() {
    super();
    this.destroyed = false;
    this.dataMode = false;
    this.buffer = '';
    this.commands = [];
    this.authToken = null;
    this.message = '';
    this.enqueueResponse('220 localhost ESMTP test\r\n');
  }

  setEncoding() {}

  setTimeout() {}

  write(chunk) {
    const content = String(chunk);
    if (this.dataMode) {
      this.consumeMessageChunk(content);
      return true;
    }

    this.buffer += content;
    let newlineIndex = this.buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      let line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (line.endsWith('\r')) {
        line = line.slice(0, -1);
      }
      this.handleCommand(line);
      newlineIndex = this.buffer.indexOf('\n');
    }
    return true;
  }

  end() {
    if (this.destroyed) return;
    this.destroyed = true;
    setTimeout(() => {
      this.emit('close');
    }, 0);
  }

  enqueueResponse(payload) {
    setTimeout(() => {
      this.emit('data', payload);
    }, 0);
  }

  consumeMessageChunk(chunk) {
    const terminator = '\r\n.\r\n';
    const terminatorIndex = chunk.indexOf(terminator);
    if (terminatorIndex === -1) {
      this.message += chunk;
      return;
    }

    this.message += chunk.slice(0, terminatorIndex);
    this.dataMode = false;
    this.enqueueResponse('250 id=test-message-123 queued\r\n');
  }

  handleCommand(line) {
    this.commands.push(line);

    if (line.startsWith('EHLO ')) {
      this.enqueueResponse('250-localhost\r\n250-AUTH PLAIN LOGIN\r\n250 SIZE 10485760\r\n');
      return;
    }

    if (line.startsWith('AUTH PLAIN ')) {
      this.authToken = line.slice('AUTH PLAIN '.length);
      this.enqueueResponse('235 Authentication successful\r\n');
      return;
    }

    if (line.startsWith('MAIL FROM:')) {
      this.enqueueResponse('250 Sender ok\r\n');
      return;
    }

    if (line.startsWith('RCPT TO:')) {
      this.enqueueResponse('250 Recipient ok\r\n');
      return;
    }

    if (line === 'DATA') {
      this.dataMode = true;
      this.enqueueResponse('354 End data with <CR><LF>.<CR><LF>\r\n');
      return;
    }

    if (line === 'QUIT') {
      this.enqueueResponse('221 Bye\r\n');
      return;
    }

    this.enqueueResponse('502 Command not implemented\r\n');
  }
}

describe('SmtpMailerAdapter', () => {
  it('delivers a multipart message over SMTP with AUTH PLAIN', async () => {
    let socket = null;
    const adapter = new SmtpMailerAdapter({
      host: 'smtp.test.local',
      port: 1025,
      secure: false,
      username: 'scholo-user',
      password: 'scholo-pass',
      fromEmail: 'noreply@test.local',
      fromName: 'Scholomance',
      greetingName: 'localhost',
      timeoutMs: 2_000,
      socketFactory: async () => {
        socket = new FakeSmtpSocket();
        return socket;
      },
    });

    const result = await adapter.send({
      to: 'scribe@test.local',
      subject: 'Ritual password reset',
      text: 'Ritual hello',
      html: '<strong>Ritual hello</strong>',
    });

    expect(result.providerMessageId).toBe('test-message-123');
    expect(socket).toBeTruthy();
    expect(Buffer.from(socket.authToken, 'base64').toString('utf8')).toBe('\0scholo-user\0scholo-pass');
    expect(socket.commands).toEqual([
      'EHLO localhost',
      expect.stringMatching(/^AUTH PLAIN /),
      'MAIL FROM:<noreply@test.local>',
      'RCPT TO:<scribe@test.local>',
      'DATA',
      'QUIT',
    ]);
    expect(socket.message).toContain('Subject: Ritual password reset');
    expect(socket.message).toContain('Content-Type: multipart/alternative;');
    expect(socket.message).toContain(Buffer.from('Ritual hello', 'utf8').toString('base64'));
    expect(socket.message).toContain(Buffer.from('<strong>Ritual hello</strong>', 'utf8').toString('base64'));
  });
});
