
import React from 'react';
import { DownloadIcon, ChevronUpIcon, ChevronDownIcon } from './icons';
import type { LogEntry } from '../types';

interface TelemetryOverlayProps {
  activeModel: string;
  turnCount: number;
  logs: LogEntry[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  availableModels: { id: string; name: string }[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

const TelemetryOverlay: React.FC<TelemetryOverlayProps> = ({
  activeModel,
  turnCount,
  logs,
  isOpen,
  setIsOpen,
  availableModels,
  selectedModel,
  onSelectModel,
}) => {
  const isIdle = activeModel === 'Idle';

  const handleExportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `telemetry_${new Date().toISOString()}.json`);
    linkElement.click();
  };

  return (
    <>
      {/* Log drawer */}
      {isOpen && (
        <div className="fixed bottom-10 left-0 right-0 bg-black border-t-2 border-brand-primary h-64 z-40 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-brand-primary/30">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-brand-primary">
              Session Logs
            </span>
            <span className="text-[10px] font-mono text-brand-primary/50">{logs.length} entries</span>
          </div>
          <div className="flex-grow overflow-auto p-4 font-mono text-xs text-brand-primary/80">
            {logs.length === 0 ? (
              <span className="text-brand-primary/40 italic">No interactions recorded yet.</span>
            ) : (
              <pre className="whitespace-pre-wrap break-all text-[11px] leading-relaxed">
                {JSON.stringify(logs, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 h-10 bg-black border-t-2 border-[#6EE7B7] flex items-center justify-between px-5 z-50">

        <div className="flex items-center gap-5">
          <select
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value)}
            disabled={!isIdle}
            className="bg-transparent text-xs font-bold text-[#6EE7B7] outline-none cursor-pointer disabled:opacity-40 hover:text-white transition-colors"
            title="AI Model"
          >
            {availableModels.map(m => (
              <option key={m.id} value={m.id} className="bg-black text-white">{m.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${!isIdle ? 'bg-[#6EE7B7] animate-pulse' : 'bg-[#6EE7B7]/40'}`} />
            <span className="text-xs font-mono font-bold text-white">
              {isIdle ? 'Ready' : activeModel}
            </span>
          </div>

          {turnCount > 0 && (
            <span className="text-xs font-mono text-white/40 hidden sm:inline">
              {turnCount} {turnCount === 1 ? 'call' : 'calls'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleExportLogs}
            className="p-2 text-white/50 hover:text-white transition-colors"
            title="Export Logs"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white/60 hover:text-white transition-colors"
          >
            {isOpen ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronUpIcon className="w-3.5 h-3.5" />}
            <span>Logs</span>
          </button>
        </div>

      </div>
    </>
  );
};

export default TelemetryOverlay;
