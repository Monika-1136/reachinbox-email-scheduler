import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { config } from './env';

let transporter: nodemailer.Transporter | null = null;
let currentFrom = config.smtp.from;
let etherealAccount: { user: string; pass: string } | null = null;

const ETHEREAL_CACHE_FILE = path.join(process.cwd(), '.ethereal-account.json');

/**
 * Loads or provisions a persistent Ethereal test account
 */
async function getOrProvisionEtherealAccount(): Promise<{ user: string; pass: string }> {
  if (etherealAccount) {
    return etherealAccount;
  }

  // 1. Check if configured in environment variables
  if (config.smtp.user && config.smtp.password && !config.smtp.user.includes('your_')) {
    etherealAccount = {
      user: config.smtp.user,
      pass: config.smtp.password,
    };
    return etherealAccount;
  }

  // 2. Check if cached on disk from previous runs
  try {
    if (fs.existsSync(ETHEREAL_CACHE_FILE)) {
      const raw = fs.readFileSync(ETHEREAL_CACHE_FILE, 'utf-8');
      const cached = JSON.parse(raw);
      if (cached && cached.user && cached.pass) {
        etherealAccount = cached;
        console.log(`[SMTP] Loaded cached Ethereal test account: ${cached.user}`);
        return etherealAccount!;
      }
    }
  } catch {
    // Disk cache read failed, proceed to create new
  }

  // 3. Provision new Ethereal account with retry logic
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[SMTP] Provisioning Ethereal test account (attempt ${attempt}/3)...`);
      const testAccount = await nodemailer.createTestAccount();
      etherealAccount = {
        user: testAccount.user,
        pass: testAccount.pass,
      };

      // Save to disk for server restart persistence
      try {
        fs.writeFileSync(ETHEREAL_CACHE_FILE, JSON.stringify(etherealAccount, null, 2), 'utf-8');
      } catch (writeErr) {
        console.warn('[SMTP] Could not write .ethereal-account.json to disk:', (writeErr as Error).message);
      }

      console.log(`[SMTP] Ethereal account ready: ${etherealAccount.user}`);
      return etherealAccount;
    } catch (err) {
      lastError = err as Error;
      console.warn(`[SMTP] Provisioning attempt ${attempt} failed: ${lastError.message}`);
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw new Error(`Failed to provision Ethereal SMTP test account: ${lastError?.message || 'Network error'}`);
}

/**
 * Initializes and verifies the singleton Nodemailer transporter
 */
export async function initEmailTransporter(): Promise<{
  transporter: nodemailer.Transporter;
  info: { provider: string; user?: string; host: string; port: number; verified: boolean };
}> {
  if (transporter) {
    return {
      transporter,
      info: {
        provider: config.smtp.provider,
        user: etherealAccount?.user || config.smtp.user,
        host: config.smtp.host,
        port: config.smtp.port,
        verified: true,
      },
    };
  }

  const isRealMode = config.smtp.provider === 'real';

  if (isRealMode) {
    if (!config.smtp.user || !config.smtp.password || config.smtp.user.includes('your_')) {
      throw new Error(
        'Real SMTP mode is configured (SMTP_PROVIDER=real), but valid SMTP_USER or SMTP_PASSWORD is not set in backend/.env.'
      );
    }

    transporter = nodemailer.createTransport({
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateLimit: 14,
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
  } else {
    // Ethereal Mode
    const account = await getOrProvisionEtherealAccount();
    transporter = nodemailer.createTransport({
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateLimit: 14,
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: account.user,
        pass: account.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    currentFrom = `ReachInbox Scheduler <${account.user}>`;
  }

  // Verify connection
  try {
    await transporter.verify();
    console.log(`[SMTP] Transporter verified & connected successfully (${isRealMode ? 'Real SMTP' : 'Ethereal Sandbox'})`);
  } catch (verifyErr) {
    console.warn('[SMTP] Transporter verification warning:', (verifyErr as Error).message);
  }

  return {
    transporter,
    info: {
      provider: config.smtp.provider,
      user: etherealAccount?.user || config.smtp.user,
      host: isRealMode ? config.smtp.host : 'smtp.ethereal.email',
      port: isRealMode ? config.smtp.port : 587,
      verified: true,
    },
  };
}

/**
 * Retrieves the active transporter and formats the sender's From header
 */
export async function getEmailTransporter(sender?: {
  email: string;
  displayName?: string | null;
}): Promise<{
  transporter: nodemailer.Transporter;
  fromAddress: string;
}> {
  if (!transporter) {
    await initEmailTransporter();
  }

  let finalFrom = currentFrom;
  if (sender && sender.email) {
    finalFrom = sender.displayName ? `"${sender.displayName}" <${sender.email}>` : sender.email;
  }

  return { transporter: transporter!, fromAddress: finalFrom };
}

/**
 * Verifies SMTP connection
 */
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
