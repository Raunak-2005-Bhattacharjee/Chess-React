# Chess Game Server ⚙️

Server for the realtime multiplayer chess game. Uses Express + Socket.IO for realtime communication and chess.js for move validation and game state.

## Quick start

Requirements: Node.js 18+, npm.

Install and run:

```bash
cd Backend/server
npm install
# development with auto-reload
npm run dev
# or production
npm start
```

Default server address: `http://localhost:4000` (set `PORT` env var to change)

## Features

- Waiting-room queue and automatic 1v1 matching
- Real-time synchronization of moves and board state
- Move validation, check/checkmate/stalemate detection (chess.js)
- Resignation and disconnect handling
- Simple health endpoint (`GET /health`)

## Socket events

Client -> Server

- `join_waiting` { nickname? } — join the waiting queue
- `player_move` { roomId, from: [r,c], to: [r,c], promotion? } — attempt a move
- `resign` { roomId } — resign the current game

Server -> Client

- `match_found` { roomId, color, board, fen, opponent } — match successful
- `waiting` { message } — still waiting for opponent
- `opponent_move` { from, to, board, fen, currentTurn, gameStatus } — opponent played
- `move_confirmed` { board, fen, currentTurn, gameStatus } — your move accepted
- `game_over` { winner, reason, gameStatus } — game ended
- `opponent_disconnected` { message } — opponent left
- `error` { message } — error handling

## Notes

- The server uses an in-memory queue and room storage (suitable for development / demo). For production, persist rooms and consider horizontal scaling, sticky sessions, or a shared store.

## Files

- `index.js` — server & socket implementation

---

If you want, I can add tests, Docker support, or an env variable for allowed CORS origin.
