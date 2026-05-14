import styles from './OpponentArea.module.css';

interface OpponentAreaProps {
  position: 'top' | 'left' | 'right';
  opponentName: string;
  cardCount: number;
  teamLabel: string;
  tone?: 'opponent' | 'teammate';
}

export function OpponentArea({
  position,
  opponentName,
  cardCount,
  teamLabel,
  tone = 'opponent',
}: OpponentAreaProps) {
  return (
    <div className={`${styles.container} ${styles[position]} ${styles[tone]}`}>
      <div className={styles.nameplate}>{opponentName}</div>
      <div className={styles.teamLabel}>{teamLabel}</div>
      <div className={styles.cardCount}>{cardCount} cards</div>
    </div>
  );
}
