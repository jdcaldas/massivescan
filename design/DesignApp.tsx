import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Group, Subgroup, DesignStructure, LogEntry, SavedDesign, WorldMeta, AppSettings, ApiStats } from './types';
import { DEFAULT_SETTINGS } from './types';
import * as fileArchive from './services/fileArchiveService';
import {
  generateAll,
  generateThemeDescription,
  regenerateGroup as apiRegenerateGroup,
  regenerateSubgroups as apiRegenerateSubgroups,
  regenerateSingleSubgroup as apiRegenerateSingleSubgroup,
  translateDesign,
  translateText,
  GenerationCancelledError,
} from './services/geminiService';
import { IMAGE_MODELS as IMAGE_GEN_MODELS } from './services/imageGenService';
import { recordUsage } from './services/usageService';
import UsageDashboard from './components/UsageDashboard';
import Header from './components/Header';
import DesignCanvas from './components/DesignCanvas';
import TelemetryOverlay from './components/TelemetryOverlay';
import SettingsModal from './components/SettingsModal';
import HomePage from './components/HomePage';
import ImageStudio from './components/ImageStudio';
import CardStudio from './components/CardStudio';
import DeckFusion from './components/DeckFusion';
import ModelTestPage from './components/ModelTestPage';

const ARCHIVE_KEY = 'massivescan_archive';
const SETTINGS_KEY = 'massivescan_settings';

const AVAILABLE_MODELS = [
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
  { id: 'gemini-3.1-flash-preview', name: 'Gemini 3.1 Flash' },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite-latest', name: 'Gemini 2.5 Flash Lite' },
];

interface DesignAppProps {
  onBackToLauncher?: () => void;
  projectId: string;
  projectName?: string;
}

