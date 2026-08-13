const { v4: uuidv4 } = require('uuid');

class WalletEngine {
  constructor() {
    // Initial demo players with balances
    this.balances = new Map([
      ['user_me', { id: 'user_me', name: 'أنت (اللاعب)', avatar: '👤', balance: 150000 }],
      ['user_ahmed', { id: 'user_ahmed', name: 'أحمد', avatar: '👨‍🦱', balance: 500000 }],
      ['user_mohamed', { id: 'user_mohamed', name: 'محمد', avatar: '🧔', balance: 350000 }],
      ['user_ali', { id: 'user_ali', name: 'علي', avatar: '👨‍🦰', balance: 420000 }],
      ['user_sara', { id: 'user_sara', name: 'سارة', avatar: '👩', balance: 280000 }]
    ]);

    // Ledger to ensure idempotency and transaction audit
    this.transactions = new Map(); // key -> transaction obj
  }

  getUser(userId) {
    if (!this.balances.has(userId)) {
      this.balances.set(userId, {
        id: userId,
        name: `لاعب ${userId.slice(0, 4)}`,
        avatar: '👤',
        balance: 100000
      });
    }
    return this.balances.get(userId);
  }

  getBalance(userId) {
    const user = this.getUser(userId);
    return user.balance;
  }

  deposit(userId, amount) {
    if (amount <= 0) throw new Error('مبلغ الإيداع يجب أن يكون أكبر من صفر');
    const user = this.getUser(userId);
    user.balance += amount;
    return user.balance;
  }

  /**
   * Deduct bet amount idempotently
   */
  placeBet(userId, roundId, character, amount, idempotencyKey) {
    const key = `bet_${userId}_${roundId}_${idempotencyKey || uuidv4()}`;
    if (this.transactions.has(key)) {
      return this.transactions.get(key);
    }

    const user = this.getUser(userId);
    if (user.balance < amount) {
      throw new Error('الرصيد غير كافٍ لتنفيذ الرهان');
    }

    user.balance -= amount;
    const tx = {
      id: key,
      userId,
      roundId,
      type: 'BET',
      character,
      amount,
      balanceAfter: user.balance,
      timestamp: new Date().toISOString()
    };
    this.transactions.set(key, tx);
    return tx;
  }

  /**
   * Credit winning amount idempotently
   */
  payoutWin(userId, roundId, character, winAmount, idempotencyKey) {
    const key = `payout_${userId}_${roundId}_${idempotencyKey || uuidv4()}`;
    if (this.transactions.has(key)) {
      return this.transactions.get(key);
    }

    const user = this.getUser(userId);
    user.balance += winAmount;
    const tx = {
      id: key,
      userId,
      roundId,
      type: 'PAYOUT',
      character,
      amount: winAmount,
      balanceAfter: user.balance,
      timestamp: new Date().toISOString()
    };
    this.transactions.set(key, tx);
    return tx;
  }

  getAllUsers() {
    return Array.from(this.balances.values());
  }
}

module.exports = new WalletEngine();
