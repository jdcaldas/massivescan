
import React, { useState, useEffect } from 'react';
import type { DeckConfig, QRCode, QRCodeColor, ErrorCorrectionLevel, QRCodeType } from './types';
import { generateRandomKey } from './utils';

import Section from './components/Section';
import DeckDetailsForm from './components/DeckDetailsForm';
import QRCodesManager from './components/QRCodesManager';
import { DECK_TYPE_META, TIER_META, GROUP_META, FALLBACK_TYPE_META } from './deckTypeMeta';


const INITIAL_DECK_CONFIG: DeckConfig = {
  "deck_details": {
    "deck_name": "ESSENTIAL PLUS DECK",
    "deck_description": "An enhanced deck with 28 cards + 8 power-ups and unique identifiers (A-Z, *, #) with a strategic star system.",
    "version": 1,
    "baseUrl": "https://www.massivescan.com/qrc/",
    "utilityBaseUrl": "https://www.massivescan.com/util/",
    "deck_id": "0001",
    "errorCorrectionLevel": "Q"
  },
  "qrcodes": []
};

const UTILITY_TYPES:   QRCodeType[] = ['promo_video', 'sponsor', 'instructions'];
const ACTIVATOR_TYPES: QRCodeType[] = ['game_activator'];
// `UTILITY_FORM_TYPES` is the UI-shape bucket used by QRCodesManager
// (utility + activator share the same form layout — no color, no letter).
const UTILITY_FORM_TYPES: QRCodeType[] = [...UTILITY_TYPES, ...ACTIVATOR_TYPES];

const enrichQRCodes = (qrcodes: (Omit<QRCode, 'number' | 'color' | 'letter' | 'stars'> | QRCode)[]): QRCode[] => {
    const colors: Array<QRCodeColor> = ['yellow', 'green', 'blue', 'magenta'];

    const cardQRCodes = qrcodes.filter(qr => qr.type === 'game_card');
    const powerUpQRCodes = qrcodes.filter(qr => qr.type === 'power_up');
    const utilityQRCodes = qrcodes.filter(qr => UTILITY_TYPES.includes(qr.type as QRCodeType));
    const activatorQRCodes = qrcodes.filter(qr => ACTIVATOR_TYPES.includes(qr.type as QRCodeType));

    const numGameCards = cardQRCodes.length;
    const alphabetSize = (numGameCards > 0 && numGameCards % 2 === 0) ? numGameCards / 2 : 26;
    const colorCounters: { [key in QRCodeColor]: number } = { yellow: 0, green: 0, blue: 0, magenta: 0 };

    const enrichedCardQRCodes: QRCode[] = cardQRCodes.map((qr, index) => {
        const number = index + 1;
        const currentColor = colors[index % 4];
        let stars: number;
        let letter: string;

        if (numGameCards === 28) {
            if (index < 26) {
                letter = String.fromCharCode(65 + index);
            } else if (index === 26) {
                letter = '*';
            } else {
                letter = '#';
            }
            colorCounters[currentColor]++;
            const countForColor = colorCounters[currentColor];
            if (countForColor === 1) { stars = 3; }
            else if (countForColor === 2) { stars = 2; }
            else { stars = 1; }
        } else {
            letter = String.fromCharCode(65 + (index % alphabetSize));
            if (number <= 10) stars = 5;
            else if (number <= 20) stars = 4;
            else if (number <= 30) stars = 3;
            else if (number <= 40) stars = 2;
            else if (number <= 50) stars = 1;
            else stars = 0;
        }

        return { ...qr, id: qr.id, pathId: qr.pathId, key: qr.key, type: 'game_card' as const, number, color: currentColor, letter, stars };
    });

    const enrichedPowerUpQRCodes: QRCode[] = powerUpQRCodes.map(qr => {
        const { number, color, letter, stars, ...rest } = qr as QRCode;
        return { ...rest, type: 'power_up' as const, stars: 0 };
    });

    const enrichedUtilityQRCodes: QRCode[] = utilityQRCodes.map(qr => {
        const { number, color, letter, stars, suit, rank, card_color, ...rest } = qr as QRCode;
        const base = { ...rest } as QRCode;
        if (!base.pathId) base.pathId = generateRandomKey(6);
        if (!base.key) base.key = generateRandomKey();
        base.card_color = 'light grey';
        base.stars = 0;
        return base;
    });

    const enrichedActivatorQRCodes: QRCode[] = activatorQRCodes.map(qr => {
        const { number, color, letter, stars, suit, rank, card_color, ...rest } = qr as QRCode;
        const base = { ...rest } as QRCode;
        if (!base.pathId) base.pathId = generateRandomKey(6);
        if (!base.key) base.key = generateRandomKey();
        base.card_color = 'light grey';
        base.stars = 0;
        return base;
    });

    return [...enrichedCardQRCodes, ...enrichedPowerUpQRCodes, ...enrichedUtilityQRCodes, ...enrichedActivatorQRCodes];
};

interface CardsAppProps {
  onBackToLauncher?: () => void;
  projectId: string;
  projectName?: string;
}

