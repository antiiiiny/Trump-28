# GitHub Copilot Instructions

## Project context
Browser-first multiplayer card game for **28** (4-player, 2 teams). Built with VS Code and GitHub Copilot. Family use, not public matchmaking. Prioritize reliability and readability over polish.

## Stack
- Frontend: React + TypeScript + Vite
- Realtime: Colyseus (Socket.IO only if explicitly requested)
- Backend: Node.js + TypeScript
- Styling: CSS modules only — no framework unless requested
- Routing: React Router
- Validation: Zod
- Client state: React context; Zustand only if context becomes unwieldy
- Testing: Vitest
- Icons: Lucide React

Do not introduce Redux, React Query, Jotai, MobX, Joi, Yup, or styled-components unless explicitly requested.

## Folder structure
```
shared/
  models/     ← Card, Player, Bid, Trick, GameState, RoomState
  enums/      ← Suit, Rank, GamePhase
  protocol/   ← client intent types, server event types
src/
  app/        routes/ providers/
  components/ cards/ table/ lobby/ common/
  features/   home/ room/ lobby/ game/ results/ reconnect/
  game/       engine/ rules/ utils/
  network/    colyseus/ events/
  styles/
server/
  rooms/ engine/ utils/
```

Shared types must not be duplicated between client and server. Both sides import from `shared/`. Never import `src/` or `server/` from `shared/`.

## Canonical card format
All card codes across the entire codebase use: rank + suit, uppercase — e.g. `'AH'`, `'7D'`, `'10S'`, `'JC'`.
- Rank: `'A' | 'K' | 'Q' | 'J' | '10' | '9' | '8' | '7'`
- Suit: `'H' | 'D' | 'C' | 'S'`
- 28 uses a 32-card deck — ranks 7 through Ace only. No 2–6.

The only place this format is converted to a `@letele/playing-cards` key is inside `PlayingCardView`. Nowhere else.

### Conversion to @letele/playing-cards keys
Library key format: suit uppercase + rank lowercase for A/K/Q/J, suit uppercase + number for 7–10.
Examples: `'AH'` → `'Ha'`, `'JH'` → `'Hj'`, `'10H'` → `'H10'`, `'7H'` → `'H7'`.
Card backs: use `'B2'` for face-down cards.

Conversion logic lives in `PlayingCardView` only:
```ts
const suit = code.slice(-1);
const rank = code.slice(0, -1);
const rankKey = ['A','K','Q','J'].includes(rank) ? rank.toLowerCase() : rank;
const libraryKey = `${suit}${rankKey}`;
```

## 28 game rules (authoritative)
These are the exact rules to implement. Do not infer rules from other card games.

### Deck and teams
- 32 cards: ranks 7, 8, 9, 10, J, Q, K, A across all 4 suits
- 4 players, 2 teams: seats 0+2 = Team A, seats 1+3 = Team B
- Partners sit opposite each other

### Card point values
- J = 3 points
- 9 = 2 points
- A = 1 point
- 10 = 1 point
- K, Q, 8, 7 = 0 points
- Total points per round = 28

### Card rank order (for trick-winning, high to low)
J, 9, A, 10, K, Q, 8, 7

### Deal
- Deal 4 cards to each player → bidding round 1
- Deal remaining 4 cards to each player → bidding round 2

### Bidding rules
- Minimum opening bid: 14. The first player to bid MUST bid (cannot pass).
- Each subsequent bid must be strictly higher than the current bid.
- If your teammate has already passed, you may only re-enter bidding at 20 or higher ("Honours").
- After the second 4 cards are dealt, the minimum bid to re-enter or raise is 24.
- Maximum bid is 28. No bids above 28.
- Bidding ends when all other players pass.

### Trump rules
- Winning bidder privately selects the trump suit — it is hidden from all other players.
- Winning bidder leads the first trick.
- Winning bidder CANNOT lead with a trump card.
- Any player may only play a trump card if they have no cards of the led suit.
- Trump suit is revealed the first time a trump card is legally played.

