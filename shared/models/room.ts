import type { GameState } from './game';
import type { Player } from './player';

export interface RoomState {
  roomCode: string;
  players: Player[];
  game: GameState | null;
  hostId: string;
}
