import type { Bid } from './bid';
import type { Card } from './card';
import type { Trick } from './trick';
import type { GamePhase } from '../enums/phase';
import type { PlayerSeat } from './seat';
import type { Suit } from '../enums/suit';

export interface RoundState {
  phase: GamePhase;
  hands: Record<string, Card[]>;
  tricks: Trick[];
  currentTrick: Trick;
  trumpSuit: Suit | null;
  trumpRevealed: boolean;
  trumpHolderId: string;
  bids: Bid[];
  currentBid: Bid | null;
  activePlayerId: string;
  dealerSeat: PlayerSeat;
}
