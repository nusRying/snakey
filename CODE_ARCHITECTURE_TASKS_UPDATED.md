# 🛠️ Code & Architecture — Detailed Implementation Guide

This file is a practical, step-by-step playbook to implement improvements across the project: TypeScript, linting, modularization, testing, instrumentation, error handling, UX, accessibility, packaging and deployment.

Each section below contains concrete steps, commands, and short examples you can follow or copy into PRs. Use it as an ongoing checklist and update it as you progress.

---

## Goals (one-liner)
- Increase confidence with TypeScript and linting
- Make server and client code modular and testable
- Add unit and end-to-end tests to prevent regressions
- Surface actionable telemetry (tick timing, client RTT, FPS)
- Improve UX (reconnect, matchmaking, customizable controls)
- Prepare the repo for CI/CD, containerization and monitoring

---

## Recommended order (first sprint)
1. TypeScript scaffolding + `typecheck` script
2. ESLint + Prettier configuration and autofix
3. Extract `backend/game/Physics.js` (pure functions) + unit tests
4. Add Vitest to frontend + one interpolation test
5. Create a RoomManager and basic lobby flows
6. Add CI job for lint/typecheck/tests

Target: get a single end-to-end PR path with tests and CI green within 1–2 weeks.

---

## 1) TypeScript: practical incremental migration

Why: TypeScript catches many classes of bugs early (payload shapes, nulls, property typos) and documents intent.

What to add now:
- A `tsconfig.json` at repo root configured for gradual migration.
- `typecheck` npm script that runs `tsc --noEmit` in CI.

Quick install:
```bash
# frontend/
npm install --save-dev typescript @types/node @types/react @types/react-dom

# backend/
npm install --save-dev typescript @types/node
```

Recommended `tsconfig.json` (repo root)
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
    "noEmit": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["frontend/src/**/*", "backend/**/*"]
}
```

Migration strategy (practical):
1. Keep `allowJs: true` so existing JS runs unchanged.
2. Add `// @ts-check` or JSDoc for high-impact files (network payload handlers, profile manager).
3. Convert one small module to `.ts` (e.g., `Network`) and fix types.
4. Repeat: convert modules that contain pure/algorithmic code first (Physics, Prediction).
5. Once a critical mass is converted, consider enabling `checkJs: true` for stricter checks on JS files.

Small example types to add early
```ts
type Profile = { name: string; xp: number; level: number; selectedSkin: string; unlockedSkins: string[] };
type Pellet = { id: number; x: number; y: number; value: number };
type ServerSnapshot = { time: number; players: Record<string, any>; pellets: Record<string, Pellet> };
```

Add script to `package.json`:
```json
"scripts": {
  "typecheck": "tsc --noEmit"
}
```

Estimated time: 0.5–2 days for scaffolding and a first converted module.

---

## 2) ESLint + Prettier: consistent style and safety

Why: catches problems early, enforces consistent style across JS/TS.

Install:
```bash
npm install --save-dev eslint prettier eslint-config-prettier eslint-plugin-prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

Minimal `.eslintrc.cjs` (root)
```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  env: { node: true, browser: true },
  rules: { 'prettier/prettier': 'error' }
};
```

Add scripts:
```json
"scripts": {
  "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
  "format": "prettier --write ."
}
```

Run autofix and commit the changes:
```bash
npx eslint . --fix
npx prettier --write .
```

Add a `lint` job to CI to prevent style regressions.

Estimated time: 2–6 hours to configure and clean up initial findings.

---

## 3) Modularization: split big files into focused modules

Why: improves testability and code comprehension.

Backend suggested modules (`backend/game`):
- `Physics.js` (pure): position integration, collision and pickup logic.
- `QuadTree.js` (already present): ensure small public API and unit tests.
- `Gameplay.js`: rules, mutations, power-up effects (calls into Physics.js for low-level ops).
- `RoomManager.js`: room lifecycle, matchmaking, countdowns.
- `GameEngine.js`: orchestrator that wires the pieces and handles IO.

Frontend suggested modules (`frontend/src/game`):
- `Network.js` (socket handlers) — already extracted.
- `InputHandler.js` — already extracted.
- `Prediction.js` (interpolation/extrapolation helpers).
- `Renderer.js` (canvas drawing helpers).

How to split: identify pure code paths (no sockets or DOM) and extract them first. Those are ideal for unit tests.

Example `applyMovement` (Physics):
```js
export function applyMovement(entity, dt) {
  entity.x += entity.vx * dt;
  entity.y += entity.vy * dt;
}
```

Estimated time: 1–3 days for a safe backend split with tests.

---

## 4) Testing: unit and e2e

Why: reduce regressions in critical systems.

Tooling:
- Unit tests: `vitest` (fast, integrates with Vite)
- E2E: `playwright` (multi-browser, CI friendly)

Install:
```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom playwright
```

Example unit test (Vitest) for `Physics.applyMovement`:
```js
import { applyMovement } from '../../backend/game/Physics';
import { it, expect } from 'vitest';

