import React, { useState, useRef, useCallback } from 'react';
import { generateImage, IMAGE_MODELS, IMAGE_STYLES, ART_FORMATS, type ArtFormatId } from '../services/imageGenService';

const DEFAULT_PROMPT = 'A majestic knight in golden armour standing on a castle battlement at sunset, dramatic sky, detailed fantasy art.';

type ModelState = 'idle' | 'generating' | 'done' | 'error';

interface ModelResult {
  state: ModelState;
  base64?: string;
  error?: string;
  ms?: number;
}

interface ModelTestPageProps {
  onBack: () => void;
  projectName?: string;
}

const ModelTestPage: React.FC<ModelTestPageProps> = ({ onBack, projectName }) => {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [styleId, setStyleId] = useState(IMAGE_STYLES[0].id);
  const [aspectRatio, setAspectRatio] = useState<ArtFormatId>('3:4');
  const [results, setResults] = useState<Record<string, ModelResult>>({});
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isAnyRunning = Object.values(results).some(r => r.state === 'generating');

  const FORMAT_COLORS: Record<string, string> = {
    '1:1': '#6EE7B7', '3:4': '#FFE500', '16:9': '#7DD3FC',
  };

  const runAll = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // Reset all to generating
    const initial: Record<string, ModelResult> = {};
    IMAGE_MODELS.forEach(m => { initial[m.id] = { state: 'generating' }; });
    setResults(initial);

    // Fire all in parallel
    await Promise.allSettled(IMAGE_MODELS.map(async (model) => {
      const start = Date.now();
      try {
        const base64 = await generateImage(
          prompt.trim() || DEFAULT_PROMPT,
          styleId,
          model.id,
          aspectRatio,
          abortRef.current!.signal,
        );
        setResults(prev => ({
          ...prev,
          [model.id]: { state: 'done', base64, ms: Date.now() - start },
        }));
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          setResults(prev => ({ ...prev, [model.id]: { state: 'idle' } }));
        } else {
          setResults(prev => ({
            ...prev,
            [model.id]: { state: 'error', error: e?.message ?? String(e), ms: Date.now() - start },
          }));
        }
      }
    }));
  }, [prompt, styleId, aspectRatio]);

  const runOne = useCallback(async (modelId: string) => {
    if (!abortRef.current || abortRef.current.signal.aborted) {
      abortRef.current = new AbortController();
    }
    const start = Date.now();
    setResults(prev => ({ ...prev, [modelId]: { state: 'generating' } }));
    try {
      const base64 = await generateImage(
        prompt.trim() || DEFAULT_PROMPT,
        styleId,
        modelId,
        aspectRatio,
        abortRef.current!.signal,
      );
      setResults(prev => ({ ...prev, [modelId]: { state: 'done', base64, ms: Date.now() - start } }));
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setResults(prev => ({ ...prev, [modelId]: { state: 'idle' } }));
      } else {
        setResults(prev => ({ ...prev, [modelId]: { state: 'error', error: e?.message ?? String(e), ms: Date.now() - start } }));
      }
    }
  }, [prompt, styleId, aspectRatio]);

  const handleCancel = () => abortRef.current?.abort();

  const doneCount  = Object.values(results).filter(r => r.state === 'done').length;
  const errorCount = Object.values(results).filter(r => r.state === 'error').length;
  const genCount   = Object.values(results).filter(r => r.state === 'generating').length;

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">

      {/* ── Header ── */}
      <header className="bg-brand-surface border-b-2 border-black sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          {projectName && (
            <>
              <div className="flex-shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-black bg-brand-secondary text-brand-text" style={{ borderRadius: 1 }}>
                {projectName}
              </div>
              <span className="text-black/20 font-light text-lg">/</span>
            </>
          )}
          <button onClick={onBack} className="flex items-center gap-1.5 text-brand-subtle hover:text-brand-text transition-colors group flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span className="text-xs font-black uppercase tracking-widest">Back</span>
          </button>
          <span className="text-black/20 font-light text-lg">/</span>
          <span className="text-xs font-black tracking-widest uppercase text-brand-text">Model Tester</span>
          <div className="ml-auto flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-subtle">
            {genCount > 0 && <span className="text-blue-500">{genCount} running…</span>}
            {doneCount > 0 && <span className="text-emerald-600">{doneCount} done</span>}
            {errorCount > 0 && <span className="text-red-500">{errorCount} failed</span>}
          </div>
        </div>
      </header>

      {/* ── Controls ── */}
      <div className="bg-brand-surface border-b-2 border-black">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-3">

          {/* Prompt */}
          <div className="flex gap-2 items-start">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={2}
              placeholder="Test prompt…"
              className="neo-input flex-1 text-xs bg-brand-bg text-brand-text px-3 py-2 resize-none placeholder:text-brand-subtle/40"
            />
          </div>

          {/* Style + Format + Buttons */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Style toggle */}
            <div className="flex items-stretch border-2 border-black overflow-hidden" style={{ boxShadow: '2px 2px 0 #000' }}>
              {IMAGE_STYLES.map((s, i) => (
                <React.Fragment key={s.id}>
                  {i > 0 && <div className="w-px bg-black" />}
                  <button
                    onClick={() => setStyleId(s.id)}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors whitespace-nowrap ${styleId === s.id ? 'bg-brand-text text-brand-surface' : 'bg-brand-surface text-brand-subtle hover:bg-brand-bg'}`}
                  >{s.label}</button>
                </React.Fragment>
              ))}
            </div>

            {/* Format toggle */}
            <div className="flex items-stretch border-2 border-black overflow-hidden" style={{ boxShadow: '2px 2px 0 #000' }}>
              {ART_FORMATS.map((f, i) => (
                <React.Fragment key={f.id}>
                  {i > 0 && <div className="w-px bg-black" />}
                  <button
                    onClick={() => setAspectRatio(f.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors whitespace-nowrap"
                    style={{ backgroundColor: aspectRatio === f.id ? FORMAT_COLORS[f.id] : undefined, color: aspectRatio === f.id ? '#1A1A1A' : undefined }}
                  >
                    <span className="flex-shrink-0 border-2 border-current" style={{ width: f.id === '1:1' ? 10 : f.id === '3:4' ? 8 : 14, height: f.id === '1:1' ? 10 : f.id === '3:4' ? 11 : 8, borderRadius: 1, opacity: aspectRatio === f.id ? 1 : 0.4 }} />
                    <span className={aspectRatio === f.id ? 'text-[#1A1A1A]' : 'text-brand-subtle'}>{f.label}</span>
                  </button>
                </React.Fragment>
              ))}
            </div>

            <div className="flex-1" />

            {/* Action buttons */}
            {isAnyRunning ? (
              <button
                onClick={handleCancel}
                className="border-2 border-black px-5 py-2 text-xs font-black uppercase tracking-widest text-white"
                style={{ backgroundColor: '#FF4F6D', boxShadow: '3px 3px 0 #000', borderRadius: 1 }}
              >Cancel</button>
            ) : (
              <button
                onClick={runAll}
                className="flex items-center gap-2 border-2 border-black px-5 py-2 text-xs font-black uppercase tracking-widest text-brand-text"
                style={{ backgroundColor: '#6EE7B7', boxShadow: '3px 3px 0 #000', borderRadius: 1 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                </svg>
                Test All {IMAGE_MODELS.length} Models
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Results grid ── */}
      <main className="flex-grow max-w-6xl mx-auto w-full px-6 py-6">
        {Object.keys(results).length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-brand-subtle">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 opacity-30">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            <p className="text-xs font-black uppercase tracking-widest">Hit "Test All Models" to benchmark every engine</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {IMAGE_MODELS.map(model => {
            const r = results[model.id];
            if (!r) return null;
            const isNano = !model.id.startsWith('imagen-');
            return (
              <div key={model.id} className="neo-card bg-brand-surface overflow-hidden flex flex-col">
                {/* Color strip */}
                <div className="h-1 w-full" style={{ backgroundColor: isNano ? '#C4B5FD' : '#FDE68A' }} />

                {/* Model label */}
                <div className="px-3 pt-3 pb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-text truncate">{model.label}</p>
                    <p className="text-[9px] text-brand-subtle/50 font-mono truncate">{model.id}</p>
                  </div>
                  {/* Status badge */}
                  {r.state === 'generating' && (
                    <div className="w-4 h-4 border-2 border-brand-text/20 border-t-brand-text rounded-full animate-spin flex-shrink-0" />
                  )}
                  {r.state === 'done' && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 border border-black/20" style={{ backgroundColor: '#6EE7B7', color: '#1A1A1A', borderRadius: 1 }}>
                      ✓ {r.ms ? `${(r.ms / 1000).toFixed(1)}s` : 'done'}
                    </span>
                  )}
                  {r.state === 'error' && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 border border-black/20" style={{ backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: 1 }}>
                      ✗ {r.ms ? `${(r.ms / 1000).toFixed(1)}s` : 'error'}
                    </span>
                  )}
                </div>

                {/* Image area */}
                <div className="relative bg-brand-bg mx-3 mb-3 border-2 border-black/10 overflow-hidden" style={{ aspectRatio: aspectRatio.replace(':', '/') }}>
                  {r.state === 'generating' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-brand-text/20 border-t-brand-text rounded-full animate-spin" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle">Generating…</span>
                    </div>
                  )}
                  {r.state === 'done' && r.base64 && (
                    <img
                      src={`data:image/jpeg;base64,${r.base64}`}
                      alt={model.label}
                      className="w-full h-full object-cover cursor-zoom-in"
                      onClick={() => setLightbox({ src: `data:image/jpeg;base64,${r.base64!}`, label: model.label })}
                    />
                  )}
                  {r.state === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
                      <span className="text-xs font-black text-red-500">✗ Failed</span>
                      <span className="text-[9px] font-mono text-red-400 leading-relaxed">{r.error}</span>
                      <button
                        onClick={() => runOne(model.id)}
                        className="neo-btn px-2 py-1 text-[9px] font-black bg-brand-text text-brand-surface mt-1"
                        style={{ boxShadow: '1px 1px 0 #000' }}
                      >↺ Retry</button>
                    </div>
                  )}
                  {r.state === 'idle' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <button
                        onClick={() => runOne(model.id)}
                        className="neo-btn px-3 py-1.5 text-[10px] font-black bg-brand-text text-brand-surface"
                        style={{ boxShadow: '2px 2px 0 #000' }}
                      >Generate</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
          onKeyDown={e => e.key === 'Escape' && setLightbox(null)}
          tabIndex={-1}
          ref={el => el?.focus()}
        >
          <div
            className="relative flex flex-col items-center gap-3 max-w-[92vw] max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-3 -right-3 z-10 w-8 h-8 flex items-center justify-center border-2 border-black bg-white text-black font-black text-sm hover:bg-brand-text hover:text-brand-surface transition-colors"
              style={{ boxShadow: '2px 2px 0 0 #000', borderRadius: 1 }}
            >✕</button>

            {/* Image */}
            <img
              src={lightbox.src}
              alt={lightbox.label}
              className="max-w-[88vw] max-h-[82vh] object-contain border-2 border-black"
              style={{ boxShadow: '6px 6px 0 0 #000' }}
            />

            {/* Label */}
            <span className="text-xs font-black uppercase tracking-widest text-white/70">
              {lightbox.label}
            </span>
          </div>
        </div>
      )}

    </div>
  );
};

export default ModelTestPage;
