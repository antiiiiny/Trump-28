import { colyseusClient } from './client';
import type { LobbyRoomState } from '../../../shared/colyseus/lobby';

export async function reconnectToRoom(reconnectionToken: string) {
  try {
    // attempt to reconnect using the Colyseus v0.17 token-based API
    // returns a Room instance if successful
    // @ts-ignore - reconnect exists on Colyseus client
    const room = await colyseusClient.reconnect<LobbyRoomState>(reconnectionToken);
    return room;
  } catch (err) {
    console.warn('reconnectToRoom failed', err);
    return null;
  }
}
