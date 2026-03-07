// RoomManager: handles room lifecycle, matchmaking, and lobby flow
//
// Responsibilities:
// - Maintain room state (LOBBY, COUNTDOWN, PLAYING, FINISHED)
// - Handle player queue and matchmaking
// - Manage countdown timers
// - Notify clients of state changes

class RoomManager {
  constructor(io, roomId, maxPlayers = 50) {
    this.io = io;
    this.roomId = roomId;
    this.maxPlayers = maxPlayers;

    // Room state: LOBBY -> COUNTDOWN -> PLAYING -> FINISHED -> LOBBY
    this.state = 'LOBBY';
    this.players = new Map(); // playerId -> { name, profile, joinedAt }
    this.queue = []; // players waiting to join
    this.countdownTime = 5000; // 5 seconds to start after min players
    this.resetDelayMs = 10000;
    this.minPlayers = 2;
    this.countdownStartedAt = null;
    this.gameStartedAt = null;
    this.resetAt = null;
  }

  getReadyCount() {
    return Array.from(this.players.values()).filter((p) => p.ready).length;
  }

  resetReadyStates() {
    for (const player of this.players.values()) {
      player.ready = false;
    }
  }

  broadcastStatus() {
    this.io.to(this.roomId).emit('room_status', this.getStatus());
  }

  /**
   * Player attempts to join the room
   */
  playerJoin(playerId, profile) {
    if (this.players.has(playerId)) {
      return { success: false, message: 'Already in room' };
    }

    if (this.players.size >= this.maxPlayers) {
      this.queue.push({ playerId, profile });
      return { success: false, message: 'Room full, added to queue', queued: true };
    }

    this.players.set(playerId, {
      id: playerId,
      name: profile.name,
      profile,
      joinedAt: Date.now(),
      ready: false,
    });

    this.checkCountdown();
    this.broadcastStatus();
    return { success: true, state: this.state };
  }

  /**
   * Player leaves the room (disconnect or abandon)
   */
  playerLeave(playerId) {
    if (!this.players.has(playerId)) return;

    this.players.delete(playerId);

    // If room empties, reset to LOBBY
    if (this.players.size === 0) {
      this.state = 'LOBBY';
      this.countdownStartedAt = null;
      this.gameStartedAt = null;
      this.resetAt = null;
    }

    // Re-evaluate countdown state (may need to cancel if player requirements no longer met)
    this.checkCountdown();

    // Check if someone from queue can join
    if (this.queue.length > 0 && this.players.size < this.maxPlayers) {
      const { playerId: queuedId, profile } = this.queue.shift();
      this.playerJoin(queuedId, profile);
    }

    this.broadcastStatus();
  }

  /**
   * Mark player as ready (can trigger countdown)
   */
  playerReady(playerId) {
    return this.setPlayerReady(playerId, true);
  }

  setPlayerReady(playerId, ready = true) {
    if (!this.players.has(playerId)) return false;
    if (this.state === 'PLAYING') return false;

    const player = this.players.get(playerId);
    player.ready = Boolean(ready);

    this.checkCountdown();
    this.broadcastStatus();
    return true;
  }

  /**
   * Check if we should start/cancel countdown based on current state
   */
  checkCountdown() {
    const readyCount = this.getReadyCount();

    if (this.state === 'LOBBY') {
      // Check if we should start countdown
      if (this.players.size >= this.minPlayers && readyCount >= this.minPlayers) {
        // Start countdown if not already started
        if (!this.countdownStartedAt) {
          this.countdownStartedAt = Date.now();
          this.state = 'COUNTDOWN';
          this.resetAt = null;
          this.io.to(this.roomId).emit('room_countdown_start', {
            duration: this.countdownTime,
            playersJoined: this.players.size,
          });
          this.broadcastStatus();
        }
      }
    } else if (this.state === 'COUNTDOWN') {
      // Check if countdown should be cancelled
      if (this.players.size < this.minPlayers || readyCount < this.minPlayers) {
        // Cancel countdown if requirements no longer met
        this.countdownStartedAt = null;
        this.state = 'LOBBY';
        this.io.to(this.roomId).emit('room_countdown_cancelled');
        this.broadcastStatus();
      }
    }
  }

  /**
   * Check if countdown is complete; transition to PLAYING
   */
  checkCountdownExpiry() {
    if (this.state !== 'COUNTDOWN' || !this.countdownStartedAt) return false;

    const elapsed = Date.now() - this.countdownStartedAt;
    if (elapsed >= this.countdownTime) {
      this.state = 'PLAYING';
      this.gameStartedAt = Date.now();
      this.countdownStartedAt = null;
      this.resetAt = null;
      this.io.to(this.roomId).emit('room_game_start', {
        timestamp: this.gameStartedAt,
        players: this.getPlayerList(),
      });
      this.broadcastStatus();
      return true;
    }

    return false;
  }

  /**
   * Room finished: declare winner and transition back to LOBBY after delay
   */
  finishGame() {
    this.state = 'FINISHED';
    this.countdownStartedAt = null;
    this.resetReadyStates();
    this.resetAt = Date.now() + this.resetDelayMs;
    this.io.to(this.roomId).emit('room_game_finished', {
      duration: Date.now() - this.gameStartedAt,
      resetDelayMs: this.resetDelayMs,
    });
    this.broadcastStatus();

    // Transition back to LOBBY after 10 seconds
    setTimeout(() => {
      if (this.state === 'FINISHED') {
        this.state = 'LOBBY';
        this.countdownStartedAt = null;
        this.gameStartedAt = null;
        this.resetAt = null;
        this.checkCountdown();
        this.io.to(this.roomId).emit('room_reset');
        this.broadcastStatus();
      }
    }, this.resetDelayMs);
  }

  /**
   * Get current room status
   */
  getStatus() {
    return {
      state: this.state,
      minPlayers: this.minPlayers,
      playerCount: this.players.size,
      maxPlayers: this.maxPlayers,
      readyCount: this.getReadyCount(),
      queueLength: this.queue.length,
      countdownRemainingMs: this.countdownStartedAt
        ? Math.max(0, this.countdownTime - (Date.now() - this.countdownStartedAt))
        : 0,
      resetRemainingMs: this.resetAt ? Math.max(0, this.resetAt - Date.now()) : 0,
      countdownStartedAt: this.countdownStartedAt,
      gameStartedAt: this.gameStartedAt,
      players: this.getPlayerList(),
    };
  }

  /**
   * Get list of active players
   */
  getPlayerList() {
    return Array.from(this.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
    }));
  }
}

module.exports = { RoomManager };
