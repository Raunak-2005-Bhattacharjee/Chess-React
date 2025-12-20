# Recursion Modified Chess — Realtime Multiplayer Chess ⚔️♟️

A realtime, 2-player chess game built with React (Vite) on the frontend and Node.js + Socket.IO on the backend. Players join a waiting room and are automatically matched into head-to-head games with synchronized move state powered by chess.js.

---

## Tech stack

- Frontend: React, Vite, Socket.IO client
- Backend: Node.js, Express, Socket.IO, chess.js
- Dev tools: nodemon (backend), eslint, vite

---

## Features ✅

- Waiting-room queue and automatic 1v1 matching
- Real-time move synchronization via Socket.IO
- Move validation, check/checkmate/stalemate detection via chess.js
- Resignation and disconnect handling
- Minimal REST health endpoint for uptime checks

---

## Table of contents

- [Prerequisites](#prerequisites)
- [Running locally](#running-locally)
- [Configuration](#configuration)
- [Development workflow](#development-workflow)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Prerequisites

- Node.js 18+ and npm (or yarn)
- Git

---

## Running locally

1. Clone the repo:

```bash
git clone <repo-url>
cd "Chess React"
```

2. Install dependencies:

```bash
# Backend
cd Backend/server
npm install

# Frontend
cd ../../Frontend/Chess
npm install
```

3. Start both services (in separate terminals):

```bash
# Backend (dev)
cd Backend/server
npm run dev

# Frontend (dev)
cd Frontend/Chess
npm run dev
```

4. Open the frontend at http://localhost:5173 and join the waiting room.

Default backend server URL: http://localhost:4000

---

## Configuration

- Backend port: set `PORT` env var (defaults to 4000)
- Frontend socket URL: currently hard-coded in `src/socket.js` (change to a different backend address if needed). You can also update the code to read from `import.meta.env.VITE_SOCKET_URL` and set a `.env` file like:

```
VITE_SOCKET_URL=http://localhost:4000
```

---

## Development workflow

- Backend scripts: `npm start` (production), `npm run dev` (nodemon)
- Frontend scripts: `npm run dev`, `npm run build`, `npm run preview`

---

## Project structure

- Backend/server — Node/Express + Socket.IO server
  - `index.js` — main server and socket logic
- Frontend/Chess — React + Vite app
  - `src` — React components and socket client

---

## Contributing

- Open an issue for feature requests or bugs
- Fork, create a feature branch, and open a pull request
- Keep changes focused and add concise commit messages

---

## License

MIT — see LICENSE (add a LICENSE file if desired)

---

If you'd like, I can also:
- Add a `.env.example` and update `src/socket.js` to use `VITE_SOCKET_URL`
- Add more detailed developer docs or a CONTRIBUTING.md

Let me know which you'd prefer next.