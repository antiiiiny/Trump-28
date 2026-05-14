import type { GamePhase } from '../enums/phase';
import type { RoundState } from './round';
import type { TeamId } from './team';

export interface GameState {
  round: RoundState;
  teamScores: Record<TeamId, number>;
  roundNumber: number;
  phase: GamePhase;
}
