import type { Room } from '@colyseus/sdk';
import type { LobbyPlayerState, LobbyRoomState } from '../../../shared/colyseus/lobby';
import styles from './Lobby.module.css';

interface LobbyProps {
  room: Room<LobbyRoomState>;
  onReadyUp: () => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onCopyRoomCode: () => Promise<void> | void;
}

function getSlotLabel(slot: LobbyPlayerState) {
  if (!slot.occupied) {
    return 'Waiting...';
  }

  if (!slot.connected) {
    return 'Disconnected';
  }

  return slot.ready ? 'Ready' : 'Not ready';
}

function renderPlayerCard(
  slot: LobbyPlayerState,
  isLocalPlayer: boolean,
  onReadyUp: () => void,
) {
  return (
    <div
      key={slot.seat}
      className={`${styles.playerCard} ${slot.team === 'A' ? styles.teamA : styles.teamB} ${
        isLocalPlayer ? styles.localPlayer : ''
      }`}
    >
      <div className={styles.playerHeader}>
        <div>
          <div className={styles.playerNameRow}>
            <span className={styles.playerName}>{slot.name || 'Waiting...'}</span>
            {isLocalPlayer ? <span className={styles.localBadge}>You</span> : null}
          </div>
          <div className={styles.playerMeta}>Seat {slot.seat + 1} · Team {slot.team}</div>
        </div>
        <div className={`${styles.readyIndicator} ${slot.ready ? styles.ready : styles.notReady}`}>
          {getSlotLabel(slot)}
        </div>
      </div>

      {isLocalPlayer && slot.connected && !slot.ready ? (
        <button className={styles.readyButton} onClick={onReadyUp} type="button">
          Ready Up
        </button>
      ) : null}
    </div>
  );
}

export function Lobby({ room, onReadyUp, onStartGame, onLeaveRoom, onCopyRoomCode }: LobbyProps) {
  if (!room || !room.state || !room.state.players || room.state.players.length < 4) {
    return (
      <div className={styles.container}>
        <div className={styles.panel}>Loading room state...</div>
      </div>
    );
  }

  const players = [...room.state.players];
  const hostIsLocal = room.state.hostId === room.sessionId;
  const allPlayersReady = players.every((player) => player.occupied && player.connected && player.ready);
  const teamAPlayers = [players[0], players[2]];
  const teamBPlayers = [players[1], players[3]];

  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Lobby</h1>
            <p className={styles.subtitle}>Team-based 28 room</p>
          </div>
          <button className={styles.leaveButton} onClick={onLeaveRoom} type="button">
            Leave Room
          </button>
        </div>

        <div className={styles.roomCode}>
          <span className={styles.label}>Room Code:</span>
          <span className={styles.code}>{room.state.roomCode}</span>
          <button className={styles.copyButton} onClick={onCopyRoomCode} type="button">
            Copy
          </button>
        </div>

        <div className={styles.teamGrid}>
          <section className={styles.teamSection}>
            <div className={styles.teamTitle}>Team A</div>
            <div className={styles.playerList}>
              {teamAPlayers.map((slot) => renderPlayerCard(slot, slot.playerId === room.sessionId, onReadyUp))}
            </div>
          </section>

          <section className={styles.teamSection}>
            <div className={styles.teamTitle}>Team B</div>
            <div className={styles.playerList}>
              {teamBPlayers.map((slot) => renderPlayerCard(slot, slot.playerId === room.sessionId, onReadyUp))}
            </div>
          </section>
        </div>

        <div className={styles.footerRow}>
          {hostIsLocal ? (
            <button className={styles.startButton} onClick={onStartGame} disabled={!allPlayersReady} type="button">
              Start Game
            </button>
          ) : (
            <div className={styles.hostHint}>Waiting for the host to start the game.</div>
          )}
          <div className={styles.readySummary}>
            {allPlayersReady ? 'All players are ready.' : 'Ready up to enable the host start button.'}
          </div>
        </div>
      </div>
    </div>
  );
}
