import type { Room } from '@colyseus/sdk';
import type { LobbyRoomState } from '../../../shared/colyseus/lobby';
import type { TeamId } from '../../../shared';
import { getStoredGameSession, sendEndGame, sendRequestRematch } from '../../network/colyseus/game';
import styles from './Results.module.css';

interface ResultsProps {
  room?: Room<{ state: LobbyRoomState }> | null;
  onNavigate?: (screen: 'home' | 'lobby') => void;
  onLeaveRoom?: () => Promise<void> | void;
}

function formatTeamNames(players: Array<{ name: string; team: TeamId }>, team: TeamId) {
  return players
    .filter((player) => player.team === team)
    .map((player) => player.name || 'Unknown')
    .join(', ');
}

function formatBidResult(team: TeamId, bidTeamId: TeamId, bidValue: number, trickPoints: number) {
  if (team !== bidTeamId) {
    return `Team ${team} scored ${trickPoints} trick points`;
  }

  const outcome = trickPoints >= bidValue ? 'Win' : 'Loss';
  return `Team ${team} bid ${bidValue}, scored ${trickPoints} — ${outcome}`;
}

function coolieText(count: number) {
  if (count < 5) {
    return `${count}`;
  }

  return `${count} (Joker)`;
}

export function Results({ room, onLeaveRoom }: ResultsProps) {
  const session = getStoredGameSession();
  const roomState = room?.state;
  const summary = roomState?.lastRoundSummary;
  const isFinal = roomState?.phase === 'gameEnd';
  const isHost = Boolean(session?.playerId && roomState?.hostId === session.playerId);

  const players = Array.from(roomState?.players || [])
    .filter((player) => player.occupied)
    .map((player) => ({
      name: player.name,
      team: player.team,
    }));

  const winningTeam = summary?.winningTeamId || 'A';
  const biddingTeam = summary?.biddingTeamId || 'A';
  const trickPoints = {
    A: biddingTeam === 'A' ? summary?.biddingTeamPoints ?? 0 : summary?.opposingTeamPoints ?? 0,
    B: biddingTeam === 'B' ? summary?.biddingTeamPoints ?? 0 : summary?.opposingTeamPoints ?? 0,
  } as Record<TeamId, number>;
  const bidValue = summary?.bidValue ?? 0;

  const handlePlayAgain = () => {
    if (!room || !isHost) {
      return;
    }

    sendRequestRematch(room);
  };

  const handleEndGame = () => {
    if (!room || !isHost) {
      return;
    }

    sendEndGame(room);
  };

  const roundTitle = isFinal ? 'Final Summary' : 'Round Results';

  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <h1 className={styles.title}>{roundTitle}</h1>

        <div className={styles.winner}>
          <h2 className={styles.winnerText}>Team {winningTeam} wins the round</h2>
          <p className={styles.caption}>{formatTeamNames(players, winningTeam)}</p>
        </div>

        <div className={styles.scoreBreakdown}>
          <h3 className={styles.subtitle}>Point Breakdown</h3>
          <div className={styles.scores}>
            {([['A', trickPoints.A], ['B', trickPoints.B]] as const).map(([team, score]) => (
              <div key={team} className={styles.scoreRow}>
                <span className={styles.playerName}>Team {team}</span>
                <span className={styles.score}>{score} trick points</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.scoreBreakdown}>
          <h3 className={styles.subtitle}>Bid vs Score</h3>
          <div className={styles.scores}>
            <div className={styles.scoreRow}>
              <span className={styles.playerName}>Team {biddingTeam}</span>
              <span className={styles.score}>{formatBidResult(biddingTeam, biddingTeam, bidValue, trickPoints[biddingTeam])}</span>
            </div>
            <div className={styles.scoreRow}>
              <span className={styles.playerName}>Team {biddingTeam === 'A' ? 'B' : 'A'}</span>
              <span className={styles.score}>{formatBidResult(biddingTeam === 'A' ? 'B' : 'A', biddingTeam, bidValue, trickPoints[biddingTeam === 'A' ? 'B' : 'A'])}</span>
            </div>
          </div>
        </div>

        <div className={styles.scoreBreakdown}>
          <h3 className={styles.subtitle}>Coolies</h3>
          <div className={styles.scores}>
            {([['A', roomState?.teamACoolies ?? 0], ['B', roomState?.teamBCoolies ?? 0]] as const).map(([team, coolies]) => (
              <div key={team} className={styles.scoreRow}>
                <span className={styles.playerName}>Team {team}</span>
                <span className={styles.score}>{coolieText(coolies)}</span>
              </div>
            ))}
          </div>
        </div>

        {!isFinal ? (
          <div className={styles.actions}>
            {isHost ? (
              <>
                <button className={styles.primaryButton} onClick={handlePlayAgain}>Play Again</button>
                <button className={styles.secondaryButton} onClick={handleEndGame}>End Game</button>
              </>
            ) : (
              <p className={styles.hostMessage}>Only the host can start the next round or end the game.</p>
            )}
          </div>
        ) : (
          <div className={styles.actions}>
            <button className={styles.secondaryButton} onClick={() => void onLeaveRoom?.()}>
              Return to Lobby
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
