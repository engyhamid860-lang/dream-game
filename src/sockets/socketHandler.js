const gameEngine = require('../engine/gameEngine');

function initSockets(io) {
  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId || 'user_me';
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
    io.to('voice_room_game').emit('round_started', data);
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
}

module.exports = initSockets;
