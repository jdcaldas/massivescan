import { GoogleGenAI, Type } from '@google/genai';
import type { Group, Subgroup, DesignStructure, ImageScenario, TokenUsage } from '../types';

// ── Fixed design-phase structure ─────────────────────────────────────────────
// The card deck always has this exact shape (7 groups total):
//   • 4 color tiers × 7 game cards each = 28 game cards (interleaved 1-2-3-4-1-2-3-4…)
//   • 1 Power-ups group × 8 cards
//   • 1 Utility group × ~4 cards (instructions, sponsor, promo video)
//   • 1 Activators group × 1 card (the game-launch activator)
// Each group's cover image is reused on every card-back in its tier.
// Each group's subgroups[i] image is the front of one specific card.
export const DESIGN_PHASE_GROUPS = [
    {
        groupType: 'Grupo A', color: 'Yellow', subgroupCount: 7,
        label: 'Tier 1 (Yellow) — 7 game cards (1 legendary + 1 rare + 5 commons)',
        subgroupNature: 'Cada subgrupo é UM elemento temático específico (personagem, lugar, facção, conceito) desta tier. HIERARQUIA DE RARIDADE OBRIGATÓRIA: subgrupo 1 = elemento MAIS ICÓNICO/LENDÁRIO (carta 3★ rara), subgrupo 2 = elemento IMPORTANTE/SECUNDÁRIO (carta 2★), subgrupos 3-7 = elementos COMUNS/REGULARES (cartas 1★). A ordem narrativa deve descer do mais épico ao mais quotidiano.',
    },
    {
        groupType: 'Grupo B', color: 'Green', subgroupCount: 7,
        label: 'Tier 2 (Green) — 7 game cards (1 legendary + 1 rare + 5 commons)',
        subgroupNature: 'Cada subgrupo é UM elemento temático específico (personagem, lugar, facção, conceito) desta tier. HIERARQUIA DE RARIDADE OBRIGATÓRIA: subgrupo 1 = elemento MAIS ICÓNICO/LENDÁRIO (carta 3★ rara), subgrupo 2 = elemento IMPORTANTE/SECUNDÁRIO (carta 2★), subgrupos 3-7 = elementos COMUNS/REGULARES (cartas 1★). A ordem narrativa deve descer do mais épico ao mais quotidiano.',
    },
    {
        groupType: 'Grupo C', color: 'Blue', subgroupCount: 7,
        label: 'Tier 3 (Blue) — 7 game cards (1 legendary + 1 rare + 5 commons)',
        subgroupNature: 'Cada subgrupo é UM elemento temático específico (personagem, lugar, facção, conceito) desta tier. HIERARQUIA DE RARIDADE OBRIGATÓRIA: subgrupo 1 = elemento MAIS ICÓNICO/LENDÁRIO (carta 3★ rara), subgrupo 2 = elemento IMPORTANTE/SECUNDÁRIO (carta 2★), subgrupos 3-7 = elementos COMUNS/REGULARES (cartas 1★). A ordem narrativa deve descer do mais épico ao mais quotidiano.',
    },
    {
        groupType: 'Grupo D', color: 'Magenta', subgroupCount: 7,
        label: 'Tier 4 (Magenta) — 7 game cards (1 legendary + 1 rare + 5 commons)',
        subgroupNature: 'Cada subgrupo é UM elemento temático específico (personagem, lugar, facção, conceito) desta tier. HIERARQUIA DE RARIDADE OBRIGATÓRIA: subgrupo 1 = elemento MAIS ICÓNICO/LENDÁRIO (carta 3★ rara), subgrupo 2 = elemento IMPORTANTE/SECUNDÁRIO (carta 2★), subgrupos 3-7 = elementos COMUNS/REGULARES (cartas 1★). A ordem narrativa deve descer do mais épico ao mais quotidiano.',
    },
    {
        groupType: 'Grupo Power-ups', color: 'Special', subgroupCount: 8,
        label: 'Power-ups — 8 action/event cards (4 positive + 4 negative)',
        subgroupNature: 'Estes 8 subgrupos NÃO são personagens nem locais — são AÇÕES/EVENTOS de jogo que afetam a jogabilidade quando uma carta é jogada. Divida EXATAMENTE em: 4 ações POSITIVAS (vantagens, bónus, eventos sortudos — ex: "O Herói Retorna", "Aliança Inesperada", "Tesouro Descoberto") e 4 ações NEGATIVAS (contratempos, armadilhas, desgraças — ex: "A Traição do General", "A Praga Espalha", "Tempestade Devastadora"). O título deve ser dramático e impactante. A descrição deve explicar o efeito da ação no jogo. O mood deve refletir a energia da ação (triunfante para positivas, sombrio para negativas).',
    },
    {
        groupType: 'Grupo Extra/Utilitários', color: 'Special', subgroupCount: 4,
        label: 'Utility — 4 utility cards',
        subgroupNature: 'Estes 4 subgrupos são CARTAS UTILITÁRIAS do jogo (não narrativas): 1) Instruções/Regras, 2) Patrocinador, 3) Vídeo Promocional, 4) Outra carta utilitária complementar. Mantenha o carácter funcional e prático.',
    },
    {
        groupType: 'Grupo Activators', color: 'Special', subgroupCount: 1,
        label: 'Activators — 1 activator card (game launcher)',
        subgroupNature: 'Este 1 subgrupo é a CARTA ATIVADORA do jogo — o ponto de entrada/lançamento. Não é uma carta narrativa nem utilitária comum: é o "iniciador" que arranca a experiência. O título deve evocar começo/despertar/ativação (ex: "O Despertar", "Início da Jornada", "A Chave"). A descrição deve reflectir o acto de iniciar o jogo. O mood deve ser de promessa/expectativa/abertura.',
    },
] as const;

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const imageScenarioSchema = {
    type: Type.OBJECT,
    properties: {
        prompt: { type: Type.STRING, description: 'Apenas a descrição visual detalhada para a geração de imagem. DEVE SER ESCRITA EM INGLÊS (ENGLISH).' },
    },
    required: ['prompt']
};

