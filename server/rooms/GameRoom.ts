import { Room, type Client } from 'colyseus';
import { GameBidState, GameTrickCardState, GameTrickState, LobbyRoomState, createLobbyPlayers, type LobbyPlayerState } from '../../shared/colyseus/lobby';
import { joinRoomSchema, leaveRoomSchema, readyUpSchema, startGameSchema, type JoinRoomPayload, type LeaveRoomPayload, type ReadyUpPayload, type StartGamePayload } from '../../shared/protocol/lobby';
import { placeBidPayloadSchema, playCardPayloadSchema, selectTrumpPayloadSchema, type PlaceBidPayload, type PlayCardPayload, type SelectTrumpPayload } from '../../shared/protocol/game';
import { createDeck } from '../game/deck';
import { getNextEligibleBidderId, isBiddingComplete, resolveTrick, scoreRound, validateBid, validateCardPlay, type RulesState } from '../game/engine';
import { sendPrivateHand, sendPrivateTrump, sendRoundSnapshot } from '../game/privateDelivery';
import type { Card } from '../../shared/models/card';
import type { Bid } from '../../shared/models/bid';
import type { RoundState } from '../../shared/models/round';
import type { Suit } from '../../shared/enums/suit';
import type { TeamId } from '../../shared/models/team';
import type { Trick } from '../../shared/models/trick';

const RECONNECT_WINDOW_SECONDS = 60;

function cardFromCode(code: string): Card {
  const suit = code.slice(-1) as Suit;
  const rank = code.slice(0, -1) as Card['rank'];
  const points = rank === 'J' ? 3 : rank === '9' ? 2 : rank === 'A' || rank === '10' ? 1 : 0;

  return {
    rank,
    suit,
    code,
    points,
  };
}

function ensurePlayerSlots(state: LobbyRoomState) {
  if (state.players.length === 4) {
    return;
  }

  state.players = createLobbyPlayers();
}

function getSeatFromOptions(options: { seat?: number; playerId?: string; name?: string } | undefined) {
  if (typeof options?.seat === 'number' && options.seat >= 0 && options.seat <= 3) {
    return options.seat;
  }

  return undefined;
}

function createRulesState(room: GameRoom): RulesState {
  const handsByPlayerId: Record<string, Card[]> = {};

  for (const player of room.state.players) {
    if (player.playerId) {
      handsByPlayerId[player.playerId] = room.handsBySeat.get(player.seat) ?? [];
    }
  }

  return {
    phase: room.state.phase,
    players: room.state.players
      .filter((player) => player.occupied)
      .map((player) => ({
        playerId: player.playerId,
        seat: player.seat,
        team: player.team as TeamId,
      })),
    handsByPlayerId,
    bids: room.state.bids as Bid[],
    currentBid: room.state.currentBid as Bid | null,
    currentTrick: room.state.currentTrick as unknown as Trick,
    tricks: room.state.tricks as unknown as Trick[],
    trumpSuit: (room.privateTrumpSuit ? room.privateTrumpSuit : room.state.trumpRevealed ? (room.state.trumpSuit as Suit | '') : '') || null,
    trumpRevealed: room.state.trumpRevealed,
    trumpHolderId: room.state.trumpHolderId,
    activePlayerId: room.state.activePlayerId,
    dealerSeat: room.state.dealerSeat,
  };
}

function createRoundSnapshot(room: GameRoom): RoundState {
  const toBid = (bidState: GameBidState): Bid => ({
    playerId: bidState.playerId,
    value: bidState.value,
    passed: bidState.passed,
    isHonours: bidState.isHonours,
  });

  const toTrick = (trickState: GameTrickState): Trick => ({
    cards: trickState.cards.map((cardState) => ({
      playerId: cardState.playerId,
      card: cardFromCode(cardState.code),
    })),
    winnerId: trickState.winnerId || null,
    leadSuit: trickState.leadSuit ? (trickState.leadSuit as Suit) : null,
  });

  return {
    phase: room.state.phase,
    hands: {},
    tricks: room.state.tricks.map((trickState) => toTrick(trickState)),
    currentTrick: toTrick(room.state.currentTrick),
    trumpSuit: room.state.trumpRevealed && room.state.trumpSuit ? (room.state.trumpSuit as Suit) : null,
    trumpRevealed: room.state.trumpRevealed,
    trumpHolderId: room.state.trumpHolderId,
    bids: room.state.bids.map((bidState) => toBid(bidState)),
    currentBid: room.state.currentBid.playerId ? toBid(room.state.currentBid) : null,
    activePlayerId: room.state.activePlayerId,
    dealerSeat: room.state.dealerSeat,
  };
}

