# Trump 28

Browser-first multiplayer card game for 28, built with React, TypeScript, Vite, Colyseus, and CSS modules.

## What this repo is

- 4-player, 2-team 28 implementation.
- Client: React + TypeScript + Vite.
- Server: Colyseus on port 2567.
- Shared types, schemas, and protocol live in `shared/`.
- The lobby is wired to a live Colyseus room, and the game screen consumes live room state.
- Bidding, trump selection, and card play are wired to the server-side game room.
- The UI now renders bidding order, turn status, trick state, and the local hand from room data.

## Current dev flow

Run both processes during local development:

```bash
npm run server
npm run dev
```

## Production deploy (Vercel + Railway)

Recommended split:

- Frontend (Vite): Vercel
- Backend (Colyseus): Railway

### Backend (Railway)

- Start command: `npm run server`
- The server already supports Railway dynamic ports via `process.env.PORT`.
- After deploy, copy your backend domain, for example:
   - `https://your-backend.up.railway.app`

### Frontend (Vercel)

- Build command: `npm run build`
- Output directory: `dist`
- Add environment variable:
   - `VITE_COLYSEUS_ENDPOINT=wss://your-backend.up.railway.app`

Important: after setting `VITE_COLYSEUS_ENDPOINT`, redeploy frontend so Vite picks up the value at build time.

Then open the app in one or more browser tabs:

1. Create a room in the first tab.
2. Copy the 4-character room code from the lobby.
3. Join from another tab with that code.
4. Ready up all 4 players.
5. Start the game from the host client once everyone is ready.

## Project history

### Stage 1 - Foundation

- Initial Vite React TypeScript workspace was created.
- Shared enums and models were added under `shared/`.
- `shared/index.ts` was created as a barrel export.
- `src/components/cards/PlayingCardView.tsx` became the only place where canonical card codes are converted into `@letele/playing-cards` library keys.
- `.github/copilot-instructions.md` was updated with the project rules and the canonical 28 card format.

### Stage 2 - Mock UI

- A mock routing and screen flow was created.
- Static screens were added for home, create/join room, lobby, game table, results, and reconnect overlay.
- Layout and visual tokens were introduced using CSS modules only.
- The table UI was split into separate components for opponent areas, trick area, player hand, bid panel, score panel, and turn indicator.
- Visual refinements were made over time to keep the board readable and the hand visible.

### Stage 3 - Colyseus lobby wiring

- Colyseus runtime dependencies were installed.
- Shared protocol schemas were added in `shared/protocol/lobby.ts`.
- Shared Colyseus lobby schema classes were added in `shared/colyseus/lobby.ts`.
- A Colyseus lobby room was implemented in `server/rooms/LobbyRoom.ts`.
- A server bootstrap was added in `server/index.ts`.
- Client Colyseus helpers were added in `src/network/colyseus/client.ts` and `src/network/colyseus/lobby.ts`.
- The lobby flow hook was added in `src/app/useLobbyFlow.ts`.
- The router and room screens were rewired to use live room state.
- Ready-state sync, host start gating, and room-code join were wired through the lobby room.

### Stage 4 - Authoritative room state and handoff

- Reconnect handling was implemented with `allowReconnection`, deterministic timeout cleanup, and typed error responses.
- A `game` room was added on the server and registered in `server/index.ts`.
- Lobby start now creates a game room and exposes `gameRoomId` in synced state for the client handoff.
- Private server delivery helpers were added for hand snapshots, trump reveal, and public round snapshots.
- The client now has a game-room join helper and stores the active room session in `sessionStorage`.
- The game screen now consumes live room state and private hand data when available.

### Stage 5 - Gameplay wiring

- The shared game protocol now includes typed messages for place bid, select trump, play card, and end game.
- The pure rules engine in `server/game/engine.ts` validates bids and card plays, resolves tricks, and scores rounds.
- `server/rooms/GameRoom.ts` is wired to the engine and advances bidding, trump, play, and round-end state.
- `src/features/game/GameTable.tsx` renders live bidding order, turn state, trick positions, and the local hand from room data.
- The client send helpers now serialize the correct payloads for bid, pass, trump selection, and card play.

