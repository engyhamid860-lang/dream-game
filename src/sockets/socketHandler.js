const gameEngine = require('../engine/gameEngine');
const walletEngine = require('../engine/walletEngine');

function initSockets(io) {
  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId || socket.handshake.query.user_id || 'user_me';
    const userName = socket.handshake.query.userName || socket.handshake.query.username || socket.handshake.query.name || null;
    const initialBalance = socket.handshake.query.balance ? parseInt(socket.handshake.query.balance) : null;

    // Register & sync real user wallet
    walletEngine.initRealUser(userId, userName, initialBalance);

    console.log(`🔌 لاعب متصل باللعبة: ${socket.id} (المستخدم: ${userId})`);

    // Join room for real-time game broadcasts
    socket.join('voice_room_game');

    // Send initial state on connection
    socket.emit('round_started', gameEngine.getRoundState(userId));

    // Handle client bet request via Socket
    socket.on('place_bet', (data, callback) => {
      try {
        const { character, amount, userName, userAvatar } = data;
        const result = gameEngine.placeBet(userId, character, amount, userName, userAvatar);

        if (typeof callback === 'function') {
          callback({ success: true, data: result });
        }
      } catch (err) {
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message });
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ انقطع اتصال اللاعب: ${socket.id}`);
    });
  });

  // Forward Game Engine events to all sockets in room
  gameEngine.on('round_started', (data) => {
    // Send customized round_started to each socket with their specific user balance
    const sockets = io.sockets.sockets;
    if (sockets && sockets.size > 0) {
      sockets.forEach((s) => {
        const sUserId = s.handshake.query.userId || s.handshake.query.user_id || 'user_me';
        s.emit('round_started', gameEngine.getRoundState(sUserId));
      });
    } else {
      io.to('voice_room_game').emit('round_started', data);
    }
  });

  gameEngine.on('countdown_updated', (data) => {
    io.to('voice_room_game').emit('countdown_updated', data);
  });

  gameEngine.on('bet_placed', (data) => {
    io.to('voice_room_game').emit('bet_placed', data);
  });

  gameEngine.on('betting_closed', (data) => {
    io.to('voice_room_game').emit('betting_closed', data);
  });

  gameEngine.on('winner_selected', (data) => {
    io.to('voice_room_game').emit('winner_selected', data);
  });

  gameEngine.on('winner_revealed', (data) => {
    io.to('voice_room_game').emit('winner_revealed', data);
  });

  gameEngine.on('player_won', (data) => {
    io.to('voice_room_game').emit('player_won', data);
  });

  gameEngine.on('round_finished', (data) => {
    io.to('voice_room_game').emit('round_finished', data);
  });

  gameEngine.on('bg_changed', (data) => {
    io.to('voice_room_game').emit('bg_changed', data);
  });

  gameEngine.on('layout_changed', (data) => {
    io.to('voice_room_game').emit('layout_changed', data);
  });
}

module.exports = initSockets;
