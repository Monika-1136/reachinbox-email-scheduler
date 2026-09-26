import React from 'react';
import { EmailStats, QueueMetrics } from '../types';
import { Clock, Send, AlertTriangle, Layers } from 'lucide-react';

interface StatsOverviewProps {
  stats: EmailStats | null;
  queueMetrics: QueueMetrics | null;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, queueMetrics }) => {
  const cards = [
    {
      title: 'Scheduled in Queue',
      value: stats?.scheduled ?? 0,
      description: 'Pending delayed dispatch',
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Successfully Sent',
      value: stats?.sent ?? 0,
      description: 'Delivered via Ethereal SMTP',
      icon: Send,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Delivery Failed',
      value: stats?.failed ?? 0,
      description: 'Exhausted retry attempts',
      icon: AlertTriangle,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
    },
    {
      title: 'BullMQ Active/Delayed',
      value: (queueMetrics?.delayed ?? 0) + (queueMetrics?.active ?? 0) + (queueMetrics?.waiting ?? 0),
      description: `Waiting: ${queueMetrics?.waiting ?? 0} | Delayed: ${queueMetrics?.delayed ?? 0}`,
      icon: Layers,
      color: 'text-brand-400',
      bg: 'bg-brand-500/10 border-brand-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            className="bg-[#12151F] border border-[#1F2433] rounded-2xl p-4.5 hover:border-[#2E354B] transition-all relative overflow-hidden group shadow-lg shadow-black/20"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{card.title}</p>
                <h3 className="text-2xl font-bold text-white mt-1.5">{card.value}</h3>
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${card.bg}`}>
                <Icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
            <p className="text-[11px] text-gray-500 mt-2 font-mono">{card.description}</p>
          </div>
        );
      })}
    </div>
  );
};
