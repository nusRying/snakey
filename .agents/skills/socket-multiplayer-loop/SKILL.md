---
name: Socket Multiplayer Loop
description: Best practices for implementing client-server sync, fixed timestep loops, interpolation, and lag compensation.
---

# Socket Multiplayer Loop Architecture

To build a real-time multiplayer snake game with Socket.io, adhere strictly to these principles:

## 1. Server-Authoritative State

- The backend Node.js server maintains the absolute source of truth (the position, mass, and state of all players and pellets).
- **The Game Loop:** Run a fixed-timestep game loop using `setInterval` (e.g., 20 ticks per second, `50ms` delay).
- In every tick, process inputs, resolve collisions, update positions, and broadcast the state to all connected clients.

## 2. Spatial Partitioning for Performance

- With many pellets and body segments, naive `O(N^2)` collision checks will crash the server.
- Implement a Grid-based spatial hash or a QuadTree to quickly check local collisions (head vs. bodies, head vs. pellets).

## 3. Client Interpolation

- Because the server broadcasts at a low tick rate (20Hz) but the client renders at 60Hz, rendering raw server coordinates will look jagged and stuttery.
- **Solution:** The client holds a buffer of recent server snapshots. It renders the game state interpolating between the last two snapshots, adding a slight artificial delay (e.g., 100ms) to ensure smooth playback.

## 4. Input Prediction (Client-Side)

- When the local player moves or boosts, they should not wait for the server round-trip to see their snake turn.
- The client applies local inputs immediately to the camera and local snake visual representation.
- When the server snapshot arrives, the client corrects the local snake's position smoothly if it deviated from the server's truth.
