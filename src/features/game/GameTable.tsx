import { useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { GamePhase, TeamId } from '../../../shared';
import type { LobbyRoomState } from '../../../shared/colyseus/lobby';
import { OpponentArea } from '../../components/table/OpponentArea';
import { TrickArea } from '../../components/table/TrickArea';
import { PlayerHand } from '../../components/table/PlayerHand';
import { BidPanel } from '../../components/table/BidPanel';
import { ScorePanel } from '../../components/table/ScorePanel';
import { TurnIndicator } from '../../components/table/TurnIndicator';
import styles from './GameTable.module.css';

interface GameTableProps {
  onNavigate?: (screen: 'home' | 'results' | 'lobby') => void;
  room?: Room<{ state: LobbyRoomState }> | null;
  myHand?: string[];
}

const currentPhase: GamePhase = 'biddingRound1';
const localTeam: TeamId = 'A';
const MOCK_HAND = ['AH', 'KH', 'QH', 'JH', '10H', '9H', '8H', '7H'];
const MOCK_TRICK_CARDS = [
  { playerId: 'teammate', code: '9D', position: 'top' as const },
  { playerId: 'left', code: 'JC', position: 'left' as const },
  { playerId: 'right', code: '10S', position: 'right' as const },
  { playerId: 'local', code: 'AH', position: 'bottom' as const },
];
const MOCK_TEAM_SCORES = { A: 14, B: 11 };

export function GameTable({ onNavigate, room, myHand = [] }: GameTableProps) {
  const [selectedCard, setSelectedCard] = useState<string>();
  const [selectedBid] = useState<number | null>(20);
  const roomState = room?.state;
  const teamScores = roomState
    ? { A: roomState.teamAScore, B: roomState.teamBScore }
    : MOCK_TEAM_SCORES;
  const handCards = myHand.length > 0 ? myHand : MOCK_HAND;
  const activePlayerLabel = roomState?.players.find((player) => player.playerId === roomState.activePlayerId)?.name || 'Teammate';

  return (
    <div className={styles.container}>
      <div className={styles.board}>
        <OpponentArea
          position="top"
          opponentName="Teammate"
          teamLabel="Team A"
          cardCount={8}
          tone="teammate"
        />

        <div className={styles.middleRow}>
          <OpponentArea
            position="left"
            opponentName="Opponent Left"
            teamLabel="Team B"
            cardCount={8}
          />

          <TrickArea trickCards={MOCK_TRICK_CARDS} />

          <OpponentArea
            position="right"
            opponentName="Opponent Right"
            teamLabel="Team B"
            cardCount={8}
          />
        </div>

        <div className={styles.bottomArea}>
          <div className={styles.statusRow}>
            <ScorePanel teamScores={teamScores} />
            <TurnIndicator activePlayer={activePlayerLabel} isYourTurn={false} />
            {currentPhase === 'biddingRound1' || currentPhase === 'biddingRound2' ? (
              <BidPanel
                currentBid={18}
                selectedBid={selectedBid}
                honoursRequired={true}
                disabled={false}
                onPlaceBid={(bid) => console.log('Bid:', bid)}
                onPass={() => console.log('Passed')}
              />
            ) : null}
          </div>

          <div className={styles.footerActions}>
            <button className={styles.secondaryButton} onClick={() => onNavigate?.('results')}>
              Show Results
            </button>
          </div>

          <PlayerHand
            cards={handCards}
            playerName="You"
            teamLabel={`Team ${localTeam}`}
            selectedCardCode={selectedCard}
            onSelectCard={setSelectedCard}
          />
        </div>
      </div>
    </div>
  );
}
