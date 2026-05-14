import { z } from 'zod';

export const playerNameSchema = z.object({
  playerName: z.string().trim().min(1).max(16),
});

export const roomCodeSchema = z.object({
  roomCode: z.string().trim().length(4).regex(/^[A-Z]{4}$/),
});

export const joinRoomSchema = playerNameSchema;
export const leaveRoomSchema = z.object({});
export const readyUpSchema = z.object({});
export const startGameSchema = z.object({});

export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;
export type LeaveRoomPayload = z.infer<typeof leaveRoomSchema>;
export type ReadyUpPayload = z.infer<typeof readyUpSchema>;
export type StartGamePayload = z.infer<typeof startGameSchema>;
