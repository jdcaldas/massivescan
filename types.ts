
export interface ImageScenario {
  prompt: string;
  base64Image: string;
  qrCodePosition: 'TL' | 'TR' | 'BL' | 'BR' | '';
  powerPosition: string;
  powerLevel: string;
  characterPosition: string;
  character: string;
  frameExist: string;
  frameType: string;
  frameColor: string;
  frameWidth: string;
  cardSide: string;
  cardType: string;
  qrCodeURL: string;
  mediaURL: string;
  partner: string;
}

export interface Subgroup {
  title: string;
  description: string;
  mood: string;
  imagePrompts: ImageScenario[];
  favoriteImagePromptIndex: number | null;
}

export interface Group {
  id: string;
  title: string;
  description: string;
  mood: string;
  icon: string;
  subgroups: Subgroup[];
  imagePrompts: ImageScenario[];
  favoriteImagePromptIndex: number | null;
  isLoading?: boolean;
  isSubgroupsLoading?: boolean;
}

export interface DesignStructure {
  icon: string;
  visualStyle: string;
  groups: Group[];
}

export interface TokenUsage {
  in: number;
  out: number;
}

export interface ApiStats {
  generateAll: number;
  regenerateGroup: number;
  regenerateSubgroups: number;
  tokens: Record<string, TokenUsage>;
}

export interface LogEntry {
  turn_id: number;
  timestamp: string;
  model_used: string;
  user_intent: string;
  status: 'Pending' | 'Success' | 'Error';
}
