import type { Client } from 'colyseus';
import type { Card } from '../../shared/models/card';
import type { Suit } from '../../shared/enums/suit';
import type { RoundState } from '../../shared/models/round';
import { sendPrivate } from '../utils/privateSend';
import type { RoundSnapshotPayload, PrivateHandPayload, PrivateTrumpPayload } from '../../shared/protocol/game';

export interface PublicRoundStateSnapshot {
  phase: RoundState['phase'];
  tricks: RoundState['tricks'];
  currentTrick: RoundState['currentTrick'];
  trumpRevealed: boolean;
  bids: RoundState['bids'];
  currentBid: RoundState['currentBid'];
  activePlayerId: RoundState['activePlayerId'];
  dealerSeat: RoundState['dealerSeat'];
}

export function createPublicRoundSnapshot(round: RoundState): PublicRoundStateSnapshot {
  return {
    phase: round.phase,
    tricks: round.tricks,
    currentTrick: round.currentTrick,
    trumpRevealed: round.trumpRevealed,
    bids: round.bids,
    currentBid: round.currentBid,
    activePlayerId: round.activePlayerId,
    dealerSeat: round.dealerSeat,
  };
}

export function sendPrivateHand(client: Client, playerId: string, cards: Card[]) {
  const payload: PrivateHandPayload = {
    playerId,
    cards,
  };

  sendPrivate(client, 'privateHand', payload);
}

export function sendPrivateTrump(client: Client, trumpSuit: Suit, trumpHolderId: string) {
  const payload: PrivateTrumpPayload = {
    trumpSuit,
    trumpHolderId,
  };

  sendPrivate(client, 'privateTrump', payload);
}

export function sendRoundSnapshot(client: Client, round: RoundState, playerId: string) {
  const publicState = createPublicRoundSnapshot(round);
  const payload: RoundSnapshotPayload = {
    ...publicState,
    myPlayerId: playerId,
  };

  sendPrivate(client, 'roundSnapshot', payload);
}