const imagePromptsSchema = {
    type: Type.ARRAY,
    description: 'Uma lista de EXATAMENTE 2 cenários de imagem muito detalhados baseados no mood gráfico, sem texto ou legendas. Apenas descrição visual. DEVEM SER ESCRITOS EM INGLÊS (ENGLISH).',
    items: imageScenarioSchema
};

const subgroupSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: 'Um nome evocativo para o subgrupo (ex: "Os Escribas de Neón", "Mercado de Especiarias Cibernéticas").' },
        description: { type: Type.STRING, description: 'Uma breve descrição de uma frase sobre o que é este subgrupo.' },
        mood: { type: Type.STRING, description: 'Uma descrição concisa do "mood" gráfico específico para este subgrupo (ex: "Hologramas trémulos, metal enferrujado, cabos expostos").' },
        imagePrompts: imagePromptsSchema,
    },
    required: ['title', 'description', 'mood', 'imagePrompts']
};

const groupSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: 'Um nome evocativo e criativo para este grupo temático. Ex: "A Teocracia do Silício".' },
        description: { type: Type.STRING, description: 'Uma descrição de uma ou duas frases sobre o conceito geral e o papel deste grupo no mundo.' },
        mood: { type: Type.STRING, description: 'Uma descrição concisa do "mood" gráfico e direção de arte para o grupo. Ex: "Ouro polido, circuitos de neon azul, areia, hologramas de hieróglifos".' },
        icon: { type: Type.STRING, description: 'Uma única palavra ou frase curta que representa visualmente este grupo (ex: "Coroa de Circuitos", "Adaga de Obsidiana").' },
        imagePrompts: imagePromptsSchema,
        subgroups: {
            type: Type.ARRAY,
            description: 'Uma lista de EXATAMENTE 6 subgrupos detalhados que pertencem a este grupo.',
            items: subgroupSchema
        }
    },
    required: ['title', 'description', 'mood', 'icon', 'imagePrompts', 'subgroups']
};

const specialGroupSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: 'Um nome evocativo para o grupo de ações, ex: "Pontos de Virada".' },
        description: { type: Type.STRING, description: 'Uma descrição de uma ou duas frases sobre como estas ações impactam o mundo.' },
        mood: { type: Type.STRING, description: 'Uma descrição concisa do "mood" gráfico para o grupo de ações.' },
        icon: { type: Type.STRING, description: 'Uma única palavra ou frase curta que representa visualmente este grupo de ações (ex: "Balança", "Impacto").' },
        imagePrompts: imagePromptsSchema,
        subgroups: {
            type: Type.ARRAY,
            description: 'Uma lista de EXATAMENTE 8 subgrupos de ações (4 positivas, 4 negativas).',
            items: subgroupSchema
        }
    },
    required: ['title', 'description', 'mood', 'icon', 'imagePrompts', 'subgroups']
};


