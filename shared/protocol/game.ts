import { z } from 'zod';
import type { GamePhase } from '../enums/phase';
import type { PlayerSeat } from '../models/seat';
import type { Suit } from '../enums/suit';
import type { Bid } from '../models/bid';
import type { Trick } from '../models/trick';
import type { Card } from '../models/card';

const gamePhaseSchema = z.enum(['waiting', 'biddingRound1', 'biddingRound2', 'playing', 'roundEnd', 'gameEnd']);
const suitSchema = z.enum(['H', 'D', 'C', 'S']);

const cardSchema = z.object({
  rank: z.string(),
  suit: suitSchema,
  code: z.string(),
  points: z.number(),
}) satisfies z.ZodType<Card>;

const bidSchema = z.object({
  playerId: z.string(),
  value: z.number(),
  passed: z.boolean(),
  isHonours: z.boolean(),
}) satisfies z.ZodType<Bid>;

const trickCardSchema = z.object({
  playerId: z.string(),
  card: cardSchema,
});

const trickSchema = z.object({
  cards: z.array(trickCardSchema),
  winnerId: z.string().nullable(),
  leadSuit: suitSchema.nullable(),
}) satisfies z.ZodType<Trick>;

export const privateHandPayloadSchema = z.object({
  playerId: z.string(),
  cards: z.array(cardSchema),
});

export const privateTrumpPayloadSchema = z.object({
  trumpSuit: suitSchema,
  trumpHolderId: z.string(),
});

export const roundSnapshotPayloadSchema = z.object({
  phase: gamePhaseSchema,
  tricks: z.array(trickSchema),
  currentTrick: trickSchema,
  trumpRevealed: z.boolean(),
  bids: z.array(bidSchema),
  currentBid: bidSchema.nullable(),
  activePlayerId: z.string(),
  dealerSeat: z.number().int().min(0).max(3) as z.ZodType<PlayerSeat>,
  myPlayerId: z.string(),
});

export type PrivateHandPayload = z.infer<typeof privateHandPayloadSchema>;
export type PrivateTrumpPayload = z.infer<typeof privateTrumpPayloadSchema>;
export type RoundSnapshotPayload = z.infer<typeof roundSnapshotPayloadSchema>;