# Snake.io Clone (MERN + Socket.IO + Canvas)

A high-performance real-time multiplayer snake game built with a React/Canvas frontend and a Node.js/Socket.io backend.

## Features

- **60 FPS Rendering**: Utilizes `requestAnimationFrame` and direct HTML5 Canvas rendering to avoid React re-renders.
- **Server-Authoritative State**: Fully verified fixed-timestep (20Hz) backend loop prevents cheating.
- **Client Interpolation**: Smoothly predicts player movement between slow server ticks.
- **QuadTree Spatial Partitioning**: Optimized backend collisions handle thousands of pellets and body segments without lag.
- **Skill Abilities**: Dash, Shield, and Magnet mechanics with cooldowns.
- **Mobile Ready**: Built-in touch joysticks and `@capacitor/core` configured for direct Android export.
- **Web Audio API**: Synthesized dynamic sound effects for consumption, abilities, and deaths.

## Running Locally

### 1. Start the Backend

```bash
cd backend
npm install
npm start
```

The server will run on `http://localhost:3000`.

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`. Open multiple browser windows to test the multiplayer!

## Android Build (Capacitor)

This project has Capacitor pre-configured. To generate an Android APK:

1. Build the production web bundle:

```bash
cd frontend
npm run build
```

2. Sync the web assets to the native Android project:

```bash
npx cap sync android
```

3. Open the project in Android Studio to build the APK:

```bash
npx cap open android
```

## Architecture Notes

- `frontend/src/game/GameManager.js`: The orchestrator handling Socket.io state synchronization, client-side buffering/interpolation, input (mouse/touch/keyboard), and the `requestAnimationFrame` loop.
- `frontend/src/game/Renderer.js`: Defines all Canvas drawing operations (grids, glowing players, UI HUD).
- `backend/game/GameEngine.js`: The authoritative physics and game loop processor ensuring inputs map to reality.
- `backend/game/QuadTree.js`: High-performance collision bucketing.
