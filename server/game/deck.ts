import type { Card } from '../../shared/models/card';
import type { Rank } from '../../shared/enums/rank';
import type { Suit } from '../../shared/enums/suit';

const ranks: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];
const suits: Suit[] = ['H', 'D', 'C', 'S'];

function getPoints(rank: Rank): number {
  if (rank === 'J') return 3;
  if (rank === '9') return 2;
  if (rank === 'A' || rank === '10') return 1;
  return 0;
}

function createCard(rank: Rank, suit: Suit): Card {
  return {
    rank,
    suit,
    code: `${rank}${suit}`,
    points: getPoints(rank),
  };
}

function hashSeed(seed: string): number {
  let value = 0;
  for (const char of seed) {
    value = (value * 31 + char.charCodeAt(0)) >>> 0;
  }
  return value || 1;
}

function nextRandom(seed: number): number {
  let value = seed ^ 0x9e3779b9;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export function createDeck(seed: string): Card[] {
  const deck = suits.flatMap((suit) => ranks.map((rank) => createCard(rank, suit)));
  let currentSeed = hashSeed(seed);

  for (let index = deck.length - 1; index > 0; index -= 1) {
    currentSeed = nextRandom(currentSeed);
    const swapIndex = currentSeed % (index + 1);
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}
