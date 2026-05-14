import type { Card } from './card';
import type { Suit } from '../enums/suit';

export interface TrickCard {
  playerId: string;
  card: Card;
}

export interface Trick {
  cards: TrickCard[];
  winnerId: string | null;
  leadSuit: Suit | null;
}
