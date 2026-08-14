const EventEmitter = require('events');
const walletEngine = require('./walletEngine');
const { v4: uuidv4 } = require('uuid');

class GameEngine extends EventEmitter {
  constructor() {
    super();

    this.roundId = 101;
    this.status = 'WAITING'; // WAITING, BETTING, BETTING_CLOSED, DRAWING, RESULT, PAYOUT, NEXT_ROUND
    this.timer = 10;
    this.timerInterval = null;

    this.characterMultipliers = {
      dream: 10,
      lightning: 2,
      fire: 2
    };

    this.bets = [];
    this.userBets = new Map(); // userId -> { dream, lightning, fire }
    this.characterTotals = { dream: 0, lightning: 0, fire: 0 };
    this.currentWinner = null;
    this.winnersList = [];

    // History and statistics
    this.roundHistory = [
      { roundId: 100, winner: 'fire', timestamp: new Date(Date.now() - 300000).toISOString() },
      { roundId: 99, winner: 'lightning', timestamp: new Date(Date.now() - 600000).toISOString() },
      { roundId: 98, winner: 'dream', timestamp: new Date(Date.now() - 900000).toISOString() },
      { roundId: 97, winner: 'fire', timestamp: new Date(Date.now() - 1200000).toISOString() },
      { roundId: 96, winner: 'lightning', timestamp: new Date(Date.now() - 1500000).toISOString() }
    ];

    this.stats = {
      dream: 12,
      lightning: 25,
      fire: 19
    };

    this.forcedNextWinner = null;
    this.customBgUrl = '/assets/game_bg.jpg';
    
    // Layout customization options (حجم العجلة، الصورة، التمركز، والعد التنازلي)
    this.wheelLayout = {
      canvasSize: 60.5,
      canvasTop: 44.3,
      frameSize: 100.0,
      frameTop: 0.0,
      frameLeft: 0.0,
      frameUrl: '/assets/wheel_frame.png',
      medallionRadius: 39,
      sliceGap: 6.8,
      sliceFontSize: 16,
      gapWheelResults: -16,
      gapResultsCards: 2,
      gapCardsChips: 2,
      repeatBtnRight: 14,
      repeatBtnBottom: 28,
      slices: [
        { char: 'dream' },
        { char: 'lightning' },
        { char: 'fire' },
        { char: 'lightning' },
        { char: 'fire' },
        { char: 'lightning' }
      ]
    };
  }

  setWheelLayout(layout) {
    this.wheelLayout = { ...this.wheelLayout, ...layout };
    this.emit('layout_changed', this.wheelLayout);
    return this.wheelLayout;
  }

  setBackgroundUrl(url) {
    this.customBgUrl = url;
    this.emit('bg_changed', { bgUrl: this.customBgUrl });
    return this.customBgUrl;
  }

  start() {
    this.startNewRound();
  }

