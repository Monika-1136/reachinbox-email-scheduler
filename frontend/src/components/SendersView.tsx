import React, { useState, useEffect } from 'react';
import { Sender } from '../types';
import { sendersApi } from '../services/api';
import { Mail, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export const SendersView: React.FC = () => {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<{ [senderId: string]: { loading: boolean; success?: boolean; message?: string } }>({});

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
      });
      setName('');
      setEmail('');
      setShowAdd(false);
      await loadSenders();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add sender');
    }
  };

  const handleTestConnection = async (senderId: string) => {
    setTestStatus((prev) => ({ ...prev, [senderId]: { loading: true } }));
    try {
      const res = await sendersApi.testSender(senderId);
      setTestStatus((prev) => ({
        ...prev,
        [senderId]: { loading: false, success: res.success, message: res.message },
      }));
    } catch (err: any) {
      setTestStatus((prev) => ({
        ...prev,
        [senderId]: {
          loading: false,
          success: false,
          message: err.response?.data?.message || 'Connection test failed',
        },
      }));
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
          <p className="text-xs text-gray-400">Manage sender identities and verify active SMTP transport connectivity</p>
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
              placeholder="Display Name (e.g. Monika)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#12151F] border border-[#1F2433] text-xs text-white px-3 py-2 rounded-xl outline-none focus:border-brand-500"
              required
            />
            <input
              type="email"
              placeholder="Sender Email (e.g. vvce23cse0208@vvc.ac.in)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#12151F] border border-[#1F2433] text-xs text-white px-3 py-2 rounded-xl outline-none focus:border-brand-500"
              required
            />
            <div className="flex items-center justify-end">
              <button
                type="submit"
                className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shrink-0 transition-colors"
              >
                Save Sender
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
          {senders.map((s) => {
            const status = testStatus[s.id];
            return (
              <div
                key={s.id}
                className="p-4 bg-[#0E1017] border border-[#1F2433] rounded-xl flex flex-col justify-between gap-3 hover:border-[#2E354B] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{s.displayName}</h4>
                      <p className="text-[11px] text-gray-400 font-mono">{s.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestConnection(s.id)}
                      disabled={status?.loading}
                      className="px-2.5 py-1 bg-[#1A1E2C] hover:bg-[#252B3E] text-[11px] font-semibold text-brand-400 border border-[#2E354B] rounded-lg transition-all flex items-center gap-1.5"
                    >
                      {status?.loading ? (
                        <RefreshCw className="w-3 h-3 animate-spin text-brand-400" />
                      ) : (
                        <span>Test Connection</span>
                      )}
                    </button>
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

                {status && !status.loading && (
                  <div
                    className={`p-2 rounded-lg text-[11px] flex items-start gap-1.5 ${
                      status.success
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                    }`}
                  >
                    {status.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                    )}
                    <span>{status.message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
