import React, { useState, useEffect } from 'react';
import type { ImageScenario } from '../types';

export type PositionProperty =
  | 'qrCodePosition'
  | 'number_Position'
  | 'boxColorPosition'
  | 'powerPosition'
  | 'letter_Position';

interface PositionModalProps {
  imageScenario: ImageScenario;
  title: string;
  onClose: () => void;
  onSetProperty: (property: PositionProperty, value: string) => void;
}

const TABS: { key: PositionProperty; label: string; bg: string; fg: string }[] = [
  { key: 'qrCodePosition',   label: 'QR Code',   bg: '#1A1A1A', fg: '#6EE7B7' },
  { key: 'number_Position',  label: 'Número',    bg: '#93C5FD', fg: '#1A1A1A' },
  { key: 'boxColorPosition', label: 'Cor Caixa', bg: '#C8B6FF', fg: '#1A1A1A' },
  { key: 'powerPosition',    label: 'Power',     bg: '#FFE500', fg: '#1A1A1A' },
  { key: 'letter_Position',  label: 'Letra',     bg: '#FF4F6D', fg: '#fff'    },
];

const CORNERS = [
  { pos: 'TL', classes: 'top-3 left-3' },
  { pos: 'TR', classes: 'top-3 right-3' },
  { pos: 'BL', classes: 'bottom-3 left-3' },
  { pos: 'BR', classes: 'bottom-3 right-3' },
];

const PositionModal: React.FC<PositionModalProps> = ({
  imageScenario, title, onClose, onSetProperty,
}) => {
  const [activeTab, setActiveTab] = useState<PositionProperty>('qrCodePosition');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const tab = TABS.find(t => t.key === activeTab)!;
  const currentPos: string = (imageScenario[activeTab] as string) || 'none';

  const isPositionTaken = (pos: string) => {
    if (activeTab === 'powerPosition') return false;
    const others = TABS.filter(t => t.key !== activeTab && t.key !== 'powerPosition');
    return others.some(t => (imageScenario[t.key] as string) === pos);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-brand-surface border-2 border-black flex flex-col"
        style={{ boxShadow: '6px 6px 0 #000', maxWidth: 720, width: '100%', maxHeight: '90vh', borderRadius: 1 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-black flex-shrink-0">
          <span className="text-xs font-black uppercase tracking-widest text-brand-text">{title}</span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center border-2 border-black bg-brand-text text-brand-surface font-black text-sm hover:opacity-80 transition-opacity"
            style={{ boxShadow: '2px 2px 0 #555', borderRadius: 1 }}
          >✕</button>
        </div>

        {/* Image + corner buttons */}
        <div className="relative flex-1 min-h-0 overflow-hidden bg-brand-bg">
          {imageScenario.base64Image ? (
            <img
              src={`data:image/jpeg;base64,${imageScenario.base64Image}`}
              alt=""
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-brand-subtle text-xs font-black uppercase tracking-widest">
              No image
            </div>
          )}

          {/* Overlay buttons */}
          <div className="absolute inset-0">
            {activeTab === 'powerPosition' ? (
              <div className="absolute inset-0 flex items-center justify-center gap-4">
                {(['center', 'none'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => onSetProperty('powerPosition', v)}
                    className="border-2 border-black px-8 py-4 text-sm font-black uppercase tracking-widest transition-all"
                    style={{
                      backgroundColor: currentPos === v
                        ? (v === 'center' ? '#FFE500' : '#FF4F6D')
                        : 'rgba(255,255,255,0.25)',
                      color: currentPos === v ? (v === 'center' ? '#1A1A1A' : '#fff') : '#fff',
                      boxShadow: currentPos === v ? '3px 3px 0 #000' : 'none',
                      borderRadius: 1,
                    }}
                  >
                    {v === 'center' ? 'Mostrar Power' : 'Esconder'}
                  </button>
                ))}
              </div>
            ) : (
              <>
                {CORNERS.map(({ pos, classes }) => {
                  const taken = isPositionTaken(pos);
                  const selected = currentPos === pos;
                  return (
                    <button
                      key={pos}
                      onClick={() => !taken && onSetProperty(activeTab, pos)}
                      disabled={taken}
                      className={`absolute ${classes} w-16 h-16 border-2 border-black font-black text-sm transition-all`}
                      style={{
                        backgroundColor: selected ? tab.bg : 'rgba(255,255,255,0.2)',
                        color: selected ? tab.fg : '#fff',
                        boxShadow: selected ? '3px 3px 0 #000' : 'none',
                        opacity: taken ? 0.2 : 1,
                        cursor: taken ? 'not-allowed' : 'pointer',
                        borderRadius: 1,
                      }}
                    >{pos}</button>
                  );
                })}
                {/* Centre "none" button */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <button
                    onClick={() => onSetProperty(activeTab, 'none')}
                    className="pointer-events-auto border-2 border-black px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all"
                    style={{
                      backgroundColor: currentPos === 'none' ? '#FF4F6D' : 'rgba(255,255,255,0.25)',
                      color: '#fff',
                      boxShadow: currentPos === 'none' ? '3px 3px 0 #000' : 'none',
                      borderRadius: 1,
                    }}
                  >
                    Esconder {tab.label}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom panel */}
        <div className="flex-shrink-0 border-t-2 border-black">
          {/* Tab bar */}
          <div className="flex border-b-2 border-black">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className="flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors border-r border-black/20 last:border-r-0"
                style={{
                  backgroundColor: activeTab === t.key ? t.bg : 'transparent',
                  color: activeTab === t.key ? t.fg : undefined,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Summary row */}
          <div className="px-5 py-3 grid grid-cols-5 gap-2 bg-brand-bg">
            {TABS.map(t => {
              const val: string = (imageScenario[t.key] as string) || 'none';
              const set = val && val !== 'none';
              return (
                <div key={t.key} className="text-center">
                  <div className="text-[8px] font-black uppercase tracking-widest text-brand-subtle mb-0.5">{t.label}</div>
                  <div
                    className="text-[10px] font-black px-1.5 py-0.5 inline-block border border-current"
                    style={{ backgroundColor: set ? t.bg : 'transparent', color: set ? t.fg : undefined }}
                  >
                    {!set ? '—' : t.key === 'powerPosition' ? 'Center' : val}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PositionModal;
