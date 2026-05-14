import { useState } from 'react';
import type { GamePhase, TeamId } from '../../../shared';
import { OpponentArea } from '../../components/table/OpponentArea';
import { TrickArea } from '../../components/table/TrickArea';
import { PlayerHand } from '../../components/table/PlayerHand';
import { BidPanel } from '../../components/table/BidPanel';
import { ScorePanel } from '../../components/table/ScorePanel';
import { TurnIndicator } from '../../components/table/TurnIndicator';
import styles from './GameTable.module.css';

interface GameTableProps {
  onNavigate?: (screen: 'home' | 'results' | 'lobby') => void;
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

export function GameTable({ onNavigate }: GameTableProps) {
  const [selectedCard, setSelectedCard] = useState<string>();
  const [selectedBid] = useState<number | null>(20);

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
            <ScorePanel teamScores={MOCK_TEAM_SCORES} />
            <TurnIndicator activePlayer="Teammate" isYourTurn={false} />
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
            cards={MOCK_HAND}
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
