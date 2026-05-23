import type { Room } from '@colyseus/sdk';
import type { LobbyRoomState } from '../../../shared/colyseus/lobby';
import { joinRoomSchema, leaveRoomSchema, playerNameSchema, readyUpSchema, roomCodeSchema, startGameSchema } from '../../../shared/protocol/lobby';
import { colyseusClient } from './client';
import { writeStoredColyseusSession } from './session';

export type LobbyRoomConnection = Room<{ state: LobbyRoomState }>;

export function validatePlayerName(playerName: string) {
  return playerNameSchema.parse({ playerName }).playerName;
}

export function validateRoomCode(roomCode: string) {
  return roomCodeSchema.parse({ roomCode }).roomCode;
}

export async function createLobbyRoom(playerName: string): Promise<LobbyRoomConnection> {
  console.log('createLobbyRoom: creating room with playerName=', playerName);
  const room = await colyseusClient.create<LobbyRoomState>('lobby');
  const payload = { playerName: playerName.trim().slice(0, 16) };
  console.log('createLobbyRoom: sending joinRoom payload=', payload);
  room.send('joinRoom', joinRoomSchema.parse(payload));
  writeStoredColyseusSession({
    roomId: room.roomId,
    sessionId: room.sessionId,
    reconnectionToken: room.reconnectionToken ?? '',
  });
  return room;
}

export async function joinLobbyRoom(roomCode: string, playerName: string): Promise<LobbyRoomConnection> {
  const payload = { playerName: playerName.trim().slice(0, 16) };
  console.log('joinLobbyRoom: joining roomCode=', roomCode, 'with payload=', payload);
  const room = await colyseusClient.joinById<LobbyRoomState>(roomCode);
  room.send('joinRoom', joinRoomSchema.parse(payload));
  writeStoredColyseusSession({
    roomId: room.roomId,
    sessionId: room.sessionId,
    reconnectionToken: room.reconnectionToken ?? '',
  });
  return room;
}

export function sendLeaveRoom(room: LobbyRoomConnection) {
  room.send('leaveRoom', leaveRoomSchema.parse({}));
}

export function sendReadyUp(room: LobbyRoomConnection) {
  room.send('readyUp', readyUpSchema.parse({}));
}

export function sendStartGame(room: LobbyRoomConnection) {
  room.send('startGame', startGameSchema.parse({}));
}
