import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { emailsApi, queueApi } from '../services/api';
import { ScheduledEmail, QueueMetrics } from '../types';
import {
  Search,
  Plus,
  Layers,
  LogOut,
  ExternalLink,
  Mail,
  Clock,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  onOpenCompose: () => void;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCompose }) => {
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ScheduledEmail[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [queueMetrics, setQueueMetrics] = useState<QueueMetrics | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Poll BullMQ queue metrics
  useEffect(() => {
    const fetchQueueStats = async () => {
      try {
        const stats = await queueApi.getStats();
        setQueueMetrics(stats);
      } catch {
        // ignore
      }
    };
    fetchQueueStats();
    const interval = setInterval(fetchQueueStats, 6000);
    return () => clearInterval(interval);
  }, []);

  // Live search debounced
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await emailsApi.search(searchQuery, undefined, 6);
        setSearchResults(data.emails);
        setShowSearchResults(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside search results dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#0E1017]/90 backdrop-blur-md border-b border-[#1F2433] px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-indigo-400 p-0.5 shadow-lg shadow-brand-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-[#0E1017] rounded-[10px] flex items-center justify-center">
              <Mail className="w-5 h-5 text-brand-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg text-white tracking-tight">ReachInbox</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-brand-500/10 text-brand-400 rounded border border-brand-500/20">
                Scheduler
              </span>
            </div>
            <p className="text-[11px] text-gray-400 hidden sm:block">Distributed BullMQ Outbound Engine</p>
          </div>
        </div>

        {/* Global Elasticsearch Search Bar */}
        <div className="flex-1 max-w-md relative" ref={searchRef}>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by recipient, subject, or content (Elasticsearch)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearchResults(true);
              }}
              className="w-full bg-[#12151F] border border-[#1F2433] focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm text-gray-200 pl-10 pr-4 py-2 rounded-xl placeholder-gray-500 transition-all outline-none"
            />
            {isSearching && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showSearchResults && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-[#12151F] border border-[#1F2433] rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-[#1F2433] flex items-center justify-between text-[11px] text-gray-400">
                <span className="font-medium flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" /> Elasticsearch Results
                </span>
                <span>{searchResults.length} matches</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-[#1F2433]/50">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400">No emails matching query found</div>
                ) : (
                  searchResults.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 hover:bg-[#1A1E2C] transition-colors cursor-pointer text-xs"
                      onClick={() => setShowSearchResults(false)}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-gray-200 truncate">{item.recipientEmail}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            item.status === 'SENT'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : item.status === 'FAILED'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="text-gray-300 font-medium truncate">{item.subject}</p>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(item.sentAt || item.scheduledAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {item.etherealUrl && (
                          <a
                            href={item.etherealUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-400 hover:text-brand-300 underline flex items-center gap-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Preview Ethereal <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Actions & Profile */}
        <div className="flex items-center gap-3">
          {/* BullMQ Dashboard Link */}
          <a
            href="http://localhost:5000/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            title="Open Live BullMQ Queue Dashboard (Bull Board)"
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#12151F] hover:bg-[#1A1E2C] border border-[#1F2433] text-xs text-gray-300 transition-colors"
          >
            <Layers className="w-4 h-4 text-brand-400" />
            <span>BullMQ Dashboard</span>
            {queueMetrics && (
              <span className="px-1.5 py-0.2 bg-brand-500/20 text-brand-300 text-[10px] font-semibold rounded-full">
                {queueMetrics.waiting + queueMetrics.delayed + queueMetrics.active}
              </span>
            )}
            <ExternalLink className="w-3 h-3 text-gray-500" />
          </a>

          {/* Primary Action: Compose Email */}
          <button
            onClick={onOpenCompose}
            id="compose-email-button"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Schedule Email</span>
          </button>

          {/* User Profile Pill & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#1F2433]">
            <img
              src={
                user?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Reach User')}&background=6366f1&color=fff`
              }
              alt={user?.name || 'User'}
              className="w-8 h-8 rounded-full border border-brand-500/30 object-cover"
            />
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold text-gray-200 leading-tight">{user?.name || 'User'}</p>
              <p className="text-[11px] text-gray-400 leading-tight">{user?.email}</p>
            </div>
            <button
              onClick={() => logout()}
              title="Logout"
              className="p-2 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
