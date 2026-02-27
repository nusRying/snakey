---
name: Advanced Snake Mechanics
description: Guidelines for analog movement, mass-based growth, and smooth visual representations.
---

# Advanced Snake Mechanics (Snake.io Style)

## 1. Movement and Turning

- Do not use 4-directional grid movement.
- **Velocity Vector:** Movement should be determined by an angle and a speed.
- Turn rate should be capped. When a player moves their mouse or joystick in a new direction, the snake's heading angle should gradually interpolate toward the target angle to create momentum and wide arcs.

## 2. Segments & Following Logic

- The snake is a series of nodes (segments).
- The head moves based on the velocity vector.
- **IK / Follow Mechanics:** Each subsequent body segment follows the position of the segment directly in front of it.
- Ensure a minimum distance is maintained between segments so they don't bunch up. If the distance exceeds a target segment length, the segment moves linearly toward the previous segment.

## 3. Mass and Growth

- Snake length is a visually smoothed representation of its mass score.
- When consuming a pellet, increase mass instantly, but visually add body segments gradually over several frames.
- **Boost Mechanics:** When boosting, deduct mass from the player continuously and decrease their length gracefully. Dropped mass should spawn as specialized high-value pellets behind their tail.

## 4. Death & Explosions

- When a head collides with another snake's body or the arena boundary, the snake dies.
- Remove the player from the active array and spawn numerous pellet entities corresponding to their mass at the exact positions of their former body segments.
