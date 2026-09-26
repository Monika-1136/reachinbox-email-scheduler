import React, { useState } from 'react';
import { ScheduledEmail } from '../types';
import { emailsApi } from '../services/api';
import {
  Clock,
  Trash2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface ScheduledEmailTableProps {
  emails: ScheduledEmail[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onOpenCompose: () => void;
}

export const ScheduledEmailTable: React.FC<ScheduledEmailTableProps> = ({
  emails,
  loading,
  total,
  page,
  totalPages,
  onPageChange,
  onRefresh,
  onOpenCompose,
}) => {
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled email job?')) return;
    setCancelingId(id);
    try {
      await emailsApi.cancel(id);
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel email');
    } finally {
      setCancelingId(null);
    }
  };

  const formatScheduledTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = Date.now();
    const diffMs = d.getTime() - now;

    const formattedDate = d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    if (diffMs <= 0) {
      return { text: formattedDate, badge: 'Due now / Processing', color: 'text-amber-400' };
    }

    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) {
      return { text: formattedDate, badge: `in ${diffSec}s`, color: 'text-brand-400' };
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      return { text: formattedDate, badge: `in ${diffMin}m ${diffSec % 60}s`, color: 'text-brand-400' };
    }
    const diffHours = Math.floor(diffMin / 60);
    return { text: formattedDate, badge: `in ${diffHours}h ${diffMin % 60}m`, color: 'text-gray-400' };
  };

  if (loading && emails.length === 0) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-[#12151F] border border-[#1F2433] rounded-xl animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="p-12 text-center bg-[#12151F] border border-[#1F2433] rounded-2xl">
        <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto mb-3">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">No Scheduled Emails in Queue</h3>
        <p className="text-xs text-gray-400 max-w-sm mx-auto mb-5">
          BullMQ delayed queue is currently idle. Schedule a single email or batch upload leads via CSV.
        </p>
        <button
          onClick={onOpenCompose}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-brand-600/20 transition-all"
        >
          <Sparkles className="w-4 h-4" />
          <span>Schedule Emails Now</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#12151F] border border-[#1F2433] rounded-2xl overflow-hidden shadow-xl shadow-black/20">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#1F2433] bg-[#0E1017]/80 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              <th className="py-3.5 px-5">Recipient Lead</th>
              <th className="py-3.5 px-4">Subject</th>
              <th className="py-3.5 px-4">Sender</th>
              <th className="py-3.5 px-4">Scheduled Execution</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F2433]/60 text-xs">
            {emails.map((email) => {
              const timeInfo = formatScheduledTime(email.scheduledAt);
              return (
                <tr key={email.id} className="hover:bg-[#1A1E2C]/70 transition-colors group">
                  <td className="py-3.5 px-5">
                    <div className="font-semibold text-gray-200">{email.recipientEmail}</div>
                    <div className="text-[10px] text-gray-500 font-mono">ID: {email.id.slice(0, 8)}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-gray-300 max-w-xs truncate">{email.subject}</div>
                  </td>
                  <td className="py-3.5 px-4 text-gray-400">
                    <span className="text-xs">{email.sender?.displayName || email.sender?.email || 'Default'}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      <span>{timeInfo.text}</span>
                    </div>
                    <span className={`text-[10px] font-mono font-medium ${timeInfo.color}`}>{timeInfo.badge}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        email.status === 'PROCESSING'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {email.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <button
                      onClick={() => handleCancel(email.id)}
                      disabled={cancelingId === email.id}
                      title="Cancel and remove from BullMQ queue"
                      className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors opacity-80 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-[#1F2433] bg-[#0E1017]/40 flex items-center justify-between text-xs text-gray-400">
          <div>
            Showing <span className="font-semibold text-gray-200">{(page - 1) * 20 + 1}</span> to{' '}
            <span className="font-semibold text-gray-200">{Math.min(page * 20, total)}</span> of{' '}
            <span className="font-semibold text-gray-200">{total}</span> scheduled emails
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-[#1F2433] bg-[#12151F] hover:bg-[#1A1E2C] disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-gray-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-[#1F2433] bg-[#12151F] hover:bg-[#1A1E2C] disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
