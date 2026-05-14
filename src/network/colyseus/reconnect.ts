import { colyseusClient } from './client';
import type { LobbyRoomState } from '../../../shared/colyseus/lobby';

export async function reconnectToRoom(roomId: string, sessionId: string) {
  try {
    // attempt to reconnect using Colyseus client API
    // returns a Room instance if successful
    // @ts-ignore - reconnect exists on Colyseus client
    const room = await colyseusClient.reconnect<LobbyRoomState>(roomId, sessionId);
    return room;
  } catch (err) {
    console.warn('reconnectToRoom failed', err);
    return null;
  }
}
