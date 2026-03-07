# Snakey

Snakey is a mobile-first real-time snake game built with a React + Canvas frontend, a Node.js + Socket.IO authoritative backend, SQLite-backed persistence, and a Capacitor Android shell for device builds.

This README is the canonical handoff document for the repo. If work pauses, resume here first.

## Current Status

As of 2026-03-07, the project includes:

- Mobile-first UI and gameplay flow across title, lobby, gameplay, options, help, loading, and skin customization.
- Real-time multiplayer with managed room states for lobby, countdown, playing, and finished rounds.
- Private bot-heavy Solo Practice routed through backend mode `OFFLINE`.
- Dedicated Skin Lab screen with progression-driven unlocks and cute animal-themed skins.
- Android packaging through Capacitor with repeatable debug APK generation.
- Firebase Android wiring, Google Sign-In wiring, native GrowthBridge support, live-ops caching, analytics batching, and push token registration.
- Mobile performance tuning on both the frontend render loop and backend snapshot delivery.
- A brighter slither-inspired visual direction for the title screen, lobby surfaces, match overlays, and loading flow.

## What Has Been Built

### Core gameplay and architecture

- Server-authoritative simulation with Socket.IO.
- Canvas rendering client-side for low-overhead frame updates instead of React scene rendering.
- Backend-controlled movement, collisions, hazards, power-ups, kills, and match summaries.
- Room lifecycle handling through `RoomManager` for managed multiplayer modes.
- World serialization and per-viewer culling through `WorldState`.

### Mobile-first gameplay

- Touch joystick and on-screen ability/boost controls.
- Safe-area-aware HUD and menu layout.
- Adaptive quality tiers and mobile performance presets.
- Physical-device Android builds through Capacitor.
- Mobile-oriented lobby, loading, and title-screen layout behavior.

### Progression, cosmetics, and profile systems

- XP, levels, unlocks, challenge progress, and daily rewards handled by `ProfileManager`.
- Skin catalog with rarity, unlock methods, trail styles, and death effects.
- Dedicated Skin Lab screen instead of embedding all skin management into the lobby.
- Featured cute animal skin line:
  - `panda_puff`
  - `bunny_blossom`
  - `otter_pop`
  - `corgi_curl`
  - `kitty_cloud`
  - `foxglove_fizz`

### Modes, rooms, and themed arenas

- Multiple themed modes defined jointly in frontend and backend mode metadata.
- Survival obstacle layouts and mode previews.
- Battle Royale, team-style logic, hazards, portals, black holes, and blockers.
- Managed-room ready flow surfaced in the frontend with in-match overlay states.

### Live systems and native/mobile integrations

- First-party analytics batching to the backend.
- Live-ops content pack caching for title and lobby surfaces.
- Android native `GrowthBridge` plugin for ads/referrer/native hooks.
- Firebase Analytics, Crashlytics, Messaging, and Sign-In wiring in Android.
- Backend persistence for Android push tokens and Google account linking.

## Major Product Changes Completed In This Session

### Mobile productization

- Reworked the game toward a phone-first experience instead of a desktop-first prototype.
- Improved mobile layouts, touch flows, safe-area behavior, and button sizing.
- Produced repeated Android APKs for device testing.

### Connectivity and Android runtime fixes

- Fixed Android backend connectivity problems for device builds.
- Preserved a device-first backend URL path instead of relying on emulator-only fallbacks.
- Allowed Android WebView/network behavior needed for the current backend setup.

### Performance and smoothness work

- Optimized backend tick loop and snapshot behavior for smoother mobile play.
- Reduced snapshot payload cost through per-viewer detail culling.
- Split bot behavior expectations between offline and multiplayer modes.
- Added a denser offline practice target of up to 25 bots.
- Added an `Ultra Smooth` performance preset.
- Fixed the client ping calculation issue that previously produced invalid values.
- Switched gameplay and title canvases to `getContext('2d', { alpha: false, desynchronized: true })`.
- Raised Android-friendly canvas resolution ceilings for capable devices.
- Reduced client interpolation delay for lower-latency motion.
- Increased client input emission frequency for faster steering response.
- Made transient particle and camera smoothing frame-rate-independent instead of assuming fixed frame durations.
- Stopped generating some mobile performance-mode effects that were not rendered anyway.
- Increased backend snapshot cadence from 10 Hz to:
  - 12 Hz for normal rooms
  - 14 Hz for `OFFLINE`

