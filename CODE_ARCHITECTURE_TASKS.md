# 🛠️ Code & Architecture — Implementation Tasks

This document lays out a comprehensive, actionable plan to improve the codebase across: Type safety, linting, modularization, testing, performance instrumentation, error handling, gameplay/UX, accessibility, mobile packaging, and DevOps.

Use this as a playbook — each section has specific tasks, commands, example snippets, and priority/time estimates.

---

## Overview & Goals
- Make the codebase safer and easier to maintain by migrating toward TypeScript and strong linting rules.
- Split large files into focused modules to ease testing and reasoning about logic.
- Add unit & E2E tests to prevent regressions in core systems (physics, interpolation, networking).
- Improve server performance instrumentation and make tick loop robust against lag.
- Improve UX with matchmaking, reconnect handling, customizable controls, and HUD telemetry.
- Add CI, containerization, monitoring and mobile build verification for production readiness.

---

## Quick start: recommended order
1. Add TypeScript scaffolding and ESLint/Prettier (low risk, high ROI).
2. Extract server `Physics.js` and write unit tests (core logic safety).
3. Add test scaffolding for frontend interpolation & run tests in CI.
4. Implement matchmaking/room manager and lobby flows.
5. Add Prometheus/Sentry integration and CI pipeline.

---

## 1) Type safety & linting
Goal: Gradually migrate to TypeScript while keeping the current JS code runnable.

A. Scaffolding (quick)
- Create `tsconfig.json` at repo root with `allowJs: true` and `checkJs: false` initially.
- Install TypeScript and types for node, react.

Commands (run in both `frontend/` and `backend/` as needed):

```bash
# from frontend/
npm install --save-dev typescript @types/node @types/react @types/react-dom

# from backend/
npm install --save-dev typescript @types/node
```

Example `tsconfig.json` (repo-level or per-package):

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Node",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowJs": true,
    "checkJs": false,
    "outDir": "dist/types",
    "baseUrl": "."
  },
  "include": ["frontend/src/**/*", "backend/**/*"]
}
```

B. Strategy for migration
- Keep `allowJs: true` so JS runs unchanged.
- Add `// @ts-check` or JSDoc types to critical JS files first (fast wins).
- Convert a single focused module to `.ts`/`.tsx` (e.g. `frontend/src/game/Network.ts`) and fix type errors.
- Gradually increase coverage and consider enabling `checkJs: true` for stricter checks after some conversions.

C. Typings to add early
- `Profile` shape: `{ name: string; xp: number; level: number; selectedSkin: string; unlockedSkins: string[]; }`.
- `ServerSnapshot` shape for socket `state` events: `{ time: number; players: Record<string, PlayerState>; pellets: Record<string, Pellet>; }`.
- `PlayerState`, `Pellet` and `WorldBounds` objects.

D. Update `package.json` scripts
```json
"scripts": {
  "typecheck": "tsc --noEmit",
  "lint": "eslint . --ext .js,.jsx,.ts,.tsx"
}
```

Estimated time: 2–6 hours for scaffolding + small migration; 1–2 days iterative conversion.

---

## 2) ESLint & Prettier
Goal: Consistent style and catching common bugs.

A. Install

```bash
# frontend/
npm install --save-dev eslint prettier eslint-config-prettier eslint-plugin-prettier
npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

B. Example `.eslintrc.cjs` (root / frontend)

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  settings: { react: { version: 'detect' } },
  rules: {
    'prettier/prettier': 'error',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
  }
}
```

C. Prettier config (`.prettierrc`)
```json
{ "trailingComma": "es5", "tabWidth": 2, "semi": true, "singleQuote": true }
```

D. Autofix and CI
- Run `npx eslint . --fix` to auto-correct formatting.
- Add `lint` job in GitHub Actions to block merges where lint fails.

Estimated time: 2–4 hours to configure and fix initial errors.

---

## 3) Modularization (split large files)
Goal: Make `GameEngine.js` and `GameManager.js` smaller and testable.

A. Backend (`backend/game`)
- `Physics.js` — deterministic stateless functions for collisions, movement, pellet pickup logic.
  - Export functions: `applyMovement(player, dt)`, `applyCollision(player, others)`, `applyPelletPickup(player, pellet)`.
- `RoomManager.js` — manages rooms, matchmaking, lobby state (waiting, starting, playing), minPlayers and start timers.
- `Gameplay.js` — high-level game rules (mutations, power-ups, scoring) that orchestrate `Physics` functions.
- Keep `GameEngine.js` as the orchestrator calling `RoomManager` and `Gameplay`.

B. Frontend (`frontend/src/game`)
- `InputHandler.js` (done) — input binding; export `setupInput(game)` and `cleanupInput(game)`.
- `Network.js` (done) — socket event wiring.
- `Prediction.js` — interpolation/extrapolation utilities: `interpolate(stateA, stateB, t)`, replay utilities.
- `Renderer.js` remains for drawing.

