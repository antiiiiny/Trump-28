import { Room, type Client } from 'colyseus';
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

  onJoin(client: Client) {
    const seat = this.state.players.findIndex((player: LobbyPlayerState) => !player.occupied);

    if (seat === -1) {
      return;
    }

    const player = this.state.players[seat];
    player.playerId = client.sessionId;
    player.connected = true;
    player.occupied = true;
    player.ready = false;
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
    player.connected = false;
    player.ready = false;
  }

  private handleJoinRoom(client: Client, message: JoinRoomPayload) {
    console.log('LobbyRoom.handleJoinRoom received message from', client.sessionId, message);
    let payload;
    try {
      payload = joinRoomSchema.parse(message);
    } catch (err) {
      console.error('LobbyRoom.handleJoinRoom validation error:', err);
      return;
    }
    const seat = this.seatByClient.get(client.sessionId);

    if (seat === undefined) {
      return;
    }

    const player = this.state.players[seat];
    player.name = payload.playerName.trim().slice(0, 16);
  }

  private handleLeaveRoom(client: Client, _message: LeaveRoomPayload) {
    leaveRoomSchema.parse(_message);
    const seat = this.seatByClient.get(client.sessionId);

    if (seat === undefined) {
      return;
    }

    const player = this.state.players[seat];
    player.connected = false;
    player.ready = false;
  }

  private handleReadyUp(client: Client, _message: ReadyUpPayload) {
    readyUpSchema.parse(_message);
    const seat = this.seatByClient.get(client.sessionId);

    if (seat === undefined) {
      return;
    }

    const player = this.state.players[seat];

    if (player.occupied && player.connected) {
      player.ready = true;
    }
  }

  private handleStartGame(client: Client, _message: StartGamePayload) {
    startGameSchema.parse(_message);
    if (client.sessionId !== this.state.hostId) {
      return;
    }

    const allReady = this.state.players.every((player: LobbyPlayerState) => player.occupied && player.connected && player.ready);

    if (!allReady) {
      return;
    }

    this.state.phase = 'playing';
  }
}
