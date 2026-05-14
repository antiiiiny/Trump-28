import type { Rank } from '../enums/rank';
import type { Suit } from '../enums/suit';

export interface Card {
  rank: Rank;
  suit: Suit;
  code: string; // e.g. 'JH', '10S', '7C' — rank + suit, uppercase
  points: number; // J=3, 9=2, A=1, 10=1, others=0
}
