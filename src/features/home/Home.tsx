import styles from './Home.module.css';

interface HomeProps {
  onNavigate?: (screen: 'room') => void;
}

export function Home({ onNavigate }: HomeProps) {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <p className={styles.mode}>28</p>
        <h1 className={styles.title}>Trump</h1>
        <p className={styles.subtitle}>Four-player trick-taking card game</p>
        <button className={styles.button} onClick={() => onNavigate?.('room')}>
          Play
        </button>
      </div>
    </div>
  );
}