C. How to split: example for server physics
1. Identify pure logic in `GameEngine.tick()` related to position integration and collision checks.
2. Move pure functions to `Physics.js` and export them.
3. Replace inline code in `GameEngine.tick()` with calls to `Physics` helpers.

Estimated time: 1–2 days for backend split + tests.

---

## 4) Testing
Goal: Prevent regressions with unit and e2e tests.

A. Choose tools
- Backend unit tests: `vitest` or `jest` (Vitest is fast and modern).
- Frontend unit tests: `vitest` + `jsdom` plugin or React Testing Library.
- E2E: `playwright` for simulating browser instances and socket interactions.

B. Setup (frontend/backend)

```bash
# install in frontend/
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom playwright

# install in backend/
npm install --save-dev vitest supertest
```

C. Example unit test for `Physics.applyMovement`
```js
import { applyMovement } from '../game/Physics';
import { expect, test } from 'vitest';

test('movement integrates position by velocity and dt', () => {
  const player = { x:0,y:0, vx:10, vy:0 };
  applyMovement(player, 0.1);
  expect(player.x).toBeCloseTo(1, 5);
});
```

D. Example E2E with Playwright
- Start backend on a random port, start two headless browsers, use `page.evaluate()` to connect socket clients, send input events, verify pellet removed and scoreboard update.
- Playwright provides a test runner; mock or run a local server for the test.

E. CI integration
- Add test jobs to GitHub Actions to run `npm test` and `npx playwright test --reporter=github`.

Estimated time: 2–4 days for basic unit tests + 2–3 days for E2E skeleton.

---

## 5) Performance instrumentation
Goal: Monitor server tick timings and client FPS/lag.

A. Server
- Use `process.hrtime.bigint()` to measure tick duration (we implemented a self-adjusting loop earlier).
- Expose metrics via socket event `server_metrics` (already added) and optionally an HTTP `/metrics` endpoint for Prometheus.
- Add Prometheus exporter: `prom-client` (npm) and create `/metrics` route.

Commands:
```bash
npm install prom-client
```

