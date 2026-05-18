import React, { ChangeEvent, useState } from 'react';
import type { QRCode, QRCodeColor, CardSuit, ErrorCorrectionLevel, QRCodeType } from '../types';
import { generateRandomKey } from '../utils';

interface QRCodesManagerProps {
  qrcodes: QRCode[];
  onQRCodesChange: (newQRCodes: QRCode[]) => void;
  onAdd: () => void;
  baseUrl: string;
  deckId?: string;
  errorCorrectionLevel: ErrorCorrectionLevel;
}

const UTILITY_TYPES: QRCodeType[] = ['promo_video', 'sponsor', 'instructions', 'game_activator'];

const InfoTooltip = ({ text }: { text: string }) => (
  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '6px' }} className="group">
    <span
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '16px', height: '16px',
        background: '#1A1A1A', color: '#FFE500',
        fontSize: '10px', fontWeight: 900, cursor: 'help',
        border: '1px solid #1A1A1A',
      }}
    >?</span>
    <div
      className="group-hover:opacity-100"
      style={{
        position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
        background: '#FFE500', border: '2px solid #1A1A1A', boxShadow: '3px 3px 0 #1A1A1A',
        padding: '6px 10px', fontSize: '12px', fontWeight: 600, color: '#1A1A1A',
        whiteSpace: 'nowrap', maxWidth: '240px', zIndex: 20,
        opacity: 0, pointerEvents: 'none', transition: 'opacity 0.15s',
      }}
    >{text}</div>
  </div>
);

const colorAccents: Record<QRCodeColor, { bg: string; textDark: boolean }> = {
  yellow:  { bg: '#FFE500', textDark: true },
  green:   { bg: '#00D4AA', textDark: true },
  blue:    { bg: '#4361EE', textDark: false },
  magenta: { bg: '#FF4F6D', textDark: false },
};

const suitSymbols: Record<CardSuit, string> = {
  Hearts: '♥', Diamonds: '♦', Clubs: '♣', Spades: '♠',
};

const typeHeaderAccent: Record<string, string> = {
  game_card:      '#2E2E2E',
  power_up:       '#C8B6FF',
  promo_video:    '#00D4AA',
  sponsor:        '#FF9F1C',
  instructions:   '#B8D8F8',
  game_activator: '#FF4F6D',
};

