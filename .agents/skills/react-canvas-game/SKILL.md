---
name: React Canvas Game Rendering
description: Best practices for implementing a high-performance 60FPS game loop using HTML5 Canvas within a React application.
---

# React Canvas Game Rendering Skill

When building a high-performance HTML5 Canvas game within React (e.g., a Snake.io clone), follow these critical rules:

## 1. Do NOT use React State for Game State

- React state (`useState`, `setState`) triggers component re-renders. A game running at 60 FPS would cause 60 re-renders per second, which will destroy performance.
- **Rule:** Store all mutable game state (player position, other players, pellets, etc.) in a `useRef` or outside the React component lifecycle (e.g., a vanilla JS module or class instance that the component refs to).

## 2. The Game Loop

- Use `requestAnimationFrame` for the game loop.
- The loop should handle input gathering, state interpolation, and canvas context rendering.
- Ensure the `requestAnimationFrame` is properly cancelled in the `useEffect` cleanup function.

## 3. Canvas Rendering

- Access the canvas via a `useRef`.
- Clear the canvas each frame using `ctx.clearRect(0, 0, width, height)`.
- Use optimized canvas operations. Avoid complex pathways or deeply nested state lookups inside the draw loop.

## 4. Input Handling

- Attach event listeners (keydown, keyup, touchstart, touchmove) inside a `useEffect` with `{ passive: false }` if canceling default behavior is necessary (like preventing scrolling on mobile).
- Store current input state in a ref (e.g., `keys.current.w = true`) so the game loop reads it without re-rendering.