it('integrates position', () => {
  const p = { x:0, y:0, vx:10, vy:0 };
  applyMovement(p, 0.1);
  expect(p.x).toBeCloseTo(1);
});
```

Example Playwright E2E scenario:
1. Start server in test mode (random port).
2. Launch two browser pages; connect socket clients.
3. Simulate movement from one client to collide with a pellet.
4. Assert server broadcasts `pellet_update` and scores update.

CI: run unit tests and Playwright tests on PRs. Keep E2E tests small and deterministic.

Estimated time: 2–5 days for initial tests plus CI integration.

---

## 5) Telemetry & instrumentation

Server:
- Use `process.hrtime.bigint()` for precise tick timing.
- Emit `server_metrics` to clients (tick duration, players count, server load).
- Optionally add `/metrics` with `prom-client` for Prometheus.

Client:
- Measure FPS and RTT and report periodically to server.
- Offer a debug HUD for dev builds.

Prometheus sketch:
```js
const client = require('prom-client');
const hist = new client.Histogram({ name: 'tick_ms', help: 'tick duration milliseconds' });
app.get('/metrics', async (req,res) => { res.set('Content-Type', client.register.contentType); res.end(await client.register.metrics()); });
```

Estimated time: 4–8 hours to instrument and add a basic dashboard.

---

## 6) Error handling & observability

Patterns:
- Emit `server_error` events for critical failures (DB down, uncaught exceptions).
- Capture exceptions with Sentry on server and client.
- Return structured errors from API calls and handle them on the client.

Example:
```js
try { await db.save(state); } catch (err) {
  this.io.to(room).emit('server_error', { code: 'DB_FAIL', message: 'Database unavailable' });
  Sentry.captureException(err);
}
```

Estimated time: 1–3 days to integrate Sentry and audit critical paths.

---

## 7) Matchmaking & room lifecycle

Server responsibilities:
- Track rooms with `minPlayers`, `maxPlayers`, `state` (waiting/starting/playing).
- Start countdown when >= `minPlayers`, cancel when below.
- Provide APIs: `listRooms`, `createRoom`, `join`, `leave`.

Frontend:
- Lobby UI to create/join rooms, show player list and countdown.

Scaling: for multi-instance deployments use Redis or another coordinator for room state.

Estimated time: 2–4 days for a basic implementation.

---

## 8) UX, controls & accessibility

UX improvements:
- Reconnect/loading overlay (already added) with retry and lobby fallback.
- Custom controls UI (drag-to-place joystick/abilities) saved to user profile.

Accessibility:
- Keyboard and Gamepad API support.
- Color-blind palettes via CSS variables and toggle.
- Ensure focus outlines and reduced-motion support.

Estimated time: 2–4 days.

---

## 9) Mobile & Capacitor

Android workflow:
```bash
cd frontend
npm run build
npx cap sync android
npx cap open android
```
Test on device/emulator and validate gamepad input and performance. For production, follow Android Studio signing.

iOS: similar flow via Xcode if targeting iOS.

Estimated time: 1–3 days to validate and sign builds.

---

## 10) CI/CD & deployment

- Add GitHub Actions with jobs: `lint`, `typecheck`, `unit tests`, `e2e`, `build`.
- Example: run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` in both `frontend/` and `backend/`.
- Containerization: create `docker-compose.prod.yml` with `nginx` (reverse proxy), `backend` and a persistent DB volume.

Estimated time: 2–4 days to scaffold CI and simple deploy steps.

---

## 11) First 7 concrete tasks (I can implement)
1. Add ESLint + Prettier config and run autofix across the repo.
2. Extract `backend/game/Physics.js` and add one unit test (Vitest).
3. Add a `lint` + `typecheck` job to CI workflow.
4. Convert `frontend/src/game/Network.js` to TypeScript (as a template for further conversions).

Tell me which of these you'd like me to take and I will implement it now.

---

## Useful references
- TypeScript migration guide: https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html
- Vitest docs: https://vitest.dev/
- Playwright docs: https://playwright.dev/
- prom-client (Prometheus): https://github.com/siimon/prom-client
