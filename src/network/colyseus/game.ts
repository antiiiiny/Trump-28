import type { Room } from '@colyseus/sdk';
import type { Card } from '../../../shared/models/card';
import type { LobbyRoomState } from '../../../shared/colyseus/lobby';
import { colyseusClient } from './client';
import { clearStoredColyseusSession, readStoredColyseusSession, writeStoredColyseusSession } from './session';

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
  const parsed = readStoredColyseusSession();
  if (!parsed || !parsed.roomId || !parsed.sessionId || !parsed.playerId || typeof parsed.seat !== 'number' || !parsed.name) {
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
}

export async function joinGameRoom(roomId: string, seat: number, playerId: string, name: string): Promise<GameRoomConnection> {
  const room = await colyseusClient.joinById<LobbyRoomState>(roomId, {
    seat,
    playerId,
    name,
  });

  writeStoredColyseusSession({
    roomId: room.roomId,
    sessionId: room.sessionId,
    reconnectionToken: room.reconnectionToken ?? '',
    playerId,
    seat,
    name,
  });

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
    cardCode: suit,
  });
}

export function sendAcknowledgeTrump(room: GameRoomConnection) {
  const sessionInfo = getStoredGameSession();
  room.send('acknowledgeTrump', {
    playerId: sessionInfo?.playerId ?? '',
  });
}

export function sendRequestRematch(room: GameRoomConnection) {
  const sessionInfo = getStoredGameSession();
  room.send('requestRematch', {
    playerId: sessionInfo?.playerId ?? '',
  });
}

export function sendEndGame(room: GameRoomConnection) {
  const sessionInfo = getStoredGameSession();
  room.send('endGame', {
    playerId: sessionInfo?.playerId ?? '',
  });
}

export function sendRevealTrump(room: GameRoomConnection) {
  const sessionInfo = getStoredGameSession();
  room.send('revealTrump', {
    playerId: sessionInfo?.playerId ?? '',
  });
}

export function clearGameSession() {
  clearStoredColyseusSession();
}