  startNewRound() {
    this.roundId += 1;
    this.status = 'BETTING';
    this.BETTING_TIME = 10; // 10 seconds betting window
    this.timer = this.BETTING_TIME;
    this.bets = [];
    this.userBets.clear();
    this.characterTotals = { dream: 0, lightning: 0, fire: 0 };
    this.currentWinner = null;
    this.winnersList = [];

    this.emit('round_started', this.getRoundState());

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => this.tick(), 1000);
  }

  tick() {
    if (this.timer > 0) {
      this.timer -= 1;
      this.emit('countdown_updated', { roundId: this.roundId, timer: this.timer });
    } else {
      clearInterval(this.timerInterval);
      this.closeBetting();
    }
  }

  placeBet(userId, character, amount, userName = null, userAvatar = null) {
    if (this.status !== 'BETTING' || this.timer <= 0) {
      throw new Error('الرهانات مغلقة لهذه الجولة');
    }

    if (!['dream', 'lightning', 'fire'].includes(character)) {
      throw new Error('الشخصية المختارة غير صالحة');
    }

    if (!amount || amount <= 0) {
      throw new Error('قيمة الرهان غير صالحة');
    }

    const user = walletEngine.getUser(userId);
    const name = userName || user.name;
    const avatar = userAvatar || user.avatar;

    // Deduct balance on server
    const tx = walletEngine.placeBet(userId, this.roundId, character, amount);

    const betRecord = {
      id: tx.id,
      userId,
      userName: name,
      avatar,
      character,
      amount,
      roundId: this.roundId,
      timestamp: new Date().toISOString()
    };

    this.bets.push(betRecord);

    // Update character totals
    this.characterTotals[character] += amount;

    // Update user specific bet summary
    if (!this.userBets.has(userId)) {
      this.userBets.set(userId, { dream: 0, lightning: 0, fire: 0 });
    }
    const userTotals = this.userBets.get(userId);
    userTotals[character] += amount;

    const payload = {
      bet: betRecord,
      characterTotals: this.characterTotals,
      userBets: userTotals,
      newBalance: walletEngine.getBalance(userId)
    };

    this.emit('bet_placed', payload);
    return payload;
  }

  closeBetting() {
    this.status = 'BETTING_CLOSED';
    this.emit('betting_closed', { roundId: this.roundId });

    setTimeout(() => {
      this.drawWinner();
    }, 1000);
  }

  drawWinner() {
    this.status = 'DRAWING';

    // Server authoritative choice (or admin forced override):
    let winner = 'lightning';
    if (this.forcedNextWinner && ['dream', 'lightning', 'fire'].includes(this.forcedNextWinner)) {
      winner = this.forcedNextWinner;
      console.log(`👑 [ADMIN] Target winner forced by admin override: ${winner}`);
      this.forcedNextWinner = null;
    } else {
      // Dream (x10): 15% probability
      // Lightning (x2): 42.5% probability
      // Fire (x2): 42.5% probability
      const rand = Math.random();
      if (rand < 0.15) {
        winner = 'dream';
      } else if (rand < 0.575) {
        winner = 'lightning';
      } else {
        winner = 'fire';
      }
    }

    this.currentWinner = winner;
    this.emit('winner_selected', { roundId: this.roundId, winner: this.currentWinner });

    // Duration of winner selector animation client-side: 2.5 seconds
    setTimeout(() => {
      this.processPayouts();
    }, 2500);
  }

  processPayouts() {
    this.status = 'PAYOUT';
    const multiplier = this.characterMultipliers[this.currentWinner];
    const winnersMap = new Map(); // userId -> winner object

    for (const bet of this.bets) {
      if (bet.character === this.currentWinner) {
        const payout = bet.amount * multiplier;
        walletEngine.payoutWin(bet.userId, this.roundId, this.currentWinner, payout, bet.id);

        if (!winnersMap.has(bet.userId)) {
          winnersMap.set(bet.userId, {
            userId: bet.userId,
            userName: bet.userName,
            avatar: bet.avatar,
            character: this.currentWinner,
            totalBet: 0,
            payout: 0,
            multiplier
          });
        }
        const w = winnersMap.get(bet.userId);
        w.totalBet += bet.amount;
        w.payout += payout;
      }
    }

    this.winnersList = Array.from(winnersMap.values()).sort((a, b) => b.payout - a.payout);

    // Save to history & stats
    this.roundHistory.unshift({
      roundId: this.roundId,
      winner: this.currentWinner,
      timestamp: new Date().toISOString()
    });
    if (this.roundHistory.length > 50) this.roundHistory.pop();

    this.stats[this.currentWinner] = (this.stats[this.currentWinner] || 0) + 1;

    this.status = 'RESULT';
    this.emit('winner_revealed', {
      roundId: this.roundId,
      winner: this.currentWinner,
      multiplier,
      winners: this.winnersList,
      history: this.roundHistory,
      stats: this.getStatsFormatted()
    });

    // Notify individual users if they won
    for (const winnerInfo of this.winnersList) {
      this.emit('player_won', {
        userId: winnerInfo.userId,
        payout: winnerInfo.payout,
        character: winnerInfo.character,
        newBalance: walletEngine.getBalance(winnerInfo.userId)
      });
    }

    // Wait 6 seconds before starting next round
    setTimeout(() => {
      this.status = 'NEXT_ROUND';
      this.emit('round_finished', { roundId: this.roundId });
      setTimeout(() => {
        this.startNewRound();
      }, 1000);
    }, 6000);
  }

  getStatsFormatted() {
    const total = (this.stats.dream || 0) + (this.stats.lightning || 0) + (this.stats.fire || 0) || 1;
    return {
      counts: { ...this.stats },
      percentages: {
        dream: Math.round(((this.stats.dream || 0) / total) * 100),
        lightning: Math.round(((this.stats.lightning || 0) / total) * 100),
        fire: Math.round(((this.stats.fire || 0) / total) * 100)
      }
    };
  }

  getRoundState(userId = 'user_me') {
    const userTotals = this.userBets.get(userId) || { dream: 0, lightning: 0, fire: 0 };
    return {
      roundId: this.roundId,
      status: this.status,
      timer: this.timer,
      multipliers: this.characterMultipliers,
      characterTotals: this.characterTotals,
      userBets: userTotals,
      currentWinner: this.currentWinner,
      winners: this.winnersList,
      userBalance: walletEngine.getBalance(userId),
      bgUrl: this.customBgUrl,
      stats: this.getStatsFormatted(),
      history: this.roundHistory,
      wheelLayout: this.wheelLayout
    };
  }

  getUserBetsHistory(userId) {
    const userBetsHistory = [];
    for (const round of this.roundHistory) {
      // Find bets by user in this round
      const betsInRound = this.bets.filter(b => b.userId === userId && b.roundId === round.roundId);
      if (betsInRound.length > 0) {
        let totalBet = 0;
        betsInRound.forEach(b => totalBet += b.amount);
        const char = betsInRound[0].character;
        const won = char === round.winner;
        const multiplier = this.characterMultipliers[char];
        const profit = won ? (totalBet * multiplier) : 0;
        userBetsHistory.push({
          roundId: round.roundId,
          character: char,
          totalBet,
          won,
          profit,
          timestamp: round.timestamp
        });
      }
    }
    return userBetsHistory;
  }
}

module.exports = new GameEngine();
