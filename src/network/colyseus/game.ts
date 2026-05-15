import type { Room } from '@colyseus/sdk';
import type { LobbyRoomState } from '../../../shared/colyseus/lobby';
import { colyseusClient } from './client';

export type GameRoomConnection = Room<{ state: LobbyRoomState }>;

export async function joinGameRoom(roomId: string, seat: number, playerId: string, name: string): Promise<GameRoomConnection> {
  const room = await colyseusClient.joinById<LobbyRoomState>(roomId, {
    seat,
    playerId,
    name,
  });

  try {
    sessionStorage.setItem('colyseus_session', JSON.stringify({ roomId: room.roomId, sessionId: room.sessionId }));
  } catch (err) {
    // ignore storage failures
  }

  return room;
}
