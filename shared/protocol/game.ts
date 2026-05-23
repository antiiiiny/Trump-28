import { z } from 'zod';
import type { PlayerSeat } from '../models/seat';
import type { Bid } from '../models/bid';
import type { Trick } from '../models/trick';
import type { Card } from '../models/card';
import type { Rank } from '../enums/rank';

const gamePhaseSchema = z.enum(['waiting', 'biddingRound1', 'biddingRound2', 'selectingTrump', 'playing', 'roundEnd', 'gameEnd']);
const rankSchema = z.enum(['A', 'K', 'Q', 'J', '10', '9', '8', '7']) satisfies z.ZodType<Rank>;
const suitSchema = z.enum(['H', 'D', 'C', 'S']);

const cardSchema = z.object({
  rank: rankSchema,
  suit: suitSchema,
  code: z.string(),
  points: z.number(),
}) as z.ZodType<Card>;

const bidSchema = z.object({
  playerId: z.string(),
  value: z.number(),
  passed: z.boolean(),
  isHonours: z.boolean(),
}) as z.ZodType<Bid>;

const trickCardSchema = z.object({
  playerId: z.string(),
  card: cardSchema,
});

const trickSchema = z.object({
  cards: z.array(trickCardSchema),
  winnerId: z.string().nullable(),
  leadSuit: suitSchema.nullable(),
}) as z.ZodType<Trick>;

export const privateHandPayloadSchema = z.object({
  playerId: z.string(),
  cards: z.array(cardSchema),
});

export const privateTrumpPayloadSchema = z.object({
  trumpSuit: suitSchema,
  trumpHolderId: z.string(),
  cardCode: z.string(),
});

export const placeBidPayloadSchema = z.object({
  playerId: z.string(),
  value: z.number().int().min(0).max(28),
  passed: z.boolean(),
  isHonours: z.boolean(),
});

export const selectTrumpPayloadSchema = z.object({
  playerId: z.string(),
  cardCode: z.string(),
});

export const acknowledgeTrumpPayloadSchema = z.object({
  playerId: z.string(),
});

export const requestRematchPayloadSchema = z.object({
  playerId: z.string(),
});

export const revealTrumpPayloadSchema = z.object({
  playerId: z.string(),
});

export const playCardPayloadSchema = z.object({
  playerId: z.string(),
  card: cardSchema,
});

export const endGamePayloadSchema = z.object({
  playerId: z.string(),
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
export type PlaceBidPayload = z.infer<typeof placeBidPayloadSchema>;
export type SelectTrumpPayload = z.infer<typeof selectTrumpPayloadSchema>;
export type AcknowledgeTrumpPayload = z.infer<typeof acknowledgeTrumpPayloadSchema>;
export type RequestRematchPayload = z.infer<typeof requestRematchPayloadSchema>;
export type RevealTrumpPayload = z.infer<typeof revealTrumpPayloadSchema>;
export type PlayCardPayload = z.infer<typeof playCardPayloadSchema>;
export type RoundSnapshotPayload = z.infer<typeof roundSnapshotPayloadSchema>;
export type EndGamePayload = z.infer<typeof endGamePayloadSchema>;