const App: React.FC<DesignAppProps> = ({ onBackToLauncher, projectId, projectName }) => {
  const [theme, setTheme] = useState('');
  const [themeDescription, setThemeDescription] = useState('');
  const [designStructure, setDesignStructure] = useState<DesignStructure | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [apiStats, setApiStats] = useState<ApiStats>({ 
    generateAll: 0, 
    regenerateGroup: 0, 
    regenerateSubgroups: 0,
    tokens: {}
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Telemetry & Model State
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeModel, setActiveModel] = useState<string>('Idle');
  const [turnCount, setTurnCount] = useState<number>(0);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });
  const [savedDesigns, setSavedDesigns] = useState<WorldMeta[]>([]);
  const [genProgress, setGenProgress] = useState<{ step: number; total: number; label: string } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [loadingSubgroupKeys, setLoadingSubgroupKeys] = useState<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'editor' | 'images' | 'cards' | 'fusion' | 'model-test'>('home');
  const [activeWorldName, setActiveWorldName] = useState<string | null>(null);
  const [activeWorldId, setActiveWorldId] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try { const s = localStorage.getItem(SETTINGS_KEY); return s ? JSON.parse(s).defaultModel ?? 'gemini-2.5-flash' : 'gemini-2.5-flash'; } catch { return 'gemini-2.5-flash'; }
  });
  const [language, setLanguage] = useState<string>(() => {
    try { const s = localStorage.getItem(SETTINGS_KEY); return s ? JSON.parse(s).defaultLanguage ?? 'English' : 'English'; } catch { return 'English'; }
  });
  const [contentLanguage, setContentLanguage] = useState<string>('English');
  const [autoAdaptTheme, setAutoAdaptTheme] = useState<boolean>(() => {
    try { const s = localStorage.getItem(SETTINGS_KEY); return s ? JSON.parse(s).autoAdaptTheme ?? true : true; } catch { return true; }
  });
  const [isAdaptingTheme, setIsAdaptingTheme] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Load settings + world index from files on startup (file wins over localStorage)
  useEffect(() => {
    fileArchive.loadSettings().then((fromFile) => {
      if (fromFile) {
        const merged = { ...DEFAULT_SETTINGS, ...fromFile } as AppSettings;
        // If a stored image model no longer exists in the list, reset to default
        if (!IMAGE_GEN_MODELS.some(m => m.id === merged.defaultImageModel)) {
          merged.defaultImageModel = DEFAULT_SETTINGS.defaultImageModel;
        }
        setSettings(merged);
        setSelectedModel(merged.defaultModel);
        setLanguage(merged.defaultLanguage);
        setAutoAdaptTheme(merged.autoAdaptTheme);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
        fileArchive.saveSettings(merged); // persist corrected value back to file
      }
    });
    fileArchive.loadIndex(projectId).then((index) => {
      setSavedDesigns(index);
    });
  }, []);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleLanguageChange = useCallback(async (newLang: string) => {
    setLanguage(newLang);
    if (autoAdaptTheme && theme.trim() && newLang !== language) {
      setIsAdaptingTheme(true);
      try {
        const translated = await translateText(theme, newLang, selectedModel);
        setTheme(translated);
      } catch { /* silently ignore */ } finally {
        setIsAdaptingTheme(false);
      }
    }
  }, [autoAdaptTheme, theme, language, selectedModel]);

  // Telemetry Helper Wrapper
  const executeWithTelemetry = async <T,>(intent: string, apiCall: () => Promise<T>): Promise<T> => {
      const currentTurn = turnCount + 1;
      setTurnCount(prev => prev + 1);
      setActiveModel(selectedModel);
      
      const newLog: LogEntry = {
          turn_id: currentTurn,
          timestamp: new Date().toISOString(),
          model_used: selectedModel,
          user_intent: intent,
          status: 'Pending'
      };
      
      setLogs(prev => [...prev, newLog]);

      try {
          const result = await apiCall();
          setLogs(prev => prev.map(log => log.turn_id === currentTurn ? { ...log, status: 'Success' } : log));
          return result;
      } catch (err) {
          setLogs(prev => prev.map(log => log.turn_id === currentTurn ? { ...log, status: 'Error' } : log));
          throw err;
      } finally {
          setActiveModel('Idle');
      }
  };

  const getErrorMessage = (err: any, defaultMessage: string): string => {
    const errorString = err?.message || String(err);
    if (errorString.includes('429') || errorString.includes('quota') || errorString.includes('RESOURCE_EXHAUSTED')) {
      return 'Você excedeu a sua quota atual da API Gemini. Por favor, verifique o seu plano e detalhes de faturação em https://ai.google.dev/gemini-api/docs/rate-limits.';
    }
    return defaultMessage;
  };

  const handleUsage = useCallback((model: string, usage: { in: number, out: number }) => {
      setApiStats(prev => {
          const current = prev.tokens[model] || { in: 0, out: 0 };
          return {
              ...prev,
              tokens: {
                  ...prev.tokens,
                  [model]: {
                      in: current.in + usage.in,
                      out: current.out + usage.out
                  }
              }
          };
      });
      recordUsage(model, usage.in, usage.out); // persist to file
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!theme.trim()) {
      setError('Por favor, insira um tema para começar.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setDesignStructure(null);
    setThemeDescription('');
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setContentLanguage(language);
      // Fixed structure: 1 analyze + 1 build base + 6 group details = 8 steps
      const genTotal = 8;
      setGenProgress({ step: 1, total: genTotal, label: 'Analyzing theme…' });
      // Execute Theme Description with Telemetry
      const description = await executeWithTelemetry(
          `Generate Theme Description for: ${theme}`,
          () => generateThemeDescription(theme, language, selectedModel, (usage) => {
              handleUsage(selectedModel, usage);
              setApiStats(prev => ({ ...prev, generateAll: prev.generateAll + 1 }));
          })
      );
      setThemeDescription(description);
      
      // Execute Generate All with Telemetry
      // Note: We await sequentially as per original logic, triggering a second turn/log.
      const result = await executeWithTelemetry(
          `Generate Full Structure for: ${theme}`,
          () => generateAll(
              theme,
              description,
              language,
              selectedModel,
              (partialStructure) => setDesignStructure(partialStructure),
              (usage) => {
                  handleUsage(selectedModel, usage);
                  setApiStats(prev => ({ ...prev, generateAll: prev.generateAll + 1 }));
              },
              (step, label) => setGenProgress({ step: step + 1, total: genTotal, label }),
              controller.signal
          )
      );
      
      setDesignStructure(result);
      setActiveWorldName(theme);

      // Auto-save: write individual world file + update index
      const newId = crypto.randomUUID();
      setActiveWorldId(newId);
      const meta: WorldMeta = {
        id: newId,
        theme,
        themeDescription: description,
        savedAt: new Date().toISOString(),
        groupCount: result.groups.length,
        language: language,
      };
      const design: SavedDesign = { ...meta, data: { theme, theme_description: description, structure: result } };
      fileArchive.saveWorld(projectId, design);
      setSavedDesigns(prev => {
        const updated = [meta, ...prev];
        localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated));
        return updated;
      });

      setSuccessMessage('Design generated and saved to archive.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      if (err instanceof GenerationCancelledError) {
        setDesignStructure(null);
      } else {
        console.error(err);
        setError(getErrorMessage(err, 'Ocorreu um erro ao gerar a estrutura. Por favor, tente novamente.'));
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      setGenProgress(null);
    }
  }, [theme, turnCount, selectedModel]);

  const handleRegenerateGroup = useCallback(async (groupIndex: number) => {
    if (!designStructure || !theme) return;
    const existingGroupTitles = designStructure.groups.map(g => g.title);
    
    setError(null);
    setSuccessMessage(null);

    setDesignStructure(prev => {
        const newGroups = prev!.groups.map((g, i) => i === groupIndex ? { ...g, isLoading: true } : g);
        return { ...prev!, groups: newGroups };
    });

    try {
      const newGroup = await executeWithTelemetry(
          `Regenerate Group ${groupIndex + 1} for theme: ${theme}`,
          () => apiRegenerateGroup(theme, themeDescription, existingGroupTitles, language, selectedModel, (usage) => {
              handleUsage(selectedModel, usage);
              setApiStats(prev => ({ ...prev, regenerateGroup: prev.regenerateGroup + 1 }));
          })
      );

      setDesignStructure(prev => {
        const newGroups = [...prev!.groups];
        const oldGroup = newGroups[groupIndex];
        newGroups[groupIndex] = { ...newGroup, id: oldGroup.id, isLoading: false };
        return { ...prev!, groups: newGroups };
      });
      setSuccessMessage(`Grupo ${groupIndex + 1} regenerado com sucesso!`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, `Erro ao regenerar o grupo ${groupIndex + 1}.`));
       setDesignStructure(prev => {
           const newGroups = prev!.groups.map((g, i) => i === groupIndex ? { ...g, isLoading: false } : g);
           return { ...prev!, groups: newGroups };
       });
    }
  }, [designStructure, theme, themeDescription, turnCount, selectedModel]);

  const handleRegenerateSubgroups = useCallback(async (groupIndex: number) => {
    if (!designStructure) return;
    const parentGroup = designStructure.groups[groupIndex];
    const existingSubgroupTitles = parentGroup.subgroups.map(sg => sg.title);

    setError(null);
    setSuccessMessage(null);

    setDesignStructure(prev => {
        const newGroups = prev!.groups.map((g, i) => i === groupIndex ? { ...g, isSubgroupsLoading: true } : g);
        return { ...prev!, groups: newGroups };
    });
    
    try {
      const newSubgroups = await executeWithTelemetry(
          `Regenerate Subgroups for Group: ${parentGroup.title}`,
          () => apiRegenerateSubgroups(theme, themeDescription, parentGroup.title, existingSubgroupTitles, language, selectedModel, (usage) => {
              handleUsage(selectedModel, usage);
              setApiStats(prev => ({ ...prev, regenerateSubgroups: prev.regenerateSubgroups + 1 }));
          }, parentGroup.subgroups.length)
      );

      setDesignStructure(prev => {
        const newStructure = { ...prev! };
        const newGroups = [...newStructure.groups];
        newGroups[groupIndex] = { ...newGroups[groupIndex], subgroups: newSubgroups, isSubgroupsLoading: false };
        return { ...newStructure, groups: newGroups };
      });
      setSuccessMessage(`Subgrupos do grupo ${groupIndex + 1} regenerados com sucesso!`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, `Erro ao regenerar subgrupos para o grupo ${groupIndex + 1}.`));
      setDesignStructure(prev => {
          const newGroups = prev!.groups.map((g, i) => i === groupIndex ? { ...g, isSubgroupsLoading: false } : g);
          return { ...prev!, groups: newGroups };
      });
    }
  }, [designStructure, theme, themeDescription, turnCount, selectedModel]);

  const handleRegenerateSingleSubgroup = useCallback(async (groupIndex: number, subgroupIndex: number) => {
    if (!designStructure) return;
    const key = `${groupIndex}-${subgroupIndex}`;
    const parentGroup = designStructure.groups[groupIndex];
    const currentSubgroup = parentGroup.subgroups[subgroupIndex];
    const otherTitles = parentGroup.subgroups.filter((_, i) => i !== subgroupIndex).map(sg => sg.title);

    setLoadingSubgroupKeys(prev => new Set([...prev, key]));
    setError(null);

    try {
      const newSubgroup = await executeWithTelemetry(
        `Regenerate Subgroup: ${currentSubgroup.title}`,
        () => apiRegenerateSingleSubgroup(
          theme, themeDescription, parentGroup.title,
          currentSubgroup.title, otherTitles,
          language, selectedModel,
          (usage) => handleUsage(selectedModel, usage)
        )
      );
      setDesignStructure(prev => {
        if (!prev) return null;
        const newGroups = prev.groups.map((g, gi) => {
          if (gi !== groupIndex) return g;
          const newSubs = g.subgroups.map((sg, si) => si === subgroupIndex ? newSubgroup : sg);
          return { ...g, subgroups: newSubs };
        });
        return { ...prev, groups: newGroups };
      });
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, `Error regenerating subgroup ${subgroupIndex + 1} of group ${groupIndex + 1}.`));
    } finally {
      setLoadingSubgroupKeys(prev => { const next = new Set(prev); next.delete(key); return next; });
    }
  }, [designStructure, theme, themeDescription, language, selectedModel, handleUsage]);

  const handleRegenerateAllSubgroups = useCallback(async () => {
    if (!designStructure) return;
    await Promise.allSettled(designStructure.groups.map((_, i) => handleRegenerateSubgroups(i)));
  }, [designStructure, handleRegenerateSubgroups]);

 const handleUpdate = useCallback((groupIndex: number | null, field: string, value: any, subIndex?: number, subField?: string, itemIndex?: number, itemProperty?: 'prompt') => {
    setDesignStructure(prev => {
        if (!prev) return null;
        const newStructure = JSON.parse(JSON.stringify(prev));

        if (groupIndex === null) {
            if (field === 'icon') {
                newStructure.icon = value;
            } else if (field === 'visualStyle') {
                newStructure.visualStyle = value;
            }
        } else {
            const group = newStructure.groups[groupIndex];
            if (field === 'subgroups' && typeof subIndex === 'number' && subField) {
                const subgroup = group.subgroups[subIndex];
                if (subField === 'imagePrompts' && typeof itemIndex === 'number' && itemProperty) {
                    subgroup.imagePrompts[itemIndex][itemProperty] = value;
                } else if (subField === 'favoriteImagePromptIndex') {
                    const currentIndex = subgroup.favoriteImagePromptIndex;
                    subgroup.favoriteImagePromptIndex = currentIndex === value ? null : value;
                } else {
                    subgroup[subField] = value;
                }
            } else if (field === 'imagePrompts' && typeof itemIndex === 'number' && itemProperty) {
                group.imagePrompts[itemIndex][itemProperty] = value;
            } else if (field === 'favoriteImagePromptIndex') {
                const currentIndex = group.favoriteImagePromptIndex;
                group.favoriteImagePromptIndex = currentIndex === value ? null : value;
            } else {
                group[field] = value;
            }
        }
        return newStructure;
    });
}, []);


  const handleSaveToArchive = useCallback(() => {
    if (!designStructure || !theme) return;
    const meta: WorldMeta = {
      id: crypto.randomUUID(),
      theme,
      themeDescription,
      savedAt: new Date().toISOString(),
      groupCount: designStructure.groups.length,
      language: contentLanguage,
    };
    const design: SavedDesign = { ...meta, data: { theme, theme_description: themeDescription, structure: designStructure } };
    fileArchive.saveWorld(projectId, design);
    setSavedDesigns(prev => {
      const updated = [meta, ...prev];
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated));
      return updated;
    });
    setSuccessMessage('Design saved.');
    setTimeout(() => setSuccessMessage(null), 3000);
  }, [designStructure, theme, themeDescription, contentLanguage]);

  const handleTranslate = useCallback(async (targetLang: string) => {
    if (!designStructure || !theme) return;
    setIsTranslating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await executeWithTelemetry(
        `Translate design "${theme}" to ${targetLang}`,
        () => translateDesign(theme, themeDescription, designStructure, targetLang, selectedModel, (usage) => {
          handleUsage(selectedModel, usage);
        })
      );
      setTheme(result.theme);
      setThemeDescription(result.themeDescription);
      setDesignStructure(result.structure);
      setContentLanguage(targetLang);
      setActiveWorldName(result.theme);
      setSuccessMessage(`Design translated to ${targetLang}.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, 'Translation failed. Please try again.'));
    } finally {
      setIsTranslating(false);
    }
  }, [designStructure, theme, themeDescription, selectedModel, turnCount]);

  const handleLoadFromArchive = useCallback(async (meta: WorldMeta) => {
    const design = await fileArchive.loadWorld(projectId, meta.id);
    if (!design) {
      setError(`Could not load world "${meta.theme}". File may be missing.`);
      return;
    }
    setTheme(design.data.theme);
    setThemeDescription(design.data.theme_description);
    setDesignStructure(design.data.structure);
    setContentLanguage(design.language ?? 'English');
    setActiveWorldName(design.theme);
    setActiveWorldId(meta.id);
    setError(null);
    setCurrentView('editor');
  }, []);

  const handleCreateNew = useCallback(() => {
    setTheme('');
    setThemeDescription('');
    setDesignStructure(null);
    setError(null);
    setActiveWorldName(null);
    setActiveWorldId(null);
    setCurrentView('editor');
  }, []);

  const handleGoHome = useCallback(() => {
    setCurrentView('home');
  }, []);

  const handleGoToImages = useCallback(() => {
    setCurrentView('images');
  }, []);

  const handleGoToCards = useCallback(() => {
    setCurrentView('cards');
  }, []);

  const handleGoToFusion = useCallback(() => {
    setCurrentView('fusion');
  }, []);

  const handleSaveImages = useCallback((updatedStructure: DesignStructure) => {
    setDesignStructure(updatedStructure);
    if (!activeWorldId) return;
    const currentMeta = savedDesigns.find(d => d.id === activeWorldId);
    const design: SavedDesign = {
      id: activeWorldId,
      theme,
      themeDescription,
      savedAt: new Date().toISOString(),
      groupCount: updatedStructure.groups.length,
      language: contentLanguage,
      locked: currentMeta?.locked,
      data: { theme, theme_description: themeDescription, structure: updatedStructure },
    };
    fileArchive.saveWorld(projectId, design);
  }, [activeWorldId, theme, themeDescription, contentLanguage, savedDesigns, projectId]);

  const handleDeleteFromArchive = useCallback((id: string) => {
    fileArchive.deleteWorld(projectId, id);
    setSavedDesigns(prev => {
      const updated = prev.filter(d => d.id !== id);
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleToggleLock = useCallback((id: string) => {
    setSavedDesigns(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, locked: !d.locked } : d);
      const entry = updated.find(d => d.id === id);
      if (entry) fileArchive.patchWorldMeta(projectId, id, { locked: entry.locked });
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleRename = useCallback((id: string, newTheme: string) => {
    fileArchive.patchWorldMeta(projectId, id, { theme: newTheme });
    setSavedDesigns(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, theme: newTheme } : d);
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleSettingsChange = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    fileArchive.saveSettings(newSettings);
    setSelectedModel(newSettings.defaultModel);
    setLanguage(newSettings.defaultLanguage);
    setAutoAdaptTheme(newSettings.autoAdaptTheme);
  }, []);

  const handleClear = () => {
    setTheme('');
    setThemeDescription('');
    setDesignStructure(null);
    setActiveWorldName(null);
    setError(null);
  };
  
  const handleExport = () => {
    if (!designStructure) return;
    const dataStr = JSON.stringify({ theme, theme_description: themeDescription, structure: designStructure }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `GDESIGN_${theme.replace(/\s+/g, '_').toLowerCase() || 'estrutura'}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error("File content is not a string.");
        const data = JSON.parse(text);
        if (data.theme && data.structure && data.structure.groups && data.structure.icon && typeof data.structure.visualStyle === 'string') {
          setTheme(data.theme);
          setThemeDescription(data.theme_description || '');
          setDesignStructure(data.structure);
          setError(null);
        } else {
          throw new Error("Invalid JSON structure.");
        }
      } catch (err) {
        console.error("Failed to parse JSON", err);
        setError("Falha ao importar o ficheiro. Verifique se é um JSON válido da Estrutura.");
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  if (currentView === 'home') {
    return (
      <>
        <HomePage
          savedDesigns={savedDesigns}
          onCreateNew={handleCreateNew}
          onLoadWorld={handleLoadFromArchive}
          onDeleteWorld={handleDeleteFromArchive}
          onRenameWorld={handleRename}
          onToggleLock={handleToggleLock}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHelp={() => setIsHelpOpen(true)}
          onOpenUsage={() => setIsUsageOpen(true)}
          onOpenModelTest={() => setCurrentView('model-test')}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          onBackToLauncher={onBackToLauncher}
          projectName={projectName}
        />
        {isSettingsOpen && (
          <SettingsModal
            settings={settings}
            onChange={handleSettingsChange}
            onClose={() => setIsSettingsOpen(false)}
            availableModels={AVAILABLE_MODELS}
          />
        )}
        {isHelpOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="neo-card bg-brand-surface max-w-lg w-full p-8">
              <p className="text-sm font-black uppercase tracking-widest text-brand-text mb-4">About Massive Scan</p>
              <p className="text-xs text-brand-subtle leading-relaxed">AI-powered game design world builder. Enter a theme, get a full design bible with groups, subgroups, art direction and image prompts — powered by Google Gemini.</p>
              <button onClick={() => setIsHelpOpen(false)} className="neo-btn mt-6 px-4 py-2 text-xs font-black bg-brand-text text-brand-surface">Close</button>
            </div>
          </div>
        )}
        {isUsageOpen && (
          <UsageDashboard onClose={() => setIsUsageOpen(false)} />
        )}
      </>
    );
  }

  if (currentView === 'images' && designStructure) {
    return (
      <>
        <ImageStudio
          designStructure={designStructure}
          theme={theme}
          themeDescription={themeDescription}
          defaultImageModel={settings.defaultImageModel}
          onBack={() => setCurrentView('editor')}
          onGoToCards={handleGoToCards}
          onSave={handleSaveImages}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
          projectName={projectName}
          projectId={projectId}
          activeWorldId={activeWorldId ?? undefined}
        />
        {isSettingsOpen && (
          <SettingsModal
            settings={settings}
            onChange={handleSettingsChange}
            onClose={() => setIsSettingsOpen(false)}
            availableModels={AVAILABLE_MODELS}
          />
        )}
      </>
    );
  }

  if (currentView === 'cards' && designStructure) {
    return (
      <>
        <CardStudio
          designStructure={designStructure}
          theme={theme}
          defaultImageModel={settings.defaultImageModel}
          onBack={() => setCurrentView('images')}
          onGoToFusion={handleGoToFusion}
          onSave={handleSaveImages}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
          projectName={projectName}
        />
        {isSettingsOpen && (
          <SettingsModal
            settings={settings}
            onChange={handleSettingsChange}
            onClose={() => setIsSettingsOpen(false)}
            availableModels={AVAILABLE_MODELS}
          />
        )}
      </>
    );
  }

  if (currentView === 'model-test') {
    return (
      <ModelTestPage
        onBack={() => setCurrentView('home')}
        projectName={projectName}
      />
    );
  }

  if (currentView === 'fusion' && designStructure) {
    return (
      <>
        <DeckFusion
          designStructure={designStructure}
          theme={theme}
          projectId={projectId}
          onBack={() => setCurrentView('cards')}
          onSave={handleSaveImages}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
          projectName={projectName}
        />
        {isSettingsOpen && (
          <SettingsModal
            settings={settings}
            onChange={handleSettingsChange}
            onClose={() => setIsSettingsOpen(false)}
            availableModels={AVAILABLE_MODELS}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col pb-10">
      <Header
        onBackToHome={handleGoHome}
        activeWorldName={activeWorldName}
        projectName={projectName}
        theme={theme}
        setTheme={setTheme}
        themeDescription={themeDescription}
        setThemeDescription={setThemeDescription}
        designStructure={designStructure}
        onGenerate={handleGenerate}
        onCancel={handleCancel}
        onSave={handleSaveToArchive}
        onGoToImages={handleGoToImages}
        onImport={handleImportClick}
        onExport={handleExport}
        onClear={handleClear}
        onUpdate={handleUpdate}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isGenerating={isLoading}
        genProgress={genProgress}
        canExport={!!designStructure}
        onTranslate={handleTranslate}
        isTranslating={isTranslating}
        apiStats={apiStats}
        language={language}
        setLanguage={handleLanguageChange}
        autoAdaptTheme={autoAdaptTheme}
        setAutoAdaptTheme={setAutoAdaptTheme}
        isAdaptingTheme={isAdaptingTheme}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        defaultTranslateTo={settings.defaultTranslateTo}
        onRegenerateAllSubgroups={handleRegenerateAllSubgroups}
        onOpenUsage={() => setIsUsageOpen(true)}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        availableModels={AVAILABLE_MODELS}
      />
       <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".json"
      />
      <main className="flex-grow max-w-7xl mx-auto w-full px-6 py-8">
        {error && (
          <div className="neo-card bg-red-100 dark:bg-red-900/30 border-red-500 dark:border-red-400 text-red-900 dark:text-red-200 px-4 py-3 text-center mb-6 font-bold text-sm" style={{ boxShadow: '4px 4px 0 0 #ef4444' }} role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="neo-card bg-brand-secondary dark:bg-brand-secondary/30 border-brand-primary text-brand-text px-4 py-3 text-center mb-6 font-bold text-sm" role="alert">
            <span className="block sm:inline">{successMessage}</span>
          </div>
        )}
        <DesignCanvas
          groups={designStructure?.groups ?? null}
          isLoading={isLoading}
          onRegenerateGroup={handleRegenerateGroup}
          onRegenerateSubgroups={handleRegenerateSubgroups}
          onRegenerateSingleSubgroup={handleRegenerateSingleSubgroup}
          loadingSubgroupKeys={loadingSubgroupKeys}
          onUpdate={handleUpdate}
        />
      </main>
      
      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setIsSettingsOpen(false)}
          availableModels={AVAILABLE_MODELS}
        />
      )}

      {isUsageOpen && (
        <UsageDashboard onClose={() => setIsUsageOpen(false)} />
      )}


      <TelemetryOverlay
        activeModel={activeModel}
        turnCount={turnCount}
        logs={logs}
        isOpen={isTelemetryOpen}
        setIsOpen={setIsTelemetryOpen}
      />

      {isHelpOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-brand-surface border border-brand-secondary rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-brand-surface border-b border-brand-secondary p-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold text-brand-text">Sobre o GDESIGN Estrutura</h2>
              <button 
                onClick={() => setIsHelpOpen(false)}
                className="text-brand-subtle hover:text-brand-text p-1 rounded-lg hover:bg-brand-secondary/50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 text-brand-text/90 leading-relaxed space-y-4 text-sm md:text-base">
              <p>
                Esta aplicação é uma ferramenta de design de universos de jogo assistida por inteligência artificial, construída em React com a API do Google Gemini, cujo objetivo principal é eliminar o "bloqueio de página em branco" que designers de jogos enfrentam ao iniciar um novo projeto.
              </p>
              <p>
                O fluxo é simples: o utilizador introduz um tema livre (por exemplo, "Egipto Futurista", "Piratas do Espaço" ou "Idade Média Cyberpunk") e a aplicação faz duas chamadas sequenciais à IA — primeiro gera uma descrição contextual rica do tema (época, locais, eventos-chave) e depois, usando essa descrição como guia, gera automaticamente uma estrutura completa de mundo composta por 6 grupos temáticos (que podem representar facções, regiões, civilizações ou qualquer conceito que a IA considere relevante para o tema) mais 1 sétimo grupo especial de "Ações" que contém 4 eventos positivos e 4 negativos que podem acontecer no jogo (como "O Herói Retorna" ou "A Traição do General").
              </p>
              <p>
                Cada grupo vem equipado com título, descrição, mood gráfico (direção de arte), ícone, 2 cenários detalhados de imagem para futura geração visual, e 6 subgrupos com os mesmos campos — resultando numa estrutura massiva com dezenas de elementos criativos prontos a usar.
              </p>
              <p>
                A partir daí, o utilizador tem controlo total: pode editar qualquer campo inline com um simples clique (títulos, descrições, moods, prompts de imagem), regenerar individualmente qualquer grupo ou conjunto de subgrupos que não lhe agrade (pedindo à IA uma nova versão sem repetir os existentes), marcar cenários de imagem como favoritos com estrela, e quando estiver satisfeito pode exportar tudo para JSON para usar noutras ferramentas ou reimportar mais tarde.
              </p>
              <p>
                A barra inferior de telemetria permite trocar entre três modelos Gemini (Pro, Flash e Flash Lite) conforme a necessidade de qualidade vs. velocidade, e regista um log completo de todas as interações com a IA incluindo timestamps, modelo usado, intenção e status de sucesso/erro — essencialmente transformando um simples tema numa bíblia de design de jogo estruturada e editável em poucos segundos.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;