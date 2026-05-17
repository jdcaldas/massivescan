import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Group, Subgroup, DesignStructure, LogEntry } from './types';
import {
  generateAll,
  generateThemeDescription,
  regenerateGroup as apiRegenerateGroup,
  regenerateSubgroups as apiRegenerateSubgroups,
} from './services/geminiService';
import Header from './components/Header';
import DesignCanvas from './components/DesignCanvas';
import TelemetryOverlay from './components/TelemetryOverlay';

const AVAILABLE_MODELS = [
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
  { id: 'gemini-3.1-flash-preview', name: 'Gemini 3.1 Flash' },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite-latest', name: 'Gemini 2.5 Flash Lite' },
];

const App: React.FC = () => {
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
  const [genProgress, setGenProgress] = useState<{ step: number; total: number; label: string } | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [language, setLanguage] = useState<string>('English');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

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

    try {
      setGenProgress({ step: 1, total: 10, label: 'Analyzing theme…' });
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
              (step, label) => setGenProgress({ step: step + 1, total: 10, label })
          )
      );
      
      setDesignStructure(result);
      setSuccessMessage('Estrutura gerada com sucesso!');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, 'Ocorreu um erro ao gerar a estrutura. Por favor, tente novamente.'));
    } finally {
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
          })
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


  const handleClear = () => {
    setTheme('');
    setThemeDescription('');
    setDesignStructure(null);
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

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col pb-10">
      <Header
        theme={theme}
        setTheme={setTheme}
        themeDescription={themeDescription}
        setThemeDescription={setThemeDescription}
        designStructure={designStructure}
        onGenerate={handleGenerate}
        onImport={handleImportClick}
        onExport={handleExport}
        onClear={handleClear}
        onUpdate={handleUpdate}
        onOpenHelp={() => setIsHelpOpen(true)}
        isGenerating={isLoading}
        genProgress={genProgress}
        canExport={!!designStructure}
        apiStats={apiStats}
        language={language}
        setLanguage={setLanguage}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
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
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg relative text-center mb-6 shadow-sm" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-lg relative text-center mb-6 shadow-sm" role="alert">
            <span className="block sm:inline">{successMessage}</span>
          </div>
        )}
        <DesignCanvas
          groups={designStructure?.groups ?? null}
          isLoading={isLoading}
          onRegenerateGroup={handleRegenerateGroup}
          onRegenerateSubgroups={handleRegenerateSubgroups}
          onUpdate={handleUpdate}
        />
      </main>
      
      <TelemetryOverlay 
        activeModel={activeModel}
        turnCount={turnCount}
        logs={logs}
        isOpen={isTelemetryOpen}
        setIsOpen={setIsTelemetryOpen}
        availableModels={AVAILABLE_MODELS}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
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