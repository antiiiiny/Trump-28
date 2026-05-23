import { useRef, useState, useEffect } from 'react';
import type { Room } from '@colyseus/sdk';
import type { LobbyRoomState } from '../../shared/colyseus/lobby';
import { createLobbyRoom, joinLobbyRoom, sendLeaveRoom, sendReadyUp, sendStartGame } from '../network/colyseus/lobby';
import { reconnectToRoom } from '../network/colyseus/reconnect';
import { joinGameRoom, clearGameSession } from '../network/colyseus/game';
import { readStoredColyseusSession, clearStoredColyseusSession, writeStoredColyseusSession } from '../network/colyseus/session';

export type AppScreen = 'home' | 'room' | 'lobby' | 'game' | 'results';

export interface FlowOverlay {
  title: string;
  message: string;
  actionLabel: string;
}

export interface RoomFlowState {
  screen: AppScreen;
  room: Room<{ state: LobbyRoomState }> | null;
  myHand: string[];
  myTrumpCardCode: string;
  busy: boolean;
  overlay: FlowOverlay | null;
  goToScreen: (screen: AppScreen) => void;
  createRoom: (playerName: string) => Promise<void>;
  joinRoom: (playerName: string, roomCode: string) => Promise<void>;
  retryReconnect: () => Promise<void>;
  readyUp: () => void;
  startGame: () => void;
  leaveRoom: () => Promise<void>;
  clearOverlay: () => void;
  discardReconnectState: () => void;
}

function getJoinErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/max clients|full|room is full/i.test(message)) {
    return 'Room already full (4 players present).';
  }

  if (/not found|404|does not exist|no room/i.test(message)) {
    return 'Invalid room code.';
  }

  if (/player name|too long|name/i.test(message)) {
    return 'Player name missing or too long (max 16 characters).';
  }

  return 'Connection failure on join attempt.';
}

function getDisconnectMessage() {
  return 'Unexpected disconnect during lobby.';
}

function normalizePlayerName(playerName: string) {
  return playerName.trim().slice(0, 16);
}

function normalizeRoomCode(roomCode: string) {
  return roomCode.trim().toUpperCase().slice(0, 4);
}

function getScreenFromPhase(phase: LobbyRoomState['phase']): AppScreen {
  if (phase === 'roundEnd' || phase === 'gameEnd') {
    return 'results';
  }

  if (phase === 'playing' || phase === 'biddingRound1' || phase === 'biddingRound2' || phase === 'selectingTrump') {
    return 'game';
  }

  return 'lobby';
}

