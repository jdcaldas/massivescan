import React, { useState, useEffect, useRef } from 'react';
import type { ProjectMeta } from '../projectTypes';
import UsageDashboard from '../design/components/UsageDashboard';

interface ProjectsHomeProps {
  onOpenProject: (project: ProjectMeta) => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

// Vivid accent colours per card
const CARD_COLORS = [
  '#6EE7B7', // mint
  '#93C5FD', // sky blue
  '#FDE68A', // yellow
  '#FCA5A5', // salmon
  '#C4B5FD', // lavender
  '#F9A8D4', // pink
  '#A5F3FC', // cyan
  '#86EFAC', // green
  '#FED7AA', // peach
];

// Project idea suggestions — static pool, picked at random when New Project
// opens. Eclectic on purpose to spark creativity across categories
// (nature, history, food, sports, geography, fiction, music, science…).
interface ProjectIdea { name: string; client?: string; description?: string }
const PROJECT_IDEAS: ProjectIdea[] = [
  { name: 'Animais do Jardim Zoológico de Lisboa', client: 'Zoo de Lisboa', description: '20 animais emblemáticos para uma colecção educativa familiar' },
  { name: 'Lendas do Futebol Português',           description: 'Eusébio, Figo, Cristiano e outros que marcaram época' },
  { name: 'Doces Conventuais de Portugal',         client: 'Confraria dos Doceiros', description: 'Pastel de Tentúgal, Ovos Moles, Pão de Ló — o melhor da pastelaria conventual' },
  { name: 'Castelos Assombrados da Europa',        description: 'Lendas medievais e atmosferas nocturnas' },
  { name: 'Sete Maravilhas do Mundo Antigo',       description: 'Coliseu, Pirâmides, Petra e o resto — viagem ao tempo das maravilhas' },
  { name: 'Aves de Portugal',                      client: 'SPEA — Sociedade Portuguesa para o Estudo das Aves', description: 'Andorinhas, abelharucos, águias e cegonhas — colecção ornitológica' },
  { name: 'Marcos do 25 de Abril',                 description: 'A revolução dos cravos em momentos e personagens' },
  { name: 'Vinhos do Douro',                       client: 'Confraria do Vinho do Porto', description: 'Quintas, castas e safras da região demarcada mais antiga do mundo' },
  { name: 'Praias do Algarve',                     description: 'Da Marinha à Falésia, da Rocha ao Camilo — areia e basalto' },
  { name: 'Plantas Medicinais Brasileiras',        description: 'Pau-d\'arco, guaraná, copaíba e a farmácia da Amazónia' },
  { name: 'Ícones do Cinema Português',            description: 'Manoel de Oliveira, Beatriz Costa, Vasco Santana — caras que fizeram época' },
  { name: 'Galáxias e Nebulosas',                  client: 'Planetário Calouste Gulbenkian', description: 'Andromeda, M82, Cabeça de Cavalo — viagem ao cosmos' },
  { name: 'Dinossauros do Jurássico',              description: 'T-Rex, Triceratops, Brachiosaurus e companhia' },
  { name: 'Cidades Perdidas',                      description: 'Petra, Machu Picchu, Angkor Wat — civilizações desaparecidas' },
  { name: 'Festividades Tradicionais',             description: 'São João, Santos Populares, Festa dos Tabuleiros, Romarias' },
  { name: 'Instrumentos Musicais do Mundo',        description: 'Cavaquinho, didgeridoo, sitar, kalimba — uma volta ao globo em som' },
  { name: 'Constelações do Céu Nocturno',          description: 'Órion, Ursa Maior, Cruzeiro do Sul, Cassiopeia' },
  { name: 'Vulcões Activos',                       description: 'Etna, Fuji, Kilauea, Stromboli — fogo da Terra' },
  { name: 'Robots da Ficção Científica',           description: 'R2-D2, T-800, Wall-E, HAL 9000 — máquinas que viraram lenda' },
  { name: 'Tipos de Café',                         client: 'A Brasileira do Chiado', description: 'Expresso, cortado, abatanado, galão — o pequeno-almoço português' },
  { name: 'Pintores Surrealistas',                 description: 'Dalí, Magritte, Frida Kahlo, Max Ernst — sonhos em tela' },
  { name: 'Heróis da Reconquista',                 description: 'Afonso Henriques, Geraldo Sem Pavor, Egas Moniz — fundadores da nação' },
  { name: 'Templos do Mundo',                      description: 'Borobudur, Taj Mahal, Sagrada Família, Notre-Dame' },
  { name: 'Borboletas Tropicais',                  description: 'Morpho, Monarca, Glasswing — asas mais belas da natureza' },
  { name: 'Carros Clássicos dos Anos 60',          description: 'Mustang, Beetle, Citroën DS, Mini Cooper, Alfa Romeo Spider' },
  { name: 'Plantas Carnívoras',                    description: 'Dioneia, Nepenthes, Sarracenia — botânica predadora' },
  { name: 'Mitologia Grega',                       description: 'Zeus, Atena, Hermes, Medusa, Prometeu — panteão olímpico' },
  { name: 'Bandas do Rock Português',              description: 'Heróis do Mar, Xutos, GNR, Madredeus — banda sonora do país' },
  { name: 'Receitas da Avó',                       description: 'Sopa de pedra, arroz de pato, leite-creme — comida que abraça' },
  { name: 'Faróis da Costa Portuguesa',            description: 'Cabo da Roca, Berlenga, São Vicente — guardiões do Atlântico' },
  { name: 'Castas do Vinho Verde',                 client: 'Comissão de Viticultura', description: 'Alvarinho, Loureiro, Trajadura — uvas do Minho' },
  { name: 'Personagens da Disney',                 description: 'Mickey, Belle, Mulan, Stitch — magia em colecção' },
  { name: 'Estações de Comboio Históricas',        description: 'São Bento, King\'s Cross, Antwerpen-Centraal — arquitectura ferroviária' },
  { name: 'Lendas Urbanas Portuguesas',            description: 'Maria da Fonte, Loureço Marques, fantasmas do Quartel' },
  { name: 'Espécies Marinhas do Atlântico',        client: 'Oceanário de Lisboa', description: 'Polvo, choco, garoupa, mero, peixe-espada — mar nosso' },
  { name: 'Pratos Asiáticos Clássicos',            description: 'Sushi, ramen, pad thai, dim sum, biryani — sabores do oriente' },
  { name: 'Super-Heróis Marvel',                   description: 'Spider-Man, Hulk, Black Panther, Captain America' },
  { name: 'Capitães dos Descobrimentos',           description: 'Vasco da Gama, Magalhães, Cabral, Bartolomeu Dias' },
  { name: 'Cogumelos Comestíveis',                 description: 'Boletos, míscaros, chanterelles, tórtulos — colheita do outono' },
  { name: 'Edifícios Brutalistas',                 description: 'Centro Comercial Apolo 70, Banco de Portugal, Tour Bois-le-Prêtre' },
];

// Pick N distinct random items from the pool. Re-shuffled per call.
const pickRandomIdeas = (count: number): ProjectIdea[] => {
  const shuffled = [...PROJECT_IDEAS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

// Inline-rename input
const InlineRename: React.FC<{
  value: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}> = ({ value, onCommit, onCancel }) => {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const commit = () => {
    const v = draft.trim();
    if (v && v !== value) onCommit(v);
    else onCancel();
  };
  return (
    <input
      ref={ref}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') onCancel();
      }}
      className="neo-input text-base font-black uppercase tracking-tight text-brand-text bg-brand-bg px-2 py-0.5 w-full focus:outline-none"
    />
  );
};

const ProjectsHome: React.FC<ProjectsHomeProps> = ({ onOpenProject }) => {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', client: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  const [projectStats, setProjectStats] = useState<Record<string, { decks: number; worlds: number }>>({});
  // 3 random project idea suggestions for the New Project form
  const [suggestions, setSuggestions] = useState<ProjectIdea[]>([]);

  // Refresh suggestions every time the New Project form opens
  useEffect(() => {
    if (creating) setSuggestions(pickRandomIdeas(3));
  }, [creating]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => { setProjects(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Fetch per-project stats whenever the projects list changes
  useEffect(() => {
    if (projects.length === 0) return;
    projects.forEach(p => {
      Promise.all([
        fetch(`/api/projects/${p.id}/cards/list`).then(r => r.json()).catch(() => null),
        fetch(`/api/projects/${p.id}/worlds`).then(r => r.json()).catch(() => null),
      ]).then(([cardsRes, worldsRes]) => {
        setProjectStats(prev => ({
          ...prev,
          [p.id]: {
            decks:  Array.isArray(cardsRes?.files) ? cardsRes.files.length : 0,
            worlds: Array.isArray(worldsRes)        ? worldsRes.length      : 0,
          },
        }));
      });
    });
  }, [projects]);

  const createProject = async () => {
    if (!draft.name.trim()) return;
    const now = new Date().toISOString();
    const project: ProjectMeta = {
      id: generateId(),
      name: draft.name.trim(),
      client: draft.client.trim() || undefined,
      description: draft.description.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      status: 'active',
    };
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    setProjects(prev => [project, ...prev]);
    setDraft({ name: '', client: '', description: '' });
    setCreating(false);
    onOpenProject(project);
  };

  const deleteProject = async (id: string) => {
    if (!window.confirm('Delete this project and all its data? This cannot be undone.')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const renameProject = async (id: string, newName: string) => {
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, updatedAt: new Date().toISOString() }),
    });
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    setRenamingId(null);
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">

      {/* ── Top-level navigation header (dark) ─────────────────────────── */}
      <header className="border-b-2 border-black bg-brand-text text-brand-surface px-8 h-16 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-brand-secondary border-2 border-black flex items-center justify-center font-black text-sm text-[#0a2a1e]">M</div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-brand-surface/50">Massive Scan</div>
            <div className="text-base font-black uppercase tracking-tight leading-none">Projects</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Dark mode toggle */}
          <button
            onClick={() => setIsDarkMode(v => !v)}
            className="p-2 rounded text-brand-surface/60 hover:text-brand-surface hover:bg-brand-surface/10 transition-colors"
            title={isDarkMode ? 'Light mode' : 'Dark mode'}
          >
            {isDarkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
              </svg>
            )}
          </button>

          {/* Usage button */}
          <button
            onClick={() => setIsUsageOpen(true)}
            className="p-2 rounded text-brand-surface/60 hover:text-brand-surface hover:bg-brand-surface/10 transition-colors"
            title="API Usage"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          </button>

          <div className="w-px h-5 bg-brand-surface/20 mx-1" />

          <button
            onClick={() => setCreating(true)}
            className="neo-btn px-4 py-2 text-xs font-black uppercase tracking-widest bg-brand-secondary text-[#0a2a1e]"
          >
            + New Project
          </button>
          <div className="flex gap-1.5 ml-2">
            {['#6EE7B7', '#FFE500', '#FF4F6D'].map(c => (
              <span key={c} className="w-2.5 h-2.5 border border-white/20 inline-block" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </header>

      {/* New project form */}
      {creating && (
        <div className="border-b-2 border-black bg-brand-surface px-8 py-6">
          <div className="max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-subtle mb-4">New Project</p>

            {/* ── 3 random idea suggestions ─────────────────────────── */}
            {suggestions.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle/70">
                    ✨ Need inspiration? Click a card to fill the form
                  </span>
                  <button
                    onClick={() => setSuggestions(pickRandomIdeas(3))}
                    className="text-[9px] font-black uppercase tracking-widest text-brand-subtle hover:text-brand-text transition-colors px-2 py-0.5 border-2 border-black/15 hover:border-black"
                    style={{ borderRadius: 1 }}
                    title="Show 3 new random ideas"
                  >
                    ↻ shuffle
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {suggestions.map((idea, i) => {
                    const ideaColor = CARD_COLORS[i % CARD_COLORS.length];
                    return (
                      <button
                        key={`${idea.name}-${i}`}
                        onClick={() => setDraft({
                          name: idea.name,
                          client: idea.client ?? '',
                          description: idea.description ?? '',
                        })}
                        className="text-left neo-card overflow-hidden hover:opacity-90 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_#000] transition-all"
                        style={{ boxShadow: '2px 2px 0 0 #000' }}
                      >
                        <div className="h-1 w-full" style={{ backgroundColor: ideaColor }} />
                        <div className="p-2.5 bg-brand-bg flex flex-col gap-1 min-h-[80px]">
                          <span className="text-xs font-black uppercase tracking-tight text-brand-text leading-tight line-clamp-2">
                            {idea.name}
                          </span>
                          {idea.client && (
                            <span className="text-[8px] font-bold uppercase tracking-widest text-brand-subtle/70 truncate">
                              {idea.client}
                            </span>
                          )}
                          {idea.description && (
                            <span className="text-[9px] text-brand-subtle leading-snug line-clamp-2 mt-auto">
                              {idea.description}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <input
                autoFocus
                placeholder="Project name *  (e.g. Animals from London Zoo)"
                value={draft.name}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') createProject(); if (e.key === 'Escape') setCreating(false); }}
                className="neo-input px-3 py-2 text-sm font-bold bg-brand-bg text-brand-text w-full"
              />
              <div className="flex gap-3">
                <input
                  placeholder="Client name  (optional)"
                  value={draft.client}
                  onChange={e => setDraft(d => ({ ...d, client: e.target.value }))}
                  className="neo-input px-3 py-2 text-sm bg-brand-bg text-brand-text flex-1"
                />
                <input
                  placeholder="Short description  (optional)"
                  value={draft.description}
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  className="neo-input px-3 py-2 text-sm bg-brand-bg text-brand-text flex-1"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={createProject}
                  disabled={!draft.name.trim()}
                  className="neo-btn px-5 py-2 text-xs font-black uppercase tracking-widest bg-brand-text text-brand-surface disabled:opacity-30"
                >
                  Create &amp; Open →
                </button>
                <button
                  onClick={() => setCreating(false)}
                  className="neo-btn px-4 py-2 text-xs font-black uppercase tracking-widest bg-brand-surface text-brand-subtle"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-grow px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-brand-text/20 border-t-brand-text rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="neo-card p-8 max-w-sm w-full">
              <div className="text-4xl mb-4">📁</div>
              <h2 className="text-base font-black uppercase tracking-tight text-brand-text mb-2">No projects yet</h2>
              <p className="text-xs text-brand-subtle mb-5">Create your first project to get started.</p>
              <button
                onClick={() => setCreating(true)}
                className="neo-btn px-5 py-2 text-xs font-black uppercase tracking-widest bg-brand-text text-brand-surface w-full"
              >
                + New Project
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-4 mb-6 max-w-6xl">
              <div className="flex items-center gap-2">
                <span className="neo-section-label">Projects</span>
                <span className="text-[10px] font-black bg-brand-text text-brand-surface px-1.5 py-0.5 rounded-full">
                  {projects.length}
                </span>
              </div>

              {/* Search */}
              {projects.length > 4 && (
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search projects…"
                  className="neo-input text-xs bg-brand-surface text-brand-text px-3 py-1.5 w-48 placeholder:text-brand-subtle/40 focus:outline-none"
                />
              )}

              {/* View toggle */}
              <div className="ml-auto flex items-stretch border-2 border-black overflow-hidden" style={{ boxShadow: '2px 2px 0 0 #000' }}>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-2.5 py-1.5 transition-colors ${viewMode === 'grid' ? 'bg-brand-text text-brand-surface' : 'bg-brand-surface text-brand-subtle hover:bg-brand-bg'}`}
                  title="Card view"
                >
                  {/* Grid icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-2.5 py-1.5 transition-colors border-l-2 border-black ${viewMode === 'list' ? 'bg-brand-text text-brand-surface' : 'bg-brand-surface text-brand-subtle hover:bg-brand-bg'}`}
                  title="List view"
                >
                  {/* List icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Filter */}
            {(() => {
              const filtered = search.trim()
                ? projects.filter(p =>
                    p.name.toLowerCase().includes(search.toLowerCase()) ||
                    (p.client ?? '').toLowerCase().includes(search.toLowerCase()) ||
                    (p.description ?? '').toLowerCase().includes(search.toLowerCase())
                  )
                : projects;

              if (filtered.length === 0) return (
                <div className="py-12 text-center text-sm text-brand-subtle">
                  No projects matching <strong>"{search}"</strong>
                </div>
              );

              /* ── CARD VIEW ── */
              if (viewMode === 'grid') return (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 max-w-6xl">
                  {filtered.map((project, idx) => {
                    const color = CARD_COLORS[projects.indexOf(project) % CARD_COLORS.length];
                    const isRenaming = renamingId === project.id;
                    return (
                      <div
                        key={project.id}
                        className="neo-card overflow-hidden flex flex-col"
                        onClick={() => !isRenaming && onOpenProject(project)}
                        style={{ cursor: isRenaming ? 'default' : 'pointer' }}
                      >
                        <div className="h-2 w-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <div className="p-5 flex flex-col gap-3 flex-grow" style={{ backgroundColor: color + '18' }}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {isRenaming ? (
                                <InlineRename
                                  value={project.name}
                                  onCommit={v => renameProject(project.id, v)}
                                  onCancel={() => setRenamingId(null)}
                                />
                              ) : (
                                <h2
                                  className="text-base font-black uppercase tracking-tight text-brand-text leading-tight truncate group flex items-center gap-1.5"
                                  title="Click to rename"
                                  onClick={e => { e.stopPropagation(); setRenamingId(project.id); }}
                                >
                                  {project.name}
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                                  </svg>
                                </h2>
                              )}
                              {project.client && (
                                <p className="text-[10px] font-bold text-brand-subtle uppercase tracking-widest mt-0.5 truncate">{project.client}</p>
                              )}
                            </div>
                            <span
                              className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 flex-shrink-0 border-2 border-black"
                              style={{ backgroundColor: color, color: '#0a0a0a' }}
                            >
                              {project.status}
                            </span>
                          </div>
                          {project.description && (
                            <p className="text-xs text-brand-subtle leading-relaxed line-clamp-2">{project.description}</p>
                          )}
                          {/* Module stats */}
                          {projectStats[project.id] !== undefined && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {[
                                { icon: '🃏', label: 'deck', count: projectStats[project.id].decks,  bg: '#FFE500' },
                                { icon: '🎨', label: 'concept', count: projectStats[project.id].worlds, bg: '#6EE7B7' },
                              ].map(({ icon, label, count, bg }) => (
                                <div
                                  key={label}
                                  className="flex items-center gap-1 border-2 border-black px-1.5 py-0.5"
                                  style={{ backgroundColor: count > 0 ? bg : '#F0EDE6' }}
                                >
                                  <span className="text-[10px] leading-none">{icon}</span>
                                  <span className="text-[9px] font-black uppercase tracking-wide text-[#0a0a0a]">
                                    {count > 0 ? `${count} ${label}${count !== 1 ? 's' : ''}` : `no ${label}s`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-2 border-t border-black/10 mt-auto">
                            <span className="text-[9px] font-bold text-brand-subtle/60 uppercase tracking-widest">{formatDate(project.createdAt)}</span>
                            <button
                              onClick={e => { e.stopPropagation(); deleteProject(project.id); }}
                              className="text-[9px] font-black uppercase tracking-widest text-brand-subtle/40 hover:text-red-500 transition-colors px-1"
                            >Delete</button>
                          </div>
                        </div>
                        <div className="px-5 py-3 border-t-2 border-black flex items-center justify-between" style={{ backgroundColor: color }}>
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#0a0a0a]">Open project</span>
                          <span className="font-black text-[#0a0a0a]">→</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );

              /* ── LIST VIEW ── */
              return (
                <div className="max-w-4xl neo-card overflow-hidden">
                  {filtered.map((project, i) => {
                    const color = CARD_COLORS[projects.indexOf(project) % CARD_COLORS.length];
                    const isRenaming = renamingId === project.id;
                    return (
                      <div
                        key={project.id}
                        className={`flex items-center gap-0 ${i > 0 ? 'border-t-2 border-black' : ''} group`}
                        onClick={() => !isRenaming && onOpenProject(project)}
                        style={{ cursor: isRenaming ? 'default' : 'pointer', backgroundColor: 'var(--color-surface)' }}
                      >
                        {/* Colour accent bar */}
                        <div className="w-1.5 self-stretch flex-shrink-0" style={{ backgroundColor: color }} />

                        {/* Main info */}
                        <div className="flex-1 min-w-0 px-5 py-3.5 flex items-center gap-4">
                          {isRenaming ? (
                            <div className="flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                              <InlineRename
                                value={project.name}
                                onCommit={v => renameProject(project.id, v)}
                                onCancel={() => setRenamingId(null)}
                              />
                            </div>
                          ) : (
                            <div
                              className="flex-1 min-w-0 flex items-center gap-2"
                              title="Click to rename"
                              onClick={e => { e.stopPropagation(); setRenamingId(project.id); }}
                            >
                              <h2 className="text-sm font-black uppercase tracking-tight text-brand-text truncate">
                                {project.name}
                              </h2>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 flex-shrink-0 text-brand-subtle opacity-0 group-hover:opacity-40 transition-opacity">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                              </svg>
                            </div>
                          )}

                          {project.client && (
                            <span className="hidden sm:block text-[10px] font-bold text-brand-subtle uppercase tracking-widest flex-shrink-0">
                              {project.client}
                            </span>
                          )}
                        </div>

                        {/* Meta */}
                        <div className="hidden md:flex items-center gap-3 px-4 flex-shrink-0">
                          {projectStats[project.id] !== undefined && (
                            <>
                              {[
                                { icon: '🃏', count: projectStats[project.id].decks,  bg: '#FFE500' },
                                { icon: '🎨', count: projectStats[project.id].worlds, bg: '#6EE7B7' },
                              ].map(({ icon, count, bg }) => (
                                <div
                                  key={icon}
                                  className="flex items-center gap-1 border-2 border-black px-1.5 py-0.5"
                                  style={{ backgroundColor: count > 0 ? bg : '#F0EDE6' }}
                                >
                                  <span className="text-[10px] leading-none">{icon}</span>
                                  <span className="text-[9px] font-black text-[#0a0a0a]">{count}</span>
                                </div>
                              ))}
                            </>
                          )}
                          <span className="text-[9px] font-bold text-brand-subtle/50 uppercase tracking-widest whitespace-nowrap">
                            {formatDate(project.createdAt)}
                          </span>
                          <span
                            className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-2 border-black"
                            style={{ backgroundColor: color, color: '#0a0a0a' }}
                          >
                            {project.status}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-stretch flex-shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); deleteProject(project.id); }}
                            className="px-4 py-3.5 text-[9px] font-black uppercase tracking-widest text-brand-subtle/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors border-l-2 border-black/10"
                          >
                            Delete
                          </button>
                          <div
                            className="px-5 py-3.5 border-l-2 border-black flex items-center gap-2 font-black text-[10px] uppercase tracking-widest text-[#0a0a0a] group-hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: color }}
                          >
                            Open <span>→</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}
      </main>

      <footer className="border-t-2 border-black px-8 py-3 flex items-center justify-between flex-shrink-0">
        <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle/40">Massive Scan · Design System</span>
        <span className="text-[9px] font-black uppercase tracking-widest text-brand-subtle/40">@jdcaldas 2026</span>
      </footer>

      {/* Usage overlay */}
      {isUsageOpen && <UsageDashboard onClose={() => setIsUsageOpen(false)} />}
    </div>
  );
};

export default ProjectsHome;
