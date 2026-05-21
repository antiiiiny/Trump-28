import { defineRoom, defineServer } from 'colyseus';
import { GameRoom } from './rooms/GameRoom';
import { LobbyRoom } from './rooms/LobbyRoom';

const server = defineServer({
  rooms: {
    lobby: defineRoom(LobbyRoom),
    game: defineRoom(GameRoom),
  },
});

const port = Number(process.env.PORT ?? 2567);
server.listen(port);