const App: React.FC<CardsAppProps> = ({ onBackToLauncher, projectId, projectName }) => {
  const [deckConfig, setDeckConfig] = useState<DeckConfig>(() => {
    const initialDeck = JSON.parse(JSON.stringify(INITIAL_DECK_CONFIG));
    initialDeck.qrcodes = enrichQRCodes(initialDeck.qrcodes);
    return initialDeck;
  });

  const [showPreview, setShowPreview] = useState(false);
  const [saveLabel, setSaveLabel] = useState('Save Deck');
  const [currentFilename, setCurrentFilename] = useState<string>('');
  const [savedFiles, setSavedFiles] = useState<{ name: string; modified: string; deckName: string }[]>([]);
  const [defaultDeck, setDefaultDeck] = useState<string>('');

  const loadSavedFilesList = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/cards/list`);
      const result = await res.json();
      setSavedFiles(result.files ?? []);
    } catch {
      // silently fail — project may have no decks yet
    }
  };

  const persistDefaultDeck = async (filename: string) => {
    try {
      await fetch(`/api/projects/${projectId}/cards/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultDeck: filename }),
      });
    } catch { /* silent */ }
  };

  const handleToggleDefault = (filename: string) => {
    const next = defaultDeck === filename ? '' : filename;
    setDefaultDeck(next);
    persistDefaultDeck(next);
  };

  // On mount: load file list + settings, then auto-load the right deck
  useEffect(() => {
    const init = async () => {
      // 1. Files list
      let files: { name: string; modified: string; deckName: string }[] = [];
      try {
        const r = await fetch(`/api/projects/${projectId}/cards/list`);
        files = (await r.json()).files ?? [];
        setSavedFiles(files);
      } catch { /* silent */ }

      // 2. Persisted default
      let defaultFile = '';
      try {
        const r = await fetch(`/api/projects/${projectId}/cards/settings`);
        defaultFile = (await r.json()).defaultDeck ?? '';
        setDefaultDeck(defaultFile);
      } catch { /* silent */ }

      // 3. Auto-load: 1 file → always load it; multiple → load default if set
      const toLoad =
        files.length === 1
          ? files[0].name
          : files.length > 1 && defaultFile && files.some(f => f.name === defaultFile)
          ? defaultFile
          : '';

      if (!toLoad) return;
      try {
        const r = await fetch(`/api/projects/${projectId}/cards/load?file=${encodeURIComponent(toLoad)}`);
        const result = await r.json();
        if (result.success && result.data) {
          const cfg = result.data;
          if (!cfg.deck_details.baseUrl) cfg.deck_details.baseUrl = 'https://www.massivescan.com/qrc/';
          if (!cfg.deck_details.utilityBaseUrl) cfg.deck_details.utilityBaseUrl = 'https://www.massivescan.com/util/';
          if (!cfg.deck_details.deck_id) cfg.deck_details.deck_id = '0001';
          if (!cfg.deck_details.errorCorrectionLevel) cfg.deck_details.errorCorrectionLevel = 'Q';
          cfg.qrcodes = enrichQRCodes(cfg.qrcodes as any[]);
          setDeckConfig(cfg);
          setCurrentFilename(toLoad);
        }
      } catch { /* silent */ }
    };
    init();
  }, [projectId]);

  const handleDeleteFile = async (filename: string) => {
    if (!window.confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/cards/delete?file=${encodeURIComponent(filename)}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setSavedFiles(prev => prev.filter(f => f.name !== filename));
        if (currentFilename === filename) setCurrentFilename('');
        if (defaultDeck === filename) { setDefaultDeck(''); persistDefaultDeck(''); }
      } else {
        alert('Delete failed.');
      }
    } catch {
      alert('Could not delete file.');
    }
  };

  const handleLoadFile = async (filename: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/cards/load?file=${encodeURIComponent(filename)}`);
      const result = await res.json();
      if (result.success && result.data) {
        const newConfig = result.data;
        if (!newConfig.deck_details.baseUrl) newConfig.deck_details.baseUrl = 'https://www.massivescan.com/qrc/';
        if (!newConfig.deck_details.utilityBaseUrl) newConfig.deck_details.utilityBaseUrl = 'https://www.massivescan.com/util/';
        if (!newConfig.deck_details.deck_id) newConfig.deck_details.deck_id = '0001';
        if (!newConfig.deck_details.errorCorrectionLevel) newConfig.deck_details.errorCorrectionLevel = 'Q';
        newConfig.qrcodes = enrichQRCodes(newConfig.qrcodes as any[]);
        setDeckConfig(newConfig);
        setCurrentFilename(filename);
      } else {
        alert('Failed to load file.');
      }
    } catch {
      alert('Could not load file.');
    }
  };

  const handleSave = async () => {
    const id = deckConfig.deck_details.deck_id || '0001';
    const filename = currentFilename || `${id}_${deckConfig.deck_details.deck_name.replace(/\s+/g, '_')}_config.json`;
    try {
      const res = await fetch(`/api/projects/${projectId}/cards/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, data: deckConfig }),
      });
      const result = await res.json();
      if (result.success) {
        setCurrentFilename(result.file);
        setSaveLabel(`Saved: ${result.file}`);
        setTimeout(() => setSaveLabel('Save Deck'), 3000);
        loadSavedFilesList();
      } else {
        setSaveLabel('Save failed!');
        setTimeout(() => setSaveLabel('Save Deck'), 3000);
      }
    } catch {
      setSaveLabel('Save failed!');
      setTimeout(() => setSaveLabel('Save Deck'), 3000);
    }
  };

  const [openSections, setOpenSections] = useState({
    deckDetails: true,
    deckTechnical: false,
    deckSummary: true,
    qrCodesCards: true,
    qrCodesPowerUps: true,
    qrCodesUtility: true,
    qrCodesActivator: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleNewDeck = () => {
    if (deckConfig.qrcodes.length > 0 && !window.confirm('Start a new deck? Unsaved changes will be lost.')) return;
    const fresh = JSON.parse(JSON.stringify(INITIAL_DECK_CONFIG));
    fresh.qrcodes = enrichQRCodes(fresh.qrcodes);
    setDeckConfig(fresh);
    setCurrentFilename('');
    setSaveLabel('Save Deck');
  };

  const updateDeckConfig = (newConfig: Partial<DeckConfig>) => {
    setDeckConfig(prevConfig => {
      const updated = { ...prevConfig, ...newConfig };
      if (newConfig.qrcodes) updated.qrcodes = enrichQRCodes(newConfig.qrcodes);
      return updated;
    });
  };

  const handleCardQRCodesChange = (newCardQRs: QRCode[]) => {
    const powerUpQRs = deckConfig.qrcodes.filter(qr => qr.type === 'power_up');
    const utilityQRs = deckConfig.qrcodes.filter(qr => UTILITY_TYPES.includes(qr.type));
    const activatorQRs = deckConfig.qrcodes.filter(qr => ACTIVATOR_TYPES.includes(qr.type));
    const newlyTypedPowerUps  = newCardQRs.filter(qr => qr.type === 'power_up');
    const newlyTypedUtility   = newCardQRs.filter(qr => UTILITY_TYPES.includes(qr.type));
    const newlyTypedActivator = newCardQRs.filter(qr => ACTIVATOR_TYPES.includes(qr.type));
    const remainingCardQRs = newCardQRs.filter(qr => qr.type === 'game_card');
    updateDeckConfig({ qrcodes: [...remainingCardQRs, ...powerUpQRs, ...newlyTypedPowerUps, ...utilityQRs, ...newlyTypedUtility, ...activatorQRs, ...newlyTypedActivator] });
  };

  const handlePowerUpQRCodesChange = (newPowerUpQRs: QRCode[]) => {
    const cardQRs = deckConfig.qrcodes.filter(qr => qr.type === 'game_card');
    const utilityQRs = deckConfig.qrcodes.filter(qr => UTILITY_TYPES.includes(qr.type));
    const activatorQRs = deckConfig.qrcodes.filter(qr => ACTIVATOR_TYPES.includes(qr.type));
    const newlyTypedCards     = newPowerUpQRs.filter(qr => qr.type === 'game_card');
    const newlyTypedUtility   = newPowerUpQRs.filter(qr => UTILITY_TYPES.includes(qr.type));
    const newlyTypedActivator = newPowerUpQRs.filter(qr => ACTIVATOR_TYPES.includes(qr.type));
    const remainingPowerUpQRs = newPowerUpQRs.filter(qr => qr.type === 'power_up');
    updateDeckConfig({ qrcodes: [...cardQRs, ...newlyTypedCards, ...remainingPowerUpQRs, ...utilityQRs, ...newlyTypedUtility, ...activatorQRs, ...newlyTypedActivator] });
  };

  const handleUtilityQRCodesChange = (newUtilityQRs: QRCode[]) => {
    const cardQRs = deckConfig.qrcodes.filter(qr => qr.type === 'game_card');
    const powerUpQRs = deckConfig.qrcodes.filter(qr => qr.type === 'power_up');
    const activatorQRs = deckConfig.qrcodes.filter(qr => ACTIVATOR_TYPES.includes(qr.type));
    const newlyTypedCards     = newUtilityQRs.filter(qr => qr.type === 'game_card');
    const newlyTypedPowerUps  = newUtilityQRs.filter(qr => qr.type === 'power_up');
    const newlyTypedActivator = newUtilityQRs.filter(qr => ACTIVATOR_TYPES.includes(qr.type));
    const remainingUtilityQRs = newUtilityQRs.filter(qr => UTILITY_TYPES.includes(qr.type));
    updateDeckConfig({ qrcodes: [...cardQRs, ...newlyTypedCards, ...powerUpQRs, ...newlyTypedPowerUps, ...remainingUtilityQRs, ...activatorQRs, ...newlyTypedActivator] });
  };

  const handleActivatorQRCodesChange = (newActivatorQRs: QRCode[]) => {
    const cardQRs = deckConfig.qrcodes.filter(qr => qr.type === 'game_card');
    const powerUpQRs = deckConfig.qrcodes.filter(qr => qr.type === 'power_up');
    const utilityQRs = deckConfig.qrcodes.filter(qr => UTILITY_TYPES.includes(qr.type));
    const newlyTypedCards    = newActivatorQRs.filter(qr => qr.type === 'game_card');
    const newlyTypedPowerUps = newActivatorQRs.filter(qr => qr.type === 'power_up');
    const newlyTypedUtility  = newActivatorQRs.filter(qr => UTILITY_TYPES.includes(qr.type));
    const remainingActivatorQRs = newActivatorQRs.filter(qr => ACTIVATOR_TYPES.includes(qr.type));
    updateDeckConfig({ qrcodes: [...cardQRs, ...newlyTypedCards, ...powerUpQRs, ...newlyTypedPowerUps, ...utilityQRs, ...newlyTypedUtility, ...remainingActivatorQRs] });
  };

  const addQRCode = (type: QRCode['type']) => {
    const qrcodesOfType = deckConfig.qrcodes.filter(qr => qr.type === type);
    const lastIdNumber = qrcodesOfType.reduce((max, qr) => {
      const match = qr.id.match(/-(\d+)$/);
      if (match) return Math.max(max, parseInt(match[1], 10));
      return max;
    }, 0);
    const newNumber = lastIdNumber + 1;
    const newId = `${type}-${String(newNumber).padStart(3, '0')}`;
    const newQRCode: Partial<QRCode> = { id: newId, pathId: generateRandomKey(6), key: generateRandomKey(), type };
    updateDeckConfig({ qrcodes: [...deckConfig.qrcodes, newQRCode as QRCode] });
  };

  const generateStandardDeck = () => {
    const newQRCodes: Omit<QRCode, 'number' | 'color' | 'letter' | 'stars'>[] = [];
    const suits: Array<QRCode['suit']> = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
    const ranks: Array<QRCode['rank']> = ['Ace', 'King', 'Queen', 'Jack', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    let cardIndex = 0;
    for (const suit of suits) {
      for (const rank of ranks) {
        const card_color = (suit === 'Hearts' || suit === 'Diamonds') ? 'red' : 'black';
        cardIndex++;
        newQRCodes.push({ id: `game_card-${String(cardIndex).padStart(3, '0')}`, pathId: generateRandomKey(6), key: generateRandomKey(), type: 'game_card', suit, rank, card_color });
      }
    }
    newQRCodes.push({ id: 'power_up-001', pathId: generateRandomKey(6), key: generateRandomKey(), type: 'power_up', card_color: 'black' });
    newQRCodes.push({ id: 'power_up-002', pathId: generateRandomKey(6), key: generateRandomKey(), type: 'power_up', card_color: 'red' });
    updateDeckConfig({ deck_details: { ...deckConfig.deck_details, deck_name: "BIG DECK", deck_description: "The complete 54-card experience for traditional games and versatile memory challenges.", version: 1 }, qrcodes: newQRCodes });
  };

  const generateThemeDeck = () => {
    const baseCards = Array.from({ length: 13 }, () => ({ type: 'game_card' as const }));
    const themedCardsRaw = [...baseCards, ...baseCards];
    const themedCards: Omit<QRCode, 'number' | 'color' | 'letter' | 'stars'>[] = themedCardsRaw.map((_, index) => ({
      id: `game_card-${String(index + 1).padStart(3, '0')}`, pathId: generateRandomKey(6), key: generateRandomKey(), type: 'game_card',
    }));
    const powerUps: Omit<QRCode, 'number' | 'color' | 'letter' | 'stars'>[] = [
      { id: 'power_up-001', pathId: generateRandomKey(6), key: generateRandomKey(), type: 'power_up', card_color: 'black' },
      { id: 'power_up-002', pathId: generateRandomKey(6), key: generateRandomKey(), type: 'power_up', card_color: 'red' },
      { id: 'power_up-003', pathId: generateRandomKey(6), key: generateRandomKey(), type: 'power_up', card_color: 'black' },
      { id: 'power_up-004', pathId: generateRandomKey(6), key: generateRandomKey(), type: 'power_up', card_color: 'red' },
    ];
    updateDeckConfig({ deck_details: { ...deckConfig.deck_details, deck_name: "ESSENTIAL DECK", deck_description: "A focused 30-card deck (26 cards + 4 power-ups), perfect for a 13-pair memory game experience.", version: 1 }, qrcodes: [...themedCards, ...powerUps] });
  };

  const generateEssentialPlusDeck = () => {
    const themedCards: Omit<QRCode, 'number' | 'color' | 'letter' | 'stars'>[] = Array.from({ length: 28 }, (_, index) => ({
      id: `game_card-${String(index + 1).padStart(3, '0')}`, pathId: generateRandomKey(6), key: generateRandomKey(), type: 'game_card',
    }));
    const powerUps: Omit<QRCode, 'number' | 'color' | 'letter' | 'stars'>[] = Array.from({ length: 8 }, (_, index) => ({
      id: `power_up-${String(index + 1).padStart(3, '0')}`, pathId: generateRandomKey(6), key: generateRandomKey(), type: 'power_up', card_color: (index < 4) ? 'black' : 'white',
    }));
    const utilityQRCodes: Omit<QRCode, 'number' | 'color' | 'letter' | 'stars'>[] = [
      { id: 'promo_video-001',  pathId: generateRandomKey(6), key: generateRandomKey(), type: 'promo_video' },
      { id: 'sponsor-001',      pathId: generateRandomKey(6), key: generateRandomKey(), type: 'sponsor' },
      { id: 'sponsor-002',      pathId: generateRandomKey(6), key: generateRandomKey(), type: 'sponsor' },
      { id: 'instructions-001', pathId: generateRandomKey(6), key: generateRandomKey(), type: 'instructions' },
    ];
    const activatorQRCodes: Omit<QRCode, 'number' | 'color' | 'letter' | 'stars'>[] = [
      { id: 'game_activator-001', pathId: generateRandomKey(6), key: generateRandomKey(), type: 'game_activator' },
    ];
    updateDeckConfig({ deck_details: { ...deckConfig.deck_details, deck_name: "ESSENTIAL PLUS DECK", deck_description: "An enhanced deck: 28 cards (4×7) + 8 power-ups + 4 utility + 1 activator = 41 QR codes total.", version: 1 }, qrcodes: [...themedCards, ...powerUps, ...utilityQRCodes, ...activatorQRCodes] });
  };

  const cardQRCodes = deckConfig.qrcodes.filter(qr => qr.type === 'game_card');
  const powerUpQRCodes = deckConfig.qrcodes.filter(qr => qr.type === 'power_up');
  const utilityQRCodes = deckConfig.qrcodes.filter(qr => UTILITY_TYPES.includes(qr.type));
  const activatorQRCodes = deckConfig.qrcodes.filter(qr => ACTIVATOR_TYPES.includes(qr.type));
  const baseUrl = deckConfig.deck_details.baseUrl || "https://www.massivescan.com/qrc/";
  const utilityBaseUrl = deckConfig.deck_details.utilityBaseUrl || "";
  const deckId = deckConfig.deck_details.deck_id || "0001";
  const errorCorrectionLevel = deckConfig.deck_details.errorCorrectionLevel || 'Q';

  const totalCards = deckConfig.qrcodes.length;

  // ─── Deck Summary precomputed data ───────────────────────────────────────
  const summaryColorCounts: Record<string, number> = {};
  const summaryStarCounts: Record<number, number> = {};
  cardQRCodes.forEach(qr => {
    if (qr.color) summaryColorCounts[qr.color] = (summaryColorCounts[qr.color] ?? 0) + 1;
    if (typeof qr.stars === 'number') summaryStarCounts[qr.stars] = (summaryStarCounts[qr.stars] ?? 0) + 1;
  });
  const summaryUtilityCounts: Record<string, number> = {};
  utilityQRCodes.forEach(qr => { summaryUtilityCounts[qr.type] = (summaryUtilityCounts[qr.type] ?? 0) + 1; });
  const summaryActivatorCounts: Record<string, number> = {};
  activatorQRCodes.forEach(qr => { summaryActivatorCounts[qr.type] = (summaryActivatorCounts[qr.type] ?? 0) + 1; });
  // Unified deck type/tier visuals — see cards/deckTypeMeta.ts
  const colorMeta = TIER_META;

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">

      {/* ── Standard header ─────────────────────────────────────────────── */}
      <header className="bg-brand-surface border-b-2 border-black dark:border-brand-primary sticky top-0 z-10 flex-shrink-0">
        <div className="px-6 h-16 flex items-center gap-3">

          {/* Back */}
          {onBackToLauncher && (
            <button
              onClick={onBackToLauncher}
              className="flex items-center gap-1.5 text-brand-subtle hover:text-brand-text transition-colors group flex-shrink-0"
              title="Back to Project"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              <span className="text-xs font-black uppercase tracking-widest">Menu</span>
            </button>
          )}

          {/* Project badge */}
          {projectName && (
            <>
              <span className="text-black/20 dark:text-brand-primary/30 font-light text-lg">/</span>
              <div
                className="flex-shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-black dark:border-brand-primary bg-brand-secondary dark:bg-brand-primary text-brand-text"
                style={{ borderRadius: 1 }}
              >
                {projectName}
              </div>
            </>
          )}

          <span className="text-black/20 dark:text-brand-primary/30 font-light text-lg">/</span>

          {/* Module identity */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-brand-subtle leading-none">Massive Scan</div>
              <div className="text-sm font-black uppercase tracking-tight leading-tight text-brand-text">Deck Config</div>
            </div>
          </div>

          {/* Right: stats + dots */}
          <div className="ml-auto flex items-center gap-3 flex-shrink-0">
            {/* Stats chips */}
            <div className="hidden md:flex items-center gap-1.5">
              {[
                { label: 'Cards',  val: cardQRCodes.length,      bg: '#FFE500' },
                { label: 'P-Ups',  val: powerUpQRCodes.length,   bg: '#C8B6FF' },
                { label: 'Util',   val: utilityQRCodes.length,   bg: '#6EE7B7' },
                { label: 'Act',    val: activatorQRCodes.length, bg: '#FF4F6D' },
                { label: 'Total',  val: totalCards,              bg: '#1A1A1A', light: true },
              ].map(({ label, val, bg, light }) => (
                <div
                  key={label}
                  className="border-2 border-black px-2 py-1 text-center"
                  style={{ backgroundColor: bg, borderRadius: 1 }}
                >
                  <div className="font-black text-sm leading-none" style={{ color: light ? '#6EE7B7' : '#1A1A1A' }}>{val}</div>
                  <div className="text-[7px] font-black uppercase tracking-wide" style={{ color: light ? 'rgba(110,231,183,0.7)' : '#1A1A1A' }}>{label}</div>
                </div>
              ))}
            </div>
            {/* Decoration dots */}
            <div className="flex gap-1.5">
              {['#FF4F6D', '#FFE500', '#00D4AA'].map(c => (
                <span key={c} className="w-2.5 h-2.5 border border-black/20 dark:border-brand-primary/20 inline-block" style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow py-8">
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 1.5rem' }}>

        {/* ══════════════════════════════════ JSON MANAGEMENT ══════════════════════════════════ */}
        <div className="card-brutal" style={{ padding: '1.5rem', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem', borderBottom: '2px solid #1A1A1A', paddingBottom: '1rem' }}>
            <h2 style={{ fontWeight: 900, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1A1A1A', margin: 0 }}>
              Deck Management
            </h2>
          </div>

          {/* ── Info note ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#F0EDE6', border: '2px solid #CCCCCC', padding: '10px 14px', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0, marginTop: '1px' }}>💡</span>
            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: '#5A5A5A', lineHeight: 1.5 }}>
              Em princípio basta um <strong style={{ color: '#1A1A1A' }}>DECK</strong> por Projeto, apesar de depois poder ter vários <strong style={{ color: '#1A1A1A' }}>DESIGNs</strong> possíveis e jogos possíveis.
            </p>
          </div>

          {/* ── File actions row ── */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '1.25rem' }}>
            <button className="btn-brutal" style={{ padding: '10px 18px', background: '#FF4F6D', color: '#FFFFFF', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 900 }} onClick={handleNewDeck}>
              + New Deck
            </button>
          </div>

          {/* ── Presets — only shown on empty/unsaved deck ── */}
          {totalCards === 0 && !currentFilename && (
            <div style={{ borderTop: '2px solid #1A1A1A', paddingTop: '1.25rem', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9A9A9A', display: 'block', marginBottom: '0.75rem' }}>Deck Presets</span>
              <div style={{ background: '#FF4F6D', border: '2px solid #1A1A1A', boxShadow: '5px 5px 0 #1A1A1A', padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ background: '#1A1A1A', color: '#FFFFFF', fontWeight: 900, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '2px 7px' }}>★ Recommended</span>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#FFFFFF' }}>Essential Plus Deck</div>
                  <div style={{ fontSize: '0.78rem', color: '#FFFFFF', fontWeight: 600, marginTop: '2px' }}>28 cards (4×7) + 8 power-ups + 4 utility + 1 activator = 41 QR codes</div>
                </div>
                <button className="btn-brutal" style={{ padding: '12px 24px', background: '#1A1A1A', color: '#FFFFFF', fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }} onClick={generateEssentialPlusDeck}>
                  Generate →
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button className="btn-brutal" style={{ padding: '7px 14px', background: '#F0EDE6', color: '#4A4A4A', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', border: '2px solid #AAAAAA', boxShadow: '3px 3px 0 #AAAAAA' }} onClick={generateStandardDeck}>Big Deck (52+2)</button>
                <button className="btn-brutal" style={{ padding: '7px 14px', background: '#F0EDE6', color: '#4A4A4A', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', border: '2px solid #AAAAAA', boxShadow: '3px 3px 0 #AAAAAA' }} onClick={generateThemeDeck}>Essential Deck (26+4)</button>
              </div>
            </div>
          )}

          {/* ── Saved decks for this project ── */}
          <div style={{ borderTop: '2px solid #1A1A1A', paddingTop: '1.25rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9A9A9A', display: 'block', marginBottom: '0.75rem' }}>
              Saved in this project {savedFiles.length > 0 && <span style={{ background: '#1A1A1A', color: '#FFE500', padding: '1px 7px', marginLeft: '6px', fontSize: '0.6rem' }}>{savedFiles.length}</span>}
            </span>
            {savedFiles.length === 0 ? (
              <div style={{ border: '2px dashed #CCCCCC', padding: '1rem 1.25rem', color: '#9A9A9A', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                No saved decks yet — generate a preset and save
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {savedFiles.map(f => {
                  const isActive = f.name === currentFilename;
                  return (
                    <div
                      key={f.name}
                      style={{
                        background: isActive ? '#FFE500' : '#FFFFFF',
                        border: `2px solid ${isActive ? '#1A1A1A' : '#DDDDDD'}`,
                        boxShadow: isActive ? '4px 4px 0 #1A1A1A' : 'none',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      {isActive && (
                        <span style={{ background: '#1A1A1A', color: '#FFE500', fontWeight: 900, fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '2px 6px', flexShrink: 0 }}>Active</span>
                      )}
                      {defaultDeck === f.name && !isActive && (
                        <span style={{ background: '#FFE500', color: '#1A1A1A', fontWeight: 900, fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '2px 6px', flexShrink: 0, border: '2px solid #1A1A1A' }}>Default</span>
                      )}
                      <div
                        onClick={() => !isActive && handleLoadFile(f.name)}
                        style={{ flex: 1, minWidth: 0, cursor: isActive ? 'default' : 'pointer' }}
                      >
                        <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.deckName || f.name}
                        </div>
                        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: isActive ? '#4A4A4A' : '#9A9A9A', marginTop: '2px' }}>
                          {new Date(f.modified).toLocaleString()}
                        </div>
                      </div>
                      {!isActive && (
                        <button
                          className="btn-brutal-sm"
                          onClick={() => handleLoadFile(f.name)}
                          style={{ padding: '5px 12px', background: '#1A1A1A', color: '#FFE500', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 900, flexShrink: 0 }}
                        >Load →</button>
                      )}
                      <button
                        className="btn-brutal-sm"
                        onClick={() => handleToggleDefault(f.name)}
                        style={{ padding: '5px 10px', background: defaultDeck === f.name ? '#FFE500' : '#F0EDE6', color: '#1A1A1A', fontSize: '0.78rem', fontWeight: 900, flexShrink: 0, border: '2px solid #1A1A1A', boxShadow: '2px 2px 0 #1A1A1A' }}
                        title={defaultDeck === f.name ? 'Clear default (won\'t auto-load)' : 'Set as default — auto-loads on next open'}
                      >★</button>
                      <button
                        className="btn-brutal-sm"
                        onClick={() => handleDeleteFile(f.name)}
                        style={{ padding: '5px 10px', background: '#FF4F6D', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 900, flexShrink: 0, border: '2px solid #1A1A1A', boxShadow: '2px 2px 0 #1A1A1A' }}
                        title="Delete deck"
                      >✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* ══════════════════════════════════ SECTIONS ══════════════════════════════════ */}
        <main>
          <Section title="Deck Details" description="Name and description of this deck." accent="#FFE500" isCollapsible isOpen={openSections.deckDetails} onToggle={() => toggleSection('deckDetails')}>
            <DeckDetailsForm details={deckConfig.deck_details} onDetailsChange={(dd) => updateDeckConfig({ deck_details: dd })} variant="basic" />
            <div style={{ borderTop: '2px solid #1A1A1A', marginTop: '1.25rem', paddingTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                className="btn-brutal"
                style={{ padding: '10px 22px', background: '#FFE500', color: '#1A1A1A', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 900 }}
                onClick={handleSave}
              >
                {saveLabel.startsWith('Saved') ? '✓ ' : '⬛ '}{saveLabel}
              </button>
              {currentFilename && (
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#7A7A7A' }}>{currentFilename}</span>
              )}
            </div>
          </Section>

          <Section title="Technical Details" description="URLs, deck ID, version and QR error correction level." accent="#C8B6FF" isCollapsible isOpen={openSections.deckTechnical} onToggle={() => toggleSection('deckTechnical')}>
            <DeckDetailsForm details={deckConfig.deck_details} onDetailsChange={(dd) => updateDeckConfig({ deck_details: dd })} variant="technical" />
            <div style={{ borderTop: '2px solid #1A1A1A', marginTop: '1.25rem', paddingTop: '1.25rem' }}>
              <button className="btn-brutal" style={{ padding: '10px 18px', background: showPreview ? '#1A1A1A' : '#F0EDE6', color: showPreview ? '#FFE500' : '#1A1A1A', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em' }} onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? '▲ Hide JSON' : '▼ Show JSON'}
              </button>
              {showPreview && (
                <div style={{ marginTop: '1rem', background: '#1A1A1A', border: '2px solid #1A1A1A', overflow: 'auto', maxHeight: '400px' }}>
                  <div style={{ background: '#FFE500', borderBottom: '2px solid #1A1A1A', padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1A1A1A' }}>{deckId}_{deckConfig.deck_details.deck_name}.json</span>
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#4A4A4A' }}>{totalCards} qrcodes</span>
                  </div>
                  <pre style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.72rem', color: '#E8F4E8', padding: '1rem', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{JSON.stringify(deckConfig, null, 2)}</pre>
                </div>
              )}
            </div>
          </Section>

          {/* ══════════════════════════════════ DECK SUMMARY ══════════════════════════════════ */}
          <Section
            title="Deck Summary"
            description={currentFilename || 'No deck loaded'}
            accent="#4361EE"
            isCollapsible
            isOpen={openSections.deckSummary}
            onToggle={() => toggleSection('deckSummary')}
          >
            {totalCards === 0 ? (
              <p style={{ fontSize: '0.8rem', color: '#9A9A9A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>No cards yet — generate a deck preset above</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Totals row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { label: GROUP_META.cards.label,     val: cardQRCodes.length,      bg: GROUP_META.cards.bg,     fg: GROUP_META.cards.fg     },
                    { label: GROUP_META.powerups.label,  val: powerUpQRCodes.length,   bg: GROUP_META.powerups.bg,  fg: GROUP_META.powerups.fg  },
                    { label: GROUP_META.utility.label,   val: utilityQRCodes.length,   bg: GROUP_META.utility.bg,   fg: GROUP_META.utility.fg   },
                    { label: GROUP_META.activator.label, val: activatorQRCodes.length, bg: GROUP_META.activator.bg, fg: GROUP_META.activator.fg },
                    { label: GROUP_META.total.label,     val: totalCards,              bg: GROUP_META.total.bg,     fg: GROUP_META.total.fg     },
                  ].map(({ label, val, bg, fg }) => (
                    <div key={label} style={{ background: bg, border: '2px solid #1A1A1A', padding: '6px 14px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontWeight: 900, fontSize: '1.5rem', color: fg, lineHeight: 1 }}>{val}</span>
                      <span style={{ fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: fg, opacity: 0.75 }}>{label}</span>
                    </div>
                  ))}
                </div>

                {/* Card colors */}
                {cardQRCodes.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9A9A9A', display: 'block', marginBottom: '6px' }}>Card Colors</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(['yellow','green','blue','magenta'] as const).map(c => {
                        const count = summaryColorCounts[c] ?? 0;
                        if (!count) return null;
                        const m = colorMeta[c];
                        return (
                          <div key={c} style={{ background: m.bg, border: '2px solid #1A1A1A', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 900, fontSize: '1rem', color: m.fg, lineHeight: 1 }}>{count}</span>
                            <span style={{ fontWeight: 800, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: m.fg }}>{c}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Star distribution */}
                {cardQRCodes.length > 0 && Object.keys(summaryStarCounts).length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9A9A9A', display: 'block', marginBottom: '6px' }}>Star Distribution</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {[3,2,1,0].map(stars => {
                        const count = summaryStarCounts[stars] ?? 0;
                        if (!count) return null;
                        return (
                          <div key={stars} style={{ background: '#FFFFFF', border: '2px solid #1A1A1A', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 900, fontSize: '1rem', color: '#1A1A1A', lineHeight: 1 }}>{count}</span>
                            <span style={{ color: '#FFE500', fontSize: '0.75rem', letterSpacing: '-1px' }}>{'★'.repeat(stars) || '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Utility breakdown */}
                {utilityQRCodes.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9A9A9A', display: 'block', marginBottom: '6px' }}>Utility QR Codes</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {Object.entries(summaryUtilityCounts).map(([type, count]) => {
                        const m = DECK_TYPE_META[type] ?? FALLBACK_TYPE_META;
                        return (
                          <div key={type} style={{ background: m.bg, border: '2px solid #1A1A1A', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 900, fontSize: '1rem', color: m.fg, lineHeight: 1 }}>{count}</span>
                            <span style={{ fontWeight: 800, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: m.fg }}>{m.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Activator breakdown */}
                {activatorQRCodes.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9A9A9A', display: 'block', marginBottom: '6px' }}>Activator QR Codes</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {Object.entries(summaryActivatorCounts).map(([type, count]) => {
                        const m = DECK_TYPE_META[type] ?? FALLBACK_TYPE_META;
                        return (
                          <div key={type} style={{ background: m.bg, border: '2px solid #1A1A1A', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 900, fontSize: '1rem', color: m.fg, lineHeight: 1 }}>{count}</span>
                            <span style={{ fontWeight: 800, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: m.fg }}>{m.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            )}
          </Section>

          <Section title={`QR Codes — Game Cards [${cardQRCodes.length}]`} description="Physical QR codes linked to digital game cards. Auto-numbered and decorated." accent="#4361EE" isCollapsible isOpen={openSections.qrCodesCards} onToggle={() => toggleSection('qrCodesCards')}>
            <QRCodesManager qrcodes={cardQRCodes} onQRCodesChange={handleCardQRCodesChange} onAdd={() => addQRCode('game_card')} baseUrl={baseUrl} deckId={deckId} errorCorrectionLevel={errorCorrectionLevel} />
          </Section>

          <Section title={`QR Codes — Power-Ups [${powerUpQRCodes.length}]`} description="QR codes that trigger special power-up actions in-game." accent="#C8B6FF" isCollapsible isOpen={openSections.qrCodesPowerUps} onToggle={() => toggleSection('qrCodesPowerUps')}>
            <QRCodesManager qrcodes={powerUpQRCodes} onQRCodesChange={handlePowerUpQRCodesChange} onAdd={() => addQRCode('power_up')} baseUrl={baseUrl} deckId={deckId} errorCorrectionLevel={errorCorrectionLevel} />
          </Section>

          <Section title={`QR Codes — Utility [${utilityQRCodes.length}]`} description="QR codes for promos, instructions and sponsors." accent="#00D4AA" isCollapsible isOpen={openSections.qrCodesUtility} onToggle={() => toggleSection('qrCodesUtility')}>
            <QRCodesManager qrcodes={utilityQRCodes} onQRCodesChange={handleUtilityQRCodesChange} onAdd={() => addQRCode('promo_video')} baseUrl={utilityBaseUrl} deckId={deckId} errorCorrectionLevel={errorCorrectionLevel} />
          </Section>

          <Section title={`QR Codes — Activators [${activatorQRCodes.length}]`} description="QR codes that launch / start the game experience." accent="#FF4F6D" isCollapsible isOpen={openSections.qrCodesActivator} onToggle={() => toggleSection('qrCodesActivator')}>
            <QRCodesManager qrcodes={activatorQRCodes} onQRCodesChange={handleActivatorQRCodesChange} onAdd={() => addQRCode('game_activator')} baseUrl={utilityBaseUrl} deckId={deckId} errorCorrectionLevel={errorCorrectionLevel} />
          </Section>

        </main>

      </div>

      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t-2 border-black px-8 py-3 flex items-center justify-between flex-shrink-0">
        <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle/40">Massive Scan · Design System</span>
        <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle/40">@jdcaldas 2026</span>
      </footer>
    </div>
  );
};

export default App;
