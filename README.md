# GDESIGN Estrutura

Ferramenta de design de universos de jogo assistida por inteligência artificial. O utilizador introduz um tema livre e a aplicação gera automaticamente uma estrutura criativa completa — eliminando o "bloqueio de página em branco" que designers de jogos enfrentam ao iniciar um novo projeto.

## O que faz

Dado um tema (ex: *"Egipto Futurista"*, *"Piratas do Espaço"*, *"Idade Média Cyberpunk"*), a app faz as seguintes chamadas à API Gemini em sequência:

1. **Descrição do tema** — gera um contexto rico: época, locais geográficos, eventos-chave históricos ou ficcionais.
2. **Estrutura base** — cria 6 grupos temáticos distintos (facções, regiões, civilizações, etc.) com título, descrição, mood gráfico e ícone.
3. **Detalhe de cada grupo** — para cada um dos 6 grupos, gera 6 subgrupos + 2 prompts de imagem prontos para geração visual.
4. **7.º grupo especial: Ações** — um grupo de 8 eventos do jogo: 4 positivos (ex: *"O Herói Retorna"*) e 4 negativos (ex: *"A Traição do General"*), cada um também com subgrupos e prompts de imagem.

O resultado final é uma **bíblia de design de jogo estruturada** com dezenas de elementos criativos prontos a usar.

## Stack técnica

| Tecnologia | Versão |
|---|---|
| React | 19 |
| TypeScript | 5.8 |
| Vite | 6 |
| @google/genai SDK | 1.28 |

## Funcionalidades

- **Geração progressiva** — os grupos aparecem no ecrã à medida que são gerados, sem esperar pelo final
- **Edição inline** — qualquer campo (título, descrição, mood, prompt de imagem) é editável com um clique
- **Regeneração seletiva** — regenera individualmente um grupo ou os subgrupos de um grupo sem perder o resto
- **Favoritos** — marca prompts de imagem com estrela para identificar os preferidos
- **Exportar / Importar JSON** — guarda a estrutura completa num ficheiro `GDESIGN_<tema>.json` e reimporta mais tarde
- **Múltiplos modelos Gemini** — escolhe entre Gemini 2.5 Flash, 2.5 Flash Lite, 3 Flash, 3 Pro, 3.1 Flash, 3.1 Pro, etc.
- **Multi-idioma** — a estrutura gerada pode ser em qualquer idioma; os prompts de imagem são sempre gerados em inglês
- **Dark / Light mode**
- **Telemetria** — overlay inferior com log completo de todas as chamadas à IA: timestamp, modelo, intenção e status (Pending / Success / Error)

## Configuração

**Pré-requisitos:** Node.js

```bash
npm install
```

Edita o ficheiro [.env.local](.env.local) e define a tua chave:

```
GEMINI_API_KEY=a_tua_chave_aqui
```

```bash
npm run dev
```

## Estrutura de ficheiros

```
├── App.tsx                          # Estado global, orquestração das chamadas à IA
├── index.tsx                        # Entry point React
├── types.ts                         # Interfaces TypeScript (Group, Subgroup, ImageScenario, etc.)
├── services/
│   └── geminiService.ts             # Todas as chamadas à API Gemini com structured output
└── components/
    ├── Header.tsx                   # Barra superior com tema, idioma, modelo, export/import
    ├── DesignCanvas.tsx             # Grid de GroupCards
    ├── GroupCard.tsx                # Card de cada grupo com subgrupos e prompts
    ├── EditableText.tsx             # Campo de texto editável inline
    ├── HighlightOnChange.tsx        # Animação de highlight quando um valor muda
    ├── TelemetryOverlay.tsx         # Overlay inferior com log de API e seletor de modelo
    └── icons.tsx                    # Ícones SVG inline
```

## Formato de exportação JSON

```json
{
  "theme": "Egipto Futurista",
  "theme_description": "...",
  "structure": {
    "icon": "Olho de Hórus Digital",
    "visualStyle": "...",
    "groups": [
      {
        "title": "A Teocracia do Silício",
        "description": "...",
        "mood": "Ouro polido, circuitos de neon azul...",
        "icon": "Coroa de Circuitos",
        "imagePrompts": [...],
        "subgroups": [...]
      }
    ]
  }
}
```