export class GameRoom extends Room<{ state: LobbyRoomState }> {
  maxClients = 4;

  private readonly seatByClient = new Map<string, number>();
  private readonly reconnectTimers = new Map<string, NodeJS.Timeout>();
  readonly handsBySeat = new Map<number, Card[]>();
  private readonly pendingHandsBySeat = new Map<number, Card[]>();
  private readonly dealtSecondHands = new Set<number>();
  privateTrumpSuit: Suit | '' = '';
  privateTrumpHolderSeat: number | null = null;

  onCreate(options: { lobbyRoomId?: string } = {}) {
    this.setState(new LobbyRoomState());
    this.state.roomCode = this.roomId;
    this.state.gameRoomId = this.roomId;
    this.state.phase = 'biddingRound1';
    this.state.gameStarted = true;
    this.state.roundNumber = 1;
    this.state.dealerSeat = 0;
    this.state.activePlayerId = '';
    this.state.trumpRevealed = false;
    this.state.trumpSuit = '';
    this.state.trumpHolderId = '';
    this.state.players = createLobbyPlayers();
    ensurePlayerSlots(this.state);

    this.handsBySeat.clear();
    this.pendingHandsBySeat.clear();
    this.dealtSecondHands.clear();
    const deck = createDeck(options.lobbyRoomId ?? this.roomId);
    const initialHands = [deck.slice(0, 4), deck.slice(4, 8), deck.slice(8, 12), deck.slice(12, 16)];
    const secondHands = [deck.slice(16, 20), deck.slice(20, 24), deck.slice(24, 28), deck.slice(28, 32)];
    initialHands.forEach((hand, seat) => this.handsBySeat.set(seat, hand));
    secondHands.forEach((hand, seat) => this.pendingHandsBySeat.set(seat, hand));

    this.privateTrumpSuit = '';
    this.privateTrumpHolderSeat = null;

    this.onMessage('joinRoom', (client: Client, message: JoinRoomPayload) => {
      this.handleJoinRoom(client, message);
    });

    this.onMessage('leaveRoom', (client: Client, message: LeaveRoomPayload) => {
      this.handleLeaveRoom(client, message);
    });

    this.onMessage('readyUp', (client: Client, message: ReadyUpPayload) => {
      this.handleReadyUp(client, message);
    });

    this.onMessage('startGame', (client: Client, message: StartGamePayload) => {
      this.handleStartGame(client, message);
    });

    this.onMessage('placeBid', (client: Client, message: PlaceBidPayload) => {
      this.handlePlaceBid(client, message);
    });

    this.onMessage('selectTrump', (client: Client, message: SelectTrumpPayload) => {
      this.handleSelectTrump(client, message);
    });

    this.onMessage('playCard', (client: Client, message: PlayCardPayload) => {
      this.handlePlayCard(client, message);
    });
  }

  private sendClientError(client: Client, code: string, message: string) {
    try {
      client.send('error', { code, message });
    } catch (err) {
      console.warn('Failed to send game error to client', client.sessionId, err);
    }
  }

  private hydrateClient(client: Client, seat: number, options: { playerId?: string; name?: string } = {}) {
    const player = this.state.players[seat];
    player.playerId = options.playerId ?? client.sessionId;
    player.name = options.name ?? player.name;
    player.connected = true;
    player.occupied = true;
    player.ready = true;
    player.cardsRemaining = this.handsBySeat.get(seat)?.length ?? 0;
    this.seatByClient.set(client.sessionId, seat);
  }