const processImagePrompts = (prompts: { prompt: string }[]): ImageScenario[] => {
    return prompts.map(p => ({
        prompt: p.prompt,
        base64Image: '',
        qrCodePosition: '',
        powerPosition: '',
        powerLevel: '',
        characterPosition: '',
        character: '',
        frameExist: '',
        frameType: '',
        frameColor: '',
        frameWidth: '',
        cardSide: '',
        cardType: '',
        qrCodeURL: '',
        mediaURL: '',
        partner: '',
    }));
};

export const translateText = async (text: string, targetLanguage: string, model: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model,
        contents: `Translate the following title to ${targetLanguage}. Return ONLY the translated title, no quotes, no explanation: ${text}`,
    });
    return response.text.trim().replace(/^["']|["']$/g, '');
};

export const generateThemeDescription = async (theme: string, language: string, model: string, onUsage?: (usage: TokenUsage) => void): Promise<string> => {
    const prompt = `
        Aja como um world-builder e historiador experiente.
        Receberá um tema principal. A sua tarefa é criar uma descrição de contexto rica e concisa para este tema.
        A descrição deve fornecer um contexto geral, mencionando elementos como o século, anos aproximados, locais geográficos e eventos históricos ou ficcionais chave que definem o cenário.
        Esta descrição será usada para guiar a geração de um universo de jogo. Seja evocativo e informativo.
        A resposta deve ter entre 2 a 4 frases.

        Tema: "${theme}"

        IMPORTANTE: Responda APENAS com o texto da descrição, sem qualquer formatação extra, títulos ou texto introdutório. O texto gerado DEVE ser escrito em ${language}.
    `;

    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
    });

    if (onUsage && response.usageMetadata) {
        onUsage({
            in: response.usageMetadata.promptTokenCount || 0,
            out: response.usageMetadata.candidatesTokenCount || 0
        });
    }

    return response.text.trim();
};

export class GenerationCancelledError extends Error {
    constructor() { super('Generation cancelled'); this.name = 'GenerationCancelledError'; }
}

