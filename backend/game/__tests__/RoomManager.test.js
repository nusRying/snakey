import { describe, it, expect, vi, beforeEach } from 'vitest';
const { RoomManager } = require('../RoomManager');

describe('RoomManager', () => {
  let roomManager;
  let mockIo;

  beforeEach(() => {
    mockIo = {
      to: vi.fn().mockReturnValue({
        emit: vi.fn(),
      }),
    };
    roomManager = new RoomManager(mockIo, 'test-room', 10);
  });

  it('initializes with correct state', () => {
    expect(roomManager.state).toBe('LOBBY');
    expect(roomManager.players.size).toBe(0);
    expect(roomManager.queue.length).toBe(0);
  });

  it('adds player to room when not full', () => {
    const result = roomManager.playerJoin('player1', { name: 'Alice' });
    expect(result.success).toBe(true);
    expect(roomManager.players.size).toBe(1);
  });

  it('queues player when room is full', () => {
    // Fill the room
    for (let i = 0; i < 10; i++) {
      roomManager.playerJoin(`player${i}`, { name: `Player${i}` });
    }

    // Next player goes to queue
    const result = roomManager.playerJoin('player10', { name: 'Overflow' });
    expect(result.queued).toBe(true);
    expect(roomManager.queue.length).toBe(1);
  });

  it('removes player from room', () => {
    roomManager.playerJoin('player1', { name: 'Alice' });
    expect(roomManager.players.size).toBe(1);

    roomManager.playerLeave('player1');
    expect(roomManager.players.size).toBe(0);
  });

  it('returns to LOBBY when last player leaves', () => {
    roomManager.playerJoin('player1', { name: 'Alice' });
    roomManager.state = 'COUNTDOWN';

    roomManager.playerLeave('player1');
    expect(roomManager.state).toBe('LOBBY');
  });

  it('moves queued player to room when a slot opens', () => {
    // Fill room
    for (let i = 0; i < 3; i++) {
      roomManager.playerJoin(`player${i}`, { name: `Player${i}` });
    }
    roomManager.maxPlayers = 3;

    // Queue a player
    roomManager.playerJoin('player3', { name: 'Queued' });
    expect(roomManager.queue.length).toBe(1);

    // Remove a player
    roomManager.playerLeave('player0');

    // Queued player should now be in the room
    expect(roomManager.queue.length).toBe(0);
    expect(roomManager.players.has('player3')).toBe(true);
  });

  it('starts countdown when min players joined and ready', () => {
    roomManager.minPlayers = 2;
    roomManager.playerJoin('player1', { name: 'Alice' });
    roomManager.playerJoin('player2', { name: 'Bob' });

    roomManager.playerReady('player1');
    expect(roomManager.state).toBe('LOBBY');

    roomManager.playerReady('player2');
    expect(roomManager.state).toBe('COUNTDOWN');
  });

  it('cancels countdown if a player leaves', () => {
    roomManager.minPlayers = 2;
    roomManager.playerJoin('player1', { name: 'Alice' });
    roomManager.playerJoin('player2', { name: 'Bob' });
    roomManager.playerReady('player1');
    roomManager.playerReady('player2');

    expect(roomManager.state).toBe('COUNTDOWN');

    roomManager.playerLeave('player1');
    expect(roomManager.state).toBe('LOBBY');
  });

  it('gets accurate room status', () => {
    roomManager.playerJoin('player1', { name: 'Alice' });

    const status = roomManager.getStatus();
    expect(status.state).toBe('LOBBY');
    expect(status.playerCount).toBe(1);
    expect(status.readyCount).toBe(0);
    expect(status.maxPlayers).toBe(10);
    expect(status.queueLength).toBe(0);
  });

  it('gets player list with ready status', () => {
    roomManager.playerJoin('player1', { name: 'Alice' });
    roomManager.playerJoin('player2', { name: 'Bob' });
    roomManager.playerReady('player1');

    const playerList = roomManager.getPlayerList();
    expect(playerList.length).toBe(2);
    expect(playerList[0].ready).toBe(true);
    expect(playerList[1].ready).toBe(false);
  });

  it('transitions to PLAYING when countdown expires', () => {
    roomManager.minPlayers = 1;
    roomManager.countdownTime = 100; // short countdown for testing
    roomManager.playerJoin('player1', { name: 'Alice' });
    roomManager.playerReady('player1');

    expect(roomManager.state).toBe('COUNTDOWN');

    // Simulate countdown expiry
    roomManager.countdownStartedAt = Date.now() - 150;
    const result = roomManager.checkCountdownExpiry();

    expect(result).toBe(true);
    expect(roomManager.state).toBe('PLAYING');
  });

  it('clears ready state and exposes a reset timer after a match ends', () => {
    roomManager.playerJoin('player1', { name: 'Alice' });
    roomManager.playerJoin('player2', { name: 'Bob' });
    roomManager.playerReady('player1');
    roomManager.playerReady('player2');
    roomManager.state = 'PLAYING';
    roomManager.gameStartedAt = Date.now() - 4000;

    roomManager.finishGame();

    const status = roomManager.getStatus();
    expect(status.state).toBe('FINISHED');
    expect(status.readyCount).toBe(0);
    expect(status.resetRemainingMs).toBeGreaterThan(0);
    expect(roomManager.players.get('player1').ready).toBe(false);
  });
});
