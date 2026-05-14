import styles from './BidPanel.module.css';

interface BidPanelProps {
  currentBid: number | null;
  selectedBid: number | null;
  honoursRequired: boolean;
  onPlaceBid?: (value: number) => void;
  onPass?: () => void;
  disabled?: boolean;
}

export function BidPanel({
  currentBid,
  selectedBid,
  honoursRequired,
  onPlaceBid,
  onPass,
  disabled = false,
}: BidPanelProps) {
  const bidOptions = Array.from({ length: 15 }, (_, index) => index + 14);

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h3 className={styles.title}>Bid Panel</h3>
        <span className={styles.note}>{honoursRequired ? 'Honours: 20+' : 'Opening: 14+'}</span>
      </div>

      <p className={styles.currentBid}>
        Current bid: <strong>{currentBid ?? 'None'}</strong>
      </p>

      <div className={styles.options}>
        {bidOptions.map((bid) => (
          <button
            key={bid}
            className={`${styles.bidButton} ${selectedBid === bid ? styles.selected : ''}`}
            onClick={() => onPlaceBid?.(bid)}
            disabled={disabled}
            aria-pressed={selectedBid === bid}
          >
            {bid}
          </button>
        ))}
      </div>
      <button
        className={styles.passButton}
        onClick={onPass}
        disabled={disabled}
      >
        Pass
      </button>
    </div>
  );
}
