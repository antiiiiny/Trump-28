import { useRef, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { LobbyRoomState } from '../../shared/colyseus/lobby';
import { createLobbyRoom, joinLobbyRoom, sendLeaveRoom, sendReadyUp, sendStartGame } from '../network/colyseus/lobby';

export type AppScreen = 'home' | 'room' | 'lobby' | 'game' | 'results';

export interface FlowOverlay {
  title: string;
  message: string;
  actionLabel: string;
}

export interface RoomFlowState {
  screen: AppScreen;
  room: Room<LobbyRoomState> | null;
  busy: boolean;
  overlay: FlowOverlay | null;
  goToScreen: (screen: AppScreen) => void;
  createRoom: (playerName: string) => Promise<void>;
  joinRoom: (playerName: string, roomCode: string) => Promise<void>;
  readyUp: () => void;
  startGame: () => void;
  leaveRoom: () => Promise<void>;
  clearOverlay: () => void;
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

export function useLobbyFlow(): RoomFlowState {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [room, setRoom] = useState<Room<LobbyRoomState> | null>(null);
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState<FlowOverlay | null>(null);
  const [, forceRender] = useState(0);
  const intentionalLeaveRef = useRef(false);

  const attachRoom = (nextRoom: Room<LobbyRoomState>) => {
    setRoom(nextRoom);
    intentionalLeaveRef.current = false;

    nextRoom.onStateChange((state) => {
      forceRender((value) => value + 1);

      if (state.phase === 'playing') {
        setScreen('game');
      }
    });

    nextRoom.onLeave((code, reason) => {
      if (intentionalLeaveRef.current || code === 1000) {
        intentionalLeaveRef.current = false;
        return;
      }

      setOverlay({
        title: 'Disconnected',
        message: reason ? String(reason) : getDisconnectMessage(),
        actionLabel: 'Return to room',
      });
      setScreen('room');
      setRoom(null);
    });

    nextRoom.onError((_code, message) => {
      setOverlay({
        title: 'Connection Error',
        message: String(message),
        actionLabel: 'Dismiss',
      });
    });
  };

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
    setScreen('room');
  };

  const clearOverlay = () => {
    setOverlay(null);
  };

  return {
    screen,
    room,
    busy,
    overlay,
    goToScreen,
    createRoom: createRoomAction,
    joinRoom: joinRoomAction,
    readyUp,
    startGame,
    leaveRoom,
    clearOverlay,
  };
}
