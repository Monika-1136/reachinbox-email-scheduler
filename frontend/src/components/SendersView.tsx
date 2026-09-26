import React, { useState, useEffect } from 'react';
import { Sender } from '../types';
import { sendersApi } from '../services/api';
import { Mail, Plus, Trash2 } from 'lucide-react';

export const SendersView: React.FC = () => {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSenders();
  }, []);

  const loadSenders = async () => {
    setLoading(true);
    try {
      const data = await sendersApi.getSenders();
      setSenders(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleAddSender = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await sendersApi.createSender({
        email,
        displayName: name,
        hourlyLimit,
      });
      setName('');
      setEmail('');
      setShowAdd(false);
      await loadSenders();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add sender');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sender?')) return;
    try {
      await sendersApi.deleteSender(id);
      await loadSenders();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete sender');
    }
  };

  return (
    <div className="bg-[#12151F] border border-[#1F2433] rounded-2xl p-6 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between pb-5 border-b border-[#1F2433] mb-5">
        <div>
          <h3 className="text-base font-bold text-white">Configured Sender Inboxes</h3>
          <p className="text-xs text-gray-400">Manage sender identities and atomic Redis hourly rate limits</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-brand-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>{showAdd ? 'Cancel' : 'Add New Sender'}</span>
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAddSender} className="p-4 bg-[#0E1017] border border-[#1F2433] rounded-xl space-y-3 mb-5">
          <p className="text-xs font-bold text-white">Create New Sender Account</p>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Display Name (e.g. Sarah Connor)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#12151F] border border-[#1F2433] text-xs text-white px-3 py-2 rounded-xl outline-none focus:border-brand-500"
              required
            />
            <input
              type="email"
              placeholder="Sender Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#12151F] border border-[#1F2433] text-xs text-white px-3 py-2 rounded-xl outline-none focus:border-brand-500"
              required
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                placeholder="Hourly Limit"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value) || 200)}
                className="w-full bg-[#12151F] border border-[#1F2433] text-xs text-white px-3 py-2 rounded-xl outline-none focus:border-brand-500"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shrink-0 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-[#0E1017] rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {senders.map((s) => (
            <div
              key={s.id}
              className="p-4 bg-[#0E1017] border border-[#1F2433] rounded-xl flex items-center justify-between hover:border-[#2E354B] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{s.displayName}</h4>
                  <p className="text-[11px] text-gray-400 font-mono">{s.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-gray-500 block">Atomic Rate Limit</span>
                  <span className="text-xs font-bold font-mono text-amber-400">{s.hourlyLimit} / hour</span>
                </div>
                {senders.length > 1 && (
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
