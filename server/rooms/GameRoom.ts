import { Room, type Client } from 'colyseus';
import { LobbyRoomState, createLobbyPlayers, type LobbyPlayerState } from '../../shared/colyseus/lobby';
import { joinRoomSchema, leaveRoomSchema, readyUpSchema, startGameSchema, type JoinRoomPayload, type LeaveRoomPayload, type ReadyUpPayload, type StartGamePayload } from '../../shared/protocol/lobby';
import { createDeck } from '../game/deck';
import { sendPrivateHand, sendPrivateTrump, sendRoundSnapshot } from '../game/privateDelivery';
import type { Card } from '../../shared/models/card';
import type { RoundState } from '../../shared/models/round';
import type { Suit } from '../../shared/enums/suit';

const RECONNECT_WINDOW_SECONDS = 60;

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

export class GameRoom extends Room<LobbyRoomState> {
  maxClients = 4;

  private readonly seatByClient = new Map<string, number>();
  private readonly reconnectTimers = new Map<string, NodeJS.Timeout>();
  private readonly handsBySeat = new Map<number, Card[]>();
  private privateTrumpSuit: Suit | '' = '';
  private privateTrumpHolderSeat: number | null = null;

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
    const deck = createDeck(options.lobbyRoomId ?? this.roomId);
    const playerHands = [deck.slice(0, 8), deck.slice(8, 16), deck.slice(16, 24), deck.slice(24, 32)];
    playerHands.forEach((hand, seat) => this.handsBySeat.set(seat, hand));

    this.privateTrumpSuit = 'S';
    this.privateTrumpHolderSeat = 0;

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
    this.state.activePlayerId ||= this.state.players[seat].playerId;
    this.state.paused = false;
    this.state.pauseReason = '';

    const hand = this.handsBySeat.get(seat) ?? [];
    sendPrivateHand(client, this.state.players[seat].playerId, hand);

    const roundSnapshot: RoundState = {
      phase: this.state.phase,
      hands: {} as Record<string, Card[]>,
      tricks: [],
      currentTrick: { cards: [], winnerId: null, leadSuit: null },
      trumpSuit: null,
      trumpRevealed: this.state.trumpRevealed,
      trumpHolderId: this.state.trumpHolderId,
      bids: [],
      currentBid: null,
      activePlayerId: this.state.activePlayerId,
      dealerSeat: this.state.dealerSeat,
    };

    sendRoundSnapshot(client, roundSnapshot, this.state.players[seat].playerId);

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
}
