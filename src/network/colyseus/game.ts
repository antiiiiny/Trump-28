import type { Room } from '@colyseus/sdk';
import type { Card } from '../../../shared/models/card';
import type { LobbyRoomState } from '../../../shared/colyseus/lobby';
import { colyseusClient } from './client';

export type GameRoomConnection = Room<{ state: LobbyRoomState }>;

export interface GameSessionInfo {
  roomId: string;
  sessionId: string;
  reconnectionToken?: string;
  playerId: string;
  seat: number;
  name: string;
}

export function getStoredGameSession(): GameSessionInfo | null {
  try {
    const raw = sessionStorage.getItem('colyseus_session');
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<GameSessionInfo>;
    if (!parsed.roomId || !parsed.sessionId || !parsed.playerId || typeof parsed.seat !== 'number' || !parsed.name) {
      return null;
    }

    return {
      roomId: parsed.roomId,
      sessionId: parsed.sessionId,
      reconnectionToken: parsed.reconnectionToken,
      playerId: parsed.playerId,
      seat: parsed.seat,
      name: parsed.name,
    };
  } catch {
    return null;
  }
}

export async function joinGameRoom(roomId: string, seat: number, playerId: string, name: string): Promise<GameRoomConnection> {
  const room = await colyseusClient.joinById<LobbyRoomState>(roomId, {
    seat,
    playerId,
    name,
  });

  try {
    sessionStorage.setItem(
      'colyseus_session',
      JSON.stringify({
        roomId: room.roomId,
        sessionId: room.sessionId,
        reconnectionToken: room.reconnectionToken ?? '',
        playerId,
        seat,
        name,
      }),
    );
  } catch (err) {
    // ignore storage failures
  }

  return room;
}

function cardFromCode(cardCode: string): Card {
  const suit = cardCode.slice(-1) as Card['suit'];
  const rank = cardCode.slice(0, -1) as Card['rank'];
  const points = rank === 'J' ? 3 : rank === '9' ? 2 : rank === 'A' || rank === '10' ? 1 : 0;

  return {
    rank,
    suit,
    code: cardCode,
    points,
  };
}

export function sendPlaceBid(room: GameRoomConnection, value: number, isHonours: boolean, passed: boolean = false) {
  const sessionInfo = getStoredGameSession();
  room.send('placeBid', {
    playerId: sessionInfo?.playerId ?? '',
    value,
    isHonours,
    passed,
  });
}

export function sendPass(room: GameRoomConnection) {
  const sessionInfo = getStoredGameSession();
  room.send('placeBid', {
    playerId: sessionInfo?.playerId ?? '',
    value: 0,
    isHonours: false,
    passed: true,
  });
}

export function sendPlayCard(room: GameRoomConnection, cardCode: string) {
  const sessionInfo = getStoredGameSession();
  room.send('playCard', {
    playerId: sessionInfo?.playerId ?? '',
    card: cardFromCode(cardCode),
  });
}

export function sendSelectTrump(room: GameRoomConnection, suit: string) {
  const sessionInfo = getStoredGameSession();
  room.send('selectTrump', {
    playerId: sessionInfo?.playerId ?? '',
    trumpSuit: suit,
  });
}
