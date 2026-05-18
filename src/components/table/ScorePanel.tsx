import type { TeamId } from '../../../shared';
import styles from './ScorePanel.module.css';

interface ScorePanelProps {
  teamScores: Record<TeamId, number>;
  teamCoolies?: Record<TeamId, number>;
}

export function ScorePanel({ teamScores, teamCoolies = { A: 0, B: 0 } }: ScorePanelProps) {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Score</h3>
      <div className={styles.scores}>
        {([['A', teamScores.A, teamCoolies.A], ['B', teamScores.B, teamCoolies.B]] as const).map(([team, score, coolies]) => (
          <div key={team} className={`${styles.scoreRow} ${styles[`team${team}` as 'teamA' | 'teamB']}`}>
            <span className={styles.playerName}>Team {team}</span>
            <div className={styles.scoreData}>
              <span className={styles.scoreValue}>{score}</span>
              <span className={styles.coolieValue} title="Coolies" style={{ fontSize: '0.8em', opacity: 0.8, marginLeft: '8px' }}>
                ⭐ {coolies}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
