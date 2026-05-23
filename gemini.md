# Gemini Handoff

## Project

Trump 28 is a browser-first multiplayer card game for 28, implemented with React, TypeScript, Vite, Colyseus, and CSS modules.

## Goal of the repo

The repo is being built in stages:

1. Stage 1: shared scaffold and canonical card/shared model setup.
2. Stage 2: mock UI and visual layout for the game flow.
3. Stage 3: real Colyseus room creation, room-code join, lobby syncing, ready states, and host start gating.
4. Stage 4: authoritative room state, reconnect handling, and live game-screen sync.
5. Stage 5: bidding, trump selection, trick resolution, and scoring wired through the pure server/game engine.

The lobby flow is implemented, and the game screen now consumes live room state. Bidding, card dealing, trump selection, trick resolution, and scoring are now wired through the server-side game room and shared protocol.

## What happened so far

### Initial scaffold

- The project started as a Vite React TypeScript app.
- Shared enums and models were added under `shared/`.
- `shared/index.ts` was created as a barrel export.
- `src/components/cards/PlayingCardView.tsx` was added as the only place where canonical card codes are converted into `@letele/playing-cards` library keys.
- `.github/copilot-instructions.md` was updated with the project rules and stage notes.

### Stage 2 mock UI

- A mock routing and screen flow were created.
- Static screens were added for home, create/join room, lobby, game table, results, and reconnect overlay.
- Layout and visual tokens were introduced in CSS modules only.
- The table UI was built with separate components for opponent areas, trick area, player hand, bid panel, score panel, and turn indicator.
- Several visual bugs were fixed during that phase:
  - The trick-area card was reduced so it no longer dominated the center.
  - The table height was constrained so the player hand stayed visible.
  - Score spacing was corrected so labels did not collapse together.

### Scope correction to 28 / 4-player

- The project was migrated from earlier 108 / 2-player assumptions to 28 / 4-player teams.
- Shared types were expanded for 4 players, teams, bids, tricks, rounds, games, and room state.
- The mock UI was updated to match the 4-player layout and team-based flow.

### Stage 3 Colyseus wiring

- Colyseus runtime dependencies were installed.
- Stage 3 instructions were appended to `.github/copilot-instructions.md`.
- Shared protocol schemas were added in `shared/protocol/lobby.ts`.
- Shared Colyseus lobby schema classes were added in `shared/colyseus/lobby.ts`.
- A Colyseus room was implemented in `server/rooms/LobbyRoom.ts`.
- A server bootstrap was added in `server/index.ts`.
- Client Colyseus helpers were added in `src/network/colyseus/client.ts` and `src/network/colyseus/lobby.ts`.
- The room flow hook was added in `src/app/useLobbyFlow.ts`.
- The router and room screens were rewired to use real room state.
- The lobby stylesheet was corrupted during patching and then recreated cleanly.

## Important implementation details

- Room codes are intended to be 4 uppercase characters.
- Seats are assigned by join order and are permanent for the life of the room.
- Teams are fixed by seat: seats 0 and 2 are Team A, seats 1 and 3 are Team B.
- Lobby state is server-authoritative and should be rendered directly from Colyseus state.
- The game table now renders live bidding, turn state, trick state, and player hand data from Colyseus state.

## Debugging history

### Build and runtime issues that were resolved

- TypeScript decorators for Colyseus schema required `experimentalDecorators: true` in the app and node tsconfigs.
- The installed `colyseus.js` version did not expose `Room.reconnection`, `onDrop`, or `onReconnect`, so the client flow was simplified to use `onLeave` and `onError`.
- The server-side `Room` generic had to be typed as room options/state shape rather than state directly.
- `npm run build` now passes.
- `npm run server` now starts successfully.

## Current status

The room and lobby flow are wired against the Colyseus server, including room creation, room-code join, ready state sync, reconnect handling, and the game-room handoff.

The gameplay layer is now wired as well: bidding, pass handling, trump selection, trick play, trick resolution, and round scoring are connected to the server room and client UI.