### Round result
- If the bidding team scores points >= their bid, they win the round.
- If the bidding team scores points < their bid, the opposing team wins the round.
- Track cumulative round wins per team; define game-end condition explicitly when implementing scoring.

## Architecture boundaries (hard rules)
- UI components must not contain game-rule logic.
- Rules logic must not import from React or any UI framework.
- Networking code must not mutate React state directly.
- Server engine must be usable independently of the transport layer.
- `shared/` must not import from `src/` or `server/`.

## Determinism rules
- All engine functions must be pure and side-effect free.
- Never call `Date.now()` or `Math.random()` inside rules or engine logic.
- Deck shuffling happens from a single server-controlled RNG call only.
- Engine transitions return new state objects; do not mutate in place.

## Code style
- Small, composable React functional components.
- Strict TypeScript — no `any`, especially in protocol payloads.
- Pure functions for all rules and score logic.
- Readable naming over clever abstractions.
- Do not generate giant files if the code can be split logically.
- Prefer concrete implementations over generic abstractions during MVP.
- Introduce abstractions only after duplication becomes clear.

## Anti-patterns — never do these
- Giant all-in-one `GameTable` component.
- Duplicating game state between client and server.
- Deep prop drilling for room or game state.
- Business logic or rule checks inside JSX.
- Using `any` for protocol payloads.
- Storing derived state on the client that the server already owns.
- Mixing CSS modules with inline styles or other styling systems.

## When uncertain
If implementation details are ambiguous:
- Ask for clarification before proceeding.
- Do not invent game rules — all rules are defined above.
- Do not introduce new libraries.
- Do not restructure the architecture without being asked.

## Prompting output format
When generating code: list touched files first, explain assumptions briefly, then generate complete code. Mention edge cases when relevant.

---

# Stage 3 Addendum — Room & Lobby Flow
**During:** Room creation, joining, and lobby wiring

## Current stage goal
Wire up room creation, room code joining, and the lobby screen against a real Colyseus server. All 4 players should be able to create/join a room, see each other, ready up, and have the host start the game. Game table remains a stub.

## Dev server setup
Two processes must run simultaneously during development:
- `npm run dev` — Vite frontend on port 5173
- `npm run server` — Colyseus server on port 2567

To test multiple players locally, open the app in multiple browser windows or tabs. Each window is an independent player. For real device testing, run Vite with `--host` and connect from other devices on the same WiFi network.

## Screens to wire
- **Create/Join Room** — create action calls Colyseus, returns room code. Join action connects by code. Player name is set here.
- **Lobby** — reflects live Colyseus room state: 4 player slots, team labels, ready states, room code + copy button. Host sees start button only when all 4 players are ready.
- **Reconnect/Error overlay** — shown on failed join and unexpected disconnect.

## Room and seat rules
- Room accepts exactly 4 players.
- Seats are assigned by the server in join order: 0, 1, 2, 3.
- Teams are fixed by seat: seats 0+2 = Team A, seats 1+3 = Team B.
- Seat assignment is permanent for the life of the room — never reassigned.
- Host is the player who created the room (seat 0).
- Room code: short, human-readable, uppercase, 4 characters (e.g. `HKQJ`).

## Lobby display rules
- Show 4 player slots always, even if not all players have joined yet (show "Waiting..." for empty slots).
- Display team grouping clearly — Team A (seats 0+2) and Team B (seats 1+3).
- Show ready indicator per player.
- Host start button is disabled until all 4 slots are filled and all players are ready.
- Room code displayed prominently with a one-click copy button.

## Error states — always show user-facing messages for
- Invalid room code.
- Room already full (4 players present).
- Player name missing or too long (max 16 characters).
- Connection failure on join attempt.
- Unexpected disconnect during lobby.

Never leave the user on a blank screen or a spinner with no message.