export const generateAll = async (
    theme: string,
    themeDescription: string,
    language: string,
    model: string,
    onProgress?: (structure: DesignStructure) => void,
    onUsage?: (usage: TokenUsage) => void,
    onStep?: (step: number, label: string) => void,
    signal?: AbortSignal
): Promise<DesignStructure> => {
    const checkCancelled = () => { if (signal?.aborted) throw new GenerationCancelledError(); };
    let totalIn = 0;
    let totalOut = 0;

    // Fixed structure: 4 color tiers + Power-ups + Utility + Activators = 7 groups.
    const groupCount = DESIGN_PHASE_GROUPS.length;
    const deckGroupsHint = `\n\n      CARD DECK STRUCTURE — the deck has EXACTLY ${groupCount} groups in this order, do NOT change the order or count:\n${DESIGN_PHASE_GROUPS.map((g, i) => `      ${i + 1}. ${g.groupType} — ${g.label}`).join('\n')}\n\n      • Groups 1–4 (Yellow/Green/Blue/Magenta) are progressive thematic tiers — characters, places, factions, or concepts (e.g. chronological eras, difficulty levels, or categories that fit the theme). Each tier's COVER image is shared by all 7 cards in that tier; each subgroup represents ONE specific card. INSIDE EACH TIER, subgroups are ordered by RARITY: subgroup 1 is the legendary 3★ card (most iconic element), subgroup 2 is the rare 2★ card, subgroups 3–7 are the common 1★ cards.\n      • Group 5 (Power-ups) is NOT a thematic tier — it is 8 ACTION/EVENT cards that affect gameplay (4 positive boosts + 4 negative setbacks). The group title/description/mood should reflect "events that shake the world", not a faction or place.\n      • Group 6 (Utility) is 4 functional/utility cards (instructions, sponsor, promo video, other utility). The group title/description/mood should reflect "game meta / rules / services", not a narrative tier.\n      • Group 7 (Activators) is 1 ACTIVATOR card — the game-launcher/entry point. Its cover image IS the visual identity of the activator. The group title/description/mood should evoke "launch / unlock / start the game / opening", not a tier or utility service.\n      Generate creative thematic titles/descriptions/moods that match the user's theme, but the GROUP ORDER and IDENTITY (tier vs. action vs. utility vs. activator) are fixed.`;

    const trackUsage = (response: any) => {
        const currentIn = response.usageMetadata?.promptTokenCount || 0;
        const currentOut = response.usageMetadata?.candidatesTokenCount || 0;
        totalIn += currentIn;
        totalOut += currentOut;
        if (onUsage) {
            onUsage({ in: currentIn, out: currentOut });
        }
    };

    // 1. Generate Base Structure (Icon, Visual Style, 6 Base Groups)
    const basePrompt = `
      Aja como um designer de jogos e world-builder sênior.
      O seu objetivo é combater o "bloqueio de página em branco".
      Receberá um tema principal e uma descrição de contexto para gerar a estrutura base de um design de jogo.

      Tema: "${theme}"
      Descrição do Tema: "${themeDescription || 'Nenhuma descrição fornecida. Crie um contexto apropriado.'}"

      A sua tarefa é criar a estrutura base:
      1.  "icon": Uma única palavra ou frase curta que representa visualmente o tema geral (ex: "Bomba Atómica", "Espada Antiga").
      2.  "visualStyle": Uma descrição concisa do estilo visual global do projeto.
      3.  "groups": Uma lista de EXATAMENTE ${groupCount} grupos temáticos distintos e criativos baseados no tema.

      Para cada grupo, forneça APENAS:
      1.  "title": Um título evocativo.
      2.  "description": Uma descrição de 1-2 frases sobre o conceito geral do grupo.
      3.  "mood": Uma breve descrição da direção de arte e atmosfera geral do grupo.
      4.  "icon": Uma única palavra ou frase curta que representa visualmente este grupo.
      ${deckGroupsHint}

      IMPORTANTE: Todos os textos gerados (títulos, descrições, mood, icon, visualStyle) DEVEM ser escritos em ${language}.
      Não adicione comentários ou texto introdutório. Responda APENAS com o JSON.
    `;

    const baseGroupSchema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: 'Um nome evocativo e criativo para este grupo temático.' },
            description: { type: Type.STRING, description: 'Uma descrição de uma ou duas frases sobre o conceito geral e o papel deste grupo no mundo.' },
            mood: { type: Type.STRING, description: 'Uma descrição concisa do "mood" gráfico e direção de arte para o grupo.' },
            icon: { type: Type.STRING, description: 'Uma única palavra ou frase curta que representa visualmente este grupo.' }
        },
        required: ['title', 'description', 'mood', 'icon']
    };

    checkCancelled();
    onStep?.(1, 'Building concept structure…');
    const baseResponse = await ai.models.generateContent({
        model: model,
        contents: basePrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    icon: { type: Type.STRING, description: "Um ícone descritivo para o tema geral." },
                    visualStyle: { type: Type.STRING, description: "Uma descrição concisa do estilo visual global do projeto." },
                    groups: {
                        type: Type.ARRAY,
                        description: `Uma lista de EXATAMENTE ${groupCount} grupos temáticos base.`,
                        items: baseGroupSchema
                    }
                },
                required: ['icon', 'visualStyle', 'groups']
            }
        }
    });

    trackUsage(baseResponse);
    const baseResult = JSON.parse(baseResponse.text.trim());

    let currentStructure: DesignStructure = {
        icon: baseResult.icon,
        visualStyle: baseResult.visualStyle || "",
        groups: baseResult.groups.map((g: any, idx: number) => ({
            ...g,
            id: crypto.randomUUID(),
            imagePrompts: [],
            subgroups: [],
            favoriteImagePromptIndex: null,
            isLoading: true,
            groupType: DESIGN_PHASE_GROUPS[idx]?.groupType,
        }))
    };

    if (onProgress) onProgress({ ...currentStructure });

    // 2. Generate Subgroups and Image Prompts for each of the 7 groups sequentially
    for (let i = 0; i < currentStructure.groups.length; i++) {
        await delay(1000);
        checkCancelled();
        onStep?.(2 + i, `Detailing group ${i + 1} of ${groupCount}…`);
        const group = currentStructure.groups[i];
        const groupSpec = DESIGN_PHASE_GROUPS[i];
        const subgroupCount = groupSpec.subgroupCount;
        const deckSubgroupHint = `\n\n          CARD DECK CONSTRAINT: This is "${groupSpec.label}". Generate EXACTLY ${subgroupCount} subgroups — one unique creative design concept per individual card in this group.\n\n          NATUREZA DOS SUBGRUPOS: ${groupSpec.subgroupNature}`;
        const detailsPrompt = `
          Aja como um designer de jogos e world-builder sênior.
          O tema principal do mundo é "${theme}".
          Descrição do Tema: "${themeDescription || 'Nenhuma descrição fornecida.'}"

          Estamos a detalhar o seguinte grupo:
          Título: "${group.title}"
          Descrição: "${group.description}"
          Mood: "${group.mood}"

          A sua tarefa é gerar os detalhes visuais e subgrupos para este grupo:
          1. "imagePrompts": Baseado no "mood" do grupo, crie uma lista de EXATAMENTE 2 cenários detalhados para geração de imagem. Devem ser apenas descrições visuais, sem texto ou legendas, cada um dentro de um objeto com a chave "prompt". ESTES PROMPTS DE IMAGEM DEVEM SER ESCRITOS EM INGLÊS.
          2. "subgroups": Uma lista de EXATAMENTE ${subgroupCount} sub-elementos que pertencem a este grupo. Para cada sub-elemento, forneça "title", "description", "mood" e os seus próprios 2 "imagePrompts" detalhados baseados no seu mood específico, cada um dentro de um objeto com a chave "prompt". TODOS OS PROMPTS DE IMAGEM DEVEM SER ESCRITOS EM INGLÊS.
          ${deckSubgroupHint}

          IMPORTANTE: Todos os textos gerados (títulos, descrições, mood) DEVEM ser escritos em ${language}. No entanto, os "imagePrompts" DEVEM SEMPRE ser escritos em INGLÊS.
          Não adicione comentários ou texto introdutório. Responda APENAS com o JSON.
        `;

        const detailsResponse = await ai.models.generateContent({
            model: model,
            contents: detailsPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        imagePrompts: imagePromptsSchema,
                        subgroups: {
                            type: Type.ARRAY,
                            description: `Uma lista de EXATAMENTE ${subgroupCount} subgrupos detalhados que pertencem a este grupo.`,
                            items: subgroupSchema
                        }
                    },
                    required: ['imagePrompts', 'subgroups']
                }
            }
        });

        trackUsage(detailsResponse);
        const detailsResult = JSON.parse(detailsResponse.text.trim());

        currentStructure.groups[i] = {
            ...group,
            isLoading: false,
            imagePrompts: processImagePrompts(detailsResult.imagePrompts),
            subgroups: detailsResult.subgroups.map((sg: any) => ({
                ...sg,
                favoriteImagePromptIndex: null,
                imagePrompts: processImagePrompts(sg.imagePrompts)
            }))
        };
        if (onProgress) onProgress({ ...currentStructure });
    }

    return currentStructure;
};

