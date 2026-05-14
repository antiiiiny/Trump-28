import { PlayingCardView } from '../cards/PlayingCardView';
import styles from './TrickArea.module.css';

interface TrickCardDisplay {
  playerId: string;
  code: string;
  position: 'top' | 'left' | 'right' | 'bottom';
}

interface TrickAreaProps {
  trickCards: TrickCardDisplay[];
}

export function TrickArea({ trickCards }: TrickAreaProps) {
  const orderedPositions: Array<TrickCardDisplay['position']> = ['top', 'left', 'right', 'bottom'];

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {trickCards.length === 0 ? (
          <p className={styles.empty}>Waiting for cards...</p>
        ) : (
          <div className={styles.stage}>
            {orderedPositions.map((position) => {
              const card = trickCards.find((entry) => entry.position === position);

              if (!card) return null;

              return (
                <div key={card.playerId} className={`${styles.cardWrapper} ${styles[position]}`}>
                  <div className={styles.card}>
                    <PlayingCardView code={card.code} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
