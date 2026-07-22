import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { POST } from './route';

vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn() } }));

const sendMailMock = vi.fn();

beforeEach(() => {
  vi.mocked(nodemailer.createTransport).mockReturnValue(
    { sendMail: sendMailMock } as unknown as ReturnType<typeof nodemailer.createTransport>
  );
});

afterEach(() => {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.EMAIL_FROM;
  sendMailMock.mockReset();
});

function setSmtpEnv() {
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_USER = 'user@example.com';
  process.env.SMTP_PASS = 'secret';
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/email-comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('email-comments route', () => {
  describe('SMTP env vars missing', () => {
    it('returns 500 with Email not configured.', async () => {
      const res = await POST(makeRequest({ to: 'a@b.com', commentsJson: '{}', fileName: 'c.json' }));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Email not configured.' });
    });
  });

  describe('request validation', () => {
    beforeEach(() => setSmtpEnv());

    it('returns 400 for missing to', async () => {
      sendMailMock.mockResolvedValue(undefined);
      const res = await POST(makeRequest({ to: '', commentsJson: '{}', fileName: 'c.json' }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid recipient email address.' });
    });

    it('returns 400 for malformed to', async () => {
      const res = await POST(makeRequest({ to: 'notanemail', commentsJson: '{}', fileName: 'c.json' }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid recipient email address.' });
    });

    it('returns 400 for missing commentsJson', async () => {
      const res = await POST(makeRequest({ to: 'a@b.com', commentsJson: '', fileName: 'c.json' }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'commentsJson is required.' });
    });
  });

  describe('successful send', () => {
    beforeEach(() => setSmtpEnv());

    it('sends via nodemailer and returns 200 with ok: true', async () => {
      sendMailMock.mockResolvedValue(undefined);
      const res = await POST(makeRequest({ to: 'recv@example.com', commentsJson: '{"comments":[]}', fileName: 'my-comments.json' }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recv@example.com',
          subject: 'Markdown Commenter — comments export',
          attachments: expect.arrayContaining([
            expect.objectContaining({ filename: 'my-comments.json' }),
          ]),
        })
      );
    });

    it('uses EMAIL_FROM when set, falls back to SMTP_USER', async () => {
      sendMailMock.mockResolvedValue(undefined);

      process.env.EMAIL_FROM = 'sender@custom.com';
      await POST(makeRequest({ to: 'recv@example.com', commentsJson: '{}', fileName: 'c.json' }));
      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'sender@custom.com' })
      );

      sendMailMock.mockReset();
      sendMailMock.mockResolvedValue(undefined);
      delete process.env.EMAIL_FROM;
      await POST(makeRequest({ to: 'recv@example.com', commentsJson: '{}', fileName: 'c.json' }));
      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'user@example.com' })
      );
    });
  });

  describe('nodemailer failure', () => {
    beforeEach(() => setSmtpEnv());

    it('returns 500 with generic error, no SMTP details', async () => {
      sendMailMock.mockRejectedValue(new Error('Connection refused smtp.example.com:587'));
      const res = await POST(makeRequest({ to: 'recv@example.com', commentsJson: '{}', fileName: 'c.json' }));
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toEqual({ error: 'Failed to send email.' });
      const body = JSON.stringify(data);
      expect(body).not.toContain('smtp.example.com');
      expect(body).not.toContain('secret');
    });
  });
});