const QRCodeItem: React.FC<{
  item: QRCode;
  index: number;
  typeIndex: number;
  onUpdate: (index: number, item: QRCode) => void;
  onDelete: (index: number) => void;
  baseUrl: string;
  deckId?: string;
  errorCorrectionLevel: ErrorCorrectionLevel;
}> = ({ item, index, typeIndex, onUpdate, onDelete, baseUrl, deckId, errorCorrectionLevel }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copyText, setCopyText] = useState('Copy URL');

  const isUtilityType = UTILITY_TYPES.includes(item.type);
  const accent = typeHeaderAccent[item.type] ?? '#FFE500';
  const colorInfo = item.color ? colorAccents[item.color] : null;

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onUpdate(index, { ...item, [e.target.name]: e.target.value });
  };

  const regenerateKey = () => {
    onUpdate(index, { ...item, key: generateRandomKey() });
  };

  const fullUrl = `${baseUrl}${item.pathId || ''}${deckId || ''}${item.key || ''}`;
  const qrApiUrl = (size: number) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(fullUrl)}&ecc=${errorCorrectionLevel}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl).then(
      () => { setCopyText('Copied!'); setTimeout(() => setCopyText('Copy URL'), 2000); },
      () => { setCopyText('Failed');  setTimeout(() => setCopyText('Copy URL'), 2000); },
    );
  };

  const handleDownload = async () => {
    const url = qrApiUrl(512);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network error');
      const blob = await response.blob();
      const dl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dl; a.download = `${item.id}.png`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(dl);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <>
      <div style={{ background: '#FFFFFF', border: '2px solid #1A1A1A', boxShadow: '4px 4px 0 #1A1A1A', marginBottom: '0' }}>

        {/* ── Header bar ── */}
        <div
          style={{
            background: accent,
            borderBottom: '2px solid #1A1A1A',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {/* Letter badge */}
          {item.type === 'game_card' && colorInfo && (
            <div
              style={{
                width: '40px', height: '40px', flexShrink: 0,
                background: colorInfo.bg,
                border: '2px solid #1A1A1A',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: '1.1rem', color: '#1A1A1A',
              }}
            >{item.letter ?? '?'}</div>
          )}

          {/* Card identity */}
          {item.type === 'game_card' && (
            <>
              <div style={{ flexGrow: 1 }}>
                {item.rank && item.suit ? (
                  <span style={{ fontWeight: 900, fontSize: '1.3rem', color: '#FFFFFF' }}>
                    {item.rank}{' '}
                    <span style={{ color: item.card_color === 'red' ? '#FF6B6B' : '#FFFFFF' }}>
                      {suitSymbols[item.suit]}
                    </span>
                  </span>
                ) : (
                  <span style={{ fontWeight: 900, fontSize: '1.3rem', color: '#FFFFFF' }}>
                    {item.letter ?? item.id}
                  </span>
                )}
                {item.color && (
                  <span style={{
                    display: 'inline-block', marginLeft: '10px',
                    background: colorAccents[item.color].bg,
                    border: '2px solid #1A1A1A',
                    fontWeight: 900, fontSize: '0.6rem',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    padding: '1px 7px', color: '#1A1A1A', verticalAlign: 'middle',
                  }}>{item.color}</span>
                )}
              </div>
              {/* Stars */}
              <div style={{ display: 'flex', gap: '2px' }}>
                {[...Array(5)].map((_, i) => (
                  <svg key={i} xmlns="http://www.w3.org/2000/svg"
                    style={{ width: '16px', height: '16px', color: '#FFE500', opacity: i < (item.stars ?? 0) ? 1 : 0.25 }}
                    viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span style={{ background: '#FFE500', color: '#1A1A1A', fontWeight: 900, fontSize: '0.7rem', padding: '2px 8px', letterSpacing: '0.04em' }}>
                #{item.number}
              </span>
            </>
          )}

          {item.type === 'power_up' && (
            <>
              <div style={{ width: '40px', height: '40px', flexShrink: 0, background: '#FFFFFF', border: '2px solid #1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '22px', height: '22px', color: '#6C63FF' }} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
              </div>
              <span style={{ fontWeight: 900, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1A1A1A', flexGrow: 1 }}>Power Up {typeIndex + 1}</span>
              {item.card_color && (
                <span style={{ background: '#1A1A1A', color: '#fff', fontWeight: 800, fontSize: '0.65rem', padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {item.card_color}
                </span>
              )}
            </>
          )}

          {isUtilityType && (
            <>
              <div style={{ width: '40px', height: '40px', flexShrink: 0, background: '#FFFFFF', border: '2px solid #1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '22px', height: '22px', color: '#1A1A1A' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <span style={{ fontWeight: 900, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1A1A1A' }}>
                {item.type.replace(/_/g, ' ')} {typeIndex + 1}
              </span>
            </>
          )}
        </div>

        {/* ── Fields ── */}
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="label-brutal">ID</span>
                <InfoTooltip text="A unique identifier for this QR code." />
              </div>
              <input type="text" name="id" value={item.id} onChange={handleChange} className="input-brutal" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="label-brutal">Type</span>
                <InfoTooltip text="Determines the function of this QR code." />
              </div>
              <select name="type" value={item.type} onChange={handleChange} className="input-brutal" style={{ appearance: 'auto' }}>
                <option value="game_card">Game Card</option>
                <option value="power_up">Power Up</option>
                <option value="promo_video">Promo Video</option>
                <option value="sponsor">Sponsor</option>
                <option value="instructions">Instructions</option>
                <option value="game_activator">Game Activator</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'end', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="label-brutal">Path ID</span>
                <InfoTooltip text="First random URL segment (6 chars)." />
              </div>
              <input type="text" name="pathId" value={item.pathId || ''} onChange={handleChange} className="input-brutal" style={{ fontFamily: 'Space Mono, monospace' }} maxLength={6} />
            </div>
            <button
              onClick={regenerateKey}
              className="btn-brutal-sm"
              title="Regenerate Key"
              style={{ width: '36px', height: '36px', background: '#FFE500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', color: '#1A1A1A' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 4l1.5 1.5A9 9 0 0120.5 15M20 20l-1.5-1.5A9 9 0 003.5 9" />
              </svg>
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="label-brutal">Key</span>
                <InfoTooltip text="Secret key used for validation." />
              </div>
              <input type="text" name="key" value={item.key || ''} onChange={handleChange} className="input-brutal" style={{ fontFamily: 'Space Mono, monospace' }} />
            </div>
          </div>

          <div>
            <span className="label-brutal">Full URL</span>
            <input
              type="text" readOnly value={fullUrl}
              className="input-brutal"
              style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', opacity: 0.75, cursor: 'text' }}
            />
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '0 1rem 1rem' }}>
          <button onClick={handleCopy} className="btn-brutal-sm" style={{ padding: '6px 14px', background: '#F0EDE6', color: '#1A1A1A', fontSize: '0.8rem' }}>
            {copyText}
          </button>
          <button onClick={() => setIsModalOpen(true)} className="btn-brutal-sm" style={{ padding: '6px 14px', background: '#4361EE', color: '#FFFFFF', fontSize: '0.8rem' }}>
            View QR
          </button>
          <button onClick={() => onDelete(index)} className="btn-brutal-sm" style={{ padding: '6px 14px', background: '#FF4F6D', color: '#FFFFFF', fontSize: '0.8rem' }}>
            Delete
          </button>
        </div>
      </div>

      {/* ── QR Modal ── */}
      {isModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{ background: '#FFFBF0', border: '2px solid #1A1A1A', boxShadow: '8px 8px 0 #1A1A1A', padding: '1.5rem', maxWidth: '360px', width: '100%', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: '#FFE500', border: '2px solid #1A1A1A', padding: '6px 14px', display: 'inline-block', marginBottom: '12px' }}>
              <span style={{ fontWeight: 900, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.id}</span>
            </div>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#4A4A4A', marginBottom: '1rem', wordBreak: 'break-all' }}>{fullUrl}</p>
            <div style={{ background: '#FFFFFF', border: '2px solid #1A1A1A', padding: '8px', display: 'inline-block' }}>
              <img src={qrApiUrl(256)} alt={`QR Code for ${item.id}`} style={{ width: '256px', height: '256px', display: 'block' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '1.25rem' }}>
              <button onClick={handleDownload} className="btn-brutal" style={{ padding: '8px 20px', background: '#00D4AA', color: '#1A1A1A', fontSize: '0.85rem' }}>
                Download
              </button>
              <button onClick={() => setIsModalOpen(false)} className="btn-brutal" style={{ padding: '8px 20px', background: '#F0EDE6', color: '#1A1A1A', fontSize: '0.85rem' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const QRCodesManager: React.FC<QRCodesManagerProps> = ({
  qrcodes, onQRCodesChange, onAdd, baseUrl, deckId, errorCorrectionLevel,
}) => {
  const handleUpdate = (index: number, item: QRCode) => {
    const updated = [...qrcodes];
    updated[index] = item;
    onQRCodesChange(updated);
  };

  const handleDelete = (index: number) => {
    onQRCodesChange(qrcodes.filter((_, i) => i !== index));
  };

  return (
    <div>
      {qrcodes.length === 0 && (
        <div style={{ border: '2px dashed #1A1A1A', padding: '2rem', textAlign: 'center', marginBottom: '1rem', background: '#F5F0E8' }}>
          <p style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.85rem', color: '#4A4A4A' }}>No QR codes yet</p>
          <p style={{ fontSize: '0.8rem', color: '#7A7A7A', marginTop: '4px' }}>Add one below to get started</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {(() => {
          const typeCounters: Record<string, number> = {};
          return qrcodes.map((qr, index) => {
            const t = qr.type;
            typeCounters[t] = (typeCounters[t] ?? 0);
            const typeIndex = typeCounters[t];
            typeCounters[t]++;
            return (
              <QRCodeItem
                key={index} item={qr} index={index} typeIndex={typeIndex}
                onUpdate={handleUpdate} onDelete={handleDelete}
                baseUrl={baseUrl} deckId={deckId} errorCorrectionLevel={errorCorrectionLevel}
              />
            );
          });
        })()}
      </div>

      <button
        onClick={onAdd}
        className="btn-brutal"
        style={{ marginTop: '1rem', padding: '10px 20px', background: '#FFE500', color: '#1A1A1A', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
      >
        <span style={{ fontSize: '1.1rem', lineHeight: 1, fontWeight: 900 }}>+</span> Add QR Code
      </button>
    </div>
  );
};

export default QRCodesManager;
