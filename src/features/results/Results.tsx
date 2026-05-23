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

function toPlainBid(bid: { playerId: string; value: number; passed: boolean; isHonours: boolean }) {
  return {
    playerId: bid.playerId,
    value: bid.value,
    passed: bid.passed,
    isHonours: bid.isHonours,
  };
}

function getCardPoints(code: string) {
  const rank = code.slice(0, -1);
  if (rank === 'J') return 3;
  if (rank === '9') return 2;
  if (rank === 'A' || rank === '10') return 1;
  return 0;
}

function getTeamPoints(tricks: Array<{ cards: Array<{ playerId: string; card: { points: number } }>; winnerId: string | null }>, playerTeamsById: Record<string, TeamId>) {
  const totals: Record<TeamId, number> = { A: 0, B: 0 };

  for (const trick of tricks) {
    if (!trick.winnerId) {
      continue;
    }

    const teamId = playerTeamsById[trick.winnerId];
    if (!teamId) {
      continue;
    }

    totals[teamId] += trick.cards.reduce((sum, trickCard) => sum + trickCard.card.points, 0);
  }

  return totals;
}

function getCompletedSummary(roomState?: LobbyRoomState) {
  const summary = roomState?.lastRoundSummary;
  if (
    summary
    && summary.roundNumber > 0
    && summary.bidPlayerId
    && summary.biddingTeamId
    && summary.winningTeamId
  ) {
    return summary;
  }

  if (!roomState) {
    return null;
  }

  const occupiedPlayers = Array.from(roomState.players || []).filter((player) => player.occupied && player.playerId);
  const playerTeamsById = Object.fromEntries(occupiedPlayers.map((player) => [player.playerId, player.team])) as Record<string, TeamId>;
  const bids = Array.from(roomState.bids || []).map(toPlainBid);
  const currentBid = roomState.currentBid.playerId ? toPlainBid(roomState.currentBid) : null;
  const resolvedBid = currentBid ?? [...bids].reverse().find((bid) => !bid.passed) ?? null;

  if (!resolvedBid || Object.keys(playerTeamsById).length === 0) {
    return null;
  }

  const tricks = Array.from(roomState.tricks || []).map((trick) => ({
    cards: Array.from(trick.cards || []).map((card) => ({
      playerId: card.playerId,
      card: {
        rank: card.code.slice(0, -1),
        suit: card.code.slice(-1),
        code: card.code,
        points: getCardPoints(card.code),
      },
    })),
    winnerId: trick.winnerId || null,
    leadSuit: trick.leadSuit || null,
  }));

  const teamPoints = getTeamPoints(tricks, playerTeamsById);
  const biddingTeamId = playerTeamsById[resolvedBid.playerId];
  if (!biddingTeamId) {
    return null;
  }

  const opposingTeamId: TeamId = biddingTeamId === 'A' ? 'B' : 'A';
  const biddingTeamPoints = teamPoints[biddingTeamId] ?? 0;
  const opposingTeamPoints = teamPoints[opposingTeamId] ?? 0;
  const biddingTeamWon = biddingTeamPoints >= resolvedBid.value;

  return {
    roundNumber: roomState.roundNumber,
    biddingTeamId,
    winningTeamId: biddingTeamWon ? biddingTeamId : opposingTeamId,
    bidValue: resolvedBid.value,
    bidPlayerId: resolvedBid.playerId,
    biddingTeamPoints,
    opposingTeamPoints,
    biddingTeamWon,
  };
}

export function Results({ room, onLeaveRoom }: ResultsProps) {
  const session = getStoredGameSession();
  const roomState = room?.state;
  const summary = getCompletedSummary(roomState);
  const isFinal = roomState?.phase === 'gameEnd';
  const isHost = Boolean(session?.playerId && roomState?.hostId === session.playerId);
  const hasCompleteSummary = Boolean(summary);
  const completedSummary = summary;

  const players = Array.from(roomState?.players || [])
    .filter((player) => player.occupied)
    .map((player) => ({
      name: player.name,
      team: player.team,
    }));

  const winningTeam = completedSummary?.winningTeamId ?? null;
  const biddingTeam = completedSummary?.biddingTeamId ?? null;
  const trickPoints = completedSummary && biddingTeam
    ? {
      A: biddingTeam === 'A' ? completedSummary.biddingTeamPoints : completedSummary.opposingTeamPoints,
      B: biddingTeam === 'B' ? completedSummary.biddingTeamPoints : completedSummary.opposingTeamPoints,
    } as Record<TeamId, number>
    : null;
  const bidValue = completedSummary?.bidValue ?? null;

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

        {hasCompleteSummary && winningTeam && biddingTeam && trickPoints && bidValue !== null ? (
          <>
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
          </>
        ) : (
          <div className={styles.winner}>
            <h2 className={styles.winnerText}>Round results are syncing</h2>
            <p className={styles.caption}>Waiting for the server to finish summarizing the round.</p>
          </div>
        )}

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
