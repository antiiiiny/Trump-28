import styles from './TurnIndicator.module.css';

interface TurnIndicatorProps {
  activePlayer: string;
  isYourTurn: boolean;
  phaseLabel?: string;
  trumpLabel?: string;
}

export function TurnIndicator({ activePlayer, isYourTurn, phaseLabel, trumpLabel }: TurnIndicatorProps) {
  return (
    <div className={`${styles.container} ${isYourTurn ? styles.active : ''}`} aria-live="polite">
      <div className={styles.stack}>
        {phaseLabel ? <span className={styles.phase}>{phaseLabel}</span> : null}
        {trumpLabel ? <span className={styles.trump}>{trumpLabel}</span> : null}
      </div>
      <div className={styles.turnRow}>
        <div className={styles.pulse} />
        <span className={`${styles.playerName} ${isYourTurn ? styles.playerNameActive : ''}`}>
          {activePlayer || 'Waiting for turn'}
        </span>
      </div>
    </div>
  );
}
