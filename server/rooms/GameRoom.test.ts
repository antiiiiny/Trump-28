import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { GameRoom } from './GameRoom';
import { LobbyRoomState, createLobbyPlayers } from '../../shared/colyseus/lobby';

type MockClient = {
  sessionId: string;
  send: ReturnType<typeof vi.fn>;
};

function createMockClient(sessionId: string): MockClient {
  return {
    sessionId,
    send: vi.fn(),
  };
}

function createRoom() {
  const room = new GameRoom();
  room.setState(new LobbyRoomState());
  room.state.players = createLobbyPlayers();
  room.state.roomCode = 'GAME1';
  return room;
}

describe('GameRoom reconnect timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'setTimeout');
    vi.spyOn(globalThis, 'clearTimeout');
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('frees a seat after the reconnect window expires', () => {
    const room = createRoom();
    const client = createMockClient('session-1');
    const allowReconnection = vi.fn();
    (room as unknown as { allowReconnection: typeof allowReconnection }).allowReconnection = allowReconnection;

    room.onJoin(client as never);
    expect(room.state.players[0].occupied).toBe(true);
    expect(room.state.players[0].connected).toBe(true);

    room.onLeave(client as never);
    expect(room.state.players[0].connected).toBe(false);
    expect(allowReconnection).toHaveBeenCalledWith(client as never, 180);

    vi.advanceTimersByTime(180_000);

    expect(room.state.players[0].occupied).toBe(false);
    expect(room.state.players[0].playerId).toBe('');
    expect(room.state.players[0].name).toBe('');
    expect(room.state.players[0].ready).toBe(false);
  });

  it('keeps the seat when the player reconnects before timeout', () => {
    const room = createRoom();
    const client = createMockClient('session-2');
    const allowReconnection = vi.fn();
    (room as unknown as { allowReconnection: typeof allowReconnection }).allowReconnection = allowReconnection;

    room.onJoin(client as never);
    room.onLeave(client as never);

    vi.advanceTimersByTime(10_000);

    room.onJoin(client as never);
    expect(room.state.players[0].occupied).toBe(true);
    expect(room.state.players[0].connected).toBe(true);

    vi.advanceTimersByTime(60_000);

    expect(room.state.players[0].occupied).toBe(true);
    expect(room.state.players[0].connected).toBe(true);
    expect(room.state.players[0].playerId).toBe('session-2');
  });
});
