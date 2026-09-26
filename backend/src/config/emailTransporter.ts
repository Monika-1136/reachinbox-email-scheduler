import nodemailer from 'nodemailer';
import { config } from './env';

let transporter: nodemailer.Transporter | null = null;
let currentFrom = config.smtp.from;

export async function getEmailTransporter(sender?: {
  email: string;
  displayName?: string | null;
}): Promise<{
  transporter: nodemailer.Transporter;
  fromAddress: string;
}> {
  let activeTransporter = transporter;

  if (!activeTransporter) {
    const isRealMode = config.smtp.provider === 'real';

    if (isRealMode) {
      if (!config.smtp.user || !config.smtp.password || config.smtp.user.includes('your_')) {
        throw new Error(
          'Real SMTP mode is configured (SMTP_PROVIDER=real), but valid SMTP_USER or SMTP_PASSWORD is not set in backend/.env. Please configure your SMTP credentials or set SMTP_PROVIDER=ethereal for sandbox testing.'
        );
      }
      console.log(`[SMTP] Using configured REAL SMTP provider (${config.smtp.host}:${config.smtp.port})`);
      activeTransporter = nodemailer.createTransport({
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
      transporter = activeTransporter;
      currentFrom = config.smtp.from || `ReachInbox <${config.smtp.user}>`;
    }

    if (!activeTransporter) {
      // Ethereal Mode: Check if custom ethereal credentials provided in env
      const hasCustomEthereal =
        config.smtp.user &&
        config.smtp.password &&
        !config.smtp.user.includes('your_') &&
        !config.smtp.password.includes('your_');

      if (hasCustomEthereal) {
        activeTransporter = nodemailer.createTransport({
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
        transporter = activeTransporter;
        console.log(`[SMTP] Configured using provided Ethereal credentials (${config.smtp.user})`);
      } else {
        // If no credentials supplied, dynamically provision a real Ethereal test account!
        try {
          console.log('[SMTP] Provisioning dynamic Ethereal test account...');
          const testAccount = await nodemailer.createTestAccount();
          activeTransporter = nodemailer.createTransport({
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
          transporter = activeTransporter;
          currentFrom = `ReachInbox Scheduler <${testAccount.user}>`;
          console.log(`[SMTP] Dynamic Ethereal account ready: ${testAccount.user}`);
        } catch (error) {
          console.warn('[SMTP] Dynamic Ethereal provisioning error:', (error as Error).message);
          activeTransporter = nodemailer.createTransport({
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
          transporter = activeTransporter;
        }
      }
    }
  }

  // Format sender from address:
  let finalFrom = currentFrom;
  if (sender && sender.email) {
    if (config.smtp.provider === 'real') {
      // In Real SMTP, if config.smtp.from is set, we can keep the authenticated sender domain or sender header
      finalFrom = sender.displayName ? `"${sender.displayName}" <${sender.email}>` : sender.email;
    } else {
      // In Ethereal mode, format with sender display name and email
      finalFrom = sender.displayName ? `"${sender.displayName}" <${sender.email}>` : sender.email;
    }
  }

  return { transporter: activeTransporter, fromAddress: finalFrom };
}

export async function verifySmtpConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const { transporter } = await getEmailTransporter();
    await transporter.verify();
    return {
      success: true,
      message: `SMTP connection and authentication verified successfully (${config.smtp.host}:${config.smtp.port})`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `SMTP Connection Failed: ${err.message || 'Authentication or network error'}`,
    };
  }
}