Server metrics endpoint sketch:
```js
const client = require('prom-client');
app.get('/metrics', async (req,res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

B. Client
- Emit client FPS & measured latency periodically over socket for server correlation.
- Show small HUD (we already added) and provide optional debug screen.

Estimated time: 4–8 hours to integrate Prometheus and Grafana dashboards.

---

## 6) Error handling
Goal: Fail gracefully and inform clients when server-side errors happen.

A. Patterns
- Wrap asynchronous/critical sections with try/catch and `this.io.to(room).emit('server_error', { message })`.
- On client, listen for `server_error` and display a transient message / offer to return to lobby.
- Centralize DB calls with retry/backoff or return an error object to calling code.

B. Example server try/catch (already applied to tick loop):
```js
try { await Database.getUser(name); } catch (err) {
  console.error(err);
  socket.emit('server_error', { message: 'DB unavailable' });
}
```

Estimated time: 3–6 hours to audit and add where needed.

---

## 7) Matchmaking & rooms
Goal: Provide polished lobby + room lifecycle with `fill-when-ready`.

A. Backend: `RoomManager` design
- Maintain rooms map: { roomId: { players: Set, state: 'waiting'|'starting'|'playing', minPlayers, maxPlayers, timer } }
- API: `createRoom({ mode, minPlayers })`, `joinRoom(roomId, socket)`, `leaveRoom(roomId, socket)`.
- When `players.size >= minPlayers`, transition to `starting` and start countdown (5–10s); if player leaves and count falls below min, cancel countdown.

B. Frontend: Lobby changes
- UI: allow creating or joining rooms, show room list, show player list, show countdown timer.
- `Lobby.jsx`: add room creation flow and WebSocket handlers to receive room updates.

C. Commands & persistence
- Optionally persist rooms in-memory; if multiple server instances needed later, use Redis to coordinate.

Estimated time: 2–4 days for basic RoomManager + lobby UI.

---

## 8) UI polish & controls
Goal: Make controls adaptable and display useful telemetry.

A. Loading + Reconnect (done)
- Fine: make overlay animated and add reconnect attempts count.

B. Customizable joystick & ability buttons
- Add `Controls` settings UI allowing drag-to-place or preset positions and sizes.
- Save settings to `ProfileManager.saveProfile(profile)` so layout persists across sessions.

C. Ping/Lag and XP / Leaderboards
- Ping is measured by `currentLag` in `GameManager` and server metrics.
- Add a `HUD` component to show ping, FPS, XP progress bar, and top N leaderboard. Use existing `Lobby.jsx` leaderboard fetch for global leaderboard — add a per-match leaderboard via socket.

Estimated time: 1–3 days.

---

## 9) Gameplay features
A. Safe-zone (Battle Royale)
- Implement storm shrink: periodically reduce `stormRadius` and emit storm center/radius to clients.
- Apply damage to players outside storm each tick.

Sketch:
```js
// in GameEngine tick
if (this.isBattleRoyale && this.matchState === 'PLAYING') {
  this.stormRadius = Math.max(100, this.stormRadius - this.stormShrinkSpeed * dt);
  this.io.to(this.roomId).emit('storm_update', { center: this.stormCenter, radius: this.stormRadius });
  // apply damage outside
}
```

B. Challenges & Shop
- Add `challenges` table or JSON for daily/weekly challenges, reward XP or skins.
- Add `shop` backend API to spend XP for skin unlocks; update `ProfileManager`.

Estimated time: 2–5 days to scaffold features.

---

## 10) Accessibility
A. Keyboard + Gamepad
- Add Gamepad API polling in `InputHandler`. Map buttons to boost/ability and axes to direction.
- Keep keyboard default; ensure focusable UI elements for non-canvas interactions.

B. Color-blind palettes
- Add CSS variables for color palettes; provide toggle in `OptionsScreen`.

C. Toggleable sound effects
- Add a `muteSfx` flag in profile and guard `AudioEngine.play*()` calls.

Estimated time: 2–3 days.

---

## 11) Mobile packaging
A. Android
- Build and test the Capacitor Android project:
```bash
# frontend/
npm run build
npx cap sync android
npx cap open android
```
- Test on device/emulator, ensure permissions and gamepad mapping.
- For release, follow Android Studio signing flow and create an APK/AAB.

B. iOS (optional)
- `npx cap add ios` and open Xcode; check entitlements and App Store signing.

Estimated time: 1–2 days for verification + signing work.

---

## 12) DevOps & Deployment
A. Containerization
- Create `docker-compose.prod.yml` with `nginx` (reverse proxy), `backend` service, and `sqlite` volume.
- Ensure env vars for production and persistent DB volume mapping.

B. CI/CD (GitHub Actions)
- Add workflow: `lint` → `test` → `build` → `deploy` (Railway or other). Example YAML snippet included below.

C. Analytics & Monitoring
- Integrate Sentry for error tracking:
```bash
npm install @sentry/node @sentry/react
```
- For metrics: Prometheus + Grafana or hosted observability (Datadog).

Estimated time: 2–4 days to scaffold CI and basic monitoring.

---

## 13) Example GitHub Actions (lint + test + build)
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with: { node-version: '18' }
      - name: Install frontend
        run: |
          cd frontend
          npm ci
      - name: Lint
        run: |
          cd frontend
          npm run lint
      - name: Unit tests
        run: |
          cd frontend
          npm test
      - name: Build
        run: |
          cd frontend
          npm run build
```

---

## 14) Testing & local development commands
- Start backend
```bash
cd backend
npm install
npm start
```

- Start frontend
```bash
cd frontend
npm install
npm run dev
```

- Run typecheck
```bash
npm run typecheck
```

- Run lint
```bash
npm run lint
```

- Run tests (when configured)
```bash
npm run test
```

- Run Playwright tests (when configured)
```bash
npx playwright test
```

---

## 15) Checklist (first 2 weeks - recommended priorities)
1. Add TypeScript scaffolding, `tsconfig.json`, install packages. (0.5d)
2. Add ESLint/Prettier and apply autofix. (0.5–1d)
3. Extract `backend/game/Physics.js` with pure functions and add unit tests. (1–2d)
4. Add Vitest and a couple of core tests for physics & quad-tree. (1d)
5. Implement RoomManager (backend) + Lobby UI changes (frontend). (2–4d)
6. Add Playwright skeleton for one e2e test (two players eat pellet). (1–2d)
7. Integrate Sentry and add server metrics Prometheus exporter. (1–2d)

---

## 16) Notes & Tips
- Convert files incrementally to TypeScript — don’t try to convert the entire repo in one pass.
- When splitting modules, prioritize extracting pure functions first — they are easiest to test.
- Use small PRs focused on a single concern (lint, TS, physics, tests, UI) to keep reviews simple.
- Keep a short-lived feature branch for major refactors and run CI frequently.

---

## 17) Resources & snippets
- TypeScript migration guide: https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html
- Vitest docs: https://vitest.dev/
- Playwright guide: https://playwright.dev/docs/intro
- Prometheus Node client: https://github.com/siimon/prom-client

---

If you want, I can now:
- scaffold `tsconfig.json` and update `frontend/package.json`/`backend/package.json` with `typecheck` script;
- add ESLint + Prettier configs and fix obvious lint issues;
- extract a first `Physics.js` file with one unit test to show the pattern.

Which of those would you like me to do next? 
