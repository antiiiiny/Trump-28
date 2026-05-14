import { defineRoom, defineServer } from 'colyseus';
import { LobbyRoom } from './rooms/LobbyRoom';

const server = defineServer({
  rooms: {
    lobby: defineRoom(LobbyRoom),
  },
});

server.listen(2567);
