import { useEffect, useRef, useState } from 'react';
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
  const [visibleCards, setVisibleCards] = useState(trickCards);
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }

    if (trickCards.length > 0) {
      setVisibleCards(trickCards);
      return;
    }

    clearTimerRef.current = window.setTimeout(() => {
      setVisibleCards([]);
      clearTimerRef.current = null;
    }, 600);

    return () => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
    };
  }, [trickCards]);

  const orderedPositions: Array<TrickCardDisplay['position']> = ['top', 'left', 'right', 'bottom'];
  const cardsToRender = visibleCards;

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {cardsToRender.length === 0 ? (
          <p className={styles.empty}>Waiting for cards...</p>
        ) : (
          <div className={styles.stage}>
            {orderedPositions.map((position) => {
              const card = cardsToRender.find((entry) => entry.position === position);

              if (!card) return null;

              return (
                <div key={card.playerId} className={`${styles.cardWrapper} ${styles[position]}`}>
                  <div className={styles.card}>
                    <PlayingCardView code={card.code} />
                  </div>
                  <div className={styles.playerLabel}>{position === 'bottom' ? 'You' : position === 'top' ? 'Teammate' : position === 'left' ? 'Opponent Left' : 'Opponent Right'}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
