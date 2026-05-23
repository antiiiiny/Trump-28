import { describe, expect, it } from 'vitest';
import type { Bid } from '../../shared/models/bid';
import type { Card } from '../../shared/models/card';
import type { Trick } from '../../shared/models/trick';
import type { RulesPlayer, RulesState } from './engine';
import { getNextEligibleBidderId, getNextPlayerId, isBiddingComplete, resolveTrick, scoreCoolies, scoreRound, validateBid, validateCardPlay } from './engine';

function createCard(rank: Card['rank'], suit: Card['suit']): Card {
  const points = rank === 'J' ? 3 : rank === '9' ? 2 : rank === 'A' || rank === '10' ? 1 : 0;

  return {
    rank,
    suit,
    code: `${rank}${suit}`,
    points,
  };
}

function createPlayers(): RulesPlayer[] {
  return [
    { playerId: 'p0', seat: 0, team: 'A' },
    { playerId: 'p1', seat: 1, team: 'B' },
    { playerId: 'p2', seat: 2, team: 'A' },
    { playerId: 'p3', seat: 3, team: 'B' },
  ];
}

function createState(overrides: Partial<RulesState> = {}): RulesState {
  return {
    phase: 'biddingRound1',
    players: createPlayers(),
    handsByPlayerId: {
      p0: [createCard('A', 'H'), createCard('10', 'H')],
      p1: [createCard('K', 'S'), createCard('Q', 'S')],
      p2: [createCard('9', 'H'), createCard('J', 'S')],
      p3: [createCard('7', 'C'), createCard('8', 'D')],
    },
    bids: [],
    currentBid: null,
    currentTrick: { cards: [], winnerId: null, leadSuit: null },
    tricks: [],
    trumpSuit: 'S',
    trumpRevealed: false,
    trumpHolderId: 'p0',
    mustPlayTrumpPlayerId: '',
    activePlayerId: 'p0',
    dealerSeat: 0,
    ...overrides,
  };
}

function createBid(playerId: string, value: number, passed = false, isHonours = false): Bid {
  return { playerId, value, passed, isHonours };
}

function createTrick(cards: Trick['cards'], leadSuit: Trick['leadSuit'], winnerId: string): Trick {
  return {
    cards,
    leadSuit,
    winnerId,
  };
}