  onJoin(client: Client, options: { seat?: number; playerId?: string; name?: string } = {}) {
    const existingTimer = this.reconnectTimers.get(client.sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.reconnectTimers.delete(client.sessionId);
    }

    let seat = this.seatByClient.get(client.sessionId);
    if (seat === undefined) {
      seat = getSeatFromOptions(options);
    }
    if (seat === undefined) {
      seat = this.state.players.findIndex((player: LobbyPlayerState) => !player.occupied);
    }

    if (seat === -1 || seat === undefined) {
      this.sendClientError(client, 'room_full', 'Game room already full.');
      return;
    }

    this.hydrateClient(client, seat, options);
    const openingSeat = ((this.state.dealerSeat + 1) % 4) as number;
    if (!this.state.activePlayerId && seat === openingSeat) {
      this.state.activePlayerId = this.state.players[seat].playerId;
    }
    this.state.paused = false;
    this.state.pauseReason = '';

    const hand = this.handsBySeat.get(seat) ?? [];
    sendPrivateHand(client, this.state.players[seat].playerId, hand);

    sendRoundSnapshot(client, createRoundSnapshot(this), this.state.players[seat].playerId);

    if (this.privateTrumpHolderSeat === seat && this.privateTrumpSuit) {
      sendPrivateTrump(client, this.privateTrumpSuit, this.state.players[seat].playerId);
    }
  }

  onLeave(client: Client) {
    const seat = this.seatByClient.get(client.sessionId);
    if (seat === undefined) {
      return;
    }

    try {
      // @ts-ignore Colyseus allowReconnection exists on Room
      this.allowReconnection(client, RECONNECT_WINDOW_SECONDS);
    } catch (err) {
      // ignore for compatibility across versions
    }

    const player = this.state.players[seat];
    player.connected = false;
    this.state.paused = true;
    this.state.pauseReason = 'A player disconnected during the game. Waiting for reconnection.';

    const timeout = setTimeout(() => {
      const current = this.state.players[seat];
      if (current && !current.connected) {
        current.playerId = '';
        current.name = '';
        current.occupied = false;
        current.ready = false;
        current.cardsRemaining = 0;
        this.seatByClient.delete(client.sessionId);
      }
      this.reconnectTimers.delete(client.sessionId);

      if (this.state.players.some((playerState) => playerState.connected)) {
        this.state.paused = true;
      } else {
        this.state.phase = 'roundEnd';
      }
    }, RECONNECT_WINDOW_SECONDS * 1000);

    this.reconnectTimers.set(client.sessionId, timeout);
  }

  onDispose() {
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
  }

  private handleJoinRoom(client: Client, message: JoinRoomPayload) {
    let payload;
    try {
      payload = joinRoomSchema.parse(message);
    } catch (err) {
      this.sendClientError(client, 'invalid_payload', 'Invalid joinRoom payload');
      return;
    }

    const seat = this.seatByClient.get(client.sessionId);
    if (seat === undefined) {
      this.sendClientError(client, 'no_seat', 'No seat assigned for this session');
      return;
    }

    this.state.players[seat].name = payload.playerName.trim().slice(0, 16);
  }

  private handleLeaveRoom(client: Client, _message: LeaveRoomPayload) {
    try {
      leaveRoomSchema.parse(_message);
    } catch (err) {
      this.sendClientError(client, 'invalid_payload', 'Invalid leaveRoom payload');
      return;
    }

    const seat = this.seatByClient.get(client.sessionId);
    if (seat === undefined) {
      this.sendClientError(client, 'no_seat', 'No seat assigned for this session');
      return;
    }

    const player = this.state.players[seat];
    player.connected = false;
    player.ready = false;
  }

  private handleReadyUp(client: Client, _message: ReadyUpPayload) {
    try {
      readyUpSchema.parse(_message);
    } catch (err) {
      this.sendClientError(client, 'invalid_payload', 'Invalid readyUp payload');
      return;
    }

    const seat = this.seatByClient.get(client.sessionId);
    if (seat === undefined) {
      this.sendClientError(client, 'no_seat', 'No seat assigned for this session');
      return;
    }

    const player = this.state.players[seat];
    if (player.occupied && player.connected) {
      player.ready = true;
    }
  }