Current follow-up work is runtime verification of the full 4-player flow and any remaining UI polish after live playtesting.

## Commands that matter

```bash
npm run server
npm run dev
npm run build
```

If testing on another device on the same Wi-Fi, the Vite dev server should be started with host exposure.

## Files worth knowing first

- `.github/copilot-instructions.md`
- `README.md`
- `src/app/useLobbyFlow.ts`
- `src/network/colyseus/lobby.ts`
- `server/rooms/LobbyRoom.ts`
- `server/index.ts`
- `shared/colyseus/lobby.ts`
- `shared/protocol/lobby.ts`

## Known status at the time of writing

- The repo builds successfully.
- The server process starts successfully.
- The room creation and join flow is implemented and currently used by the client.
## Stage 4 completion notes

- Lobby reconnect handling is implemented with `allowReconnection`, deterministic timeout cleanup, and typed error responses.
- A `game` room now exists on the server and is registered in `server/index.ts`.
- Lobby start now creates a game room and exposes `gameRoomId` in synced state for the client handoff.
- Private server delivery helpers exist for hand snapshots, trump reveal, and public round snapshots.
- The client now has a game-room join helper and stores the active room session in `sessionStorage`.
- The game screen now consumes live room state and private hand data when available.

## Stage 5 completion notes

- The shared game protocol includes typed messages for place bid, select trump, play card, and end game.
- `server/rooms/GameRoom.ts` validates bids and card plays against the pure engine and advances bidding / trick state.
- `src/features/game/GameTable.tsx` renders live bidding order, turn status, trick positions, and player hand state from room data.
- The client send helpers now serialize the correct payloads for bid, pass, trump selection, and card play.

## Stage 6 addendum

This repo is now past the core gameplay wiring and into reconnect, results, and layout polish.

### Current gameplay and UX behavior

- Trump reveal is player-driven. The player who cannot follow suit can choose when to reveal trump, and the reveal is transient for that trick.
- The game viewport is locked so the page does not scroll during play.
- Reconnect works with token-based recovery first, then seat-based fallback using stored player identity and seat data.
- The lobby room code is preserved across the lobby-to-game handoff and survives refresh/rejoin flows.
- Private state is restored on reconnect through server delivery helpers for hand, trump, and round snapshot data.
- The trick area is intentionally height-locked so the player hand stays visible.

### Results screen work

- The results screen no longer defaults to Team A / 0 when summary data is missing.
- It now waits for a complete round summary or derives a safe fallback from live round state.
- The server coolie scoring path was corrected so the round category is derived from the actual bid instead of assuming round 2.
- The bidding order display now starts from the current active bidder instead of always assuming dealer + 1.

### Layout debugging notes

- The trick-card layout issue came from the height chain and centering behavior, not from seat mapping.
- The local player card should appear in the bottom position, teammate at the top, and opponents on the left and right.
- `src/components/table/TrickArea.module.css` now owns the vertical space and anchors the trick stage at the bottom to reduce the gap above the hand.
- `src/features/game/GameTable.tsx` still maps the local player to `bottom`; the visual issue is handled in CSS.

### Recent file-level context

- `src/components/table/TrickArea.module.css` was updated to lock the trick area height and reduce layout shift.
- `src/features/results/Results.tsx` was updated to avoid fake default summaries and to recover when the server summary is not yet complete.
- `src/features/game/GameTable.tsx` was updated so bidding order follows the current opening bidder.
- `server/rooms/GameRoom.ts` was updated so coolie scoring uses the correct bid category.

### Validation status

- `npm run build` passes after the recent changes.
- `npm run server` and `npm run dev` were previously attempted but are not currently clean in this workspace context.
- The remaining work is visual verification in the browser and any final offset tuning for trick card placement.

### Current follow-up items

- Keep the trick stage visually closer to the hand without reintroducing layout shifts.
- Verify reconnect and private-state restore in a real disconnect/rejoin scenario.
- Confirm the results screen renders the correct round winner and coolie totals in all states.