describe('engine', () => {
  it('advances player turns in seat order', () => {
    const players = createPlayers();

    expect(getNextPlayerId(players, 'p0')).toBe('p1');
    expect(getNextPlayerId(players, 'p1')).toBe('p2');
    expect(getNextPlayerId(players, 'p2')).toBe('p3');
    expect(getNextPlayerId(players, 'p3')).toBe('p0');
  });

  it('skips players who have passed when bidding advances', () => {
    const players = createPlayers();
    const bids = [createBid('p0', 14), createBid('p1', 0, true)];

    expect(getNextEligibleBidderId(players, bids, 'p0')).toBe('p2');
    expect(isBiddingComplete(players, bids)).toBe(false);
  });

  it('detects bidding completion when only one bidder remains', () => {
    const players = createPlayers();
    const bids = [createBid('p0', 14), createBid('p1', 0, true), createBid('p2', 0, true), createBid('p3', 0, true)];

    expect(isBiddingComplete(players, bids)).toBe(true);
  });

  it('requires the opening bid to be at least 14 and non-pass', () => {
    const state = createState({ phase: 'biddingRound1' });

    expect(validateBid(createBid('p0', 0, true), state)).toMatchObject({ valid: false });
    expect(validateBid(createBid('p0', 13), state)).toMatchObject({ valid: false });
    expect(validateBid(createBid('p0', 14), state)).toMatchObject({ valid: true });
  });

  it('enforces strict raises, honours minimums, round 2 floor, and max bid', () => {
    const round1State = createState({
      currentBid: createBid('p0', 16),
      bids: [createBid('p0', 16, true), createBid('p1', 0, true)],
      activePlayerId: 'p2',
    });

    expect(validateBid(createBid('p2', 16), round1State)).toMatchObject({ valid: false });
    expect(validateBid(createBid('p2', 19), round1State)).toMatchObject({ valid: false });
    expect(validateBid(createBid('p2', 20), round1State)).toMatchObject({ valid: true });
    expect(validateBid(createBid('p2', 29), round1State)).toMatchObject({ valid: false });

    const round2State = createState({
      phase: 'biddingRound2',
      currentBid: createBid('p1', 23),
      bids: [createBid('p0', 16, true), createBid('p1', 23)],
      activePlayerId: 'p2',
    });

    expect(validateBid(createBid('p2', 23), round2State)).toMatchObject({ valid: false });
    expect(validateBid(createBid('p2', 24), round2State)).toMatchObject({ valid: true });
    expect(validateBid(createBid('p2', 28), round2State)).toMatchObject({ valid: true });
    expect(validateBid(createBid('p2', 29), round2State)).toMatchObject({ valid: false });
  });

  it('rejects round 2 bids from players who already passed in round 1', () => {
    const state = createState({
      phase: 'biddingRound2',
      bids: [createBid('p0', 16, true), createBid('p1', 17), createBid('p2', 18)],
      currentBid: createBid('p2', 18),
      activePlayerId: 'p0',
    });

    expect(validateBid(createBid('p0', 24), state)).toMatchObject({ valid: false });
  });

  it('rejects any later bid from a player who has already passed', () => {
    const state = createState({
      bids: [createBid('p0', 16, true), createBid('p1', 17)],
      currentBid: createBid('p1', 17),
      activePlayerId: 'p0',
    });

    expect(validateBid(createBid('p0', 20), state)).toMatchObject({ valid: false });
  });

  it('enforces follow suit and trump lead rules in card play', () => {
    const state = createState({
      phase: 'playing',
      activePlayerId: 'p1',
      trumpSuit: 'S',
      trumpHolderId: 'p0',
      handsByPlayerId: {
        p0: [createCard('A', 'H')],
        p1: [createCard('K', 'S'), createCard('Q', 'S'), createCard('A', 'H')],
        p2: [createCard('9', 'H')],
        p3: [createCard('7', 'C')],
      },
      currentTrick: {
        cards: [
          { playerId: 'p0', card: createCard('A', 'H') },
        ],
        winnerId: null,
        leadSuit: 'H',
      },
    });

    expect(validateCardPlay(createCard('K', 'S'), 'p1', state)).toMatchObject({ valid: false });
    expect(validateCardPlay(createCard('Q', 'S'), 'p1', state)).toMatchObject({ valid: false });

    const voidInLeadSuitState = createState({
      phase: 'playing',
      activePlayerId: 'p1',
      trumpSuit: 'S',
      trumpHolderId: 'p0',
      handsByPlayerId: {
        p0: [createCard('A', 'H')],
        p1: [createCard('K', 'S'), createCard('Q', 'S')],
        p2: [createCard('9', 'H')],
        p3: [createCard('7', 'C')],
      },
      currentTrick: {
        cards: [
          { playerId: 'p0', card: createCard('A', 'H') },
        ],
        winnerId: null,
        leadSuit: 'H',
      },
    });

    expect(validateCardPlay(createCard('K', 'S'), 'p1', voidInLeadSuitState)).toMatchObject({ valid: true, revealsTrump: true });

    const openingLeadState = createState({
      phase: 'playing',
      activePlayerId: 'p0',
      currentTrick: { cards: [], winnerId: null, leadSuit: null },
      tricks: [],
      trumpSuit: 'S',
      trumpHolderId: 'p0',
    });

    expect(validateCardPlay(createCard('K', 'S'), 'p0', openingLeadState)).toMatchObject({ valid: false });
    expect(validateCardPlay(createCard('A', 'H'), 'p0', openingLeadState)).toMatchObject({ valid: true });
  });

  it('only forces trump on the reveal turn', () => {
    const revealTurnState = createState({
      phase: 'playing',
      activePlayerId: 'p1',
      trumpSuit: 'S',
      trumpRevealed: true,
      mustPlayTrumpPlayerId: 'p1',
      handsByPlayerId: {
        p0: [createCard('A', 'H')],
        p1: [createCard('K', 'S'), createCard('Q', 'D')],
        p2: [createCard('9', 'H')],
        p3: [createCard('7', 'C')],
      },
      currentTrick: {
        cards: [
          { playerId: 'p0', card: createCard('A', 'H') },
        ],
        winnerId: null,
        leadSuit: 'H',
      },
    });

    const laterTurnState = createState({
      phase: 'playing',
      activePlayerId: 'p1',
      trumpSuit: 'S',
      trumpRevealed: true,
      mustPlayTrumpPlayerId: '',
      handsByPlayerId: {
        p0: [createCard('A', 'H')],
        p1: [createCard('K', 'S'), createCard('Q', 'D')],
        p2: [createCard('9', 'H')],
        p3: [createCard('7', 'C')],
      },
      currentTrick: {
        cards: [
          { playerId: 'p0', card: createCard('A', 'H') },
        ],
        winnerId: null,
        leadSuit: 'H',
      },
    });

    expect(validateCardPlay(createCard('Q', 'D'), 'p1', revealTurnState)).toMatchObject({ valid: false });
    expect(validateCardPlay(createCard('K', 'S'), 'p1', revealTurnState)).toMatchObject({ valid: true });
    expect(validateCardPlay(createCard('Q', 'D'), 'p1', laterTurnState)).toMatchObject({ valid: true });
  });

  it('rejects card play before trump has been selected', () => {
    const state = createState({
      phase: 'playing',
      activePlayerId: 'p0',
      trumpSuit: null,
      trumpHolderId: 'p0',
      currentTrick: { cards: [], winnerId: null, leadSuit: null },
      tricks: [],
    });

    expect(validateCardPlay(createCard('A', 'H'), 'p0', state)).toMatchObject({ valid: false });
  });

  it('resolves tricks using trump first, then lead suit, then rank order', () => {
    const trumpTrick = createTrick([
      { playerId: 'p0', card: createCard('10', 'H') },
      { playerId: 'p1', card: createCard('7', 'S') },
      { playerId: 'p2', card: createCard('A', 'H') },
      { playerId: 'p3', card: createCard('K', 'H') },
    ], 'H', 'p1');

    expect(resolveTrick(trumpTrick, 'S')).toBe('p1');

    const leadSuitTrick = createTrick([
      { playerId: 'p0', card: createCard('7', 'H') },
      { playerId: 'p1', card: createCard('J', 'H') },
      { playerId: 'p2', card: createCard('9', 'C') },
      { playerId: 'p3', card: createCard('A', 'H') },
    ], 'H', 'p1');

    expect(resolveTrick(leadSuitTrick, 'S')).toBe('p1');
  });

  it('scores rounds from trick points and the bid boundary', () => {
    const tricks: Trick[] = [
      createTrick([
        { playerId: 'p0', card: createCard('J', 'H') },
        { playerId: 'p1', card: createCard('9', 'H') },
        { playerId: 'p2', card: createCard('A', 'H') },
        { playerId: 'p3', card: createCard('10', 'H') },
      ], 'H', 'p0'),
      createTrick([
        { playerId: 'p0', card: createCard('J', 'D') },
        { playerId: 'p1', card: createCard('9', 'D') },
        { playerId: 'p2', card: createCard('A', 'D') },
        { playerId: 'p3', card: createCard('10', 'D') },
      ], 'D', 'p0'),
      createTrick([
        { playerId: 'p0', card: createCard('J', 'C') },
        { playerId: 'p1', card: createCard('9', 'C') },
        { playerId: 'p2', card: createCard('A', 'C') },
        { playerId: 'p3', card: createCard('10', 'C') },
      ], 'C', 'p1'),
      createTrick([
        { playerId: 'p0', card: createCard('J', 'S') },
        { playerId: 'p1', card: createCard('9', 'S') },
        { playerId: 'p2', card: createCard('A', 'S') },
        { playerId: 'p3', card: createCard('10', 'S') },
      ], 'S', 'p1'),
    ];

    const teams = {
      p0: 'A' as const,
      p1: 'B' as const,
      p2: 'A' as const,
      p3: 'B' as const,
    };

    const winningBid = createBid('p0', 14);
    const winningResult = scoreRound(tricks, winningBid, teams);
    expect(winningResult).toMatchObject({
      biddingTeamId: 'A',
      biddingTeamPoints: 14,
      opposingTeamPoints: 14,
      biddingTeamWon: true,
      winningTeamId: 'A',
    });

    const losingBid = createBid('p0', 15);
    const losingResult = scoreRound(tricks, losingBid, teams);
    expect(losingResult).toMatchObject({
      biddingTeamId: 'A',
      biddingTeamPoints: 14,
      opposingTeamPoints: 14,
      biddingTeamWon: false,
      winningTeamId: 'B',
    });
  });

  it('calculates coolie deltas based on bid category and win/loss', () => {
    // Normal (round 1, bid 14-19)
    const normalBid = createBid('p0', 16);
    expect(scoreCoolies({ biddingTeamWon: true, biddingTeamId: 'A' } as any, normalBid, 'biddingRound1')).toEqual({ A: 0, B: 1 });
    expect(scoreCoolies({ biddingTeamWon: false, biddingTeamId: 'A' } as any, normalBid, 'biddingRound1')).toEqual({ A: 2, B: 0 });

    // Honours (round 1, bid 20-28)
    const honoursBid = createBid('p0', 20, false, true);
    expect(scoreCoolies({ biddingTeamWon: true, biddingTeamId: 'A' } as any, honoursBid, 'biddingRound1')).toEqual({ A: 0, B: 2 });
    expect(scoreCoolies({ biddingTeamWon: false, biddingTeamId: 'A' } as any, honoursBid, 'biddingRound1')).toEqual({ A: 3, B: 0 });

    // Disti (round 2, bid 24-27)
    const distiBid = createBid('p0', 24);
    expect(scoreCoolies({ biddingTeamWon: true, biddingTeamId: 'A' } as any, distiBid, 'biddingRound2')).toEqual({ A: 0, B: 3 });
    expect(scoreCoolies({ biddingTeamWon: false, biddingTeamId: 'A' } as any, distiBid, 'biddingRound2')).toEqual({ A: 4, B: 0 });

    // Thani (round 2, bid 28)
    const thaniBid = createBid('p0', 28);
    expect(scoreCoolies({ biddingTeamWon: true, biddingTeamId: 'A' } as any, thaniBid, 'biddingRound2')).toEqual({ A: 0, B: 4 });
    expect(scoreCoolies({ biddingTeamWon: false, biddingTeamId: 'A' } as any, thaniBid, 'biddingRound2')).toEqual({ A: 5, B: 0 });
  });
});