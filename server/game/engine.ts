import type { Bid } from '../../shared/models/bid';
import type { Card } from '../../shared/models/card';
import type { Trick } from '../../shared/models/trick';
import type { GamePhase } from '../../shared/enums/phase';
import type { PlayerSeat } from '../../shared/models/seat';
import type { Suit } from '../../shared/enums/suit';
import type { TeamId } from '../../shared/models/team';
import type { Rank } from '../../shared/enums/rank';

export type BidCategory = 'normal' | 'honours' | 'disti' | 'thani';

export interface RulesPlayer {
  playerId: string;
  seat: PlayerSeat;
  team: TeamId;
}

export interface RulesState {
  phase: GamePhase;
  players: RulesPlayer[];
  handsByPlayerId: Record<string, Card[]>;
  bids: Bid[];
  currentBid: Bid | null;
  currentTrick: Trick;
  tricks: Trick[];
  trumpSuit: Suit | null;
  trumpRevealed: boolean;
  trumpHolderId: string;
  mustPlayTrumpPlayerId: string;
  activePlayerId: string;
  dealerSeat: PlayerSeat;
}

export interface BidValidationResult {
  valid: boolean;
  reason?: string;
}

export interface CardPlayValidationResult {
  valid: boolean;
  reason?: string;
  revealsTrump?: boolean;
}

export interface TrumpRevealValidationResult {
  valid: boolean;
  reason?: string;
}

export interface RoundResult {
  biddingTeamId: TeamId;
  biddingTeamPoints: number;
  opposingTeamPoints: number;
  biddingTeamWon: boolean;
  winningTeamId: TeamId;
}

export type CoolieUpdate = Record<TeamId, number>;

const trickRankOrder: Rank[] = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];
const rankStrength = new Map<Rank, number>(trickRankOrder.map((rank, index) => [rank, trickRankOrder.length - index]));

function getPlayerById(players: RulesPlayer[], playerId: string): RulesPlayer | undefined {
  return players.find((player) => player.playerId === playerId);
}

function getPlayersInSeatOrder(players: RulesPlayer[]): RulesPlayer[] {
  return [...players].sort((left, right) => left.seat - right.seat);
}

function getEligibleBidders(players: RulesPlayer[], bids: Bid[]): RulesPlayer[] {
  return getPlayersInSeatOrder(players).filter((player) => player.playerId && !hasPassed(player.playerId, bids));
}

function hasPassed(playerId: string, bids: Bid[]): boolean {
  return bids.some((bid) => bid.playerId === playerId && bid.passed);
}

function hasCard(hand: Card[], card: Card): boolean {
  return hand.some((handCard) => handCard.code === card.code);
}

function getLeadSuit(trick: Trick): Suit | null {
  if (trick.leadSuit) {
    return trick.leadSuit;
  }

  return trick.cards[0]?.card.suit ?? null;
}

function getTeamPoints(tricks: Trick[], playerTeamsById: Record<string, TeamId>): Record<TeamId, number> {
  const totals: Record<TeamId, number> = { A: 0, B: 0 };

  for (const trick of tricks) {
    if (!trick.winnerId) {
      continue;
    }

    const teamId = playerTeamsById[trick.winnerId];
    if (!teamId) {
      continue;
    }

    const trickPoints = trick.cards.reduce((sum, trickCard) => sum + trickCard.card.points, 0);
    totals[teamId] += trickPoints;
  }

  return totals;
}

export function getBidCategory(bid: Bid, phase: GamePhase): BidCategory {
  if (phase === 'biddingRound2') {
    if (bid.value === 28) {
      return 'thani';
    }

    if (bid.value >= 24) {
      return 'disti';
    }
  }

  if (phase === 'biddingRound1') {
    return bid.isHonours ? 'honours' : 'normal';
  }

  return bid.isHonours ? 'honours' : 'normal';
}

export function getNextPlayerId(players: RulesPlayer[], currentPlayerId: string): string {
  const orderedPlayers = getPlayersInSeatOrder(players);
  if (orderedPlayers.length === 0) {
    return '';
  }

  const currentIndex = orderedPlayers.findIndex((player) => player.playerId === currentPlayerId);
  if (currentIndex === -1) {
    return orderedPlayers[0].playerId;
  }

  return orderedPlayers[(currentIndex + 1) % orderedPlayers.length].playerId;
}