### UI and presentation upgrades

- Added FPS to the in-game metrics display.
- Temporarily disabled ad presentation surfaces so testing is cleaner.
- Added a brighter, more playful title screen inspired by slither-style references.
- Refreshed the lobby, loading flow, post-match hero, auth strip, HUD chips, and room overlays to match that brighter direction.

## Current Gameplay Smoothness Strategy

The current build improves perceived smoothness through:

- Adaptive render delay based on observed snapshot interval, jitter, and latency.
- Local prediction and reconciliation for the controlled snake.
- Adaptive quality tiering through `performance`, `balanced`, and `quality` behavior.
- Mobile-friendly camera scaling and dynamic resolution control.
- Frame-rate-independent transient effect updates.
- Per-viewer snapshot detail profiles to reduce unnecessary segment data.

Important constraint:

- The game is now better prepared for 120 Hz / 144 Hz-capable devices, but a true guaranteed 144 FPS cannot be promised on every phone because display policy, browser/WebView behavior, GPU budget, and thermal throttling can still cap the refresh rate.

## What Changed Most Recently

The latest high-impact changes before this README update were:

- Brighter title screen presentation and title animation refresh.
- Brighter lobby, loading, room overlay, post-match, and HUD chrome.
- Dedicated HUD metric chips for FPS, ping, tick, and player count.
- Lower-latency gameplay interpolation and more frequent input sends.
- Frame-rate-independent camera and effect smoothing.
- Modest server snapshot rate increase for smoother interpolation.
- Fresh Android APK built successfully with those changes.

## Validation Snapshot

The currently revalidated baseline from this session is:

- Frontend production build: passes
- Backend tests: 31/31 passing
- Android debug APK build: passes

Commands used successfully during this phase:

```bash
cd frontend
npm run build
```

```bash
cd ..
npm run test --workspace backend
```

```powershell
cd frontend
npx cap sync android
cd android
.\gradlew.bat --no-daemon assembleDebug
```

Notes:

- Root workspace `npm run typecheck` and full root `npm test` were validated earlier in the repo lifecycle, but were not the primary validation commands in the latest mobile/gameplay pass.
- The Android build in this workspace can fail intermittently if Gradle/JVM daemon state goes bad. Retrying with `--no-daemon` is the current reliable workaround.

## Recommended Local Run Commands

From the repo root:

```bash
npm install
```

Frontend dev server:

```bash
npm run dev --workspace frontend
```

Backend server from the repo root:

```bash
node backend/index.js
```

Backend tests:

```bash
npm run test --workspace backend
```

Frontend build:

```bash
npm run build --workspace frontend
```

Repo-level validation scripts:

```bash
npm run typecheck
npm test
```

Optional backend debug logging on Windows PowerShell:

```powershell
$env:SNAKEY_DEBUG="true"
node backend/index.js
```

## Android Build Workflow

### Build and sync

```bash
cd frontend
npm run build
npx cap sync android
```

### Build debug APK

Recommended in this workspace:

```powershell
cd android
.\gradlew.bat --no-daemon assembleDebug
```

### Current APK output

Latest debug APK path:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

### Android build notes

- Prefer `--no-daemon` when Gradle behaves inconsistently.
- Physical-device networking in this workspace is currently tied to the configured backend URL path described in `frontend/.env.production.local`.
- Emulator-only host assumptions should not override the configured physical-device backend URL.

## Current Frontend Map

- `frontend/src/App.tsx`
  Top-level screen routing and match-end flow.
- `frontend/src/components/TitleScreen.tsx`
  Main menu, animated title canvas, live-ops strip, and primary CTAs.
- `frontend/src/components/Lobby.tsx`
  Match setup, progression hub, auth strip, live pack surface, Skin Lab entry, and post-match summary.
