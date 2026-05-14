import { PlayingCardView } from '../cards/PlayingCardView';
import styles from './PlayerHand.module.css';

interface PlayerHandProps {
  cards: string[];
  playerName: string;
  teamLabel: string;
  selectedCardCode?: string;
  onSelectCard?: (code: string) => void;
}

export function PlayerHand({
  cards,
  playerName,
  teamLabel,
  selectedCardCode,
  onSelectCard,
}: PlayerHandProps) {
  const cardAngleIncrement = cards.length > 1 ? 12 / (cards.length - 1) : 0;

  return (
    <div className={styles.container}>
      <div className={styles.nameplateRow}>
        <div className={styles.nameplate}>{playerName}</div>
        <div className={styles.teamBadge}>{teamLabel}</div>
      </div>
      <div className={styles.hand}>
        {cards.map((code, index) => {
          const angle = (index - (cards.length - 1) / 2) * cardAngleIncrement;
          const isSelected = selectedCardCode === code;
          return (
            <button
              key={`${code}-${index}`}
              className={`${styles.cardButton} ${isSelected ? styles.selected : ''}`}
              style={{
                transform: `rotate(${angle}deg) translateY(${isSelected ? -20 : 0}px)`,
              }}
              onClick={() => onSelectCard?.(code)}
              aria-pressed={isSelected}
            >
              <div className={styles.card}>
                <PlayingCardView code={code} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
