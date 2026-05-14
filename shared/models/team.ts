import type { PlayerSeat } from './seat';

export type TeamId = 'A' | 'B';

export interface Team {
  id: TeamId;
  seats: [PlayerSeat, PlayerSeat];
}