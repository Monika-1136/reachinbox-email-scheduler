export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface EmailJobData {
  emailId: string;
  campaignId: string;
  userId: string;
  senderId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  hourlyLimit: number;
  rescheduledCount?: number;
}

export interface ScheduleEmailsRequest {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime?: string | Date; // ISO string or Date
  delayMs?: number; // Milliseconds between sends, e.g. 2000
  hourlyLimit?: number; // e.g. 200
}

export interface ParsedCsvRecipient {
  email: string;
  isValid: boolean;
  error?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}
