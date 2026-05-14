import styles from './TurnIndicator.module.css';

interface TurnIndicatorProps {
  activePlayer: string;
  isYourTurn: boolean;
}

export function TurnIndicator({ activePlayer, isYourTurn }: TurnIndicatorProps) {
  return (
    <div className={`${styles.container} ${isYourTurn ? styles.active : ''}`} aria-live="polite">
      {isYourTurn ? (
        <>
          <div className={styles.pulse} />
          <span>Your turn</span>
        </>
      ) : (
        <span>{activePlayer}'s turn</span>
      )}
    </div>
  );
}
