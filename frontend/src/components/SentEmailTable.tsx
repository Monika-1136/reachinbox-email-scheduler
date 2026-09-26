import React from 'react';
import { ScheduledEmail } from '../types';
import {
  Send,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SentEmailTableProps {
  emails: ScheduledEmail[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
}

export const SentEmailTable: React.FC<SentEmailTableProps> = ({
  emails,
  loading,
  total,
  page,
  totalPages,
  onPageChange,
}) => {
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
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
          <Send className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">No Delivered Emails Yet</h3>
        <p className="text-xs text-gray-400 max-w-sm mx-auto">
          As BullMQ workers process scheduled jobs, sent emails and live Ethereal inbox preview links will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#12151F] border border-[#1F2433] rounded-2xl overflow-hidden shadow-xl shadow-black/20">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#1F2433] bg-[#0E1017]/80 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              <th className="py-3.5 px-5">Recipient</th>
              <th className="py-3.5 px-4">Subject</th>
              <th className="py-3.5 px-4">Delivered Time</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-5 text-right">Ethereal SMTP Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F2433]/60 text-xs">
            {emails.map((email) => {
              const isSent = email.status === 'SENT';
              return (
                <tr key={email.id} className="hover:bg-[#1A1E2C]/70 transition-colors">
                  <td className="py-3.5 px-5">
                    <div className="font-semibold text-gray-200">{email.recipientEmail}</div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      Message ID: {email.messageId ? email.messageId.slice(0, 20) + '...' : 'N/A'}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-gray-300 max-w-xs truncate">{email.subject}</div>
                    {email.errorMessage && (
                      <div className="text-[11px] text-rose-400 flex items-center gap-1 mt-0.5">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-xs">{email.errorMessage}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-gray-300">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      <span>
                        {email.sentAt
                          ? new Date(email.sentAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        isSent
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}
                    >
                      {isSent ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {email.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    {email.etherealUrl ? (
                      <a
                        href={email.etherealUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 hover:text-brand-300 border border-brand-500/20 rounded-xl text-xs font-medium transition-colors"
                      >
                        <span>View in Ethereal</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-gray-500 text-xs italic">No preview URL</span>
                    )}
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
            <span className="font-semibold text-gray-200">{total}</span> delivered emails
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