export function useLobbyFlow(): RoomFlowState {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [room, setRoom] = useState<Room<{ state: LobbyRoomState }> | null>(null);
  const [myHand, setMyHand] = useState<string[]>([]);
  const [myTrumpCardCode, setMyTrumpCardCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState<FlowOverlay | null>(null);
  const [, forceRender] = useState(0);
  const intentionalLeaveRef = useRef(false);
  const currentRoomRef = useRef<Room<{ state: LobbyRoomState }> | null>(null);
  const transitioningToGameRef = useRef(false);

  const syncStoredSession = (nextRoom: Room<{ state: LobbyRoomState }>) => {
    const players = nextRoom.state?.players;
    if (!players || typeof players.find !== 'function') {
      return;
    }

    const localPlayer = players.find((player) => player.playerId === nextRoom.sessionId);
    if (!localPlayer) {
      return;
    }

    writeStoredColyseusSession({
      roomId: nextRoom.roomId,
      sessionId: nextRoom.sessionId,
      reconnectionToken: nextRoom.reconnectionToken ?? '',
      playerId: localPlayer.playerId,
      seat: localPlayer.seat,
      name: localPlayer.name,
    });
  };

  const attachRoom = (nextRoom: Room<{ state: LobbyRoomState }>, skipResetFlag = false) => {
    currentRoomRef.current = nextRoom;
    setRoom(nextRoom);
    if (!skipResetFlag) {
      intentionalLeaveRef.current = false;
    }
    transitioningToGameRef.current = false;

    let lastSeenPhase = nextRoom.state?.phase ?? 'unknown';

    nextRoom.onStateChange((state) => {
      forceRender((value) => value + 1);
      syncStoredSession(nextRoom);

      if (state.phase === 'roundEnd' && lastSeenPhase !== 'roundEnd') {
        setScreen('results');
      }

      if (state.phase === 'gameEnd') {
        setScreen('results');
      }

      if (state.phase === 'biddingRound1' && lastSeenPhase === 'roundEnd') {
        setScreen('game');
      }

      // Only transition to game room ONCE when phase changes to 'playing' (not on every state change)
      if (state.phase === 'playing' && lastSeenPhase !== 'playing' && !transitioningToGameRef.current) {
        if (state.gameRoomId && nextRoom.roomId !== state.gameRoomId) {
          transitioningToGameRef.current = true;
          console.log('State changed to playing, transitioning to game room', state.gameRoomId);

          const localPlayer = state.players.find((player) => player.playerId === nextRoom.sessionId);
          if (localPlayer) {
            void (async () => {
                try {
                console.log('Attempting to join game room', state.gameRoomId);
                const gameRoom = await joinGameRoom(state.gameRoomId, localPlayer.seat, localPlayer.playerId, localPlayer.name);
                console.log('Successfully joined game room, leaving lobby');
                // Mark this as an intentional leave and only reset the flag when the old lobby actually fires its onLeave.
                intentionalLeaveRef.current = true;

                // Install a one-time onLeave handler on the current lobby room so we reset the flag only after it completes.
                const oldLobby = nextRoom;
                let oldLeaveHandled = false;
                try {
                  oldLobby.onLeave((_code, _reason) => {
                    if (oldLeaveHandled) return;
                    oldLeaveHandled = true;
                    intentionalLeaveRef.current = false;
                  });
                } catch (err) {
                  // If attaching the listener fails for any reason, fall back to clearing the flag after a short delay.
                  setTimeout(() => (intentionalLeaveRef.current = false), 250);
                }

                // Trigger lobby leave and attach the game room immediately; the intentionalLeaveRef will remain true
                // until the old lobby's onLeave handler runs and clears it.
                nextRoom.leave();
                attachRoom(gameRoom, true);
                setScreen('game');
              } catch (error) {
                console.error('Failed to join game room', error);
                setOverlay({
                  title: 'Game Join Failed',
                  message: 'Unable to enter the game room.',
                  actionLabel: 'Dismiss',
                });
                transitioningToGameRef.current = false;
              }
            })();
          }
        }
      }

      lastSeenPhase = state.phase;
    });

    nextRoom.onMessage('privateHand', (message: { playerId: string; cards: Array<{ code: string }> }) => {
      setMyHand(message.cards.map((card) => card.code));
    });

    nextRoom.onMessage('roundSnapshot', (message: unknown) => {
      // Handle round state snapshot (game phase, bids, tricks, etc.)
      console.log('Received roundSnapshot:', message);
    });

    nextRoom.onMessage('privateTrump', (message: unknown) => {
      // Handle private trump suit if this player is trump holder
      console.log('Received privateTrump:', message);
      const trumpPayload = message as { cardCode?: string };
      if (typeof trumpPayload.cardCode === 'string') {
        setMyTrumpCardCode(trumpPayload.cardCode);
      }
    });

    nextRoom.onMessage('gameEnded', (message: unknown) => {
      console.log('Received gameEnded:', message);
      setScreen('results');
    });

    nextRoom.onMessage('rematchStarted', (message: unknown) => {
      console.log('Received rematchStarted:', message);
      setScreen('game');
    });

    nextRoom.onMessage('error', (message: { code: string; message: string }) => {
      console.error('Server error:', message.code, message.message);
      setOverlay({
        title: 'Server Error',
        message: message.message || 'An error occurred on the server',
        actionLabel: 'Dismiss',
      });
    });

    nextRoom.onLeave((code, reason) => {
      console.log('Room onLeave triggered:', { roomId: nextRoom.roomId, code, reason, intentionalLeave: intentionalLeaveRef.current });
      if (intentionalLeaveRef.current || code === 1000) {
        intentionalLeaveRef.current = false;
        return;
      }

      setOverlay({
        title: 'Disconnected',
        message: reason ? String(reason) : getDisconnectMessage(),
        actionLabel: 'Rejoin',
      });
      setScreen('room');
      setRoom(null);
      currentRoomRef.current = null;
      setMyHand([]);
      setMyTrumpCardCode('');
    });

    syncStoredSession(nextRoom);

    nextRoom.onError((code, message) => {
      console.error('Room onError triggered:', { roomId: nextRoom.roomId, code, message });
      setOverlay({
        title: 'Connection Error',
        message: String(message),
        actionLabel: 'Dismiss',
      });
    });
  };

  // attempt silent reconnect on mount if session data exists
  useEffect(() => {
    (async () => {
      try {
        const stored = readStoredColyseusSession();
        if (!stored) return;

        const reconnectionToken = stored.reconnectionToken;

        if (reconnectionToken) {
          // Prefer token-based reconnect when available
          const rejoined = await reconnectToRoom(reconnectionToken);
          if (rejoined) {
            attachRoom(rejoined);
            setScreen(getScreenFromPhase(rejoined.state.phase));
            return;
          }
        }

        // Fallback: attempt seat-based rejoin (joinById) if we have playerId and seat
        if (stored.roomId && stored.playerId && typeof stored.seat === 'number' && stored.name) {
          try {
            const rejoined = await joinGameRoom(stored.roomId, stored.seat, stored.playerId, stored.name);
            attachRoom(rejoined);
            setScreen(getScreenFromPhase(rejoined.state.phase));
            return;
          } catch (err) {
            console.warn('Seat-based rejoin failed', err);
            // If the room no longer exists or has been disposed, clear the stored session
            // so the user can rejoin/create a new room instead of being stuck.
            try {
              clearStoredColyseusSession();
            } catch (e) {
              // ignore
            }
            setOverlay({
              title: 'Room Not Found',
              message: 'The room no longer exists or has been closed. Returning to the start screen.',
              actionLabel: 'OK',
            });
            setScreen('home');
            return;
          }
        }

        // If neither path succeeded, show retry UI (token may be expired)
        setOverlay({
          title: 'Reconnect Failed',
          message: 'Your room could not be rejoined yet. Try again while the reconnect window is open.',
          actionLabel: 'Retry',
        });
        setScreen('room');
      } catch (err) {
        console.warn('Silent reconnect attempt failed', err);
        setOverlay({
          title: 'Reconnect Failed',
          message: 'Your room could not be rejoined yet. Try again while the reconnect window is open.',
          actionLabel: 'Retry',
        });
        setScreen('room');
      }
    })();
  }, []);

  const goToScreen = (nextScreen: AppScreen) => {
    setScreen(nextScreen);
  };

  const createRoomAction = async (playerName: string) => {
    setBusy(true);
    setOverlay(null);

    try {
      const validName = normalizePlayerName(playerName);

      if (!validName) {
        throw new Error('Player name missing or too long (max 16 characters).');
      }

      const nextRoom = await createLobbyRoom(validName);
      attachRoom(nextRoom);
      setScreen('lobby');
    } catch (error) {
      console.error('createRoomAction error:', error);
      setOverlay({
        title: 'Create Room Failed',
        message: getJoinErrorMessage(error),
        actionLabel: 'Back',
      });
      setScreen('room');
    } finally {
      setBusy(false);
    }
  };

  const joinRoomAction = async (playerName: string, roomCode: string) => {
    setBusy(true);
    setOverlay(null);

    try {
      const validName = normalizePlayerName(playerName);

      if (!validName) {
        throw new Error('Player name missing or too long (max 16 characters).');
      }

      const validRoomCode = normalizeRoomCode(roomCode);
      const nextRoom = await joinLobbyRoom(validRoomCode, validName);
      attachRoom(nextRoom);
      setScreen('lobby');
    } catch (error) {
      console.error('joinRoomAction error:', error);
      setOverlay({
        title: 'Join Room Failed',
        message: getJoinErrorMessage(error),
        actionLabel: 'Back',
      });
      setScreen('room');
    } finally {
      setBusy(false);
    }
  };

  const retryReconnect = async () => {
    try {
      const stored = readStoredColyseusSession();
      if (!stored?.reconnectionToken) {
        setOverlay(null);
        setScreen('room');
        return;
      }

      setBusy(true);
      const rejoined = await reconnectToRoom(stored.reconnectionToken);
      if (!rejoined) {
        setOverlay({
          title: 'Reconnect Failed',
          message: 'Your room could not be rejoined yet. Try again while the reconnect window is open.',
          actionLabel: 'Retry',
        });
        return;
      }

      attachRoom(rejoined);
      setOverlay(null);
      setScreen(getScreenFromPhase(rejoined.state.phase));
    } catch (err) {
      console.warn('Reconnect retry failed', err);
      setOverlay({
        title: 'Reconnect Failed',
        message: 'Your room could not be rejoined yet. Try again while the reconnect window is open.',
        actionLabel: 'Retry',
      });
    } finally {
      setBusy(false);
    }
  };

  const readyUp = () => {
    if (!room) {
      return;
    }

    sendReadyUp(room);
  };

  const startGame = () => {
    if (!room) {
      return;
    }

    sendStartGame(room);
  };

  const leaveRoom = async () => {
    if (!room) {
      setScreen('room');
      return;
    }

    intentionalLeaveRef.current = true;
    sendLeaveRoom(room);
    room.leave();
    setRoom(null);
    currentRoomRef.current = null;
    setMyHand([]);
    setMyTrumpCardCode('');
    clearGameSession();
    setScreen('room');
  };

  const clearOverlay = () => {
    setOverlay(null);
  };

  const discardReconnectState = () => {
    clearGameSession();
    setOverlay(null);
    setRoom(null);
    currentRoomRef.current = null;
    setMyHand([]);
    setMyTrumpCardCode('');
    setScreen('room');
  };

  return {
    screen,
    room,
    myHand,
    myTrumpCardCode,
    busy,
    overlay,
    goToScreen,
    createRoom: createRoomAction,
    joinRoom: joinRoomAction,
    retryReconnect,
    readyUp,
    startGame,
    leaveRoom,
    clearOverlay,
    discardReconnectState,
  };
}
