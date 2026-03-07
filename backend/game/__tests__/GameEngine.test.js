import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../Database', () => ({
  ensureUser: vi.fn().mockResolvedValue(undefined),
  getUser: vi.fn().mockResolvedValue(null),
  saveMatchData: vi.fn().mockResolvedValue({ newXp: 0, newLevel: 1 }),
}));

const { GameEngine } = require('../GameEngine');
const { getModeConfig } = require('../modeConfig');

function createIoMock() {
  const emit = vi.fn();
  return {
    emit,
    io: {
      to: vi.fn().mockReturnValue({ emit }),
    },
  };
}

function createRoomManagerMock(overrides = {}) {
  return {
    state: 'PLAYING',
    getStatus: vi.fn(() => ({ state: 'PLAYING', playerCount: 0, countdownRemainingMs: 0 })),
    checkCountdownExpiry: vi.fn(),
    finishGame: vi.fn(),
    ...overrides,
  };
}

describe('GameEngine managed match flow', () => {
  let ioMock;

  beforeEach(() => {
    ioMock = createIoMock();
  });

  it('resets the managed match when a room transitions into PLAYING', () => {
    const roomManager = createRoomManagerMock({ state: 'COUNTDOWN' });
    roomManager.getStatus.mockImplementation(() => ({
      state: roomManager.state,
      playerCount: 2,
      countdownRemainingMs: roomManager.state === 'PLAYING' ? 0 : 3000,
    }));
    const engine = new GameEngine(ioMock.io, 'BATTLE_ROYALE', roomManager);

    engine.world.addPlayer('player-1', { name: 'Alice', baseColor: '#00ffcc' });
    engine.world.players['player-1'].mass = 320;
    engine.world.players['player-1'].mutationPoints = 3;
    engine.world.players['player-1'].segments = [{ x: 10, y: 10 }];
    engine.world.pellets = {};
    engine.world.pelletIdCounter = 0;
    engine.lastManagedRoomState = 'COUNTDOWN';

    roomManager.state = 'PLAYING';

    const shouldSimulate = engine.syncManagedRoomState();

    expect(shouldSimulate).toBe(true);
    expect(engine.matchState).toBe('PLAYING');
    expect(engine.world.roomState).toBe('PLAYING');
    expect(engine.world.roomStatus).toEqual(
      expect.objectContaining({ state: 'PLAYING', playerCount: 2 })
    );
    expect(engine.world.players['player-1'].mass).toBe(50);
    expect(engine.world.players['player-1'].mutationPoints).toBe(0);
    expect(engine.world.players['player-1'].segments.length).toBe(5);
    expect(Object.keys(engine.world.pellets).length).toBe(
      getModeConfig('BATTLE_ROYALE').world.pelletSpawnCount
    );
  });

  it('emits state without simulating while a managed room is waiting', () => {
    const roomManager = createRoomManagerMock({
      state: 'LOBBY',
      getStatus: vi.fn(() => ({ state: 'LOBBY', playerCount: 1, countdownRemainingMs: 0 })),
    });
    const engine = new GameEngine(ioMock.io, 'BATTLE_ROYALE', roomManager);
    engine.botController.update = vi.fn();

    engine.world.addPlayer('player-1', { name: 'Alice', baseColor: '#00ffcc' });
    const startPosition = { ...engine.world.players['player-1'].position };

    engine.tick(0.05, Date.now());

    expect(engine.botController.update).not.toHaveBeenCalled();
    expect(engine.world.players['player-1'].position).toEqual(startPosition);
    expect(ioMock.emit).toHaveBeenCalledWith('state', expect.any(Object));
  });

  it('finishes a managed battle royale when one player remains alive', () => {
    const roomManager = createRoomManagerMock();
    const engine = new GameEngine(ioMock.io, 'BATTLE_ROYALE', roomManager);
    engine.botController.update = vi.fn();

    engine.world.players = {};
    engine.world.pellets = {};
    engine.world.addPlayer('player-1', { name: 'Winner', baseColor: '#00ffcc' });
    engine.world.players['player-1'].position = { x: 1500, y: 1500 };

    engine.tick(0.05, Date.now());

    expect(roomManager.finishGame).toHaveBeenCalledOnce();
  });

  it('emits a winner and finishes a managed team match at the score target', () => {
    const roomManager = createRoomManagerMock();
    const engine = new GameEngine(ioMock.io, 'TEAM_MATCH', roomManager);
    engine.botController.update = vi.fn();

    engine.world.players = {};
    engine.world.pellets = {};
    engine.world.addPlayer('red-1', { name: 'Red Lead', baseColor: '#ff0000' });
    engine.world.addPlayer('blue-1', { name: 'Blue Lead', baseColor: '#0000ff' });

    engine.world.players['red-1'].team = 'RED';
    engine.world.players['red-1'].mass = 4100;
    engine.world.players['red-1'].position = { x: 900, y: 900 };
    engine.world.players['blue-1'].team = 'BLUE';
    engine.world.players['blue-1'].mass = 100;
    engine.world.players['blue-1'].position = { x: 2100, y: 2100 };

    engine.tick(0.05, Date.now());

    expect(ioMock.emit).toHaveBeenCalledWith(
      'team_match_winner',
      expect.objectContaining({ team: 'RED', score: expect.any(Number) })
    );
    expect(roomManager.finishGame).toHaveBeenCalledOnce();
  });
});