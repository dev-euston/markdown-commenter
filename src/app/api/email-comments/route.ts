import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return NextResponse.json({ error: 'Email not configured.' }, { status: 500 });
  }

  const body = await request.json();
  const { to, commentsJson, fileName } = body;

  if (typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: 'Invalid recipient email address.' }, { status: 400 });
  }

  if (typeof commentsJson !== 'string' || !commentsJson) {
    return NextResponse.json({ error: 'commentsJson is required.' }, { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? SMTP_USER,
      to,
      subject: 'Markdown Commenter — comments export',
      text: 'Please find the attached comments file.',
      attachments: [
        {
          filename: typeof fileName === 'string' && fileName ? fileName : 'comments.json',
          content: commentsJson,
          contentType: 'application/json',
        },
      ],
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to send email.' }, { status: 500 });
  }
}
