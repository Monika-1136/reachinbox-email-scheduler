import nodemailer from 'nodemailer';
import { config } from './env';

let transporter: nodemailer.Transporter | null = null;
let currentFrom = config.smtp.from;

export async function getEmailTransporter(): Promise<{
  transporter: nodemailer.Transporter;
  fromAddress: string;
}> {
  if (transporter) {
    return { transporter, fromAddress: currentFrom };
  }

  if (config.smtp.user && config.smtp.password) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password,
      },
    });
    console.log(`[SMTP] Configured using provided Ethereal credentials (${config.smtp.user})`);
    return { transporter, fromAddress: currentFrom };
  }

  // If no credentials supplied in .env, dynamically provision a real Ethereal test account!
  try {
    console.log('[SMTP] No SMTP credentials in .env. Creating real Ethereal test account dynamically...');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    currentFrom = `ReachInbox Scheduler <${testAccount.user}>`;
    console.log(`[SMTP] Real Ethereal account created: ${testAccount.user}`);
    return { transporter, fromAddress: currentFrom };
  } catch (error) {
    console.warn('[SMTP] Fallback transporter creation warning:', (error as Error).message);
    // Return standard fallback
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password,
      },
    });
    return { transporter, fromAddress: currentFrom };
  }
}
