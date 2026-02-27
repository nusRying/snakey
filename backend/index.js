const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GameEngine } = require('./game/GameEngine');
const Database = require('./game/Database');

const app = express();
app.use(cors());
app.use(express.json()); // Allow JSON body parsing

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

// Room Multiplexer
const activeRooms = {
    'FFA': new GameEngine(io, 'FFA'),
    // Add more rooms here later
};

// Start all initial rooms
for (const room in activeRooms) {
    activeRooms[room].start();
}

// Map to keep track of which room a socket is in
const playerRooms = new Map();

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('join_game', async (profileData) => {
      // Default to FFA if no mode specified
      const mode = profileData?.mode || 'FFA';
      
      let engine = activeRooms[mode];
      
      // Lazy load rooms if they don't exist yet but are requested
      if (!engine) {
          engine = new GameEngine(io, mode);
          engine.start();
          activeRooms[mode] = engine;
      }
      
      socket.join(mode); // Socket.IO built-in rooms for emitting
      playerRooms.set(socket.id, mode);
      
      engine.addPlayer(socket, profileData);
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const roomId = playerRooms.get(socket.id);
    if (roomId && activeRooms[roomId]) {
        activeRooms[roomId].removePlayer(socket.id);
    }
    playerRooms.delete(socket.id);
  });
  
  socket.on('input', (data) => {
    const roomId = playerRooms.get(socket.id);
    if (roomId && activeRooms[roomId]) {
        activeRooms[roomId].handleInput(socket.id, data);
    }
  });
});

// REST API Routes
app.get('/api/leaderboard', async (req, res) => {
    try {
        const topPlayers = await Database.getLeaderboard();
        res.json(topPlayers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Snake.io Backend listening on port ${PORT}`);
});