export function getNextEligibleBidderId(players: RulesPlayer[], bids: Bid[], currentPlayerId: string): string {
  const orderedPlayers = getPlayersInSeatOrder(players).filter((player) => player.playerId);
  if (orderedPlayers.length === 0) {
    return '';
  }

  const currentIndex = orderedPlayers.findIndex((player) => player.playerId === currentPlayerId);
  const startingIndex = currentIndex === -1 ? 0 : currentIndex;

  for (let offset = 1; offset <= orderedPlayers.length; offset += 1) {
    const candidate = orderedPlayers[(startingIndex + offset) % orderedPlayers.length];
    if (!hasPassed(candidate.playerId, bids)) {
      return candidate.playerId;
    }
  }

  return orderedPlayers[startingIndex].playerId;
}

export function isBiddingComplete(players: RulesPlayer[], bids: Bid[]): boolean {
  return getEligibleBidders(players, bids).length <= 1;
}

export function validateBid(bid: Bid, state: RulesState): BidValidationResult {
  const player = getPlayerById(state.players, bid.playerId);
  if (!player) {
    return { valid: false, reason: 'Unknown player.' };
  }

  if (state.activePlayerId !== bid.playerId) {
    return { valid: false, reason: 'It is not this player\'s turn.' };
  }

  if (bid.passed && state.bids.length === 0) {
    return { valid: false, reason: 'The opening bid must be at least 14.' };
  }

  if (bid.value > 28) {
    return { valid: false, reason: 'Maximum bid is 28.' };
  }

  if (hasPassed(bid.playerId, state.bids)) {
    return { valid: false, reason: 'Players who have passed may not bid again.' };
  }

  if (bid.passed) {
    if (state.phase === 'biddingRound1' || state.phase === 'biddingRound2') {
      return { valid: true };
    }

    return { valid: false, reason: 'Bids are only allowed during the bidding phases.' };
  }

  if (state.currentBid && bid.value <= state.currentBid.value) {
    return { valid: false, reason: 'Bid must be strictly higher than the current bid.' };
  }

  const teammatePassed = state.bids.some((existingBid) => {
    if (!existingBid.passed) {
      return false;
    }

    const existingPlayer = getPlayerById(state.players, existingBid.playerId);
    if (!existingPlayer) {
      return false;
    }

    return existingPlayer.team === player.team;
  });

  if (teammatePassed && bid.value < 20) {
    return { valid: false, reason: 'Honours bids must be 20 or higher when a teammate has passed.' };
  }

  if (state.phase === 'biddingRound1') {
    if (bid.value < 14) {
      return { valid: false, reason: 'Opening bids must be at least 14.' };
    }

    return { valid: true };
  }

  if (state.phase === 'biddingRound2') {
    if (bid.value < 24) {
      return { valid: false, reason: 'Round 2 bids must be at least 24.' };
    }

    return { valid: true };
  }

  return { valid: false, reason: 'Bids are only allowed during the bidding phases.' };
}

export function validateCardPlay(card: Card, playerId: string, state: RulesState): CardPlayValidationResult {
  const player = getPlayerById(state.players, playerId);
  if (!player) {
    return { valid: false, reason: 'Unknown player.' };
  }

  if (state.activePlayerId !== playerId) {
    return { valid: false, reason: 'It is not this player\'s turn.' };
  }

  const hand = state.handsByPlayerId[playerId] ?? [];
  if (!hasCard(hand, card)) {
    return { valid: false, reason: 'Card is not in the player\'s hand.' };
  }

  if (state.currentTrick.cards.length === 4 && !state.currentTrick.winnerId) {
    return { valid: false, reason: 'Trick is resolving.' };
  }

  if (state.phase === 'playing' && !state.trumpSuit) {
    return { valid: false, reason: 'Trump suit has not been selected yet.' };
  }

  const openingTrick = state.tricks.length === 0 && state.currentTrick.cards.length === 0;
  if (openingTrick && playerId === state.trumpHolderId && state.trumpSuit && card.suit === state.trumpSuit) {
    return { valid: false, reason: 'Winning bidder cannot lead with trump.' };
  }

  const leadSuit = getLeadSuit(state.currentTrick);
  const playerHasLeadSuit = leadSuit
    ? hand.some((handCard) => handCard.suit === leadSuit)
    : false;
  const playerHasTrump = state.trumpSuit ? hand.some((handCard) => handCard.suit === state.trumpSuit) : false;

  if (leadSuit && state.currentTrick.cards.length > 0 && playerHasLeadSuit && card.suit !== leadSuit) {
    return { valid: false, reason: 'Player must follow suit.' };
  }

  if (leadSuit && state.currentTrick.cards.length > 0 && !playerHasLeadSuit && playerHasTrump && !state.trumpRevealed) {
    if (card.suit === state.trumpSuit) {
      return { valid: true, revealsTrump: true };
    }

    return { valid: false, reason: 'Reveal trump before playing a trump card.' };
  }

  if (leadSuit && state.currentTrick.cards.length > 0 && !playerHasLeadSuit && playerHasTrump && state.mustPlayTrumpPlayerId === playerId && card.suit !== state.trumpSuit) {
    return { valid: false, reason: 'You must play trump after revealing it.' };
  }

  return {
    valid: true,
  };
}

