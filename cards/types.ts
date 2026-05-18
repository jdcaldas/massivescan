
export type QRCodeType = 'game_card' | 'power_up' | 'promo_video' | 'sponsor' | 'instructions' | 'game_activator';
export type QRCodeColor = 'yellow' | 'green' | 'blue' | 'magenta';

export type CardSuit = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
export type CardRank = 'Ace' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'Jack' | 'Queen' | 'King' | 'Joker';
export type CardColor = 'red' | 'black' | 'white' | 'light grey';

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';


export interface QRCode {
  id: string;
  pathId: string;
  key: string;
  type: QRCodeType;
  path?: string;
  // Decoration properties
  number?: number;
  color?: QRCodeColor;
  letter?: string;
  stars?: number;
  // Standard card properties
  suit?: CardSuit;
  rank?: CardRank;
  card_color?: CardColor;
}

export interface DeckDetails {
  deck_name: string;
  deck_description: string;
  version: number;
  baseUrl?: string;
  utilityBaseUrl?: string;
  deck_id?: string;
  errorCorrectionLevel?: ErrorCorrectionLevel;
}

export interface DeckConfig {
  deck_details: DeckDetails;
  qrcodes: QRCode[];
}
