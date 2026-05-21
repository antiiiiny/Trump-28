import { useMemo, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { LobbyRoomState } from '../../../shared/colyseus/lobby';
import { OpponentArea } from '../../components/table/OpponentArea';
import { TrickArea } from '../../components/table/TrickArea';
import { PlayerHand } from '../../components/table/PlayerHand';
import { BidPanel } from '../../components/table/BidPanel';
import { ScorePanel } from '../../components/table/ScorePanel';
import { TurnIndicator } from '../../components/table/TurnIndicator';
import { getStoredGameSession, sendPlaceBid, sendPass, sendPlayCard, sendRevealTrump, sendSelectTrump } from '../../network/colyseus/game';
import styles from './GameTable.module.css';

interface GameTableProps {
  onNavigate?: (screen: 'home' | 'results' | 'lobby') => void;
  room?: Room<{ state: LobbyRoomState }> | null;
  myHand?: string[];
}

export function GameTable({ onNavigate, room, myHand = [] }: GameTableProps) {
  const [selectedCard, setSelectedCard] = useState<string>();
  const [selectedBid, setSelectedBid] = useState<number | null>(null);

  const roomState = room?.state;
  const localPlayerId = getStoredGameSession()?.playerId || '';
  const players = Array.from(roomState?.players || []).filter((player) => player.occupied);

  // Get local player info
  const localPlayer = players.find((p) => p.playerId === localPlayerId);
  const localTeam = localPlayer?.team || 'A';
  const localSeat = localPlayer?.seat ?? -1;

  // Game phase and status
  const phase = roomState?.phase || 'waiting';
  const isBiddingPhase = phase === 'biddingRound1' || phase === 'biddingRound2';
  const isPlayingPhase = phase === 'playing';
  const isSelectingTrump = phase === 'selectingTrump';
  const isYourTurn = roomState?.activePlayerId === localPlayerId;

  // Team scores and coolies
  const teamScores = { A: roomState?.teamAScore || 0, B: roomState?.teamBScore || 0 };
  const teamCoolies = { A: roomState?.teamACoolies || 0, B: roomState?.teamBCoolies || 0 };

  // Bidding info
  const currentBidValue = roomState?.currentBid?.playerId ? roomState.currentBid.value : null;
  const currentBidder = players.find((p) => p.playerId === roomState?.activePlayerId);
  const activeBidderName = currentBidder?.name || '';

  const biddingOrder = useMemo(() => {
    if (!roomState) return [];

    const orderedSeats = [0, 1, 2, 3].map((offset) => (roomState.dealerSeat + 1 + offset) % 4);
    return orderedSeats
      .map((seat) => players.find((player) => player.seat === seat))
      .filter((player): player is NonNullable<typeof player> => Boolean(player));
  }, [players, roomState]);

  // Determine if honours required (teammate has passed)
  const teammate = Array.from(roomState?.players || []).find((p) => p.seat === (3 - localSeat) && p.team === localTeam);
  const hasTeammatePassed = (roomState?.bids || []).some((b) => b.playerId === teammate?.playerId && b.passed);
  const honoursRequired = Boolean(phase === 'biddingRound1' && hasTeammatePassed);

  // Get opponent positions relative to local player
  const getOpponentPosition = (seat: number) => {
    const relativeSeat = (seat - localSeat + 4) % 4;
    if (relativeSeat === 1) return 'right';
    if (relativeSeat === 2) return 'top';
    if (relativeSeat === 3) return 'left';
    return null;
  };

  const opponentTop = Array.from(roomState?.players || []).find((p) => getOpponentPosition(p.seat) === 'top');
  const opponentLeft = Array.from(roomState?.players || []).find((p) => getOpponentPosition(p.seat) === 'left');
  const opponentRight = Array.from(roomState?.players || []).find((p) => getOpponentPosition(p.seat) === 'right');

  // Trick cards display
  const trickCards = (roomState?.currentTrick?.cards || []).map((card) => {
    const player = players.find((p) => p.playerId === card.playerId);
    if (!player) return null;
    const position = getOpponentPosition(player.seat);
    if (!position && player.seat !== localSeat) return null;
    return {
      playerId: card.playerId,
      code: card.code,
      position: player.seat === localSeat ? ('bottom' as const) : (position as 'top' | 'left' | 'right'),
    };
  }).filter(Boolean) as Array<{ playerId: string; code: string; position: 'top' | 'left' | 'right' | 'bottom' }>;

  const handCards = myHand;
  const currentLeadSuit = roomState?.currentTrick?.leadSuit || '';
  const hasLeadSuit = Boolean(currentLeadSuit) && handCards.some((code) => code.slice(-1) === currentLeadSuit);
  const canRevealTrump = isPlayingPhase && isYourTurn && Boolean(currentLeadSuit) && !roomState?.trumpRevealed && !hasLeadSuit;
  const trumpLabel = roomState?.trumpRevealed && roomState.trumpSuit
    ? `Trump revealed: ${roomState.trumpSuit === 'H' ? 'Hearts' : roomState.trumpSuit === 'D' ? 'Diamonds' : roomState.trumpSuit === 'C' ? 'Clubs' : 'Spades'}`
    : '';

  // Bidding handlers
  const handlePlaceBid = (bid: number) => {
    if (!room) return;
    setSelectedBid(bid);
    sendPlaceBid(room, bid, Boolean(honoursRequired), false);
  };

  const handlePass = () => {
    if (!room) return;
    setSelectedBid(null);
    sendPass(room);
  };

  // Card play handler
  const handleSelectCard = (code: string) => {
    if (isPlayingPhase) {
      if (!isYourTurn) {
        return;
      }

      sendPlayCard(room!, code);
      setSelectedCard(undefined);
      return;
    }

    setSelectedCard(selectedCard === code ? undefined : code);
  };

  const handleRevealTrump = () => {
    if (!room) return;
    sendRevealTrump(room);
  };

  const handleSelectTrump = (suit: string) => {
    if (!room) return;
    sendSelectTrump(room, suit);
  };

  const isBiddingDisabled = !isYourTurn || !isBiddingPhase;

  return (
    <div className={styles.container}>
      <div className={`${styles.board} ${isBiddingPhase ? styles.biddingLayout : styles.playingLayout}`}>
        {/* Only show opponents and trick area during playing phase */}
        {isPlayingPhase && (
          <>
            <OpponentArea
              position="top"
              opponentName={opponentTop?.name || 'Teammate'}
              teamLabel={`Team ${opponentTop?.team || 'A'}`}
              cardCount={opponentTop?.cardsRemaining || 8}
              tone={opponentTop?.team === localTeam ? 'teammate' : undefined}
            />

            <div className={styles.middleRow}>
              <OpponentArea
                position="left"
                opponentName={opponentLeft?.name || 'Opponent Left'}
                teamLabel={`Team ${opponentLeft?.team || 'B'}`}
                cardCount={opponentLeft?.cardsRemaining || 8}
              />

              <TrickArea trickCards={trickCards} />

              <OpponentArea
                position="right"
                opponentName={opponentRight?.name || 'Opponent Right'}
                teamLabel={`Team ${opponentRight?.team || 'B'}`}
                cardCount={opponentRight?.cardsRemaining || 8}
              />
            </div>
          </>
        )}

        {/* Main play area: score, turn indicator, and bidding/trick display */}
        <div className={styles.centralArea}>
          <div className={styles.topStatusRow}>
            <ScorePanel teamScores={teamScores} teamCoolies={teamCoolies} />
            <TurnIndicator
              activePlayer={activeBidderName}
              isYourTurn={isYourTurn}
              phaseLabel={isBiddingPhase ? 'Bidding' : isSelectingTrump ? 'Selecting Trump' : isPlayingPhase ? 'Playing' : phase}
              trumpLabel={trumpLabel}
            />
          </div>

          {trumpLabel ? <div className={styles.trumpStatusBanner}>{trumpLabel}</div> : null}

          {roomState?.bids?.length ? (
            <div className={styles.bidHistory}>
              <span className={styles.bidHistoryLabel}>Bid history</span>
              <div className={styles.bidHistoryRow}>
                {roomState.bids.map((bid, index) => {
                  const player = players.find((candidate) => candidate.playerId === bid.playerId);
                  const label = bid.passed ? 'Pass' : `${bid.value}${bid.isHonours ? 'H' : ''}`;
                  return (
                    <span key={`${bid.playerId}-${index}`} className={styles.bidHistoryChip}>
                      {player?.name || 'Player'}: {label}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}

          {isSelectingTrump ? (
            <div className={styles.selectTrumpCenter}>
              {roomState?.trumpHolderId === localPlayerId ? (
                <div className={styles.selectTrumpControls}>
                  <span className={styles.selectTrumpLabel}>Select trump:</span>
                  <button className={styles.trumpSuitButton} onClick={() => handleSelectTrump('H')}>Hearts</button>
                  <button className={styles.trumpSuitButton} onClick={() => handleSelectTrump('D')}>Diamonds</button>
                  <button className={styles.trumpSuitButton} onClick={() => handleSelectTrump('C')}>Clubs</button>
                  <button className={styles.trumpSuitButton} onClick={() => handleSelectTrump('S')}>Spades</button>
                </div>
              ) : (
                <div className={styles.selectTrumpWaiting}>Waiting for winning bidder to select trump…</div>
              )}
            </div>
          ) : isBiddingPhase ? (
            <div className={styles.biddingCenter}>
              <div className={styles.biddingStack}>
                <div className={styles.biddingOrder}>
                  <span className={styles.biddingOrderLabel}>Bidding order</span>
                  <div className={styles.biddingOrderRow}>
                    {biddingOrder.map((player) => {
                      const isActive = player.playerId === roomState?.activePlayerId;
                      return (
                        <span
                          key={player.playerId}
                          className={`${styles.biddingOrderChip} ${isActive ? styles.biddingOrderChipActive : ''}`}
                        >
                          {player.name || `Seat ${player.seat + 1}`}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <BidPanel
                  currentBid={currentBidValue}
                  selectedBid={selectedBid}
                  activeBidder={activeBidderName}
                  honoursRequired={honoursRequired}
                  disabled={isBiddingDisabled}
                  onPlaceBid={handlePlaceBid}
                  onPass={handlePass}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Player hand section */}
        <div className={styles.handSection}>
          <div className={styles.footerActions}>
            <button className={styles.secondaryButton} onClick={() => onNavigate?.('results')}>
              Show Results
            </button>
          </div>

          {canRevealTrump ? (
            <div className={styles.handActions}>
              <button className={styles.secondaryButton} onClick={handleRevealTrump}>
                Reveal Trump
              </button>
            </div>
          ) : null}

          <PlayerHand
            cards={handCards}
            playerName="You"
            teamLabel={`Team ${localTeam}`}
            selectedCardCode={selectedCard}
            onSelectCard={handleSelectCard}
          />
        </div>
      </div>
    </div>
  );
}
