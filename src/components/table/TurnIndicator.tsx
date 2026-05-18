import styles from './TurnIndicator.module.css';

interface TurnIndicatorProps {
  activePlayer: string;
  isYourTurn: boolean;
  phaseLabel?: string;
}

export function TurnIndicator({ activePlayer, isYourTurn, phaseLabel }: TurnIndicatorProps) {
  return (
    <div className={`${styles.container} ${isYourTurn ? styles.active : ''}`} aria-live="polite">
      {phaseLabel ? <span className={styles.phase}>{phaseLabel}</span> : null}
      {isYourTurn ? (
        <>
          <div className={styles.pulse} />
          <span>Your turn</span>
        </>
      ) : (
        <span>{activePlayer ? `${activePlayer}'s turn` : 'Waiting for turn'}</span>
      )}
    </div>
  );
}
