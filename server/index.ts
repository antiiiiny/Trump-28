import { defineRoom, defineServer } from 'colyseus';
import { GameRoom } from './rooms/GameRoom';
import { LobbyRoom } from './rooms/LobbyRoom';

const server = defineServer({
  rooms: {
    lobby: defineRoom(LobbyRoom),
    game: defineRoom(GameRoom),
  },
});

server.listen(2567);