  private handlePlaceBid(client: Client, message: PlaceBidPayload) {
    const parsed = placeBidPayloadSchema.safeParse(message);
    if (!parsed.success) {
      this.sendClientError(client, 'invalid_payload', 'Invalid placeBid payload');
      return;
    }

    const rulesState = createRulesState(this);
    const validation = validateBid(parsed.data, rulesState);

    if (!validation.valid) {
      this.sendClientError(client, 'invalid_bid', validation.reason ?? 'Invalid bid');
      return;
    }

    const seat = this.seatByClient.get(client.sessionId);
    if (seat === undefined) {
      this.sendClientError(client, 'no_seat', 'No seat assigned for this session');
      return;
    }

    const bidState = new GameBidState();
    bidState.playerId = parsed.data.playerId;
    bidState.value = parsed.data.value;
    bidState.passed = parsed.data.passed;
    bidState.isHonours = parsed.data.isHonours;
    this.state.bids.push(bidState);

    if (!parsed.data.passed) {
      this.state.currentBid.playerId = parsed.data.playerId;
      this.state.currentBid.value = parsed.data.value;
      this.state.currentBid.passed = false;
      this.state.currentBid.isHonours = parsed.data.isHonours;
      this.state.trumpHolderId = parsed.data.playerId;
      this.privateTrumpHolderSeat = seat;
    }

    this.advanceBiddingState(parsed.data.playerId);
  }

  private handleSelectTrump(client: Client, message: SelectTrumpPayload) {
    const parsed = selectTrumpPayloadSchema.safeParse(message);
    if (!parsed.success) {
      this.sendClientError(client, 'invalid_payload', 'Invalid selectTrump payload');
      return;
    }

    const seat = this.seatByClient.get(client.sessionId);
    if (seat === undefined) {
      this.sendClientError(client, 'no_seat', 'No seat assigned for this session');
      return;
    }

    const player = this.state.players[seat];
    if (player.playerId !== parsed.data.playerId || player.playerId !== this.state.trumpHolderId) {
      this.sendClientError(client, 'not_trump_holder', 'Only the winning bidder may select trump');
      return;
    }

    this.privateTrumpHolderSeat = seat;
    this.privateTrumpSuit = parsed.data.trumpSuit;
    this.state.trumpHolderId = player.playerId;
    sendPrivateTrump(client, parsed.data.trumpSuit, player.playerId);
  }

  private handlePlayCard(client: Client, message: PlayCardPayload) {
    const parsed = playCardPayloadSchema.safeParse(message);
    if (!parsed.success) {
      this.sendClientError(client, 'invalid_payload', 'Invalid playCard payload');
      return;
    }

    const seat = this.seatByClient.get(client.sessionId);
    if (seat === undefined) {
      this.sendClientError(client, 'no_seat', 'No seat assigned for this session');
      return;
    }

    const player = this.state.players[seat];
    const rulesState = createRulesState(this);
    const validation = validateCardPlay(parsed.data.card, player.playerId, rulesState);

    if (!validation.valid) {
      this.sendClientError(client, 'invalid_card_play', validation.reason ?? 'Invalid card play');
      return;
    }

    const hand = this.handsBySeat.get(seat) ?? [];
    const handIndex = hand.findIndex((handCard) => handCard.code === parsed.data.card.code);
    if (handIndex === -1) {
      this.sendClientError(client, 'card_missing', 'Card not found in hand');
      return;
    }

    hand.splice(handIndex, 1);
    this.handsBySeat.set(seat, hand);
    player.cardsRemaining = hand.length;

    if (this.state.currentTrick.cards.length === 0) {
      this.state.currentTrick.leadSuit = parsed.data.card.suit;
    }

    const trickCard = new GameTrickCardState();
    trickCard.playerId = player.playerId;
    trickCard.code = parsed.data.card.code;
    trickCard.position = String(seat);
    this.state.currentTrick.cards.push(trickCard);

    if (validation.revealsTrump) {
      this.state.trumpRevealed = true;
      this.privateTrumpSuit = parsed.data.card.suit;
      this.state.trumpSuit = parsed.data.card.suit;
    }

    this.state.activePlayerId = this.getNextPlayerId(player.playerId);

    const activeTrumpSuit = this.state.trumpRevealed && this.state.trumpSuit ? this.state.trumpSuit : this.privateTrumpSuit;

    if (this.state.currentTrick.cards.length === 4 && activeTrumpSuit) {
      const trickSnapshot: Trick = {
        cards: this.state.currentTrick.cards.map((currentCard) => ({
          playerId: currentCard.playerId,
          card: cardFromCode(currentCard.code),
        })),
        winnerId: null,
        leadSuit: this.state.currentTrick.leadSuit ? (this.state.currentTrick.leadSuit as Suit) : null,
      };
      const winnerId = resolveTrick(trickSnapshot, activeTrumpSuit as Suit);
      this.state.currentTrick.winnerId = winnerId;
      this.state.tricks.push(this.state.currentTrick);
      this.state.currentTrick = new GameTrickState();
      this.state.activePlayerId = winnerId;

      const allTricksComplete = this.state.tricks.length >= 8;
      if (allTricksComplete && this.state.currentBid) {
        const roundResult = scoreRound(
          this.state.tricks.map((currentTrick) => ({
            cards: currentTrick.cards.map((currentCard) => ({
              playerId: currentCard.playerId,
              card: cardFromCode(currentCard.code),
            })),
            winnerId: currentTrick.winnerId || null,
            leadSuit: currentTrick.leadSuit ? (currentTrick.leadSuit as Suit) : null,
          })),
          {
            playerId: this.state.currentBid.playerId,
            value: this.state.currentBid.value,
            passed: this.state.currentBid.passed,
            isHonours: this.state.currentBid.isHonours,
          },
          Object.fromEntries(this.state.players.map((currentPlayer) => [currentPlayer.playerId, currentPlayer.team as TeamId])) as Record<string, TeamId>,
        );
        this.state.phase = 'roundEnd';
        this.state.pauseReason = roundResult.biddingTeamWon ? 'Bidding team won the round.' : 'Bidding team lost the round.';
        this.state.teamAScore += roundResult.winningTeamId === 'A' ? 1 : 0;
        this.state.teamBScore += roundResult.winningTeamId === 'B' ? 1 : 0;
      }
    }
  }

