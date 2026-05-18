import { Room, type Client } from 'colyseus';
import * as matchMaker from '@colyseus/core/MatchMaker';
import {
  joinRoomSchema,
  leaveRoomSchema,
  readyUpSchema,
  startGameSchema,
  type JoinRoomPayload,
  type LeaveRoomPayload,
  type ReadyUpPayload,
  type StartGamePayload,
} from '../../shared/protocol/lobby';
import { createLobbyPlayers, LobbyRoomState, type LobbyPlayerState } from '../../shared/colyseus/lobby';

function generateRoomCode(): string {
  const characters = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  let code = '';

  for (let index = 0; index < 4; index += 1) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return code;
}

export class LobbyRoom extends Room<{ state: LobbyRoomState }> {
  maxClients = 4;

  private readonly seatByClient = new Map<string, number>();
  private readonly reconnectTimers = new Map<string, NodeJS.Timeout>();

  onCreate() {
    this.roomId = generateRoomCode();
    this.setState(new LobbyRoomState());
    this.state.roomCode = this.roomId;
    this.state.players = createLobbyPlayers();

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

  // send a typed error response to a single client
  private sendClientError(client: Client, code: string, message: string) {
    try {
      client.send('error', { code, message });
    } catch (err) {
      console.warn('Failed to send error to client', client.sessionId, err);
    }
  }

  onJoin(client: Client) {
    // clear any pending reconnect timer for this session
    const existingTimer = this.reconnectTimers.get(client.sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.reconnectTimers.delete(client.sessionId);
    }

    // If the session already had a seat assignment (reconnect), reuse it
    let seat = this.seatByClient.get(client.sessionId);

    if (seat === undefined) {
      seat = this.state.players.findIndex((player: LobbyPlayerState) => !player.occupied);
    }

    if (seat === -1 || seat === undefined) {
      // room full
      return;
    }

    const player = this.state.players[seat];
    player.playerId = client.sessionId;
    player.connected = true;
    player.occupied = true;
    // keep ready=false on fresh join; if reconnecting we preserve ready state as-is
    if (!player.ready) {
      player.ready = false;
    }
    this.seatByClient.set(client.sessionId, seat);

    if (!this.state.hostId) {
      this.state.hostId = client.sessionId;
    }
  }

  onLeave(client: Client) {
    const seat = this.seatByClient.get(client.sessionId);

    if (seat === undefined) {
      return;
    }

    const player = this.state.players[seat];

    // allow Colyseus to hold the seat for reconnection
    try {
      // reserve seat for 60 seconds
      // @ts-ignore - allowReconnection exists on Colyseus Room
      this.allowReconnection(client, 60);
    } catch (err) {
      // best-effort: ignore if API not available
    }

    player.connected = false;

    // start a deterministic server-side timer to clear the seat if reconnection doesn't occur
    const timeout = setTimeout(() => {
      // if still disconnected and not reconnected, free the seat
      const current = this.state.players[seat];
      if (current && !current.connected) {
        current.playerId = '';
        current.name = '';
        current.occupied = false;
        current.ready = false;
        // remove mapping
        this.seatByClient.delete(client.sessionId);
        if (this.state.hostId === client.sessionId) {
          this.state.hostId = this.state.players.find((player: LobbyPlayerState) => player.occupied)?.playerId ?? '';
        }
      }
      this.reconnectTimers.delete(client.sessionId);
    }, 60 * 1000);

    this.reconnectTimers.set(client.sessionId, timeout);
  }

  onDispose() {
    // clear any pending timers
    for (const t of this.reconnectTimers.values()) {
      clearTimeout(t);
    }
    this.reconnectTimers.clear();
  }

  private handleJoinRoom(client: Client, message: JoinRoomPayload) {
    console.log('LobbyRoom.handleJoinRoom received message from', client.sessionId, message);
    let payload;
    try {
      payload = joinRoomSchema.parse(message);
    } catch (err) {
      console.error('LobbyRoom.handleJoinRoom validation error:', err);
      this.sendClientError(client, 'invalid_payload', 'Invalid joinRoom payload');
      return;
    }
    const seat = this.seatByClient.get(client.sessionId);

    if (seat === undefined) {
      this.sendClientError(client, 'no_seat', 'No seat assigned for this session');
      return;
    }

    const player = this.state.players[seat];
    player.name = payload.playerName.trim().slice(0, 16);
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
    } else {
      this.sendClientError(client, 'not_readyable', 'Player not occupied or not connected');
    }
  }

  private async handleStartGame(client: Client, _message: StartGamePayload) {
    try {
      startGameSchema.parse(_message);
    } catch (err) {
      this.sendClientError(client, 'invalid_payload', 'Invalid startGame payload');
      return;
    }

    if (client.sessionId !== this.state.hostId) {
      this.sendClientError(client, 'not_host', 'Only the host may start the game');
      return;
    }

    const allReady = this.state.players.every((player: LobbyPlayerState) => player.occupied && player.connected && player.ready);

    if (!allReady) {
      this.sendClientError(client, 'not_all_ready', 'All players must be present and ready to start');
      return;
    }

    try {
      console.log('LobbyRoom.handleStartGame: Creating game room with lobbyRoomId=', this.roomId);
      const gameRoom = await matchMaker.createRoom('game', {
        lobbyRoomId: this.roomId,
      });
      console.log('LobbyRoom.handleStartGame: Game room created with roomId=', gameRoom.roomId);

      this.state.gameRoomId = gameRoom.roomId;
      this.state.gameStarted = true;
      this.state.phase = 'playing';
    } catch (err) {
      console.error('LobbyRoom.handleStartGame: Failed to create game room', err);
      this.sendClientError(client, 'game_create_failed', 'Failed to create game room');
    }
  }
}