export const regenerateGroup = async (theme: string, themeDescription: string, existingGroupTitles: string[], language: string, model: string, onUsage?: (usage: TokenUsage) => void): Promise<Omit<Group, 'id'>> => {
    const prompt = `
      Aja como um designer de jogos e world-builder sênior.
      O tema principal do mundo é "${theme}".
      Descrição do Tema: "${themeDescription || 'Nenhuma descrição fornecida.'}"
      Já existem os seguintes grupos: ${existingGroupTitles.join(', ')}.

      A sua tarefa é gerar UM ÚNICO novo grupo temático que seja criativo, distinto dos existentes e que se encaixe no tema principal.

      Para este novo grupo, forneça:
      1. "title": Um título evocativo.
      2. "description": Uma descrição de 1-2 frases sobre o conceito geral do grupo.
      3. "mood": Uma breve descrição da direção de arte e atmosfera geral do grupo.
      4. "icon": Uma única palavra ou frase curta que representa visualmente este grupo.
      5. "imagePrompts": Baseado no "mood", crie uma lista de EXATAMENTE 2 cenários detalhados para geração de imagem. Devem ser apenas descrições visuais, sem texto ou legendas, cada um dentro de um objeto com a chave "prompt". ESTES PROMPTS DE IMAGEM DEVEM SER ESCRITOS EM INGLÊS.
      6. "subgroups": Uma lista de EXATAMENTE 6 sub-elementos. Para cada sub-elemento, forneça "title", "description", "mood", e os seus próprios 2 "imagePrompts" detalhados, cada um dentro de um objeto com a chave "prompt". TODOS OS PROMPTS DE IMAGEM DEVEM SER ESCRITOS EM INGLÊS.

      IMPORTANTE: Todos os textos gerados (títulos, descrições, mood, icon) DEVEM ser escritos em ${language}. No entanto, os "imagePrompts" DEVEM SEMPRE ser escritos em INGLÊS.
      Não adicione comentários ou texto introdutório. Responda APENAS com o JSON do novo grupo.
    `;

    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: groupSchema
        }
    });

    if (onUsage && response.usageMetadata) {
        onUsage({
            in: response.usageMetadata.promptTokenCount || 0,
            out: response.usageMetadata.candidatesTokenCount || 0
        });
    }

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);

    return {
        ...result,
        favoriteImagePromptIndex: null,
        imagePrompts: processImagePrompts(result.imagePrompts),
        subgroups: result.subgroups.map((subgroup: any) => ({
            ...subgroup,
            favoriteImagePromptIndex: null,
            imagePrompts: processImagePrompts(subgroup.imagePrompts),
        })),
    };
};