  private dealSecondHands() {
    for (const player of this.state.players) {
      if (!player.occupied || this.dealtSecondHands.has(player.seat)) {
        continue;
      }

      const nextCards = this.pendingHandsBySeat.get(player.seat) ?? [];
      const currentHand = this.handsBySeat.get(player.seat) ?? [];
      const combinedHand = [...currentHand, ...nextCards];
      this.handsBySeat.set(player.seat, combinedHand);
      player.cardsRemaining = combinedHand.length;
      this.dealtSecondHands.add(player.seat);
    }

    for (const client of this.clients) {
      const seat = this.seatByClient.get(client.sessionId);
      if (seat === undefined) {
        continue;
      }

      const player = this.state.players[seat];
      sendPrivateHand(client, player.playerId, this.handsBySeat.get(seat) ?? []);
    }
  }

  private advanceBiddingState(currentPlayerId: string) {
    const rulesPlayers = Array.from(this.state.players).filter((player) => player.occupied).map((player) => ({
      playerId: player.playerId,
      seat: player.seat,
      team: player.team as TeamId,
    }));
    const ruleBids = Array.from(this.state.bids).map((bidState) => ({
      playerId: bidState.playerId,
      value: bidState.value,
      passed: bidState.passed,
      isHonours: bidState.isHonours,
    }));
    const biddingComplete = isBiddingComplete(rulesPlayers, ruleBids);

    if (this.state.phase === 'biddingRound1') {
      if (biddingComplete) {
        this.dealSecondHands();
        this.state.phase = 'biddingRound2';
      }

      this.state.activePlayerId = getNextEligibleBidderId(rulesPlayers, ruleBids, currentPlayerId);
      return;
    }

    if (this.state.phase === 'biddingRound2') {
      if (!biddingComplete) {
        this.state.activePlayerId = getNextEligibleBidderId(rulesPlayers, ruleBids, currentPlayerId);
        return;
      }

      this.state.phase = 'playing';
      this.state.activePlayerId = this.state.trumpHolderId;
    }
  }

  private async handleStartGame(client: Client, _message: StartGamePayload) {
    try {
      startGameSchema.parse(_message);
    } catch (err) {
      this.sendClientError(client, 'invalid_payload', 'Invalid startGame payload');
      return;
    }

    const allReady = this.state.players.every((player: LobbyPlayerState) => player.occupied && player.connected && player.ready);

    if (allReady) {
      this.state.phase = 'playing';
    }
  }

  private getNextPlayerId(currentPlayerId: string) {
    const players = this.state.players.filter((player) => player.occupied);
    if (players.length === 0) {
      return currentPlayerId;
    }

    const orderedPlayers = [...players].sort((left, right) => left.seat - right.seat);
    const currentIndex = orderedPlayers.findIndex((player) => player.playerId === currentPlayerId);
    if (currentIndex === -1) {
      return orderedPlayers[0].playerId;
    }

    return orderedPlayers[(currentIndex + 1) % orderedPlayers.length].playerId;
  }
}