## Colyseus integration
- Use `onStateChange` to reflect player list, team assignments, and ready states in real time.
- Do not maintain a local copy of player state — render directly from synced room state.
- Ready state is server-authoritative; clicking ready sends a message, does not toggle local UI state.

## Protocol messages at this stage
Defined in `shared/protocol/`. Use Zod schemas for server-side validation.
- Client → server: `joinRoom`, `leaveRoom`, `readyUp`, `startGame`
- Server → client: room state updates via Colyseus schema sync

All message payloads must be strictly typed — no ad-hoc objects, no `any`.

## Do not build yet
- No card dealing.
- No bidding logic.
- No game engine on the server.
- Game table remains a stub/placeholder screen.

---

# Stage 4 Addendum — Multiplayer Room State & Reconnect
**During:** Colyseus room state, sync, and reconnect wiring

## Current stage goal
Implement authoritative server room state, full client synchronisation, and reconnect handling. Game table should now reflect real server state. Bidding and card play are still stubs — focus is entirely on the sync layer being correct and reconnect being reliable.

## Multiplayer synchronisation rules
- Clients must never predict or locally finalise game actions.
- The UI may show a pending state after a player action, but authoritative state always comes from the server.
- Re-render only from Colyseus `onStateChange` — never from local mutation.
- If server state contradicts local UI state, server always wins.

## Hidden information rules (hard requirements)
- Each client receives ONLY the cards in their own hand. Opponent and teammate hand contents must never appear in any client payload.
- Trump suit is sent to clients ONLY after `trumpRevealed` becomes true. Before that, only the trump holder knows it.
- Server-only state (full deck, undealt cards, trump suit before reveal) must never be in the synced Colyseus schema.
- Review every schema field before syncing: if a client should not see it, it must not be in the patch.

## Seat and team model rules
- `PlayerSeat` (0–3) is assigned by the server at join time and never changes.
- Teams are derived from seat: seats 0+2 = Team A, seats 1+3 = Team B. Never store team separately if it can be derived.
- UI table positions derive from the LOCAL player's seat:
  - Local player is always rendered at the bottom.
  - Partner (same team, other seat) is always at the top.
  - Opponents are left and right.
  - Calculate relative position as: `(opponentSeat - localSeat + 4) % 4` → 1=right, 2=top(partner), 3=left.
- Turn order is clockwise by seat: 0 → 1 → 2 → 3 → 0.
- Never infer turn order or position from array index or join order.

## Reconnect guarantees
Use Colyseus `allowReconnection`. Do not build a custom token system.
- On disconnect, server holds the seat open for 60 seconds (configurable constant).
- Client stores Colyseus session token in `sessionStorage`.
- On mount, client checks `sessionStorage` and attempts silent reconnection before showing reconnect UI.
- After successful reconnection:
  - Seat identity and team are unchanged.
  - Hand contents match server state exactly.
  - Current trick, turn state, bid state, and trump reveal state are fully restored.
  - Trump suit is only sent to the reconnecting client if they are the trump holder OR if trump has been revealed.
- A reconnecting client replaces the stale socket — it does not create a second player in the seat.

## Room lifecycle rules
- Empty rooms (all players disconnected, no active reconnect windows) self-clean after timeout.
- Reconnect windows expire deterministically via server-side timers, not client pings.
- All timers and intervals must be cleared in the Colyseus room `onDispose` handler.
- If a player's reconnect window expires mid-game, the remaining players see a clear message and the room enters a paused/error state rather than continuing with a missing player.

## Protocol rules
- All client intent messages and server event payloads are typed in `shared/protocol/`.
- Validate all incoming client messages with Zod on the server before acting on them.
- Client and server payload shapes must never diverge — the shared type is the contract.
- No ad-hoc socket message shapes anywhere.
- Server rejects any action from a player whose turn it is not — return a typed error response, never silently ignore.

## Protocol messages at this stage
- Client → server: reconnect handled via Colyseus session (not a manual message)
- Server → client: typed error responses for rejected actions

## Do not build yet
- No bidding logic.
- No card dealing.
- No trick resolution.