export const regenerateSubgroups = async (theme: string, themeDescription: string, parentGroupName: string, existingSubgroupTitles: string[], language: string, model: string, onUsage?: (usage: TokenUsage) => void, subgroupCount: number = 6): Promise<Subgroup[]> => {
    const prompt = `
      Aja como um designer de jogos e world-builder sênior.
      O tema principal do mundo é "${theme}".
      Descrição do Tema: "${themeDescription || 'Nenhuma descrição fornecida.'}"
      Estamos a focar no grupo chamado "${parentGroupName}".
      Os subgrupos atuais são: ${existingSubgroupTitles.join(', ')}.

      A sua tarefa é gerar uma nova lista de EXATAMENTE ${subgroupCount} subgrupos criativos e detalhados para o grupo "${parentGroupName}", considerando o tema geral e sua descrição.
      Os novos subgrupos devem ser distintos dos existentes.

      Para cada novo subgrupo, forneça "title", "description", "mood", e "imagePrompts". Os "imagePrompts" devem ser uma lista de 2 cenários detalhados para geração de imagem, baseados no mood do subgrupo, cada um dentro de um objeto com a chave "prompt". TODOS OS PROMPTS DE IMAGEM DEVEM SER ESCRITOS EM INGLÊS.

      IMPORTANTE: Todos os textos gerados (títulos, descrições, mood) DEVEM ser escritos em ${language}. No entanto, os "imagePrompts" DEVEM SEMPRE ser escritos em INGLÊS.
      Responda APENAS com um objeto JSON contendo a chave "subgroups", que é um array com os ${subgroupCount} novos objetos de subgrupo.
    `;
    
    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    subgroups: {
                        type: Type.ARRAY,
                        description: `Uma lista de EXATAMENTE ${subgroupCount} novos subgrupos.`,
                        items: subgroupSchema
                    }
                },
                required: ['subgroups']
            }
        }
    });
    
    if (onUsage && response.usageMetadata) {
        onUsage({
            in: response.usageMetadata.promptTokenCount || 0,
            out: response.usageMetadata.candidatesTokenCount || 0
        });
    }

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    return result.subgroups.map((subgroup: any) => ({
        ...subgroup,
        favoriteImagePromptIndex: null,
        imagePrompts: processImagePrompts(subgroup.imagePrompts),
    }));
};

