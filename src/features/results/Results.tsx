import styles from './Results.module.css';
import type { TeamId } from '../../../shared';

interface ResultsProps {
  winnerTeam?: TeamId;
  scores?: Record<TeamId, number>;
  onNavigate?: (screen: 'home' | 'lobby') => void;
}

const DEFAULT_WINNER: TeamId = 'A';
const DEFAULT_SCORES: Record<TeamId, number> = { A: 28, B: 24 };

export function Results({
  winnerTeam = DEFAULT_WINNER,
  scores = DEFAULT_SCORES,
  onNavigate,
}: ResultsProps) {
  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <h1 className={styles.title}>Game Over</h1>

        <div className={styles.winner}>
          <h2 className={styles.winnerText}>Team {winnerTeam} wins!</h2>
        </div>

        <div className={styles.scoreBreakdown}>
          <h3 className={styles.subtitle}>Team Scores</h3>
          <div className={styles.scores}>
            {([['A', scores.A], ['B', scores.B]] as const).map(([team, score]) => (
              <div key={team} className={styles.scoreRow}>
                <span className={styles.playerName}>Team {team}</span>
                <span className={styles.score}>{score}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.primaryButton}
            onClick={() => onNavigate?.('lobby')}
          >
            Play Again
          </button>
          <button
            className={styles.secondaryButton}
            onClick={() => onNavigate?.('home')}
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
