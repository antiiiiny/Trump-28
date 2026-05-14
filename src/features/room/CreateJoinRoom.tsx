import { useState } from 'react';
import styles from './CreateJoinRoom.module.css';

interface CreateJoinRoomProps {
  busy?: boolean;
  errorMessage?: string | null;
  onBack?: () => void;
  onCreateRoom: (playerName: string) => Promise<void>;
  onJoinRoom: (playerName: string, roomCode: string) => Promise<void>;
}

export function CreateJoinRoom({
  busy = false,
  errorMessage = null,
  onBack,
  onCreateRoom,
  onJoinRoom,
}: CreateJoinRoomProps) {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  const handleCreate = async () => {
    await onCreateRoom(playerName);
  };

  const handleJoin = async () => {
    await onJoinRoom(playerName, roomCode);
  };

  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Room Setup</h1>
          <button className={styles.backButton} onClick={onBack} type="button">
            Back
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'create' ? styles.active : ''}`}
            onClick={() => setActiveTab('create')}
            type="button"
          >
            Create Room
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'join' ? styles.active : ''}`}
            onClick={() => setActiveTab('join')}
            type="button"
          >
            Join Room
          </button>
        </div>

        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="playerName">Your Name</label>
            <input
              id="playerName"
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className={styles.input}
            />
          </div>

          {activeTab === 'create' && (
            <button
              className={styles.submitButton}
              disabled={busy || !playerName.trim()}
              onClick={handleCreate}
              type="button"
            >
              {busy ? 'Creating...' : 'Create Room'}
            </button>
          )}

          {activeTab === 'join' && (
            <>
              <div className={styles.formGroup}>
                <label htmlFor="roomCode">Room Code</label>
                <input
                  id="roomCode"
                  type="text"
                  placeholder="Enter room code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className={styles.input}
                  maxLength={4}
                />
              </div>
              <button
                className={styles.submitButton}
                disabled={busy || !playerName.trim() || roomCode.trim().length !== 4}
                onClick={handleJoin}
                type="button"
              >
                {busy ? 'Joining...' : 'Join Room'}
              </button>
            </>
          )}

          {errorMessage ? <p className={styles.errorMessage}>{errorMessage}</p> : null}
        </div>
      </div>
    </div>
  );
}
