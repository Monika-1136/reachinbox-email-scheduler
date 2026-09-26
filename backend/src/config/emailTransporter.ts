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

  const isRealMode = config.smtp.provider === 'real';

  if (isRealMode) {
    if (!config.smtp.user || !config.smtp.password) {
      console.warn('[SMTP] Real SMTP mode requested, but SMTP_USER or SMTP_PASSWORD is not set. Falling back to Ethereal.');
    } else {
      console.log(`[SMTP] Initializing REAL SMTP transporter via ${config.smtp.host}:${config.smtp.port} (user: ${config.smtp.user})`);
      transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.password,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
      currentFrom = config.smtp.from || `ReachInbox <${config.smtp.user}>`;
      return { transporter, fromAddress: currentFrom };
    }
  }

  // Ethereal Mode: Check if custom ethereal credentials provided in env
  const hasCustomEthereal =
    config.smtp.user &&
    config.smtp.password &&
    !config.smtp.user.includes('your_') &&
    !config.smtp.password.includes('your_');

  if (hasCustomEthereal) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    console.log(`[SMTP] Configured using provided Ethereal credentials (${config.smtp.user})`);
    return { transporter, fromAddress: currentFrom };
  }

  // If no credentials supplied, dynamically provision a real Ethereal test account!
  try {
    console.log('[SMTP] Provisioning dynamic Ethereal test account...');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    currentFrom = `ReachInbox Scheduler <${testAccount.user}>`;
    console.log(`[SMTP] Dynamic Ethereal account ready: ${testAccount.user}`);
    return { transporter, fromAddress: currentFrom };
  } catch (error) {
    console.warn('[SMTP] Dynamic Ethereal provisioning error:', (error as Error).message);
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    return { transporter, fromAddress: currentFrom };
  }
}
