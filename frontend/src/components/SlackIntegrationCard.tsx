import React, { useState, useEffect } from 'react';
import { SlackStatus } from '../types';
import { slackApi } from '../services/api';
import {
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export const SlackIntegrationCard: React.FC = () => {
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const status = await slackApi.getStatus();
      setSlackStatus(status);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const authUrl = await slackApi.getConnectUrl();
      window.location.href = authUrl;
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Slack OAuth not configured in backend .env');
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Slack rate-limit notifications?')) return;
    setActionLoading(true);
    try {
      await slackApi.disconnect();
      await loadStatus();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to disconnect Slack');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-[#12151F] border border-[#1F2433] rounded-2xl p-6 shadow-xl shadow-black/20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-[#1F2433]">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#4A154B]/20 border border-[#E01E5A]/30 flex items-center justify-center">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
              <path
                d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
                fill="#E01E5A"
              />
              <path
                d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
                fill="#2EB67D"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Slack Workspace Integration</h3>
              {slackStatus?.connected && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">Real-time instant rate limit alerts via official Slack Web API</p>
          </div>
        </div>

        <div>
          {loading ? (
            <div className="w-24 h-8 bg-gray-800 rounded-xl animate-pulse"></div>
          ) : slackStatus?.connected ? (
            <button
              onClick={handleDisconnect}
              disabled={actionLoading}
              className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold rounded-xl transition-colors"
            >
              {actionLoading ? 'Disconnecting...' : 'Disconnect Slack'}
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={actionLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#4A154B] hover:bg-[#611f69] text-white text-xs font-semibold rounded-xl shadow-lg transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Connect Slack Workspace</span>
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Feature Explanations */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 bg-[#0E1017] border border-[#1F2433] rounded-xl space-y-1.5">
          <div className="flex items-center gap-2 text-brand-400 font-semibold">
            <Zap className="w-4 h-4" />
            <span>Automatic Rate-Limit Alerts</span>
          </div>
          <p className="text-gray-400 leading-relaxed">
            When a sender reaches its hourly limit (e.g. 200 emails/hour), ReachInbox sends a live Slack alert detailing sender identity, limit, and automatic BullMQ job rescheduling.
          </p>
        </div>

        <div className="p-4 bg-[#0E1017] border border-[#1F2433] rounded-xl space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Smart Deduplication Engine</span>
          </div>
          <p className="text-gray-400 leading-relaxed">
            Uses Redis atomic key <code className="text-gray-300 font-mono text-[10px]">slack-rate-limit-notified:{'{senderId}'}:{'{hourWindow}'}</code> to guarantee only 1 notification is dispatched per sender per hour window.
          </p>
        </div>
      </div>
    </div>
  );
};