export const regenerateSingleSubgroup = async (
  theme: string,
  themeDescription: string,
  parentGroupTitle: string,
  currentSubgroupTitle: string,
  otherSubgroupTitles: string[],
  language: string,
  model: string,
  onUsage?: (usage: TokenUsage) => void
): Promise<Subgroup> => {
  const prompt = `
    You are a senior game designer and world-builder.
    The main theme is "${theme}".
    Theme description: "${themeDescription || 'None provided.'}"
    We are working on the group called "${parentGroupTitle}".
    The other existing subgroups in this group are: ${otherSubgroupTitles.length ? otherSubgroupTitles.join(', ') : 'none'}.

    Create ONE new, creative and detailed subgroup to replace "${currentSubgroupTitle}" for the group "${parentGroupTitle}".
    It must be distinct from all other existing subgroups listed above.

    Provide "title", "description", "mood", and "imagePrompts".
    "imagePrompts" must be a list of exactly 2 detailed image generation scenarios based on the subgroup's mood, each with a "prompt" key. IMAGE PROMPTS MUST BE IN ENGLISH.

    IMPORTANT: All generated texts (title, description, mood) MUST be in ${language}. Image prompts MUST always be in ENGLISH.
    Reply ONLY with a JSON object containing the key "subgroup" with the single new subgroup object.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: { subgroup: subgroupSchema },
        required: ['subgroup'],
      },
    },
  });

  if (onUsage && response.usageMetadata) {
    onUsage({
      in: response.usageMetadata.promptTokenCount || 0,
      out: response.usageMetadata.candidatesTokenCount || 0,
    });
  }

  const result = JSON.parse(response.text.trim());
  return {
    ...result.subgroup,
    favoriteImagePromptIndex: null,
    imagePrompts: processImagePrompts(result.subgroup.imagePrompts),
  };
};

export const translateDesign = async (
    theme: string,
    themeDescription: string,
    structure: DesignStructure,
    targetLanguage: string,
    model: string,
    onUsage?: (usage: TokenUsage) => void
): Promise<{ theme: string; themeDescription: string; structure: DesignStructure }> => {
    // Strip base64 images before sending to avoid huge payloads; restore after
    const savedImages: Record<string, string> = {};
    const stripped = JSON.parse(JSON.stringify(structure)) as DesignStructure;
    stripped.groups.forEach((g, gi) => {
        g.imagePrompts?.forEach((ip, pi) => {
            if (ip.base64Image) { savedImages[`g${gi}p${pi}`] = ip.base64Image; ip.base64Image = ''; }
        });
        g.subgroups?.forEach((sg, si) => {
            sg.imagePrompts?.forEach((ip, pi) => {
                if (ip.base64Image) { savedImages[`g${gi}s${si}p${pi}`] = ip.base64Image; ip.base64Image = ''; }
            });
        });
    });

    const prompt = `You are a professional translator and creative writer. Translate the following game design project into ${targetLanguage}.

Rules:
- Translate ALL text fields: theme, themeDescription, group titles, descriptions, moods, icons, subgroup titles/descriptions/moods, and image prompts.
- Image prompts MUST remain in English (they are used with image generation APIs).
- Keep the JSON structure EXACTLY the same — only change text values.
- Preserve the creative tone, atmosphere and artistic intent of the original.
- Do NOT add, remove, or rename any JSON keys.

Input:
${JSON.stringify({ theme, themeDescription, structure: stripped }, null, 2)}

Respond with ONLY a valid JSON object with this exact shape:
{
  "theme": "...",
  "themeDescription": "...",
  "structure": { ...same structure with translated text, image prompts still in English }
}`;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
    });

    if (onUsage && response.usageMetadata) {
        onUsage({
            in: response.usageMetadata.promptTokenCount || 0,
            out: response.usageMetadata.candidatesTokenCount || 0,
        });
    }

    const parsed = JSON.parse(response.text.trim());
    const translatedStructure = parsed.structure as DesignStructure;

    // Restore base64 images
    translatedStructure.groups.forEach((g, gi) => {
        g.imagePrompts?.forEach((ip, pi) => {
            if (savedImages[`g${gi}p${pi}`]) ip.base64Image = savedImages[`g${gi}p${pi}`];
        });
        g.subgroups?.forEach((sg, si) => {
            sg.imagePrompts?.forEach((ip, pi) => {
                if (savedImages[`g${gi}s${si}p${pi}`]) ip.base64Image = savedImages[`g${gi}s${si}p${pi}`];
            });
        });
        // Preserve IDs and loading states from original
        g.id = structure.groups[gi]?.id ?? g.id;
    });

    return {
        theme: parsed.theme,
        themeDescription: parsed.themeDescription,
        structure: translatedStructure,
    };
};