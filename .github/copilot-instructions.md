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
  enums/      ← Suit, Rank, GamePhase, BidCategory
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
These are the exact rules to implement. Do not infer rules from any other card game.

### Deck and teams
- 32 cards: ranks 7, 8, 9, 10, J, Q, K, A across all 4 suits
- 4 players, 2 teams: seats 0+2 = Team A, seats 1+3 = Team B
- Partners sit opposite each other

### Card point values
- J = 3 points, 9 = 2 points, A = 1 point, 10 = 1 point
- K, Q, 8, 7 = 0 points
- Total points per round = 28

### Card rank order (for trick-winning, high to low)
J, 9, A, 10, K, Q, 8, 7

### Deal sequence
1. Deal 4 cards to each player → bidding round 1 (phase: `biddingRound1`)
2. Winning bidder selects trump suit → trump selection phase (phase: `selectingTrump`)
3. Deal remaining 4 cards to each player → bidding round 2 (phase: `biddingRound2`)
4. Play tricks (phase: `playing`)

### Bid categories
```ts
type BidCategory = 'normal' | 'honours' | 'disti' | 'thani';
```
- **normal**: round 1, bid 14–19
- **honours**: round 1, bid 20–28 (only valid when your teammate has already passed)
- **disti**: round 2, bid 24–27
- **thani**: round 2, bid exactly 28

### Bidding rules
- First player to act in round 1 MUST bid — minimum 14. Cannot pass on opening.
- Each subsequent bid must be strictly higher than the current bid.
- If your teammate has already passed, you may only bid 20 or higher (Honours).
- After round 1 bidding completes, the winning bidder selects trump suit.
- After trump selection, round 2 bidding begins with minimum bid 24. Only players who did NOT pass in round 1 may bid.
- In round 2, any eligible player can bid above 24 (not just the round 1 winner). Bids must still be strictly higher than current bid.
- Maximum bid is 28. No bids above 28.
- Bidding ends when all other players pass.

### Trump rules
- Winning bidder privately selects trump suit after round 1 bidding ends — hidden from all other players until revealed.
- Winning bidder leads the first trick.
- Winning bidder CANNOT lead with a trump card.
- A player must follow suit if they have cards of the led suit.
- If a player cannot follow suit and has trump, they must click `Reveal Trump` before playing a trump card.
- If a player has neither the led suit nor trump, they may play any card.
- Trump is revealed explicitly by the active player through a `Reveal Trump` action and is then visible to all players.

### Round result and coolie scoring
Coolies are per team. Both teams start at 0. The 5th coolie is the joker (special shame token).
There is no automatic game-end — the host ends the game manually when players decide to stop.

| Bid category | Bidding team wins | Bidding team loses |
|---|---|---|
| Normal (14–19, round 1) | Opponents get 1 coolie | Bidding team gets 2 coolies |
| Honours (20–28, round 1) | Opponents get 2 coolies | Bidding team gets 3 coolies |
| Disti (24–27, round 2) | Opponents get 3 coolies | Bidding team gets 4 coolies |
| Thani (28, round 2) | Opponents get 4 coolies | Bidding team gets 5 coolies |

Winning = bidding team's trick points >= their bid value.
Losing = bidding team's trick points < their bid value.
The joker is the 5th coolie — display it distinctly in the UI.
Coolies accumulate indefinitely across rounds.

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

## Stage 6 Addendum - Results, Rematch & Polish

### Current stage goal
Wire up the results screen with real round and game data, implement rematch flow, end game handling, and polish any remaining UI rough edges.

### Results screen
- Show winning team (A or B) and player names for the round just played.
- Show point breakdown: how many trick points each team scored.
- Show bid vs actual score, for example: "Team A bid 18, scored 21 - Win".
- Show current coolie count per team; display the joker distinctly when a team is at 5 coolies.
- Coolies accumulate across rounds and are never reset.
- Host sees an "End Game" button at all times and sends `endGame` intent to the server.
- Non-host players see a message indicating only the host can end the game.
- Buttons: Play Again (next round), End Game (host only).

### End game flow
- Host clicks End Game and the server broadcasts `gameEnded` to all clients.
- All players are taken to a final summary screen.
- Final summary shows total coolie count per team across all rounds played.
- There is no automatic game-end condition; the game runs indefinitely until the host ends it.
- Do not hardcode any round win target.

### Rematch flow (next round)
- Host clicks Play Again and sends `requestRematch` intent.
- Server resets RoundState only; teams, seats, and coolie counts are preserved.
- Dealer rotates one seat clockwise each round.
- All players return to a ready state before the next round begins.
- If a player leaves during the results screen, handle it gracefully by showing the lobby with rejoining option.

### Polish checklist
- Trick area correctly shows compass layout (N/S/E/W cards).
- Trump revealed indicator visible to all players once revealed.
- Bid history visible during play, including what was bid and by whom.
- Coolie display updates in real time from Colyseus state.
- Reconnect overlay tested with a real disconnect scenario.
- All screens tested at 375px width.

### Do not add
- Matchmaking or public rooms.
- Chat or social features.
- Animations beyond simple CSS transitions.
- Persistent leaderboards or accounts.
- Any automatic game-end condition based on round wins or coolie count.