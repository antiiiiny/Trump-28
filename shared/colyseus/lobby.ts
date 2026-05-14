import { ArraySchema, Schema, type } from '@colyseus/schema';
import type { GamePhase } from '../enums/phase';
import type { PlayerSeat } from '../models/seat';
import type { TeamId } from '../models/team';

export class LobbyPlayerState extends Schema {
  @type('string') playerId = '';
  @type('string') name = '';
  @type('number') seat: PlayerSeat = 0;
  @type('string') team: TeamId = 'A';
  @type('boolean') connected = false;
  @type('boolean') ready = false;
  @type('boolean') occupied = false;
}

export class LobbyRoomState extends Schema {
  @type('string') roomCode = '';
  @type('string') hostId = '';
  @type('string') phase: GamePhase = 'waiting';
  @type([LobbyPlayerState]) players = new ArraySchema<LobbyPlayerState>();
}

export function createLobbyPlayer(seat: PlayerSeat): LobbyPlayerState {
  const player = new LobbyPlayerState();
  player.seat = seat;
  player.team = seat % 2 === 0 ? 'A' : 'B';
  return player;
}

export function createLobbyPlayers(): ArraySchema<LobbyPlayerState> {
  const players = new ArraySchema<LobbyPlayerState>();
  players.push(createLobbyPlayer(0));
  players.push(createLobbyPlayer(1));
  players.push(createLobbyPlayer(2));
  players.push(createLobbyPlayer(3));
  return players;
}