## Debugging history

### Lobby handoff and disconnect issues

- The lobby-to-game transition originally triggered unexpected disconnects during the handoff.
- `maxClients` / room-lock behavior was removed from the game room to avoid blocking joins and handshake timing.
- The client `intentionalLeave` handling was corrected so the lobby leave during the room handoff did not show a false disconnect overlay.
- Duplicate join behavior was reduced by adding server-side seat checks and client-side transition guards.

### Game layout and readability issues

- The hand was initially too low and forced zooming to see all cards.
- The board layout was reworked so bidding and play could occupy different visual states.
- The trick area was centered for play and hidden during bidding.
- The turn indicator was made larger and more explicit so everyone can see whose turn it is.
- The bid panel was updated to show the active bidder and bidding order.

### Runtime render crashes

- `GameTable` crashed when it tried to read `roomState.currentTrick.cards` before the first snapshot had arrived.
- That access was made null-safe by defaulting to an empty array.

### Bid validation bug

- Passing was initially being treated like a normal bid, so the validator compared `0` against the current bid and rejected it.
- The engine was updated so pass is a legal bidding action during the bidding phases while still preserving turn order and no-rebid rules.

### Reconnect API mismatch

- Silent reconnect originally used the old `reconnect(roomId, sessionId)` pattern.
- The client was updated to store and use the Colyseus `reconnectionToken` instead.
- The reconnect hook now uses the token-based reconnect flow expected by the installed Colyseus client.

### Game-state startup edge cases

- `GameTable` also had startup crashes around room-state fields that were not ready on the first render.
- Those accesses were made null-safe so the UI can render before the first live snapshot arrives.

## Current status

- The repo builds successfully.
- The lobby flow is live.
- The game-room handoff is live.
- Bidding, pass handling, trump selection, trick play, and scoring are wired.
- Live browser verification of the full 4-player flow is still recommended after changes.

## Useful files

- `src/app/useLobbyFlow.ts` - client room lifecycle and screen flow.
- `src/network/colyseus/lobby.ts` - client Colyseus helpers.
- `src/network/colyseus/game.ts` - game-room send helpers and session storage.
- `src/network/colyseus/reconnect.ts` - token-based reconnect helper.
- `server/rooms/LobbyRoom.ts` - lobby room implementation.
- `server/rooms/GameRoom.ts` - game room implementation.
- `server/game/engine.ts` - pure rules engine.
- `shared/colyseus/lobby.ts` - shared lobby schema.
- `shared/protocol/lobby.ts` - lobby protocol schemas.
- `shared/protocol/game.ts` - game protocol schemas.
- `.github/copilot-instructions.md` - repo rules and stage notes.

## Build

```bash
npm run build
```

The build currently passes.

## Recent progress & next steps (May 18, 2026)

### What was just implemented

- **New game phase:** Added `selectingTrump` phase to `shared/enums/phase.ts` and `shared/protocol/game.ts`. This phase now occurs immediately after round 1 bidding, before the second 4 cards are dealt.

- **Server-side flow:** Patched `server/rooms/GameRoom.ts` to:
   - Transition to `selectingTrump` after round-1 bidding completes.
   - Accept `selectTrump` messages and move the room into round-2 bidding after the trump suit is chosen.
   - Accept `revealTrump` messages so the active player can explicitly reveal trump to everyone.
   - Accept `requestRematch` and `endGame` intents for round reset and final summary flow.

- **Client-side UI:** Updated `src/features/game/GameTable.tsx` and `src/features/game/GameTable.module.css` to render trump-selection controls when `phase === 'selectingTrump'`:
  - If the local player is the `trumpHolderId`, show 4 suit buttons (Hearts, Diamonds, Clubs, Spades).
  - If the local player is not the trump holder, show a waiting message.
  - Wire `sendSelectTrump()` helper from `src/network/colyseus/game.ts`.

