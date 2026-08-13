const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const path = require('path');

const apiRoutes = require('./src/routes/apiRoutes');
const gameEngine = require('./src/engine/gameEngine');
const initSockets = require('./src/sockets/socketHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', apiRoutes);

// Socket.IO Setup
initSockets(io);

// Admin Control Panel Route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Catch-all route to serve main game UI
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🎮 لعبة الحلم والبرق والنار تعمل الآن على البورت ${PORT}`);
  console.log(`=======================================================`);

  // Start authoritative game loop
  gameEngine.start();
});
