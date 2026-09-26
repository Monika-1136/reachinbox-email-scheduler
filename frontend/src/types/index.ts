export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface Sender {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  hourlyLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledEmail {
  id: string;
  campaignId: string;
  userId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';
  attempts: number;
  bullJobId?: string | null;
  idempotencyKey: string;
  messageId?: string | null;
  etherealUrl?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: Sender;
  campaign?: {
    id: string;
    subject: string;
    delayMs: number;
    hourlyLimit: number;
  };
}

export interface EmailCampaign {
  id: string;
  userId: string;
  subject: string;
  body: string;
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
  createdAt: string;
  _count?: {
    scheduledEmails: number;
  };
}

export interface QueueMetrics {
  waiting: number;
  delayed: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
}

export interface SlackStatus {
  connected: boolean;
  teamName?: string | null;
  connectedAt?: string | null;
}

export interface EmailStats {
  scheduled: number;
  sent: number;
  failed: number;
  total: number;
}

export interface ParsedCsvRecipient {
  email: string;
  isValid: boolean;
  error?: string;
}

export interface CsvParseResponse {
  validEmails: string[];
  invalidCount: number;
  duplicateCount: number;
  totalDetected: number;
  recipients: ParsedCsvRecipient[];
}
