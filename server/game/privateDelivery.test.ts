import { describe, expect, it, vi } from 'vitest';
import { createPublicRoundSnapshot, sendPrivateHand, sendPrivateTrump } from './privateDelivery';
import type { RoundState } from '../../shared/models/round';

function createRoundState(): RoundState {
  return {
    phase: 'playing',
    hands: {
      seat0: [
        { rank: 'A', suit: 'H', code: 'AH', points: 1 },
      ],
    },
    tricks: [
      {
        cards: [
          {
            playerId: 'seat0',
            card: { rank: 'A', suit: 'H', code: 'AH', points: 1 },
          },
        ],
        winnerId: 'seat0',
        leadSuit: 'H',
      },
    ],
    currentTrick: {
      cards: [],
      winnerId: null,
      leadSuit: null,
    },
    trumpSuit: 'S',
    trumpRevealed: false,
    trumpHolderId: 'seat0',
    bids: [
      {
        playerId: 'seat0',
        value: 14,
        passed: false,
        isHonours: false,
      },
    ],
    currentBid: null,
    activePlayerId: 'seat1',
    dealerSeat: 0,
  };
}

describe('privateDelivery', () => {
  it('creates a public round snapshot without hidden hand or trump ownership state', () => {
    const round = createRoundState();
    const snapshot = createPublicRoundSnapshot(round);

    expect(snapshot).toEqual({
      phase: 'playing',
      tricks: round.tricks,
      currentTrick: round.currentTrick,
      trumpRevealed: false,
      bids: round.bids,
      currentBid: null,
      activePlayerId: 'seat1',
      dealerSeat: 0,
    });
    expect(snapshot).not.toHaveProperty('hands');
    expect(snapshot).not.toHaveProperty('trumpSuit');
    expect(snapshot).not.toHaveProperty('trumpHolderId');
  });

  it('sends private hand and trump payloads to the target client', () => {
    const client = {
      sessionId: 'seat0',
      send: vi.fn(),
    } as const;

    sendPrivateHand(client as never, 'seat0', [
      { rank: 'A', suit: 'H', code: 'AH', points: 1 },
    ]);
    sendPrivateTrump(client as never, 'S', 'seat0');

    expect(client.send).toHaveBeenCalledWith('privateHand', {
      playerId: 'seat0',
      cards: [{ rank: 'A', suit: 'H', code: 'AH', points: 1 }],
    });
    expect(client.send).toHaveBeenCalledWith('privateTrump', {
      trumpSuit: 'S',
      trumpHolderId: 'seat0',
    });
  });
});