- **Trump reveal UI:** The play screen now shows a `Reveal Trump` button when the active player cannot follow the led suit, and the revealed trump suit is shown to all players.

- **Session persistence:** Token-based reconnection now stores player identity and reconnection token in `sessionStorage`, preventing duplicate joins and enabling silent reconnect across tab reloads.

- **Bidding validation fix:** Updated `server/game/engine.ts` so `validateBid()` allows `passed: true` as a legal action during bidding phases, unblocking the pass-bid flow.

### Current state

**What works:**
- Full bidding loop with round 1 trump selection, round 2 bidding, pass handling, honours rules, and teammate-passed gating.
- Trump selection UI for the winning bidder (4 suit buttons).
- Manual trump reveal action during play.
- Reconnection with session token storage.
- Trick resolution, scoring, and coolie tracking.
- Live room-state sync and private hand/trump delivery.

**What needs verification / remaining work:**
1. **Integration test:** Start server + client (4 browser tabs), run through bidding → trump selection → play. Confirm:
   - Trump selection UI appears after round-1 bidding ends.
   - Winning bidder can click a suit and move the room into round-2 bidding.
   - All clients receive updated snapshots and the game proceeds to tricks.

2. **Trump visibility:** Currently `state.trumpSuit` is set on selection and later revealed (not hidden). Verify this behavior is correct:
   - Private trump holder sees their own suit immediately.
   - Other players see trump only after the active player explicitly reveals it.
   - Server-side: review `sendPrivateTrump()` calls and `handleRevealTrump()`.

3. **UX improvements:**
   - Show selected trump suit (icon + label) in `TurnIndicator` or `ScorePanel` after selection.
   - Add a confirm/cancel step for trump selection (optional; current button-per-suit is fine for MVP).

4. **Testing:**
   - Unit tests for `validateCardPlay()` edge cases (leading with trump, follow suit, trump reveal).
   - Quick test of all 4 suits to ensure no card-code bugs.

### Stage 6 follow-up

- Results, rematch, and end-game handling now need live browser verification.
- The results screen should reflect `lastRoundSummary`, the current coolie counts, and host-only rematch/end-game controls.

### Key files to inspect if debugging

- `server/rooms/GameRoom.ts` → phase transitions, `handleSelectTrump()`, `advanceBiddingState()`.
- `server/game/engine.ts` → `validateBid()`, `validateCardPlay()`, `resolveTrick()`, `scoreRound()`, `scoreCoolies()`.
- `server/game/privateDelivery.ts` → `sendPrivateTrump()`, `sendRoundSnapshot()`.
- `shared/enums/phase.ts`, `shared/protocol/game.ts` → schema definitions.
- `src/features/game/GameTable.tsx` → trump selection UI logic and handlers.
- `src/network/colyseus/game.ts` → `sendSelectTrump()` and outgoing payload wiring.

### How to pick up work in a new chat

1. Paste this section (from "Recent progress" onward) into a new chat as context.
2. Run the verification steps:
   ```bash
   npm run server    # in one terminal
   npm run dev       # in another terminal
   ```
3. Open 4 browser tabs, create a room, join all 4 seats, ready up, start the game.
4. Play through bidding and check that `selectingTrump` phase appears with the correct UI.
5. If any errors appear, paste the server console logs (last 100 lines) and browser console errors into the new chat.

### Quick diagnostic info to include if things break

- Last 100 lines of server logs (focus on `GameRoom` and phase transitions).
- Browser console errors (especially around room-state or message handling).
- The exact payload sent (e.g., the `selectTrump` message) and the server's `invalid_*` error response, if any.
- Colyseus version in `package.json` (currently ^0.17.10) to check for API mismatches.

## Notes

- Use `npm run server` with the explicit node tsconfig already wired in `package.json`.
- If a room fails to join, check the browser console and server terminal for the latest Colyseus error details.
- If the game view looks wrong on first load, refresh after all 4 players join so the latest room state is applied cleanly.
