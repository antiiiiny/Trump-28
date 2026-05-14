import { ArraySchema, Schema, type } from '@colyseus/schema';
import type { GamePhase } from '../enums/phase';
import type { PlayerSeat } from '../models/seat';
import type { TeamId } from '../models/team';

export class GameBidState extends Schema {
  @type('string') playerId = '';
  @type('number') value = 0;
  @type('boolean') passed = false;
  @type('boolean') isHonours = false;
}

export class GameTrickCardState extends Schema {
  @type('string') playerId = '';
  @type('string') code = '';
  @type('string') position = '';
}

export class GameTrickState extends Schema {
  @type([GameTrickCardState]) cards = new ArraySchema<GameTrickCardState>();
  @type('string') winnerId = '';
  @type('string') leadSuit = '';
}

export class LobbyPlayerState extends Schema {
  @type('string') playerId = '';
  @type('string') name = '';
  @type('number') seat: PlayerSeat = 0;
  @type('string') team: TeamId = 'A';
  @type('boolean') connected = false;
  @type('boolean') ready = false;
  @type('boolean') occupied = false;
  @type('number') cardsRemaining = 0;
}

export class LobbyRoomState extends Schema {
  @type('string') roomCode = '';
  @type('string') gameRoomId = '';
  @type('string') hostId = '';
  @type('string') phase: GamePhase = 'waiting';
  @type('boolean') gameStarted = false;
  @type('boolean') paused = false;
  @type('string') pauseReason = '';
  @type('number') roundNumber = 0;
  @type('number') teamAScore = 0;
  @type('number') teamBScore = 0;
  @type('string') activePlayerId = '';
  @type('number') dealerSeat: PlayerSeat = 0;
  @type('string') trumpSuit = '';
  @type('boolean') trumpRevealed = false;
  @type('string') trumpHolderId = '';
  @type(GameBidState) currentBid = new GameBidState();
  @type([GameBidState]) bids = new ArraySchema<GameBidState>();
  @type(GameTrickState) currentTrick = new GameTrickState();
  @type([GameTrickState]) tricks = new ArraySchema<GameTrickState>();
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
