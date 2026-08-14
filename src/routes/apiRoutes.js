const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const gameEngine = require('../engine/gameEngine');
const walletEngine = require('../engine/walletEngine');

// Multer storage setup for local background and frame image uploads
const uploadDir = path.join(__dirname, '..', '..', 'public', 'assets', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// 1. Get current round information
router.get('/game/round/current', (req, res) => {
  const userId = req.query.userId || 'user_me';
  res.json({
    success: true,
    data: gameEngine.getRoundState(userId)
  });
});

// 2. Start / Restart round manually if needed
router.post('/game/round/start', (req, res) => {
  if (gameEngine.status === 'WAITING' || gameEngine.status === 'NEXT_ROUND') {
    gameEngine.startNewRound();
  }
  res.json({
    success: true,
    message: 'تم بدء الجولة بنجاح',
    data: gameEngine.getRoundState()
  });
});

// 3. Place bet
router.post('/game/bet', (req, res) => {
  try {
    const { userId = 'user_me', character, amount, userName, userAvatar } = req.body;

    if (!character || !amount) {
      return res.status(400).json({ success: false, error: 'يرجى تحديد الشخصية ومبلغ الرهان' });
    }

    const result = gameEngine.placeBet(userId, character, parseInt(amount), userName, userAvatar);

    res.json({
      success: true,
      message: `تم وضع رهان ${amount} على ${character}`,
      data: result
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// 4. Get round status
router.get('/game/round/status', (req, res) => {
  res.json({
    success: true,
    data: {
      roundId: gameEngine.roundId,
      status: gameEngine.status,
      timer: gameEngine.timer,
      characterTotals: gameEngine.characterTotals
    }
  });
});

// 5. Get round result
router.get('/game/round/result', (req, res) => {
  res.json({
    success: true,
    data: {
      roundId: gameEngine.roundId,
      status: gameEngine.status,
      winner: gameEngine.currentWinner,
      winners: gameEngine.winnersList
    }
  });
});

// 6. Round history
router.get('/game/history', (req, res) => {
  res.json({
    success: true,
    data: gameEngine.roundHistory
  });
});

// 7. Player bet history
router.get('/game/my-bets', (req, res) => {
  const userId = req.query.userId || 'user_me';
  const history = gameEngine.getUserBetsHistory(userId);
  res.json({
    success: true,
    data: history
  });
});

// 8. Recent winners
router.get('/game/winners', (req, res) => {
  res.json({
    success: true,
    data: gameEngine.winnersList
  });
});

// 9. User balance & deposit
router.get('/user/balance', (req, res) => {
  const userId = req.query.userId || 'user_me';
  res.json({
    success: true,
    data: {
      userId,
      balance: walletEngine.getBalance(userId)
    }
  });
});

router.post('/user/deposit', (req, res) => {
  try {
    const { userId = 'user_me', amount } = req.body;
    const newBalance = walletEngine.deposit(userId, parseInt(amount));
    res.json({
      success: true,
      message: `تم إضافة ${amount} إلى حسابك بنجاح`,
      data: {
        userId,
        newBalance
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 10. Game stats
router.get('/game/stats', (req, res) => {
  res.json({
    success: true,
    data: gameEngine.getStatsFormatted()
  });
});

// ==========================================
// 👑 ADMIN CONTROL PANEL API ENDPOINTS
// ==========================================

// Admin Overview Metrics
router.get('/admin/overview', (req, res) => {
  const totals = gameEngine.characterTotals || { dream: 0, lightning: 0, fire: 0 };
  const totalRoundBets = totals.dream + totals.lightning + totals.fire;

  res.json({
    success: true,
    data: {
      roundId: gameEngine.roundId,
      status: gameEngine.status,
      timer: gameEngine.timer,
      characterTotals: totals,
      totalRoundBets,
      multipliers: gameEngine.characterMultipliers,
      forcedNextWinner: gameEngine.forcedNextWinner,
      userBalance: walletEngine.getBalance('user_me'),
      history: gameEngine.roundHistory,
      stats: gameEngine.getStatsFormatted()
    }
  });
});

// Force Next Round Winner
router.post('/admin/force-winner', (req, res) => {
  const { winner } = req.body;
  if (!winner || winner === 'auto') {
    gameEngine.forcedNextWinner = null;
    return res.json({ success: true, message: 'تم إرجاع النتيجة للتوليد التلقائي العشوائي', forcedWinner: 'auto' });
  }

  if (!['dream', 'lightning', 'fire'].includes(winner)) {
    return res.status(400).json({ success: false, error: 'تحديد الفائز غير صالحة' });
  }

  gameEngine.forcedNextWinner = winner;
  const names = { dream: '🌙 الحلم (x10)', lightning: '⚡ البرق (x2)', fire: '🔥 النار (x2)' };
  res.json({
    success: true,
    message: `👑 تم توجيه الفائز بالجولة القادمة ليكون: ${names[winner]}`,
    forcedWinner: winner
  });
});

// Set Character Multipliers
router.post('/admin/multipliers', (req, res) => {
  const { dream = 10, lightning = 2, fire = 2 } = req.body;
  gameEngine.characterMultipliers = {
    dream: parseInt(dream),
    lightning: parseInt(lightning),
    fire: parseInt(fire)
  };

  res.json({
    success: true,
    message: 'تم تحديث مضاعفات الفوز بنجاح',
    multipliers: gameEngine.characterMultipliers
  });
});

// Admin Add Funds to User
router.post('/admin/user-balance', (req, res) => {
  const { userId = 'user_me', amount } = req.body;
  if (!amount || isNaN(amount)) {
    return res.status(400).json({ success: false, error: 'المبلغ غير صالحة' });
  }
  const newBalance = walletEngine.deposit(userId, parseInt(amount));
  res.json({
    success: true,
    message: `تم إضافة ${amount} لحساب ${userId} بنجاح`,
    newBalance
  });
});

// Admin Update Wheel Layout Configuration (حجم العجلة، الصورة، العد التنازلي، التمركز)
router.post('/admin/layout', (req, res) => {
  const { 
    canvasSize, canvasTop, frameSize, frameTop, frameLeft, frameUrl,
    medallionRadius, sliceGap, sliceFontSize, 
    gapWheelResults, gapResultsCards, gapCardsChips,
    repeatBtnRight, repeatBtnBottom, slices 
  } = req.body;
  
  const newLayout = {};
  if (canvasSize !== undefined) newLayout.canvasSize = parseFloat(canvasSize);
  if (canvasTop !== undefined) newLayout.canvasTop = parseFloat(canvasTop);
  if (frameSize !== undefined) newLayout.frameSize = parseFloat(frameSize);
  if (frameTop !== undefined) newLayout.frameTop = parseFloat(frameTop);
  if (frameLeft !== undefined) newLayout.frameLeft = parseFloat(frameLeft);
  if (frameUrl !== undefined) newLayout.frameUrl = frameUrl;
  if (medallionRadius !== undefined) newLayout.medallionRadius = parseFloat(medallionRadius);
  if (sliceGap !== undefined) newLayout.sliceGap = parseFloat(sliceGap);
  if (sliceFontSize !== undefined) newLayout.sliceFontSize = parseFloat(sliceFontSize);
  
  if (gapWheelResults !== undefined) newLayout.gapWheelResults = parseFloat(gapWheelResults);
  if (gapResultsCards !== undefined) newLayout.gapResultsCards = parseFloat(gapResultsCards);
  if (gapCardsChips !== undefined) newLayout.gapCardsChips = parseFloat(gapCardsChips);
  if (repeatBtnRight !== undefined) newLayout.repeatBtnRight = parseFloat(repeatBtnRight);
  if (repeatBtnBottom !== undefined) newLayout.repeatBtnBottom = parseFloat(repeatBtnBottom);
  
  if (slices !== undefined && Array.isArray(slices)) newLayout.slices = slices;

  const updatedLayout = gameEngine.setWheelLayout(newLayout);
  res.json({
    success: true,
    message: 'تم تحديث أبعاد ومقاسات العجلة والإطار بنجاح في الوقت الفعلي! 🎡',
    layout: updatedLayout
  });
});

// Admin Upload Local Game Background
router.post('/admin/upload/background', upload.single('bgImage'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'يرجى اختيار صورة الخلفية لرفعها' });
  }
  const fileUrl = `/assets/uploads/${req.file.filename}`;
  gameEngine.setBackgroundUrl(fileUrl);
  res.json({
    success: true,
    message: 'تم رفع صورة الخلفية وتطبيقها بنجاح! 🖼️',
    bgUrl: fileUrl
  });
});

// Admin Upload Local Wheel Frame Overlay
router.post('/admin/upload/frame', upload.single('frameImage'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'يرجى اختيار صورة الإطار لرفعها' });
  }
  const fileUrl = `/assets/uploads/${req.file.filename}`;
  const updatedLayout = gameEngine.setWheelLayout({ frameUrl: fileUrl });
  res.json({
    success: true,
    message: 'تم رفع صورة الإطار وتطبيقها بنجاح! 🎡',
    layout: updatedLayout
  });
});

// Admin Scan Local Assets & Uploads lists (للاختيار المباشر دون الحاجة لكتابة روابط)
router.get('/admin/assets', (req, res) => {
  const assetsDir = path.join(__dirname, '..', '..', 'public', 'assets');
  const uploadsDir = path.join(assetsDir, 'uploads');
  
  let baseFiles = [];
  if (fs.existsSync(assetsDir)) {
    baseFiles = fs.readdirSync(assetsDir).filter(f => fs.statSync(path.join(assetsDir, f)).isFile());
  }

  let uploadedFiles = [];
  if (fs.existsSync(uploadsDir)) {
    uploadedFiles = fs.readdirSync(uploadsDir).filter(f => fs.statSync(path.join(uploadsDir, f)).isFile());
  }

  // Group default assets and uploads
  const frames = [
    '/assets/wheel_frame.png',
    '/assets/wheel_frame_fantasy.png',
    ...uploadedFiles.filter(f => f.startsWith('frameImage-')).map(f => `/assets/uploads/${f}`)
  ];

  const backgrounds = [
    '/assets/game_bg.jpg',
    '/assets/dream.jpg',
    '/assets/lightning.jpg',
    '/assets/fire.jpg',
    ...uploadedFiles.filter(f => f.startsWith('bgImage-')).map(f => `/assets/uploads/${f}`)
  ];

  res.json({
    success: true,
    frames,
    backgrounds
  });
});

module.exports = router;
