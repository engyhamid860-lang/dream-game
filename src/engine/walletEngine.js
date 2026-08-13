const { v4: uuidv4 } = require('uuid');

class WalletEngine {
  constructor() {
    // Real connected players balances
    this.balances = new Map([
      ['user_me', { id: 'user_me', name: 'أنت (اللاعب)', avatar: '👤', balance: 150000 }]
    ]);

    // Ledger to ensure idempotency and transaction audit
    this.transactions = new Map(); // key -> transaction obj
  }

  initRealUser(userId, name = null, initialBalance = null) {
    if (!this.balances.has(userId)) {
      this.balances.set(userId, {
        id: userId,
        name: name || `لاعب ${userId.slice(-4)}`,
        avatar: '👤',
        balance: (initialBalance !== null && !isNaN(initialBalance) && initialBalance >= 0) ? initialBalance : 150000
      });
    } else {
      const user = this.balances.get(userId);
      if (initialBalance !== null && !isNaN(initialBalance) && initialBalance >= 0) {
        user.balance = initialBalance;
      }
      if (name) user.name = name;
    }
    return this.balances.get(userId);
  }

  getUser(userId) {
    if (!this.balances.has(userId)) {
      return this.initRealUser(userId);
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
