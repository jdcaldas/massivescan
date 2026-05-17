
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
        <div className="fixed bottom-10 left-0 right-0 bg-brand-surface border-t border-brand-secondary h-64 z-40 flex flex-col shadow-lg">
          <div className="flex items-center justify-between px-4 py-2 border-b border-brand-secondary/50">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-brand-subtle">
              Session Logs
            </span>
            <span className="text-[10px] font-mono text-brand-subtle/50">{logs.length} entries</span>
          </div>
          <div className="flex-grow overflow-auto p-4 font-mono text-xs text-brand-text/80">
            {logs.length === 0 ? (
              <span className="text-brand-subtle/50 italic">No interactions recorded yet.</span>
            ) : (
              <pre className="whitespace-pre-wrap break-all text-[11px] leading-relaxed">
                {JSON.stringify(logs, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 h-10 bg-brand-surface border-t border-brand-secondary flex items-center justify-between px-5 z-50">

        <div className="flex items-center gap-5">
          <select
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value)}
            disabled={!isIdle}
            className="bg-transparent text-xs text-brand-subtle outline-none cursor-pointer disabled:opacity-40 hover:text-brand-text transition-colors"
            title="AI Model"
          >
            {availableModels.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${!isIdle ? 'bg-emerald-400 animate-pulse' : 'bg-brand-secondary'}`} />
            <span className="text-xs font-mono text-brand-subtle">
              {isIdle ? 'Ready' : activeModel}
            </span>
          </div>

          {turnCount > 0 && (
            <span className="text-xs font-mono text-brand-subtle/50 hidden sm:inline">
              {turnCount} {turnCount === 1 ? 'call' : 'calls'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleExportLogs}
            className="p-2 text-brand-subtle hover:text-brand-text rounded transition-colors"
            title="Export Logs"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-brand-subtle hover:text-brand-text rounded transition-colors"
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
