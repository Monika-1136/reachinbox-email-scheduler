import axios from 'axios';
import {
  User,
  Sender,
  ScheduledEmail,
  EmailCampaign,
  QueueMetrics,
  SlackStatus,
  EmailStats,
  CsvParseResponse,
} from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject Bearer token if present in localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth Endpoints
export const authApi = {
  signup: async (data: { name: string; email: string; password: string }): Promise<{ user: User; token: string }> => {
    const res = await api.post('/api/auth/signup', data);
    return res.data.data;
  },
  login: async (data: { email: string; password: string }): Promise<{ user: User; token: string }> => {
    const res = await api.post('/api/auth/login', data);
    return res.data.data;
  },
  getMe: async (): Promise<User> => {
    const res = await api.get('/api/auth/me');
    return res.data.data;
  },
  devLogin: async (email?: string, name?: string): Promise<{ user: User; token: string }> => {
    const res = await api.post('/api/auth/demo', { email, name });
    return res.data.data;
  },
  demoLogin: async (email?: string, name?: string): Promise<{ user: User; token: string }> => {
    const res = await api.post('/api/auth/demo', { email, name });
    return res.data.data;
  },
  logout: async (): Promise<void> => {
    await api.post('/api/auth/logout');
  },
};

// Senders Endpoints
export const sendersApi = {
  getSenders: async (): Promise<Sender[]> => {
    const res = await api.get('/api/senders');
    return res.data.data;
  },
  createSender: async (data: { email: string; displayName: string; hourlyLimit?: number }): Promise<Sender> => {
    const res = await api.post('/api/senders', data);
    return res.data.data;
  },
  deleteSender: async (id: string): Promise<void> => {
    await api.delete(`/api/senders/${id}`);
  },
  testSender: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/api/senders/${id}/test`);
    return res.data;
  },
};

// Campaigns Endpoints
export const campaignsApi = {
  getCampaigns: async (): Promise<EmailCampaign[]> => {
    const res = await api.get('/api/campaigns');
    return res.data.data;
  },
  getCampaignById: async (id: string): Promise<EmailCampaign> => {
    const res = await api.get(`/api/campaigns/${id}`);
    return res.data.data;
  },
};

// Emails Endpoints
export const emailsApi = {
  schedule: async (data: {
    senderId: string;
    subject: string;
    body: string;
    recipients: string[];
    startTime?: string;
    delayMs?: number;
    hourlyLimit?: number;
  }): Promise<{ campaignId: string; totalScheduled: number; startTime: string; delayMs: number }> => {
    const res = await api.post('/api/emails/schedule', data);
    return res.data.data;
  },
  getScheduled: async (page = 1, limit = 20): Promise<{ emails: ScheduledEmail[]; total: number; page: number; totalPages: number }> => {
    const res = await api.get('/api/emails/scheduled', { params: { page, limit } });
    return { emails: res.data.data, ...res.data.meta };
  },
  getSent: async (page = 1, limit = 20): Promise<{ emails: ScheduledEmail[]; total: number; page: number; totalPages: number }> => {
    const res = await api.get('/api/emails/sent', { params: { page, limit } });
    return { emails: res.data.data, ...res.data.meta };
  },
  search: async (q: string, status?: string, limit = 50, offset = 0): Promise<{ emails: ScheduledEmail[]; total: number; source: string }> => {
    const res = await api.get('/api/emails/search', { params: { q, status, limit, offset } });
    return { emails: res.data.data, total: res.data.meta?.total || 0, source: res.data.meta?.source || 'db' };
  },
  getStats: async (): Promise<EmailStats> => {
    const res = await api.get('/api/emails/stats');
    return res.data.data;
  },
  cancel: async (id: string): Promise<void> => {
    await api.delete(`/api/emails/${id}`);
  },
  parseCsv: async (content: string): Promise<CsvParseResponse> => {
    const res = await api.post('/api/emails/parse-csv', { content });
    return res.data.data;
  },
};

// Slack Endpoints
export const slackApi = {
  getConnectUrl: async (): Promise<string> => {
    const res = await api.get('/api/slack/connect');
    return res.data.data.authUrl;
  },
  getStatus: async (): Promise<SlackStatus> => {
    const res = await api.get('/api/slack/status');
    return res.data.data;
  },
  disconnect: async (): Promise<void> => {
    await api.post('/api/slack/disconnect');
  },
};

// Queue & Admin Endpoints
export const queueApi = {
  getStats: async (): Promise<QueueMetrics> => {
    const res = await api.get('/api/queues/stats');
    return res.data.data;
  },
};
