# Trump 28

Browser-first multiplayer card game for 28, built with React, TypeScript, Vite, Colyseus, and CSS modules.

## What this repo is

- 4-player, 2-team 28 implementation
- Client: React + TypeScript + Vite
- Server: Colyseus on port 2567
- Shared types and lobby schema live in `shared/`
- The lobby is wired to a live Colyseus room, and the game screen now consumes server state
- Bidding and card play are still stubbed out

## Current dev flow

Run both processes during local development:

```bash
npm run server
npm run dev
```

Then open the app in one or more browser tabs:

1. Create a room in the first tab.
2. Copy the 4-character room code from the lobby.
3. Join from another tab with that code.
4. Ready up all 4 players.
5. Start the game from the host client once everyone is ready.

## Current stage

Stage 4 is focused on authoritative room state, reconnect handling, and live game-screen sync.

Known limitations:

- None currently blocking for the room and lobby flow.
- Bidding, card dealing, and trick resolution are still intentionally stubbed.

## Useful files

- `src/app/useLobbyFlow.ts` - client room lifecycle and screen flow
- `src/network/colyseus/lobby.ts` - client Colyseus helpers
- `server/rooms/LobbyRoom.ts` - server room implementation
- `server/rooms/GameRoom.ts` - game room implementation
- `shared/colyseus/lobby.ts` - shared lobby schema
- `shared/protocol/lobby.ts` - Zod protocol schemas
- `.github/copilot-instructions.md` - repo rules and stage notes

## Build

```bash
npm run build
```

The build currently passes.

## Notes

- Use `npm run server` with the explicit node tsconfig already wired in `package.json`.
- If a room fails to join, check the browser console and server terminal for the latest Colyseus error details.
