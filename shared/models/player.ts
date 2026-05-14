import type { PlayerSeat } from './seat';
import type { TeamId } from './team';

export interface Player {
  id: string;
  name: string;
  seat: PlayerSeat;
  team: TeamId;
  connected: boolean;
}
