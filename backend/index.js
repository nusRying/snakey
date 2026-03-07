const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GameEngine } = require('./game/GameEngine');
const { RoomManager } = require('./game/RoomManager');
const Database = require('./game/Database');
const { MODE_CONFIGS, DOWNLOADABLE_ARENA_PACKS, getModeConfig } = require('./game/modeConfig');

const app = express();
app.use(cors());
app.use(express.json()); // Allow JSON body parsing

// Health check endpoint for Railway / load balancers
app.get('/', (req, res) => {
  res.json({ status: 'ok', game: 'Snakey IO', uptime: process.uptime() });
});

app.get('/api/content-pack', (req, res) => {
  res.json({
    season: 'Season Pulse // Neon Uprising',
    headline: 'Live arena packs are now staged for cached delivery.',
    briefing:
      'The client now caches live briefing data so featured arena content, seasonal beats, and special playlists can refresh without a full app rebuild.',
    fetchedAt: new Date().toISOString(),
    arenaPacks: [
      {
        id: 'pulse-core',
        name: 'Pulse Core',
        status: 'Cached',
        summary: 'Default competitive playlist with stable room cycling and aggressive pellet pacing.',
      },
      ...DOWNLOADABLE_ARENA_PACKS.map((pack) => ({
        id: pack.id,
        name: pack.mode.name,
        status: 'Downloaded',
        summary: pack.mode.shortDescription,
      })),
    ],
  });
});

app.get('/api/arena-packs', (req, res) => {
  res.json({
    packs: DOWNLOADABLE_ARENA_PACKS.map((pack) => ({
      id: pack.id,
      mode: pack.mode,
    })),
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const managedRoomModes = new Set(
  Object.keys(MODE_CONFIGS).filter((mode) => getModeConfig(mode).managedRoom)
);

function configureRoomManager(roomManager, mode) {
  if (!roomManager) return;
  const config = getModeConfig(mode);
  roomManager.minPlayers = config.room.minPlayers;
  roomManager.maxPlayers = config.room.maxPlayers;
}

function createRoom(mode) {
  const config = getModeConfig(mode);
  const roomManager = managedRoomModes.has(mode)
    ? new RoomManager(io, mode, config.room.maxPlayers)
    : null;
  configureRoomManager(roomManager, mode);
  const engine = new GameEngine(io, mode, roomManager);
  engine.start();
  return { engine, roomManager };
}

// Room Multiplexer
const activeRooms = {
  FFA: createRoom('FFA'),
};

// Map to keep track of which room a socket is in
const playerRooms = new Map();

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('join_game', async (profileData) => {
    // Default to FFA if no mode specified
    const mode = profileData?.mode || 'FFA';

    let room = activeRooms[mode];

    // Lazy load rooms if they don't exist yet but are requested
    if (!room) {
      room = createRoom(mode);
      activeRooms[mode] = room;
    }

    socket.join(mode); // Socket.IO built-in rooms for emitting
    playerRooms.set(socket.id, mode);

    if (room.roomManager) {
      const joinResult = room.roomManager.playerJoin(socket.id, profileData || {});
      if (!joinResult.success) {
        socket.leave(mode);
        playerRooms.delete(socket.id);
        socket.emit('server_error', { message: joinResult.message || 'Unable to join room' });
        return;
      }

      socket.emit('room_status', room.roomManager.getStatus());
    }

    room.engine.addPlayer(socket, profileData);
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const roomId = playerRooms.get(socket.id);
    if (roomId && activeRooms[roomId]) {
      const room = activeRooms[roomId];
      room.engine.removePlayer(socket.id);
      if (room.roomManager) {
        room.roomManager.playerLeave(socket.id);
      }
    }
    playerRooms.delete(socket.id);
  });

  socket.on('input', (data) => {
    const roomId = playerRooms.get(socket.id);
    if (roomId && activeRooms[roomId]) {
      activeRooms[roomId].engine.handleInput(socket.id, data);
    }
  });

  socket.on('player_ready', (payload) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId || !activeRooms[roomId]?.roomManager) return;

    const shouldReady = typeof payload?.ready === 'boolean' ? payload.ready : true;
    activeRooms[roomId].roomManager.setPlayerReady(socket.id, shouldReady);
  });
});

// REST API Routes
app.get('/api/leaderboard', async (req, res) => {
  try {
    const topPlayers = await Database.getLeaderboard();
    res.json(topPlayers);
  } catch (_err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

app.post('/api/analytics/batch', async (req, res) => {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    const saved = await Database.saveAnalyticsEvents(events);
    res.json({ ok: true, saved });
  } catch (error) {
    console.error('Analytics batch failed', error);
    res.status(500).json({ ok: false, error: 'Failed to save analytics events' });
  }
});

app.post('/api/push/register', async (req, res) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const platform = typeof req.body?.platform === 'string' ? req.body.platform.trim() : 'android';
    const playerName = typeof req.body?.playerName === 'string' ? req.body.playerName.trim() : null;

    if (!token) {
      res.status(400).json({ ok: false, error: 'Missing push token' });
      return;
    }

    await Database.savePushToken({ token, platform, playerName });
    res.json({ ok: true });
  } catch (error) {
    console.error('Push token registration failed', error);
    res.status(500).json({ ok: false, error: 'Failed to save push token' });
  }
});

app.post('/api/account/link-google', async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const googleUid = typeof req.body?.googleUid === 'string' ? req.body.googleUid.trim() : '';
    const googleEmail = typeof req.body?.googleEmail === 'string' ? req.body.googleEmail.trim() : null;
    const googlePhotoUrl = typeof req.body?.googlePhotoUrl === 'string' ? req.body.googlePhotoUrl.trim() : null;

    if (!name || !googleUid) {
      res.status(400).json({ ok: false, error: 'Missing name or googleUid' });
      return;
    }

    await Database.linkGoogleAccount({ name, googleUid, googleEmail, googlePhotoUrl });
    res.json({ ok: true });
  } catch (error) {
    console.error('Google account link failed', error);
    res.status(500).json({ ok: false, error: 'Failed to link Google account' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Snake.io Backend listening on port ${PORT}`);
});
