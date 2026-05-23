import styles from './ReconnectOverlay.module.css';

interface ReconnectOverlayProps {
  isVisible: boolean;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export function ReconnectOverlay({
  isVisible = true,
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: ReconnectOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          {onSecondaryAction && secondaryActionLabel ? (
            <button className={`${styles.button} ${styles.secondaryButton}`} onClick={onSecondaryAction} type="button">
              {secondaryActionLabel}
            </button>
          ) : null}
          <button className={styles.button} onClick={onAction} type="button">
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