export function validateTrumpReveal(state: RulesState, playerId: string): TrumpRevealValidationResult {
  const player = getPlayerById(state.players, playerId);
  if (!player) {
    return { valid: false, reason: 'Unknown player.' };
  }

  if (state.activePlayerId !== playerId) {
    return { valid: false, reason: 'It is not this player\'s turn.' };
  }

  if (state.phase !== 'playing') {
    return { valid: false, reason: 'Trump can only be revealed during play.' };
  }

  if (state.trumpRevealed) {
    return { valid: false, reason: 'Trump has already been revealed.' };
  }

  const leadSuit = getLeadSuit(state.currentTrick);
  if (!leadSuit || state.currentTrick.cards.length === 0) {
    return { valid: false, reason: 'Trump can only be revealed after a suit is led.' };
  }

  const hand = state.handsByPlayerId[playerId] ?? [];
  const playerHasLeadSuit = hand.some((handCard) => handCard.suit === leadSuit);
  if (playerHasLeadSuit) {
    return { valid: false, reason: 'You must follow suit if you can.' };
  }

  return { valid: true };
}

export function resolveTrick(trick: Trick, trumpSuit: Suit): string {
  if (trick.cards.length === 0) {
    return '';
  }

  const leadSuit = getLeadSuit(trick);
  const trumpCards = trick.cards.filter((trickCard) => trickCard.card.suit === trumpSuit);
  const candidates = trumpCards.length > 0
    ? trumpCards
    : trick.cards.filter((trickCard) => trickCard.card.suit === leadSuit);

  return candidates.reduce((winningPlayerId, trickCard) => {
    if (!winningPlayerId) {
      return trickCard.playerId;
    }

    const winningCard = trick.cards.find((candidate) => candidate.playerId === winningPlayerId);
    if (!winningCard) {
      return trickCard.playerId;
    }

    const winningStrength = rankStrength.get(winningCard.card.rank) ?? 0;
    const challengerStrength = rankStrength.get(trickCard.card.rank) ?? 0;
    return challengerStrength > winningStrength ? trickCard.playerId : winningPlayerId;
  }, '');
}

export function scoreRound(tricks: Trick[], bid: Bid, playerTeamsById: Record<string, TeamId>): RoundResult {
  const biddingTeamId = playerTeamsById[bid.playerId];
  const teamPoints = getTeamPoints(tricks, playerTeamsById);
  const biddingTeamPoints = teamPoints[biddingTeamId] ?? 0;
  const opposingTeamId: TeamId = biddingTeamId === 'A' ? 'B' : 'A';
  const opposingTeamPoints = teamPoints[opposingTeamId] ?? 0;
  const biddingTeamWon = biddingTeamPoints >= bid.value;

  return {
    biddingTeamId,
    biddingTeamPoints,
    opposingTeamPoints,
    biddingTeamWon,
    winningTeamId: biddingTeamWon ? biddingTeamId : opposingTeamId,
  };
}

export function scoreCoolies(result: RoundResult, bid: Bid, phase: GamePhase): CoolieUpdate {
  const category = getBidCategory(bid, phase);
  const deltas: Record<TeamId, number> = { A: 0, B: 0 };
  const opposingTeamId: TeamId = result.biddingTeamId === 'A' ? 'B' : 'A';

  if (result.biddingTeamWon) {
    if (category === 'normal') deltas[opposingTeamId] = 1;
    else if (category === 'honours') deltas[opposingTeamId] = 2;
    else if (category === 'disti') deltas[opposingTeamId] = 3;
    else if (category === 'thani') deltas[opposingTeamId] = 4;
  } else {
    if (category === 'normal') deltas[result.biddingTeamId] = 2;
    else if (category === 'honours') deltas[result.biddingTeamId] = 3;
    else if (category === 'disti') deltas[result.biddingTeamId] = 4;
    else if (category === 'thani') deltas[result.biddingTeamId] = 5;
  }

  return deltas;
}
