import type { TeamId } from '../../../shared';
import styles from './ScorePanel.module.css';

interface ScorePanelProps {
  teamScores: Record<TeamId, number>;
}

export function ScorePanel({ teamScores }: ScorePanelProps) {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Score</h3>
      <div className={styles.scores}>
        {([['A', teamScores.A], ['B', teamScores.B]] as const).map(([team, score]) => (
          <div key={team} className={`${styles.scoreRow} ${styles[`team${team}` as 'teamA' | 'teamB']}`}>
            <span className={styles.playerName}>Team {team}</span>
            <span className={styles.scoreValue}>{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
