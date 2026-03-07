import { describe, it, expect } from 'vitest';

const { WorldState } = require('../WorldState');

describe('WorldState snapshot serialization', () => {
  it('emits compact player snapshots with only network-relevant fields', () => {
    const world = new WorldState();
    world.addPlayer('player-1', { name: 'Alice', baseColor: '#00ffcc', selectedSkin: 'ghost' });

    const player = world.players['player-1'];
    player.position.x = 123.456;
    player.position.y = 987.654;
    player.velocity.x = 12.345;
    player.velocity.y = -6.789;
    player.mass = 50.678;
    player.radius = 17.891;
    player.score = 999;
    player.matchKills = 4;
    player.dbStats = { xp: 5000 };
    player.activePowerUps = { SHIELD: 1234.56 };
    player.segments = [{ x: 1.234, y: 5.678 }];

    const snapshot = world.getSnapshot();
    const serializedPlayer = snapshot.players['player-1'];

    expect(serializedPlayer).toEqual({
      id: 'player-1',
      name: 'Alice',
      skin: 'ghost',
      team: undefined,
      position: { x: 123.5, y: 987.7 },
      velocity: { x: 12.3, y: -6.8 },
      mass: 50.7,
      radius: 17.9,
      segments: [{ x: 1.2, y: 5.7 }],
      isBoosting: false,
      color: '#00ffcc',
      ability: {
        type: expect.any(String),
        isActive: false,
        cooldown: 0,
        maxCooldown: 5000,
        duration: 0,
        maxDuration: 2000,
      },
      activePowerUps: { SHIELD: 1235 },
    });
    expect(serializedPlayer.score).toBeUndefined();
    expect(serializedPlayer.matchKills).toBeUndefined();
    expect(serializedPlayer.dbStats).toBeUndefined();
  });

  it('serializes pellet updates with rounded positions', () => {
    const world = new WorldState();
    world.pelletUpdates = {
      added: [{ id: 1, x: 10.49, y: 20.51, value: 2.2, color: '#fff' }],
      removed: [2],
      moved: [{ id: 3, x: 30.44, y: 40.55 }],
    };

    const update = world.getPelletUpdate();

    expect(update).toEqual({
      added: [{ id: 1, x: 10.5, y: 20.5, value: 2, color: '#fff' }],
      removed: [2],
      moved: [{ id: 3, x: 30.4, y: 40.6 }],
    });
  });

  it('keeps distant players in viewer snapshots as lightweight stubs', () => {
    const world = new WorldState();
    world.addPlayer('viewer', { name: 'Viewer', baseColor: '#00ffcc' });
    world.addPlayer('nearby', { name: 'Nearby', baseColor: '#ff00ff' });
    world.addPlayer('far', { name: 'Far', baseColor: '#ffaa00' });

    world.players.viewer.position = { x: 100, y: 100 };
    world.players.nearby.position = { x: 400, y: 400 };
    world.players.far.position = { x: 2800, y: 2800 };
    world.players.nearby.segments = [{ x: 390, y: 390 }, { x: 380, y: 380 }];
    world.players.far.segments = [{ x: 2790, y: 2790 }, { x: 2780, y: 2780 }];
    world.players.far.activePowerUps = { SHIELD: 1000 };
    world.players.far.ability.isActive = true;

    const snapshot = world.getSnapshotForPlayer('viewer');

    expect(snapshot.players.viewer.segments.length).toBeGreaterThan(0);
    expect(snapshot.players.nearby.segments.length).toBeGreaterThan(0);
    expect(snapshot.players.far.segments).toEqual([]);
    expect(snapshot.players.far.activePowerUps).toEqual({});
    expect(snapshot.players.far.ability.isActive).toBe(false);
    expect(snapshot.players.far.position).toEqual({ x: 2800, y: 2800 });
  });
});