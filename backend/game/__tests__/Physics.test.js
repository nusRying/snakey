import { describe, it, expect } from 'vitest';
const {
  distance,
  calculateNewAngle,
  updateVelocityFromAngle,
  movePosition,
  isOutOfBounds,
} = require('../Physics');

describe('Physics helpers', () => {
  it('calculates correct distance', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
  });

  it('limits turning correctly', () => {
    const cur = 0;
    const target = Math.PI; // want to turn 180 degrees
    const newAngle = calculateNewAngle(cur, target, 50, 1, 0.1);
    // with dt small, angle should move a little bit
    expect(newAngle).toBeGreaterThan(cur);
    expect(newAngle).toBeLessThan(Math.PI);
  });

  it('updates velocity from angle & speed', () => {
    const vel = { x: 0, y: 0 };
    updateVelocityFromAngle(vel, Math.PI / 2, 10);
    expect(vel.x).toBeCloseTo(0, 5);
    expect(vel.y).toBeCloseTo(10, 5);
  });

  it('moves position based on velocity & dt', () => {
    const pos = { x: 1, y: 2 };
    const vel = { x: 3, y: -1 };
    movePosition(pos, vel, 0.5);
    expect(pos.x).toBeCloseTo(1 + 3 * 0.5);
    expect(pos.y).toBeCloseTo(2 - 1 * 0.5);
  });

  it('detects out-of-bounds correctly', () => {
    const bounds = { width: 100, height: 100 };
    expect(isOutOfBounds({ x: 0, y: 50 }, 5, bounds)).toBe(true);
    expect(isOutOfBounds({ x: 50, y: 50 }, 5, bounds)).toBe(false);
    expect(isOutOfBounds({ x: 96, y: 50 }, 5, bounds)).toBe(true);
  });
});
