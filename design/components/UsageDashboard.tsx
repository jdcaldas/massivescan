
import React, { useState, useEffect } from 'react';
import { loadUsage, type UsageData } from '../services/usageService';
import { XIcon, ChevronDownIcon, ChevronUpIcon } from './icons';

interface UsageDashboardProps {
  onClose: () => void;
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(1)}K`
  : String(n);

function dayTotals(day: UsageData['days'][string]) {
  let calls = 0, tokensIn = 0, tokensOut = 0;
  for (const m of Object.values(day.models)) {
    calls      += m.calls;
    tokensIn   += m.tokensIn;
    tokensOut  += m.tokensOut;
  }
  return { calls, tokensIn, tokensOut };
}

function allTimeTotals(data: UsageData) {
  let calls = 0, tokensIn = 0, tokensOut = 0;
  for (const day of Object.values(data.days)) {
    const t = dayTotals(day);
    calls     += t.calls;
    tokensIn  += t.tokensIn;
    tokensOut += t.tokensOut;
  }
  return { calls, tokensIn, tokensOut };
}

// Short display names for models
const MODEL_SHORT: Record<string, string> = {
  'gemini-2.5-flash':               '2.5 Flash',
  'gemini-2.5-flash-lite-latest':   '2.5 Lite',
  'gemini-3-flash-preview':         '3 Flash',
  'gemini-3-pro-preview':           '3 Pro',
  'gemini-3.1-flash-preview':       '3.1 Flash',
  'gemini-3.1-pro-preview':         '3.1 Pro',
  'gemini-2.5-flash-image':         'Img 2.5F',
  'gemini-3.1-flash-image-preview': 'Img 3.1F',
  'gemini-3-pro-image-preview':     'Img 3P',
  'imagen-4.0-generate-001':        'Img4',
  'imagen-3.0-generate-002':        'Img3',
  'imagen-3.0-fast-generate-001':   'Img3 Fast',
};
const shortName = (id: string) => MODEL_SHORT[id] ?? id.split('-').slice(0, 2).join('-');

const UsageDashboard: React.FC<UsageDashboardProps> = ({ onClose }) => {
  const [data, setData] = useState<UsageData | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadUsage().then(setData);
  }, []);

  const toggleDay = (date: string) =>
    setExpandedDays(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });

  const days = data ? Object.keys(data.days).sort((a, b) => b.localeCompare(a)) : [];
  const totals = data ? allTimeTotals(data) : null;

  // All models that appear in ANY day
  const allModels = data
    ? [...new Set(days.flatMap(d => Object.keys(data!.days[d].models)))]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="neo-card bg-brand-surface w-full max-w-4xl mt-8 mb-8" style={{ boxShadow: '6px 6px 0 0 #000' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black dark:border-brand-primary">
          <div>
            <h2 className="text-base font-black uppercase tracking-widest text-brand-text">API Usage</h2>
            <p className="text-[10px] text-brand-subtle mt-0.5">Accumulated by day · archive/massivescan_usage.json</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-brand-subtle hover:text-brand-text hover:bg-brand-bg transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {!data ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-brand-text/20 border-t-brand-text rounded-full animate-spin" />
          </div>
        ) : days.length === 0 ? (
          <div className="py-16 text-center text-brand-subtle text-sm">
            No usage data yet. Make some API calls first.
          </div>
        ) : (
          <div className="px-6 py-4 space-y-4">

            {/* All-time summary */}
            <div className="neo-card bg-brand-bg border-brand-text flex items-center gap-6 px-5 py-4" style={{ boxShadow: '3px 3px 0 0 #000' }}>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-brand-subtle">All Time</p>
                <p className="text-2xl font-black text-brand-text leading-none mt-0.5">{fmt(totals!.calls)}</p>
                <p className="text-[9px] text-brand-subtle mt-0.5">total calls</p>
              </div>
              <div className="w-px h-10 bg-black/20 dark:bg-brand-primary/30" />
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-brand-subtle">Tokens In</p>
                <p className="text-2xl font-black text-brand-text leading-none mt-0.5">{fmt(totals!.tokensIn)}</p>
              </div>
              <div className="w-px h-10 bg-black/20 dark:bg-brand-primary/30" />
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-brand-subtle">Tokens Out</p>
                <p className="text-2xl font-black text-brand-text leading-none mt-0.5">{fmt(totals!.tokensOut)}</p>
              </div>
              <div className="w-px h-10 bg-black/20 dark:bg-brand-primary/30" />
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-brand-subtle">Days</p>
                <p className="text-2xl font-black text-brand-text leading-none mt-0.5">{days.length}</p>
              </div>
            </div>

            {/* Day rows */}
            <div className="space-y-2">
              {days.map(date => {
                const day = data.days[date];
                const t = dayTotals(day);
                const isExpanded = expandedDays.has(date);
                const models = Object.entries(day.models).sort((a, b) => b[1].calls - a[1].calls);

                return (
                  <div key={date} className="border-2 border-black dark:border-brand-primary overflow-hidden" style={{ borderRadius: 1 }}>
                    {/* Day header row */}
                    <button
                      onClick={() => toggleDay(date)}
                      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-brand-bg transition-colors text-left"
                    >
                      <span className="font-black text-sm text-brand-text flex-shrink-0 w-28">{date}</span>

                      {/* Mini model pills */}
                      <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
                        {models.map(([modelId, usage]) => (
                          <span
                            key={modelId}
                            className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide border border-black/30 dark:border-brand-primary/30 bg-brand-secondary text-brand-text flex-shrink-0"
                            style={{ borderRadius: 1 }}
                            title={modelId}
                          >
                            {shortName(modelId)} · {usage.calls}
                          </span>
                        ))}
                      </div>

                      {/* Day totals */}
                      <div className="flex items-center gap-4 flex-shrink-0 text-right">
                        <div>
                          <p className="text-xs font-black text-brand-text">{t.calls}</p>
                          <p className="text-[8px] text-brand-subtle uppercase tracking-wide">calls</p>
                        </div>
                        <div>
                          <p className="text-xs font-black text-brand-text">{fmt(t.tokensIn)}</p>
                          <p className="text-[8px] text-brand-subtle uppercase tracking-wide">in</p>
                        </div>
                        <div>
                          <p className="text-xs font-black text-brand-text">{fmt(t.tokensOut)}</p>
                          <p className="text-[8px] text-brand-subtle uppercase tracking-wide">out</p>
                        </div>
                        {isExpanded
                          ? <ChevronUpIcon className="w-3.5 h-3.5 text-brand-subtle flex-shrink-0" />
                          : <ChevronDownIcon className="w-3.5 h-3.5 text-brand-subtle flex-shrink-0" />}
                      </div>
                    </button>

                    {/* Expanded per-model table */}
                    {isExpanded && (
                      <div className="border-t-2 border-black/10 dark:border-brand-primary/20 bg-brand-bg">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-black/10 dark:border-brand-primary/20">
                              <th className="text-left px-4 py-2 text-[9px] font-black uppercase tracking-widest text-brand-subtle">Model</th>
                              <th className="text-right px-4 py-2 text-[9px] font-black uppercase tracking-widest text-brand-subtle">Calls</th>
                              <th className="text-right px-4 py-2 text-[9px] font-black uppercase tracking-widest text-brand-subtle">Tokens In</th>
                              <th className="text-right px-4 py-2 text-[9px] font-black uppercase tracking-widest text-brand-subtle">Tokens Out</th>
                              <th className="text-right px-4 py-2 text-[9px] font-black uppercase tracking-widest text-brand-subtle">Total Tokens</th>
                            </tr>
                          </thead>
                          <tbody>
                            {models.map(([modelId, usage]) => (
                              <tr key={modelId} className="border-b border-black/5 dark:border-brand-primary/10 hover:bg-brand-secondary/20 transition-colors">
                                <td className="px-4 py-2.5">
                                  <span className="font-black text-brand-text">{shortName(modelId)}</span>
                                  <span className="ml-2 text-[9px] text-brand-subtle font-mono">{modelId}</span>
                                </td>
                                <td className="text-right px-4 py-2.5 font-black text-brand-text tabular-nums">{usage.calls}</td>
                                <td className="text-right px-4 py-2.5 font-mono text-brand-subtle tabular-nums">{usage.tokensIn.toLocaleString()}</td>
                                <td className="text-right px-4 py-2.5 font-mono text-brand-subtle tabular-nums">{usage.tokensOut.toLocaleString()}</td>
                                <td className="text-right px-4 py-2.5 font-mono text-brand-text tabular-nums">
                                  {(usage.tokensIn + usage.tokensOut).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Per-model all-time summary */}
            {allModels.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-brand-subtle mb-2">All-Time by Model</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {allModels
                    .map(modelId => {
                      let calls = 0, tokensIn = 0, tokensOut = 0;
                      for (const day of Object.values(data.days)) {
                        const m = day.models[modelId];
                        if (m) { calls += m.calls; tokensIn += m.tokensIn; tokensOut += m.tokensOut; }
                      }
                      return { modelId, calls, tokensIn, tokensOut };
                    })
                    .sort((a, b) => b.calls - a.calls)
                    .map(({ modelId, calls, tokensIn, tokensOut }) => (
                      <div
                        key={modelId}
                        className="neo-card bg-brand-bg px-3 py-2.5"
                        style={{ boxShadow: '2px 2px 0 0 #000' }}
                      >
                        <p className="text-[9px] font-black uppercase tracking-wide text-brand-text truncate" title={modelId}>
                          {shortName(modelId)}
                        </p>
                        <p className="text-[8px] text-brand-subtle font-mono truncate mt-0.5">{modelId}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-lg font-black text-brand-text leading-none">{fmt(calls)}</p>
                            <p className="text-[8px] text-brand-subtle">calls</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-brand-text">{fmt(tokensIn + tokensOut)}</p>
                            <p className="text-[8px] text-brand-subtle">tokens</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default UsageDashboard;
