import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Header } from '../components/Header';
import { StatsOverview } from '../components/StatsOverview';
import { ScheduledEmailTable } from '../components/ScheduledEmailTable';
import { SentEmailTable } from '../components/SentEmailTable';
import { SlackIntegrationCard } from '../components/SlackIntegrationCard';
import { SendersView } from '../components/SendersView';
import { ComposeModal } from '../components/ComposeModal';
import { emailsApi, queueApi, sendersApi } from '../services/api';
import { ScheduledEmail, EmailStats, QueueMetrics } from '../types';
import {
  Clock,
  Send,
  Layers,
  MessageSquare,
  Users,
  Sparkles,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent' | 'senders' | 'slack' | 'queue'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [scheduledTotalPages, setScheduledTotalPages] = useState(1);
  const [loadingScheduled, setLoadingScheduled] = useState(false);

  const [sentEmails, setSentEmails] = useState<ScheduledEmail[]>([]);
  const [sentTotal, setSentTotal] = useState(0);
  const [sentPage, setSentPage] = useState(1);
  const [sentTotalPages, setSentTotalPages] = useState(1);
  const [loadingSent, setLoadingSent] = useState(false);

  const [stats, setStats] = useState<EmailStats | null>(null);
  const [queueMetrics, setQueueMetrics] = useState<QueueMetrics | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Check URL params for tab navigation (e.g. ?tab=slack)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'slack') setActiveTab('slack');
    if (tabParam === 'sent') setActiveTab('sent');
  }, [location]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  const loadScheduled = async (page = scheduledPage) => {
    setLoadingScheduled(true);
    try {
      const data = await emailsApi.getScheduled(page, 20);
      setScheduledEmails(data.emails);
      setScheduledTotal(data.total);
      setScheduledPage(data.page);
      setScheduledTotalPages(data.totalPages);
    } catch {
      // ignore
    } finally {
      setLoadingScheduled(false);
    }
  };

  const loadSent = async (page = sentPage) => {
    setLoadingSent(true);
    try {
      const data = await emailsApi.getSent(page, 20);
      setSentEmails(data.emails);
      setSentTotal(data.total);
      setSentPage(data.page);
      setSentTotalPages(data.totalPages);
    } catch {
      // ignore
    } finally {
      setLoadingSent(false);
    }
  };

  const loadStats = async () => {
    try {
      const [st, qm] = await Promise.all([emailsApi.getStats(), queueApi.getStats()]);
      setStats(st);
      setQueueMetrics(qm);
    } catch {
      // ignore
    }
  };

  const refreshAll = () => {
    loadScheduled();
    loadSent();
    loadStats();
  };

  useEffect(() => {
    if (user) {
      refreshAll();
      // Auto-poll every 5 seconds so live background email dispatch is immediately visible
      const interval = setInterval(() => {
        loadScheduled();
        loadSent();
        loadStats();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Quick Seed 10 Demo Emails for instant demonstration
  const handleQuickSeed = async () => {
    setIsSeeding(true);
    try {
      const senders = await sendersApi.getSenders();
      if (senders.length === 0) {
        alert('Please create a sender account first');
        return;
      }

      const demoRecipients = [
        'alice@techinnovate.io',
        'bob@cloudscale.net',
        'carol@datanext.dev',
        'david@saasgrowth.org',
        'elena@growthvelocity.co',
        'frank@outboundreach.io',
        'grace@pipelinepro.net',
        'harry@talenthire.org',
        'isabella@scalepartners.vc',
        'jack@fintechlabs.test',
      ];

      await emailsApi.schedule({
        senderId: senders[0].id,
        subject: 'ReachInbox AI Outbound Optimization',
        body: 'Hello,\n\nI wanted to share how ReachInbox handles distributed BullMQ delayed email queuing with persistence and atomic rate limits.\n\nBest,\nReach Team',
        recipients: demoRecipients,
        startTime: new Date().toISOString(),
        delayMs: 2000,
        hourlyLimit: 5, // Triggers rate limit rescheduling & Slack notification demonstration!
      });

      refreshAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to seed workload');
    } finally {
      setIsSeeding(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B0D13] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0D13] text-[#F3F4F6] flex flex-col selection:bg-brand-500 selection:text-white">
      <Header onOpenCompose={() => setIsComposeOpen(true)} onRefresh={refreshAll} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Top Action Bar & Quick Seed CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Email Campaign Scheduler</h1>
            <p className="text-xs sm:text-sm text-gray-400">
              Distributed BullMQ queue • Redis atomic rate limiting • Ethereal SMTP • Elasticsearch
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleQuickSeed}
              disabled={isSeeding}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#12151F] hover:bg-[#1A1E2C] border border-[#1F2433] hover:border-brand-500/50 text-xs font-semibold text-brand-300 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
              title="Instantly enqueue 10 demo emails to test BullMQ worker and rate limiting"
            >
              {isSeeding ? (
                <div className="w-3.5 h-3.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              )}
              <span>Quick Seed 10 Emails</span>
            </button>

            <button
              onClick={refreshAll}
              className="p-2 bg-[#12151F] hover:bg-[#1A1E2C] border border-[#1F2433] text-gray-400 hover:text-white rounded-xl transition-colors"
              title="Refresh queue and email states"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <StatsOverview stats={stats} queueMetrics={queueMetrics} />

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#1F2433] pb-px overflow-x-auto">
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'scheduled'
                ? 'border-brand-500 text-white bg-brand-500/10'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#12151F]'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Scheduled Emails</span>
            <span className="px-2 py-0.2 bg-[#0E1017] text-gray-300 text-[10px] rounded-full border border-[#1F2433]">
              {stats?.scheduled ?? 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'sent'
                ? 'border-brand-500 text-white bg-brand-500/10'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#12151F]'
            }`}
          >
            <Send className="w-4 h-4 text-emerald-400" />
            <span>Sent & Delivered</span>
            <span className="px-2 py-0.2 bg-[#0E1017] text-gray-300 text-[10px] rounded-full border border-[#1F2433]">
              {stats?.sent ?? 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('senders')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'senders'
                ? 'border-brand-500 text-white bg-brand-500/10'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#12151F]'
            }`}
          >
            <Users className="w-4 h-4 text-blue-400" />
            <span>Senders & Limits</span>
          </button>

          <button
            onClick={() => setActiveTab('slack')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'slack'
                ? 'border-brand-500 text-white bg-brand-500/10'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#12151F]'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-[#E01E5A]" />
            <span>Slack Alerts</span>
          </button>

          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'queue'
                ? 'border-brand-500 text-white bg-brand-500/10'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#12151F]'
            }`}
          >
            <Layers className="w-4 h-4 text-brand-400" />
            <span>BullMQ Live Queue</span>
          </button>
        </div>

        {/* Tab Panels */}
        {activeTab === 'scheduled' && (
          <ScheduledEmailTable
            emails={scheduledEmails}
            loading={loadingScheduled}
            total={scheduledTotal}
            page={scheduledPage}
            totalPages={scheduledTotalPages}
            onPageChange={(p) => loadScheduled(p)}
            onRefresh={refreshAll}
            onOpenCompose={() => setIsComposeOpen(true)}
          />
        )}

        {activeTab === 'sent' && (
          <SentEmailTable
            emails={sentEmails}
            loading={loadingSent}
            total={sentTotal}
            page={sentPage}
            totalPages={sentTotalPages}
            onPageChange={(p) => loadSent(p)}
            onRefresh={refreshAll}
          />
        )}

        {activeTab === 'senders' && <SendersView />}

        {activeTab === 'slack' && <SlackIntegrationCard />}

        {activeTab === 'queue' && (
          <div className="bg-[#12151F] border border-[#1F2433] rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-5 border-b border-[#1F2433]">
              <div>
                <h3 className="text-base font-bold text-white">BullMQ Engine & Redis Job States</h3>
                <p className="text-xs text-gray-400">Delayed jobs persist in Redis across backend/server restarts</p>
              </div>
              <a
                href="http://localhost:5000/admin/queues"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all"
              >
                <span>Open Bull Board Dashboard</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-4 bg-[#0E1017] border border-[#1F2433] rounded-xl text-center">
                <span className="text-[11px] text-gray-400 uppercase font-semibold">Waiting</span>
                <p className="text-2xl font-bold text-white mt-1">{queueMetrics?.waiting ?? 0}</p>
              </div>
              <div className="p-4 bg-[#0E1017] border border-[#1F2433] rounded-xl text-center">
                <span className="text-[11px] text-gray-400 uppercase font-semibold">Delayed</span>
                <p className="text-2xl font-bold text-amber-400 mt-1">{queueMetrics?.delayed ?? 0}</p>
              </div>
              <div className="p-4 bg-[#0E1017] border border-[#1F2433] rounded-xl text-center">
                <span className="text-[11px] text-gray-400 uppercase font-semibold">Active</span>
                <p className="text-2xl font-bold text-blue-400 mt-1">{queueMetrics?.active ?? 0}</p>
              </div>
              <div className="p-4 bg-[#0E1017] border border-[#1F2433] rounded-xl text-center">
                <span className="text-[11px] text-gray-400 uppercase font-semibold">Completed</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{queueMetrics?.completed ?? 0}</p>
              </div>
              <div className="p-4 bg-[#0E1017] border border-[#1F2433] rounded-xl text-center">
                <span className="text-[11px] text-gray-400 uppercase font-semibold">Failed</span>
                <p className="text-2xl font-bold text-rose-400 mt-1">{queueMetrics?.failed ?? 0}</p>
              </div>
            </div>

            <div className="p-4 bg-[#0E1017] border border-[#1F2433] rounded-xl text-xs text-gray-400 space-y-2">
              <p className="font-semibold text-gray-300">🔄 Demonstrating Server Restart Resilience:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Schedule an email batch for a future time (e.g. 5 minutes from now).</li>
                <li>Stop the backend server process (<code className="text-brand-300 font-mono">Ctrl+C</code>).</li>
                <li>Verify Redis retains all delayed job timers in Redis sorted sets.</li>
                <li>Start the backend again (<code className="text-brand-300 font-mono">npm run dev</code>).</li>
                <li>BullMQ worker automatically reconnects and processes the emails at the scheduled time!</li>
              </ol>
            </div>
          </div>
        )}
      </main>

      {/* Compose Campaign Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          refreshAll();
          setActiveTab('scheduled');
        }}
      />
    </div>
  );
};
