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

// Prevent browser caching of static files
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

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

const PORT = process.env.PORT || process.env.ALWAYSDATA_HTTPD_PORT || 3000;
const HOST = process.env.IP || process.env.ALWAYSDATA_HTTPD_IP || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Game server running on ${HOST}:${PORT}`);

  // Start authoritative game loop
  gameEngine.start();
});
