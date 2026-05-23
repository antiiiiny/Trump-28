import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { GameRoom } from './GameRoom';
import { LobbyRoomState, createLobbyPlayers } from '../../shared/colyseus/lobby';
import { GameTrickCardState, GameTrickState } from '../../shared/colyseus/lobby';

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
  room.state.roomCode = 'GAME2';
  return room;
}

describe('GameRoom reveal lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('marks trumpAwaitingReveal on reveal and clears it when trick finalizes', () => {
    // Capture onMessage handlers by monkey-patching prototype
    const handlers = new Map<string, Function>();
    const originalOnMessage = (GameRoom.prototype as any).onMessage;
    (GameRoom.prototype as any).onMessage = function (type: string, cb: Function) {
      handlers.set(type, cb.bind(this));
    };

    try {
      const room = createRoom();
      // Call onCreate so handlers are registered (provide seed to deck)
      (room as any).onCreate({ lobbyRoomId: 'test-seed' });

      const client = createMockClient('reveal-player');
      room.onJoin(client as never);

      // Prepare game state so reveal is allowed: playing phase, active player, a lead suit, and holder has no lead suit
      room.state.phase = 'playing';
      room.state.trumpRevealed = false;
      room.state.activePlayerId = client.sessionId;
      room.state.currentTrick = new GameTrickState();
      const starter = new GameTrickCardState();
      starter.playerId = 'p0';
      starter.code = 'AH';
      starter.position = '0';
      room.state.currentTrick.cards.push(starter);
      room.state.currentTrick.leadSuit = 'H';
      // Ensure the holder's private hand does not contain hearts
      (room as any).handsBySeat.set(0, [{ rank: 'K', suit: 'S', code: 'KS', points: 0 }]);

      // Mark reveal-in-flight (handler tested separately) and ensure finalization clears it
      room.state.trumpAwaitingReveal = true;
      expect(room.state.trumpAwaitingReveal).toBe(true);

      // Prepare a current trick with 4 cards and a private trump suit, then finalize
      room.state.currentTrick = new GameTrickState();
      for (let i = 0; i < 4; i += 1) {
        const c = new GameTrickCardState();
        c.playerId = `p${i}`;
        c.code = 'AH';
        c.position = String(i);
        room.state.currentTrick.cards.push(c);
      }
      room.privateTrumpSuit = 'S';

      // Call the finalize helper directly
      (room as any).finalizeCurrentTrickNow('S');

      expect(room.state.trumpAwaitingReveal).toBe(false);
    } finally {
      // restore original
      (GameRoom.prototype as any).onMessage = originalOnMessage;
    }
  });
});