- `frontend/src/components/SkinLabScreen.tsx`
  Dedicated skin customization and cosmetic selection screen.
- `frontend/src/components/GameCanvas.tsx`
  Canvas host, loading state, room overlay, and FPS/ping/tick metrics panel.
- `frontend/src/game/GameManager.ts`
  Client render loop, interpolation, adaptive quality, mobile input, and runtime orchestration.
- `frontend/src/game/Renderer.js`
  World, snakes, effects, HUD, and mobile draw path.
- `frontend/src/game/Network.ts`
  Socket event bridge, state buffering, room status, death summaries, and latency handling.
- `frontend/src/game/ProfileManager.js`
  XP, levels, skins, unlock rules, challenge progression, and daily reward state.
- `frontend/src/game/ModeThemes.ts`
  Frontend mode metadata, preview information, and themed arena descriptions.
- `frontend/src/platform/growthBridge.ts`
  Native bridge usage for growth/ads/auth hooks; ads are currently intentionally disabled for testing.

## Current Backend Map

- `backend/index.js`
  HTTP + Socket.IO bootstrap.
- `backend/game/GameEngine.js`
  Authoritative simulation, snapshots, death handling, bot orchestration, and match summary emission.
- `backend/game/RoomManager.js`
  Managed room lifecycle and ready/countdown/play/reset flow.
- `backend/game/WorldState.js`
  Arena state, serialization, obstacle and hazard data, and per-viewer snapshot shaping.
- `backend/game/BotController.js`
  Bot population logic and offline-vs-online tuning.
- `backend/game/modeConfig.js`
  Mode definitions, map blockers, storm data, and themed arena presets.
- `backend/game/Database.js`
  SQLite persistence for progression/account-related data.

## Important Project Rules

- Skin ids and colors must stay aligned between frontend skin metadata and backend constants.
- If a new themed mode is added, update both frontend mode metadata and backend mode config.
- If a survival obstacle layout changes in the backend, update the frontend arena preview so the selector remains truthful.
- Match-end progression depends on `xpEarned`, `matchKills`, `maxMass`, and death summary context.
- `OFFLINE` is not fully local simulation; it is a private bot-heavy backend room.
- Root README is the canonical handoff doc and should be updated when major work lands.

## Current Known Constraints

- Ads are intentionally disabled right now for cleaner testing.
- Google Sign-In is wired, but wider production verification still depends on full Firebase/Android environment correctness.
- Android packaging can intermittently fail because of Gradle/JVM daemon instability; retry with `--no-daemon`.
- The backend has been validated through tests, but startup in the editor terminal history has shown noisy or ambiguous failures and should be treated carefully during local debugging.
- True universal 144 FPS is not guaranteed across all devices.

## Immediate Next Steps

1. Continue device playtesting for input feel, frame pacing, and camera smoothness on phone hardware.
2. If further smoothness is needed, reduce in-frame draw cost in `frontend/src/game/Renderer.js`, especially HUD, minimap, and effect paths.
3. Continue tuning world colors, snake presentation, and gameplay readability to align more closely with the desired slither-style vibrancy.
4. Keep validating Android builds on physical devices after each gameplay/rendering pass.
5. Improve backend local startup ergonomics so frontend + backend launch is consistently repeatable from a clean shell.

## Related Docs

- `CODE_WALKTHROUGH.md`
  Deeper explanation of the codebase and runtime structure.
- `CODE_ARCHITECTURE_TASKS_UPDATED.md`
  Technical backlog and architecture follow-up tasks.
- `CODE_ARCHITECTURE_TASKS.md`
  Older architecture task notes.
- `DEPLOYMENT.md`
  Deployment notes and environment caveats.

## Resume Here

If work resumes later, start with this sequence:

```bash
npm install
cd frontend
npm run build
cd ..
npm run test --workspace backend
```

If Android packaging is needed immediately after that:

```powershell
cd frontend
npx cap sync android
cd android
.\gradlew.bat --no-daemon assembleDebug
```
