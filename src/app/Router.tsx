import { Home } from '../features/home/Home';
import { CreateJoinRoom } from '../features/room/CreateJoinRoom';
import { Lobby } from '../features/lobby/Lobby';
import { GameTable } from '../features/game/GameTable';
import { Results } from '../features/results/Results';
import { ReconnectOverlay } from '../features/reconnect/ReconnectOverlay';
import { useLobbyFlow } from './useLobbyFlow';

export function Router() {
  const {
    screen,
    room,
    busy,
    overlay,
    goToScreen,
    createRoom,
    joinRoom,
    readyUp,
    startGame,
    leaveRoom,
    clearOverlay,
  } = useLobbyFlow();

  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return <Home onNavigate={() => goToScreen('room')} />;
      case 'room':
        return (
          <CreateJoinRoom
            busy={busy}
            onBack={() => goToScreen('home')}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
          />
        );
      case 'lobby':
        return room ? (
          <Lobby
            room={room}
            onReadyUp={readyUp}
            onStartGame={startGame}
            onLeaveRoom={leaveRoom}
            onCopyRoomCode={async () => navigator.clipboard.writeText(room.state.roomCode)}
          />
        ) : (
          <CreateJoinRoom
            busy={busy}
            onBack={() => goToScreen('home')}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
          />
        );
      case 'game':
        return <GameTable onNavigate={(nextScreen) => goToScreen(nextScreen)} />;
      case 'results':
        return <Results onNavigate={(nextScreen) => goToScreen(nextScreen)} />;
      default:
        return <Home onNavigate={() => goToScreen('room')} />;
    }
  };

  return (
    <>
      {renderScreen()}
      {overlay ? (
        <ReconnectOverlay
          isVisible={true}
          title={overlay.title}
          message={overlay.message}
          actionLabel={overlay.actionLabel}
          onAction={clearOverlay}
        />
      ) : null}
    </>
  );
}

