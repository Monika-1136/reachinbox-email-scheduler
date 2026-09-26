import React, { useState, useEffect, useRef } from 'react';
import { Sender, CsvParseResponse } from '../types';
import { sendersApi, emailsApi } from '../services/api';
import { parseEmailListClient } from '../utils/csvParser';
import {
  X,
  UploadCloud,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Users,
  PlusCircle,
} from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientsText, setRecipientsText] = useState('');
  const [parsedRecipients, setParsedRecipients] = useState<CsvParseResponse | null>(null);

  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [customStartTime, setCustomStartTime] = useState<string>('');
  const [delayMs, setDelayMs] = useState<number>(2000);
  const [hourlyLimit, setHourlyLimit] = useState<number>(200);

  const [showAddSender, setShowAddSender] = useState(false);
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderName, setNewSenderName] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setSubject('');
    setBody('');
    setRecipientsText('');
    setParsedRecipients(null);
    setScheduleMode('now');
    setCustomStartTime('');
    setDelayMs(2000);
    setHourlyLimit(200);
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowAddSender(false);
    setNewSenderEmail('');
    setNewSenderName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
      loadSenders();
      // Default future time if scheduled
      const future = new Date(Date.now() + 5 * 60 * 1000);
      const isoLocal = new Date(future.getTime() - future.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setCustomStartTime(isoLocal);
    }
  }, [isOpen]);

  const loadSenders = async () => {
    try {
      const data = await sendersApi.getSenders();
      setSenders(data);
      if (data.length > 0) {
        setSelectedSenderId(data[0].id);
      }
    } catch {
      // ignore
    }
  };

  // Synchronously parse emails whenever recipients text changes
  useEffect(() => {
    if (!recipientsText.trim()) {
      setParsedRecipients(null);
      return;
    }

    const localResult = parseEmailListClient(recipientsText);
    setParsedRecipients(localResult);
  }, [recipientsText]);

  // Handle CSV/text file drop or upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRecipientsText(content);
    };
    reader.readAsText(file);
  };

  const handleCreateSender = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await sendersApi.createSender({
        email: newSenderEmail,
        displayName: newSenderName,
        hourlyLimit: 200,
      });
      setSenders((prev) => [...prev, created]);
      setSelectedSenderId(created.id);
      setShowAddSender(false);
      setNewSenderEmail('');
      setNewSenderName('');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to add sender');
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedSenderId) {
      setErrorMessage('Please select or create a sender email account');
      return;
    }

    if (!subject.trim()) {
      setErrorMessage('Email subject is required');
      return;
    }

    if (!body.trim()) {
      setErrorMessage('Email body content is required');
      return;
    }

    const currentParsed = parseEmailListClient(recipientsText);
    if (!currentParsed || currentParsed.validEmails.length === 0) {
      setErrorMessage('Please provide at least one valid recipient email address (e.g. name@domain.com)');
      return;
    }

    setIsSubmitting(true);

    try {
      const effectiveStartTime =
        scheduleMode === 'later' && customStartTime ? new Date(customStartTime).toISOString() : new Date().toISOString();

      const res = await emailsApi.schedule({
        senderId: selectedSenderId,
        subject,
        body,
        recipients: currentParsed.validEmails,
        startTime: effectiveStartTime,
        delayMs: Math.max(0, Number(delayMs) || 0),
        hourlyLimit: Math.max(1, Number(hourlyLimit) || 200),
      });

      setSuccessMessage(`Successfully scheduled ${res.totalScheduled} email(s) with BullMQ!`);
      setTimeout(() => {
        resetForm();
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to schedule campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sample CSV filler for testing ease
  const fillSampleCsv = () => {
    setRecipientsText(
      `vvce23cse0208@vvc.ac.in\nmonika300404@gmail.com`
    );
    if (!subject) setSubject('ReachInbox Real Delivery Test');
    if (!body)
      setBody(
        'This is an end-to-end ReachInbox outbound test.\n\nTesting real SMTP email dispatch and exact recipient delivery.'
      );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#12151F] border border-[#1F2433] rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/80 relative">
        {/* Modal Header */}
        <div className="sticky top-0 z-20 bg-[#12151F]/95 backdrop-blur-md px-6 py-4.5 border-b border-[#1F2433] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Schedule New Email Campaign</h2>
              <p className="text-xs text-gray-400">Direct BullMQ outbound email scheduler</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1F2433] rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Sender Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-300">From Sender Account</label>
              <button
                type="button"
                onClick={() => setShowAddSender(!showAddSender)}
                className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                {showAddSender ? 'Cancel' : 'Add New Sender'}
              </button>
            </div>

            {showAddSender ? (
              <div className="p-3.5 bg-[#0E1017] border border-[#1F2433] rounded-xl space-y-3 mb-3">
                <p className="text-xs font-medium text-gray-300">Add New Outbound Sender</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Display Name (e.g. Monika)"
                    value={newSenderName}
                    onChange={(e) => setNewSenderName(e.target.value)}
                    className="bg-[#12151F] border border-[#1F2433] text-xs text-white px-3 py-2 rounded-lg outline-none focus:border-brand-500"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Sender Email (e.g. vvce23cse0208@vvc.ac.in)"
                    value={newSenderEmail}
                    onChange={(e) => setNewSenderEmail(e.target.value)}
                    className="bg-[#12151F] border border-[#1F2433] text-xs text-white px-3 py-2 rounded-lg outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleCreateSender}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white rounded-lg transition-colors"
                  >
                    Save Sender
                  </button>
                </div>
              </div>
            ) : (
              <select
                value={selectedSenderId}
                onChange={(e) => setSelectedSenderId(e.target.value)}
                className="w-full bg-[#0E1017] border border-[#1F2433] text-sm text-gray-200 px-3.5 py-2.5 rounded-xl outline-none focus:border-brand-500"
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName} ({s.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Subject</label>
            <input
              type="text"
              placeholder="e.g. Accelerating outbound pipelines with ReachInbox"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-[#0E1017] border border-[#1F2433] text-sm text-gray-200 px-3.5 py-2.5 rounded-xl outline-none focus:border-brand-500 placeholder-gray-500"
              required
            />
          </div>

          {/* Email Body */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Body</label>
            <textarea
              rows={4}
              placeholder="Write your email content..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-[#0E1017] border border-[#1F2433] text-sm text-gray-200 px-3.5 py-2.5 rounded-xl outline-none focus:border-brand-500 placeholder-gray-500 font-sans"
              required
            />
          </div>

          {/* Recipient Leads (CSV Upload & Paste) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-400" />
                Recipient Leads (CSV, TXT, or Paste)
              </label>
              <button
                type="button"
                onClick={fillSampleCsv}
                className="text-[11px] text-brand-400 hover:text-brand-300 underline font-medium"
              >
                Insert Sample Leads
              </button>
            </div>

            <div className="space-y-2">
              <div className="relative border-2 border-dashed border-[#1F2433] hover:border-brand-500/50 rounded-2xl p-4 text-center transition-colors bg-[#0E1017]">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center gap-1 pointer-events-none">
                  <UploadCloud className="w-7 h-7 text-brand-400" />
                  <p className="text-xs font-medium text-gray-300">
                    Drag & Drop CSV / TXT file here or <span className="text-brand-400 underline">Browse</span>
                  </p>
                  <p className="text-[11px] text-gray-500">Auto-detects emails, cleans duplicates & validates syntax</p>
                </div>
              </div>

              <textarea
                rows={3}
                placeholder="Or paste emails here (one per line, comma or semicolon separated)..."
                value={recipientsText}
                onChange={(e) => setRecipientsText(e.target.value)}
                className="w-full bg-[#0E1017] border border-[#1F2433] text-xs text-gray-300 px-3.5 py-2 rounded-xl outline-none focus:border-brand-500 font-mono"
              />
            </div>

            {/* Live Recipient Badges & Validation Summary */}
            {parsedRecipients && (
              <div className="mt-2.5 p-3 bg-[#0E1017] border border-[#1F2433] rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    {parsedRecipients.validEmails.length} Valid Recipients Detected
                  </span>
                  <div className="flex items-center gap-2 text-gray-400">
                    {parsedRecipients.duplicateCount > 0 && (
                      <span className="text-amber-400">{parsedRecipients.duplicateCount} duplicate filtered</span>
                    )}
                    {parsedRecipients.invalidCount > 0 && (
                      <span className="text-rose-400">{parsedRecipients.invalidCount} malformed filtered</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {parsedRecipients.validEmails.slice(0, 15).map((email, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-brand-500/10 border border-brand-500/20 text-brand-300 text-[11px] rounded-md font-mono"
                    >
                      {email}
                    </span>
                  ))}
                  {parsedRecipients.validEmails.length > 15 && (
                    <span className="px-2 py-0.5 bg-gray-800 text-gray-400 text-[11px] rounded-md">
                      +{parsedRecipients.validEmails.length - 15} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Timing & Rate Limit Controls */}
          <div className="p-4 bg-[#0E1017] border border-[#1F2433] rounded-2xl space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-400" /> Start Timing
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#12151F] rounded-xl border border-[#1F2433]">
                <button
                  type="button"
                  onClick={() => setScheduleMode('now')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    scheduleMode === 'now' ? 'bg-brand-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Send Immediately
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode('later')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    scheduleMode === 'later' ? 'bg-brand-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Schedule for Future
                </button>
              </div>
              {scheduleMode === 'later' && (
                <input
                  type="datetime-local"
                  value={customStartTime}
                  onChange={(e) => setCustomStartTime(e.target.value)}
                  className="w-full mt-3 bg-[#12151F] border border-[#1F2433] text-xs text-white px-3 py-2 rounded-xl outline-none focus:border-brand-500"
                  required
                />
              )}
            </div>

            {/* Delay Between Sends & Hourly Limit */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1F2433]">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Delay Between Sends (ms)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={delayMs}
                  onChange={(e) => setDelayMs(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="e.g. 2000"
                  className="w-full bg-[#12151F] border border-[#1F2433] text-xs text-white px-3 py-2 rounded-xl outline-none focus:border-brand-500 font-mono"
                  required
                />
                <p className="text-[10px] text-gray-500 mt-1">Spreads recipient sends via BullMQ delays</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Hourly Rate Limit
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="e.g. 200"
                  className="w-full bg-[#12151F] border border-[#1F2433] text-xs text-white px-3 py-2 rounded-xl outline-none focus:border-brand-500 font-mono"
                  required
                />
                <p className="text-[10px] text-gray-500 mt-1">Reschedules excess to next hour window</p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Enqueuing BullMQ Jobs...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Schedule Outbound Campaign</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
