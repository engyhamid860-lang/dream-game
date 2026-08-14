let appInitialized = false;

function initApp() {
  if (appInitialized) return;
  appInitialized = true;

  // Parse URL parameters for real user authentication & wallet balance (Supports all parameter aliases)
  const urlParams = new URLSearchParams(window.location.search);
  const realUserId = urlParams.get('userId') || urlParams.get('user_id') || urlParams.get('id') || 'user_me';
  const realUserName = urlParams.get('userName') || urlParams.get('username') || urlParams.get('name') || 'أنت';
  const realUserAvatar = urlParams.get('avatar') || urlParams.get('avatarUrl') || urlParams.get('user_avatar') || urlParams.get('img') || '';
  const rawBalance = urlParams.get('balance') || urlParams.get('user_balance') || urlParams.get('wallet_balance') || urlParams.get('coins');
  const realUserBalance = (rawBalance !== null && rawBalance !== undefined && rawBalance !== '') ? parseInt(rawBalance) : null;

  // Render Real User Name & Avatar in Header
  const userNameTextEl = document.getElementById('userNameText');
  const userAvatarIconEl = document.getElementById('userAvatarIcon');
  const userAvatarImgEl = document.getElementById('userAvatarImg');

  if (userNameTextEl) safeSetText(userNameTextEl, realUserName);
  if (realUserAvatar) {
    if (userAvatarImgEl) {
      userAvatarImgEl.src = realUserAvatar;
      userAvatarImgEl.style.display = 'block';
    }
    if (userAvatarIconEl) userAvatarIconEl.style.display = 'none';
  }

  // Initialize Socket.IO with real user query params
  const socketQuery = { userId: realUserId };
  if (realUserName) socketQuery.userName = realUserName;
  if (realUserBalance !== null && !isNaN(realUserBalance)) socketQuery.balance = realUserBalance;

  const socket = io({ query: socketQuery });

  // Safe DOM helpers to prevent client-side crashes on missing elements
  function safeSetText(el, text) {
    if (el) el.textContent = text;
  }
  function safeSetStyle(el, prop, val) {
    if (el) el.style[prop] = val;
  }
  function safeAddClass(el, className) {
    if (el) el.classList.add(className);
  }
  function safeRemoveClass(el, className) {
    if (el) el.classList.remove(className);
  }


  // Game State Variables
  let currentRoundId = 101;
  let currentStatus = 'WAITING';
  let selectedAmount = 1000;
  let userBalance = (realUserBalance !== null && !isNaN(realUserBalance)) ? realUserBalance : 0;
  let characterTotals = { dream: 0, lightning: 0, fire: 0 };
  let myBets = { dream: 0, lightning: 0, fire: 0 };
  let lastRoundUserBets = { dream: 0, lightning: 0, fire: 0 };

  // DOM Elements
  const startScreen = document.getElementById('startScreen');
  const startProgressBar = document.getElementById('startProgressBar');
  const startProgressText = document.getElementById('startProgressText');
  const loadingStatusLabel = document.getElementById('loadingStatusLabel');

  const roundNumberEl = document.getElementById('roundNumber');
  const timerBoxEl = document.getElementById('timerBox');
  const timerTextEl = document.getElementById('timerText');
  const statusMessageEl = document.getElementById('statusMessage');

  const cardDream = document.getElementById('cardDream');
  const cardLightning = document.getElementById('cardLightning');
  const cardFire = document.getElementById('cardFire');
  const charCards = [cardDream, cardLightning, cardFire];

  const totalBetDream = document.getElementById('totalBetDream');
  const totalBetLightning = document.getElementById('totalBetLightning');
  const totalBetFire = document.getElementById('totalBetFire');

  const myBetDream = document.getElementById('myBetDream');
  const myBetLightning = document.getElementById('myBetLightning');
  const myBetFire = document.getElementById('myBetFire');

  const userBalanceText = document.getElementById('userBalanceText');
  const btnDeposit = document.getElementById('btnDeposit');
  const chipBtns = document.querySelectorAll('.chip-btn');

  const winnersListContainer = document.getElementById('winnersListContainer');
  const historyPillsContainer = document.getElementById('historyPillsContainer');

  const toastMsg = document.getElementById('toastMsg');

  // Modals
  const btnOpenHistory = document.getElementById('btnOpenHistory');
  const btnOpenMyBets = document.getElementById('btnOpenMyBets');
  const modalHistory = document.getElementById('modalHistory');
  const modalMyBets = document.getElementById('modalMyBets');
  const historyModalBody = document.getElementById('historyModalBody');
  const myBetsModalBody = document.getElementById('myBetsModalBody');

  // Canvas Setup
  const canvas = document.getElementById('effectsCanvas');
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // 🎡 Fortune Wheel Canvas Setup
  const wheelCanvas = document.getElementById('wheelCanvas');
  const wheelCtx = wheelCanvas.getContext('2d');
  let currentWheelAngle = 0; // In Radians
  let isWheelSpinning = false;

  // Layout customization configuration controlled from Admin Panel
  let wheelLayout = {
    canvasSize: 60.5,
    canvasTop: 44.3,
    frameSize: 100.0,
    medallionRadius: 39
  };

  function applyWheelLayout(layout) {
    if (!layout) return;
    wheelLayout = { ...wheelLayout, ...layout };
    
    // Apply canvas styling
    if (wheelCanvas) {
      wheelCanvas.style.width = `${wheelLayout.canvasSize}%`;
      wheelCanvas.style.height = `${wheelLayout.canvasSize}%`;
      wheelCanvas.style.top = `${wheelLayout.canvasTop}%`;
    }
    
    // Apply frame image overlay styling
    const frameOverlay = document.getElementById('wheelFrameOverlay');
    if (frameOverlay) {
      frameOverlay.style.width = `${wheelLayout.frameSize}%`;
      frameOverlay.style.height = `${wheelLayout.frameSize}%`;
    }
    
    // Redraw immediately to apply sizes
    drawWheel(currentWheelAngle, currentLiveTimer);
  }

  // Preload Character Image Assets for Full Sector Filling (الأيقونات تملا مثلث العجلة بالكامل)
  const wheelImages = {
    dream: new Image(),
    lightning: new Image(),
    fire: new Image()
  };
  wheelImages.dream.src = 'assets/dream.jpg';
  wheelImages.lightning.src = 'assets/lightning.jpg';
  wheelImages.fire.src = 'assets/fire.jpg';

  Object.values(wheelImages).forEach(img => {
    img.onload = () => {
      if (typeof drawWheel === 'function') drawWheel(currentWheelAngle);
    };
  });

  // 🎡 6-Sector Geometric Deluxe Fortune Wheel (عجلة هندسية دقيقة 6 قطاعات 60° بأيقونات كاملة)
  // 🎡 6-Sector Geometric Deluxe Fortune Wheel (خلفيات مدمجة بآرت الإطار الخيالي وأيقونات مصغرة)
  const wheelSlices = [
    { char: 'dream', title: 'الحلم', icon: '🌙', multiplier: '×10', grad1: '#f43f5e', grad2: '#881337', iconColor: '#fb7185' },
    { char: 'lightning', title: 'البرق', icon: '⚡', multiplier: '×2', grad1: '#581c87', grad2: '#2e1065', iconColor: '#c084fc' },
    { char: 'fire', title: 'النار', icon: '🔥', multiplier: '×2', grad1: '#581c87', grad2: '#2e1065', iconColor: '#c084fc' },
    { char: 'lightning', title: 'البرق', icon: '⚡', multiplier: '×2', grad1: '#581c87', grad2: '#2e1065', iconColor: '#c084fc' },
    { char: 'fire', title: 'النار', icon: '🔥', multiplier: '×2', grad1: '#581c87', grad2: '#2e1065', iconColor: '#c084fc' },
    { char: 'lightning', title: 'البرق', icon: '⚡', multiplier: '×2', grad1: '#581c87', grad2: '#2e1065', iconColor: '#c084fc' }
  ];

  let currentLiveTimer = 10;
  let landedWinningSliceIndex = null;

  function drawWheel(angle = 0, liveTimerVal = null) {
    const width = wheelCanvas.width;
    const height = wheelCanvas.height;
    // 100% Strict Integer Center Coordinates
    const centerX = Math.round(width / 2);
    const centerY = Math.round(height / 2);
    const radius = centerX - 2; // Fill canvas completely with zero empty gap
    const sliceAngle = (Math.PI * 2) / wheelSlices.length;

    wheelCtx.clearRect(0, 0, width, height);

    // Calculate sector index currently positioned directly under top pointer pin (12 o'clock)
    const pointerAngle = 1.5 * Math.PI;
    let angleUnderPointer = (pointerAngle - angle) % (Math.PI * 2);
    if (angleUnderPointer < 0) angleUnderPointer += Math.PI * 2;
    const activeUnderPointerIndex = Math.floor(angleUnderPointer / sliceAngle) % wheelSlices.length;

    // 2. Draw 6 Equal Geometric Sectors with Active Pointer Glow (القطاع الموجود تحت السهم يضيء بالكامل)
    wheelSlices.forEach((slice, i) => {
      const startAngle = angle + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      const isWinnerLanded = (landedWinningSliceIndex === i);
      const isUnderPointer = (i === activeUnderPointerIndex);
      const sectorMidAngle = startAngle + sliceAngle / 2;

      wheelCtx.save();

      // Clip Sector Triangle Area precisely
      wheelCtx.beginPath();
      wheelCtx.moveTo(centerX, centerY);
      wheelCtx.arc(centerX, centerY, radius, startAngle, endAngle);
      wheelCtx.closePath();
      wheelCtx.clip();

      // Sector Base Radial Gradient Background (الإضاءة تظهر فقط عند توقف السهم على القطاع الفائز)
      const grad = wheelCtx.createRadialGradient(centerX, centerY, 10, centerX, centerY, radius);
      if (isWinnerLanded) {
        // Intense Flash Glow ONLY for Winning Sector when wheel stops
        const flashIntensity = Math.abs(Math.sin(performance.now() / 120));
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, `rgba(255, 245, 157, ${0.85 + flashIntensity * 0.15})`);
        grad.addColorStop(0.7, '#ffd700');
        grad.addColorStop(1, '#f97316');
      } else {
        grad.addColorStop(0, slice.grad1);
        grad.addColorStop(0.85, slice.grad2);
        grad.addColorStop(1, '#1e1035');
      }
      wheelCtx.fillStyle = grad;
      wheelCtx.fill();

      // Draw Small Circular Character Icon inside Sector (أيقونة دائرية صغيرة مطابقة لكروت الرهان)
      const imgAsset = wheelImages[slice.char];
      if (imgAsset && imgAsset.complete && imgAsset.naturalWidth > 0) {
        wheelCtx.save();
        wheelCtx.translate(centerX, centerY);
        wheelCtx.rotate(sectorMidAngle);

        const imgDist = radius * 0.58;
        wheelCtx.translate(imgDist, 0);
        wheelCtx.rotate(Math.PI / 2);

        const iconScale = 1.0; // Steady and completely still icon without pulse
        wheelCtx.scale(iconScale, iconScale);

        // Small circular icon size matching betting cards
        const iconRadius = radius * 0.16;

        wheelCtx.beginPath();
        wheelCtx.arc(0, 0, iconRadius, 0, Math.PI * 2);
        wheelCtx.closePath();

        wheelCtx.save();
        wheelCtx.clip();
        wheelCtx.drawImage(imgAsset, -iconRadius, -iconRadius, iconRadius * 2, iconRadius * 2);
        wheelCtx.restore();

        // Glowing Gold Ring Border around circular avatar icon
        wheelCtx.strokeStyle = '#ffd700';
        wheelCtx.lineWidth = 2.2;
        wheelCtx.shadowColor = isWinnerLanded ? '#ffffff' : 'rgba(0, 0, 0, 0.8)';
        wheelCtx.shadowBlur = isWinnerLanded ? 15 : 4;
        wheelCtx.stroke();

        wheelCtx.restore();
      }

      // Bold Golden Inner Sector Divider Lines (حدود قطاعات سميكة وبارزة مجسمة باللون الذهبي)
      wheelCtx.save();
      wheelCtx.beginPath();
      wheelCtx.moveTo(centerX, centerY);
      wheelCtx.lineTo(centerX + Math.cos(startAngle) * radius, centerY + Math.sin(startAngle) * radius);
      
      const dividerGrad = wheelCtx.createLinearGradient(centerX, centerY, centerX + Math.cos(startAngle) * radius, centerY + Math.sin(startAngle) * radius);
      dividerGrad.addColorStop(0, '#ffffff');
      dividerGrad.addColorStop(0.3, '#ffe775');
      dividerGrad.addColorStop(0.7, '#ffd700');
      dividerGrad.addColorStop(1, '#b8860b');

      wheelCtx.strokeStyle = isWinnerLanded ? '#ffffff' : dividerGrad;
      wheelCtx.lineWidth = isWinnerLanded ? 9.5 : 6.8;
      wheelCtx.shadowColor = isWinnerLanded ? '#ffffff' : 'rgba(0, 0, 0, 0.85)';
      wheelCtx.shadowBlur = isWinnerLanded ? 20 : 6;
      wheelCtx.stroke();
      wheelCtx.restore();

      wheelCtx.restore(); // Restore sector clip
    });

    // 4. Deluxe Golden Outer Rim & Perimeter Rivet Dots (إطار محيطي سميك وبارز للقطاعات)
    wheelCtx.save();
    wheelCtx.beginPath();
    wheelCtx.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
    const rimGrad = wheelCtx.createLinearGradient(0, 0, width, height);
    rimGrad.addColorStop(0, '#ffffff');
    rimGrad.addColorStop(0.2, '#ffd700');
    rimGrad.addColorStop(0.5, '#b8860b');
    rimGrad.addColorStop(0.8, '#fff59d');
    rimGrad.addColorStop(1, '#ffd700');
    wheelCtx.strokeStyle = rimGrad;
    wheelCtx.lineWidth = 10.5;
    wheelCtx.shadowColor = '#000000';
    wheelCtx.shadowBlur = 8;
    wheelCtx.stroke();
    wheelCtx.restore();

    // 12 Outer Light Bulbs / Rivets around the rim
    for (let b = 0; b < 12; b++) {
      const bulbAngle = (Math.PI * 2 / 12) * b + haloOrbitAngle * 0.5;
      const bx = centerX + Math.cos(bulbAngle) * (radius - 1);
      const by = centerY + Math.sin(bulbAngle) * (radius - 1);
      wheelCtx.beginPath();
      wheelCtx.arc(bx, by, 3.5, 0, Math.PI * 2);
      wheelCtx.fillStyle = (b % 2 === 0) ? '#ffffff' : '#ffd700';
      wheelCtx.shadowColor = '#ffd700';
      wheelCtx.shadowBlur = 6;
      wheelCtx.fill();
    }

    // 5. Center Hub 3D Medallion with Live Countdown Timer (مركز العجلة الفاخر)
    const displayTimer = (liveTimerVal !== null && liveTimerVal !== undefined) ? liveTimerVal : currentLiveTimer;
    const isWarning = displayTimer <= 3 && displayTimer > 0;

    // Medallion Outer Bevel Ring (توسط دقيق 100% في منتصف الحلقة الذهبية للإطار)
    const mOuter = wheelLayout.medallionRadius || 39;
    const mInner = mOuter * 0.77;
    const mFont = Math.round(mOuter * 0.615);

    wheelCtx.save();
    wheelCtx.beginPath();
    wheelCtx.arc(centerX, centerY, mOuter, 0, Math.PI * 2);
    wheelCtx.fillStyle = '#1e1b4b';
    wheelCtx.fill();
    wheelCtx.strokeStyle = rimGrad;
    wheelCtx.lineWidth = 4;
    wheelCtx.shadowColor = '#000000';
    wheelCtx.shadowBlur = 10;
    wheelCtx.stroke();

    // Inner Medallion Core Circle
    wheelCtx.beginPath();
    wheelCtx.arc(centerX, centerY, mInner, 0, Math.PI * 2);
    const coreGrad = wheelCtx.createRadialGradient(centerX, centerY, 4, centerX, centerY, mInner);
    if (isWarning) {
      coreGrad.addColorStop(0, '#ef4444');
      coreGrad.addColorStop(1, '#7f1d1d');
    } else {
      coreGrad.addColorStop(0, '#31103f');
      coreGrad.addColorStop(1, '#0f051d');
    }
    wheelCtx.fillStyle = coreGrad;
    wheelCtx.fill();
    wheelCtx.strokeStyle = isWarning ? '#fca5a5' : '#ffd700';
    wheelCtx.lineWidth = 2.2;
    wheelCtx.stroke();

    // Timer / Symbol Text inside Medallion
    wheelCtx.textAlign = 'center';
    wheelCtx.textBaseline = 'middle';

    if (displayTimer !== null && displayTimer !== undefined && displayTimer > 0) {
      const formatted = displayTimer < 10 ? `0${displayTimer}` : `${displayTimer}`;
      wheelCtx.font = `900 ${mFont}px Outfit, Cairo, sans-serif`;
      wheelCtx.fillStyle = isWarning ? '#ffffff' : '#ffd700';
      wheelCtx.shadowColor = isWarning ? '#ef4444' : '#ffd700';
      wheelCtx.shadowBlur = 8;
      wheelCtx.fillText(formatted, centerX, centerY + 1);
    } else {
      wheelCtx.font = `900 ${Math.round(mFont * 0.58)}px Cairo, sans-serif`;
      wheelCtx.fillStyle = '#ffd700';
      wheelCtx.shadowColor = '#ffd700';
      wheelCtx.shadowBlur = 6;
      wheelCtx.fillText('★ DL ★', centerX, centerY);
    }
    wheelCtx.restore();
  }

  // Initial Wheel Render & 60FPS Continuous Ambient Render Loop (حركة أنيميشن حية ومستمرة 60 إطار في الثانية)
  let haloOrbitAngle = 0;
  function mainGameLoop() {
    if (!isWheelSpinning) {
      haloOrbitAngle += 0.02; // Smooth continuous rim lights orbit
      drawWheel(currentWheelAngle, currentLiveTimer);
    }
    requestAnimationFrame(mainGameLoop);
  }
  requestAnimationFrame(mainGameLoop);

  // 🎡 Pure Monotonic Single-Curve Rotation Trajectory (منع التسارع المزدوج والقفز)
  function getRotationAngle(progress, startAngle, totalRotation) {
    const accelRatio = 0.14; // 14% initial smooth acceleration
    let factor = 0;
    if (progress < accelRatio) {
      const t = progress / accelRatio;
      factor = 0.08 * (t * t);
    } else {
      const t = (progress - accelRatio) / (1.0 - accelRatio);
      const easeOut = 1 - Math.pow(1 - t, 4); // Quartic Ease-Out strictly monotonic continuous slowdown
      factor = 0.08 + 0.92 * easeOut;
    }
    return startAngle + totalRotation * factor;
  }

  // 🎡 Spin Wheel Automatically when Countdown Ends (Deterministic Landing with ZERO Jump)
  function spinWheelToWinner(winnerChar) {
    if (isWheelSpinning) return;
    isWheelSpinning = true;
    landedWinningSliceIndex = null;

    // 1. Find matching sector indices for winner character
    const matchingIndices = [];
    wheelSlices.forEach((s, idx) => {
      if (s.char === winnerChar) matchingIndices.push(idx);
    });
    const targetSliceIndex = matchingIndices[Math.floor(Math.random() * matchingIndices.length)];

    // 2. Calculate exact target angle of sector center
    const sliceAngle = (Math.PI * 2) / wheelSlices.length; // 60° (Math.PI / 3)
    const targetSectorCenter = (targetSliceIndex * sliceAngle) + (sliceAngle / 2);

    // 3. Pointer is fixed at TOP (12 o'clock / 1.5 * Math.PI)
    const targetStopAngle = (Math.PI * 1.5) - targetSectorCenter;

    // 4. Calculate total rotation by adding 6 full integer spins
    const startAngle = currentWheelAngle;
    const currentNormalized = ((startAngle % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
    let delta = targetStopAngle - currentNormalized;
    while (delta < 0) delta += (Math.PI * 2);

    const fullSpins = 6 * (Math.PI * 2); // 6 full rotations
    const totalRotation = fullSpins + delta;
    const finalRotation = startAngle + totalRotation;

    const duration = 2500; // 2.5 seconds fast wheel spin
    const startTime = performance.now();
    let lastTickSlice = -1;

    function animateWheel(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1.0);

      // Monotonic single-curve angle calculation (ZERO re-acceleration!)
      currentWheelAngle = getRotationAngle(progress, startAngle, totalRotation);

      drawWheel(currentWheelAngle);

      // Audio tick on slice boundary passes
      const currentSlice = Math.floor((((currentWheelAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / sliceAngle);
      if (currentSlice !== lastTickSlice) {
        lastTickSlice = currentSlice;
        if (window.soundFx) window.soundFx.playSpinTickSound();
      }

      if (progress < 1.0) {
        requestAnimationFrame(animateWheel);
      } else {
        isWheelSpinning = false;
        // Lock wheel at exact finalRotation (NO jump, NO reset to 0!)
        currentWheelAngle = finalRotation;
        landedWinningSliceIndex = targetSliceIndex;

        // Final canvas draw with landed winning sector glow
        drawWheel(currentWheelAngle);

        // Highlight winner card
        charCards.forEach(c => c.classList.remove('winner-highlight'));
        const winCard = document.querySelector(`.char-card[data-char="${winnerChar}"]`);
        if (winCard) winCard.classList.add('winner-declared');

        // Play victory sound
        if (window.soundFx) window.soundFx.playWinSound();
      }
    }

    requestAnimationFrame(animateWheel);
  }

  // Toast Notifications
  function showToast(msg, isSuccess = false) {
    toastMsg.textContent = msg;
    toastMsg.className = `toast-msg show ${isSuccess ? 'success' : ''}`;
    setTimeout(() => {
      toastMsg.className = 'toast-msg';
    }, 2500);
  }

  // Format numbers in English digits
  function fmt(num) {
    return (num || 0).toLocaleString('en-US');
  }

  // Instant Mobile Launch Progress Bar (0% to 100% in 180ms)
  function runLoadingProgressBar() {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 25;
      if (progress > 100) progress = 100;

      if (startProgressBar) startProgressBar.style.width = `${progress}%`;
      if (startProgressText) startProgressText.textContent = `${progress}%`;

      if (progress >= 100) {
        clearInterval(interval);
        if (loadingStatusLabel) loadingStatusLabel.textContent = '✨ مرحباً بك في لعبة الحلم!';
        
        setTimeout(() => {
          if (window.soundFx) window.soundFx.init();
          if (startScreen) {
            startScreen.classList.add('fade-out');
            setTimeout(() => {
              startScreen.style.display = 'none';
            }, 250);
          }
        }, 80);
      }
    }, 20);
  }

  if (startScreen) {
    startScreen.addEventListener('click', () => {
      startScreen.classList.add('fade-out');
      setTimeout(() => {
        startScreen.style.display = 'none';
      }, 600);
    });
  }

  runLoadingProgressBar();

  // Chip Selector
  chipBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      chipBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedAmount = parseInt(btn.dataset.amount);
      if (window.soundFx) window.soundFx.playChipSound();
    });
  });

  // Direct Instant Bet Placement on Character Card Click
  function placeDirectBet(charName) {
    if (currentStatus !== 'BETTING') {
      return;
    }
    if (userBalance < selectedAmount) {
      showToast('❌ الرصيد غير كافٍ');
      return;
    }

    socket.emit('place_bet', {
      character: charName,
      amount: selectedAmount,
      userName: realUserName,
      userAvatar: realUserAvatar || '👤'
    }, (response) => {
      if (response && response.success) {
        if (window.soundFx) window.soundFx.playChipSound();
      } else {
        showToast(response.error || 'فشل في وضع الرهان');
      }
    });
  }

  charCards.forEach(card => {
    card.addEventListener('click', () => {
      placeDirectBet(card.dataset.char);
    });
  });

  // Deposit Button
  if (btnDeposit) {
    btnDeposit.addEventListener('click', () => {
      fetch('/api/user/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user_me', amount: 50000 })
      }).then(res => res.json()).then(data => {
        if (data.success) {
          userBalance = data.data.newBalance;
          safeSetText(userBalanceText, fmt(userBalance));
          showToast('💎 تم إضافة 50,000 إلى رصيدك!', true);
        }
      });
    });
  }

  // UI State Update
  function applyRoundState(data) {
    currentRoundId = data.roundId;
    currentStatus = data.status;
    safeSetText(roundNumberEl, `الجولة #${data.roundId}`);
    userBalance = data.userBalance;
    safeSetText(userBalanceText, fmt(userBalance));

    characterTotals = data.characterTotals || { dream: 0, lightning: 0, fire: 0 };
    safeSetText(totalBetDream, fmt(characterTotals.dream));
    safeSetText(totalBetLightning, fmt(characterTotals.lightning));
    safeSetText(totalBetFire, fmt(characterTotals.fire));

    myBets = data.userBets || { dream: 0, lightning: 0, fire: 0 };
    safeSetText(myBetDream, fmt(myBets.dream));
    safeSetText(myBetLightning, fmt(myBets.lightning));
    safeSetText(myBetFire, fmt(myBets.fire));

    renderHistoryPills(data.history || []);

    if (data.bgUrl) {
      const appContainer = document.querySelector('.voice-app-container');
      if (appContainer) appContainer.style.backgroundImage = `url('${data.bgUrl}')`;
    }
    
    if (data.wheelLayout) {
      applyWheelLayout(data.wheelLayout);
    }
  }

  // Socket Events
  socket.on('bg_changed', (data) => {
    if (data && data.bgUrl) {
      const appContainer = document.querySelector('.voice-app-container');
      if (appContainer) appContainer.style.backgroundImage = `url('${data.bgUrl}')`;
    }
  });

  socket.on('layout_changed', (layout) => {
    applyWheelLayout(layout);
  });

  socket.on('round_started', (data) => {
    if (myBets.dream > 0 || myBets.lightning > 0 || myBets.fire > 0) {
      lastRoundUserBets = { ...myBets };
    }
    landedWinningSliceIndex = null;
    applyRoundState(data);

    currentLiveTimer = data.timer || 10;
    drawWheel(currentWheelAngle, currentLiveTimer);

    charCards.forEach(card => {
      card.classList.remove('winner-highlight', 'winner-declared');
    });
  });

  socket.on('countdown_updated', (data) => {
    currentLiveTimer = data.timer;
    drawWheel(currentWheelAngle, currentLiveTimer);
    if (currentLiveTimer <= 3 && currentLiveTimer > 0) {
      if (window.soundFx) window.soundFx.playTickSound();
    }
  });

  socket.on('bet_placed', (data) => {
    const { bet, characterTotals: totals, userBets: uBets, newBalance } = data;
    characterTotals = totals;
    safeSetText(totalBetDream, fmt(characterTotals.dream));
    safeSetText(totalBetLightning, fmt(characterTotals.lightning));
    safeSetText(totalBetFire, fmt(characterTotals.fire));

    if (bet.userId === realUserId || bet.userId === 'user_me') {
      myBets = uBets;
      if (myBets.dream > 0 || myBets.lightning > 0 || myBets.fire > 0) {
        lastRoundUserBets = { ...myBets };
      }
      safeSetText(myBetDream, `رهانك: ${fmt(myBets.dream)}`);
      safeSetText(myBetLightning, `رهانك: ${fmt(myBets.lightning)}`);
      safeSetText(myBetFire, `رهانك: ${fmt(myBets.fire)}`);
      userBalance = newBalance;
      safeSetText(userBalanceText, fmt(userBalance));
    }
  });

  socket.on('player_won', (data) => {
    if (data.userId === realUserId || data.userId === 'user_me') {
      userBalance = data.newBalance;
      safeSetText(userBalanceText, fmt(userBalance));
    }
  });

  socket.on('betting_closed', (data) => {
    currentStatus = 'BETTING_CLOSED';
  });

  socket.on('winner_selected', (data) => {
    currentStatus = 'DRAWING';
    // Spin Fortune Wheel automatically to winner!
    spinWheelToWinner(data.winner);
  });

  // Center Winners Popup Box DOM Elements
  const roundWinnersPopup = document.getElementById('roundWinnersPopup');
  const podiumWinnersContainer = document.getElementById('podiumWinnersContainer');
  const myPopBetVal = document.getElementById('myPopBetVal');
  const myPopWinVal = document.getElementById('myPopWinVal');
  let popupTimeout = null;

  socket.on('winner_revealed', (data) => {
    currentStatus = 'RESULT';

    renderWinnersPopup(data);
    renderHistoryPills(data.history);

    if (window.soundFx) window.soundFx.playWinSound(data.winner === 'dream');
  });

  // Render Centered Winners Popup Box (Top 3 Podium matching Reference Screenshot)
  function renderWinnersPopup(data) {
    if (popupTimeout) clearTimeout(popupTimeout);
    
    // Sort winners by profit/payout descending and pick top 3
    const sortedWinners = [...(data.winners || [])].sort((a, b) => b.payout - a.payout);
    const top3 = sortedWinners.slice(0, 3);

    if (podiumWinnersContainer) {
      podiumWinnersContainer.innerHTML = '';
      if (top3.length === 0) {
        podiumWinnersContainer.innerHTML = `
          <div style="color: #94a3b8; font-weight: 700; font-size: 0.85rem; padding: 12px 0;">
            😯 لا يوجد فائزين في هذه الجولة
          </div>
        `;
      } else {
        const crowns = ['👑 1', '👑 2', '👑 3'];
        top3.forEach((w, idx) => {
          const rankClass = `rank-${idx + 1}`;
          const pCard = document.createElement('div');
          pCard.className = `podium-card ${rankClass}`;
          pCard.innerHTML = `
            <span class="podium-crown">${crowns[idx]}</span>
            <div class="podium-avatar-frame">
              <span>${w.avatar || '👤'}</span>
            </div>
            <span class="podium-username-banner">${w.userName}</span>
            <span class="podium-stat-line">الرهان: ${fmt(w.totalBet)}</span>
            <span class="podium-stat-line win">فوز: ${fmt(w.payout)}</span>
          `;
          podiumWinnersContainer.appendChild(pCard);
        });
      }
    }

    // Update Bottom Row (Personal Stats for realUserId)
    const myTotalBetInRound = (myBets.dream + myBets.lightning + myBets.fire) || 0;
    let myWinPayoutInRound = 0;
    if (data.winners) {
      const meWin = data.winners.find(w => w.userId === realUserId);
      if (meWin) myWinPayoutInRound = meWin.payout;
    }

    const myPopNameText = document.getElementById('myPopNameText');
    const myPopAvatarMini = document.getElementById('myPopAvatarMini');
    if (myPopNameText) myPopNameText.textContent = realUserName;
    if (myPopAvatarMini) {
      if (realUserAvatar) {
        myPopAvatarMini.innerHTML = `<img src="${realUserAvatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="Avatar">`;
      } else {
        myPopAvatarMini.textContent = '👤';
      }
    }

    if (myPopBetVal) myPopBetVal.textContent = fmt(myTotalBetInRound);
    if (myPopWinVal) myPopWinVal.textContent = fmt(myWinPayoutInRound);

    // Delay showing Popup Overlay by 2.0s so player can admire the landed winning sector glow effect!
    setTimeout(() => {
      if (roundWinnersPopup) roundWinnersPopup.classList.add('active');

      // Auto-disappear after 4.5 seconds (اختفاء مربع الفائز وضوء القطاع معا في نفس الوقت)
      popupTimeout = setTimeout(() => {
        if (roundWinnersPopup) roundWinnersPopup.classList.remove('active');
        landedWinningSliceIndex = null;
        drawWheel(currentWheelAngle);
      }, 4500);
    }, 2000);
  }

  // Render Recent History Image Icon Badges across 100% full width of strip (11 items with NEW tag)
  function renderHistoryPills(history) {
    historyPillsContainer.innerHTML = '';
    const images = { dream: 'assets/dream.jpg', lightning: 'assets/lightning.jpg', fire: 'assets/fire.jpg' };
    const names = { dream: '🌙 الحلم', lightning: '⚡ البرق', fire: '🔥 النار' };
    const items = (history || []).slice(0, 11);

    items.forEach((item, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'history-icon-badge-wrapper';

      if (idx === 0) {
        const newTag = document.createElement('span');
        newTag.className = 'new-pill-tag';
        newTag.textContent = 'جديد';
        wrapper.appendChild(newTag);
      }

      const badge = document.createElement('div');
      badge.className = `history-icon-badge ${item.winner}`;
      badge.innerHTML = `<img src="${images[item.winner]}" alt="${names[item.winner]}" class="history-badge-img">`;
      badge.title = `الجولة #${item.roundId} — ${names[item.winner]}`;
      wrapper.appendChild(badge);

      historyPillsContainer.appendChild(wrapper);
    });
  }

  // Canvas Particles FX
  function triggerCoinBurst(charName) {
    const card = document.querySelector(`.char-card[data-char="${charName}"]`);
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;

    for (let i = 0; i < 20; i++) {
      particles.push({
        x: startX,
        y: startY,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 4,
        size: Math.random() * 8 + 6,
        color: '#ffd700',
        life: 1
      });
    }
  }

  function triggerWinExplosion(charName) {}

  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, idx) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.life -= 0.02;

      if (p.life > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        particles.splice(idx, 1);
      }
    });
    requestAnimationFrame(animateParticles);
  }
  animateParticles();

  // History Modals Handling
  btnOpenHistory.addEventListener('click', () => {
    fetch('/api/game/history')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          historyModalBody.innerHTML = '';
          const names = { dream: '🌙 الحلم', lightning: '⚡ البرق', fire: '🔥 النار' };
          data.data.forEach(item => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.background = 'rgba(255,255,255,0.05)';
            row.style.padding = '8px 12px';
            row.style.borderRadius = '12px';
            row.innerHTML = `
              <span>الجولة #${item.roundId}</span>
              <span class="history-pill ${item.winner}">${names[item.winner]}</span>
            `;
            historyModalBody.appendChild(row);
          });
          safeAddClass(modalHistory, 'active');
        }
      });
  });

  btnOpenMyBets.addEventListener('click', () => {
    fetch('/api/game/my-bets?userId=user_me')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          myBetsModalBody.innerHTML = '';
          if (data.data.length === 0) {
            myBetsModalBody.innerHTML = '<div style="text-align: center; color: #94a3b8;">لا توجد رهانات سابقة</div>';
          } else {
            const names = { dream: '🌙 الحلم', lightning: '⚡ البرق', fire: '🔥 النار' };
            data.data.forEach(item => {
              const row = document.createElement('div');
              row.style.display = 'flex';
              row.style.justifyContent = 'space-between';
              row.style.background = 'rgba(255,255,255,0.05)';
              row.style.padding = '8px 12px';
              row.style.borderRadius = '12px';
              row.innerHTML = `
                <div>
                  <div>الجولة #${item.roundId} — ${names[item.character]}</div>
                  <div style="font-size: 0.75rem; color: #94a3b8;">الرهان: ${fmt(item.totalBet)}</div>
                </div>
                <div style="text-align: left;">
                  <div style="font-weight: 800; color: ${item.won ? '#4ade80' : '#ef4444'};">
                    ${item.won ? `فوز +${fmt(item.profit)}` : 'خسارة'}
                  </div>
                </div>
              `;
              myBetsModalBody.appendChild(row);
            });
          }
          safeAddClass(modalMyBets, 'active');
        }
      });
  });

  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      safeRemoveClass(modalHistory, 'active');
      safeRemoveClass(modalMyBets, 'active');
    });
  });

  // Sound Mute/Unmute Toggle Button
  const btnToggleSound = document.getElementById('btnToggleSound');
  const soundBtnIcon = document.getElementById('soundBtnIcon');
  if (btnToggleSound) {
    btnToggleSound.addEventListener('click', () => {
      if (window.soundFx) {
        const isMuted = window.soundFx.toggleMute();
        if (soundBtnIcon) soundBtnIcon.textContent = isMuted ? '🔇' : '🔊';
        if (isMuted) {
          btnToggleSound.classList.add('muted');
        }
      }
    });
  }

  // 3D Cartoon Repeat Bet Button ("🔄 كرر")
  const btnRepeatBet = document.getElementById('btnRepeatBet');
  if (btnRepeatBet) {
    btnRepeatBet.addEventListener('click', () => {
      if (currentStatus !== 'BETTING') {
        showToast('❌ الرهان مغلق الآن');
        return;
      }

      const totalNeeded = (lastRoundUserBets.dream || 0) + (lastRoundUserBets.lightning || 0) + (lastRoundUserBets.fire || 0);

      if (totalNeeded <= 0) {
        showToast('⚠️ لا يوجد رهان سابق لتكراره');
        return;
      }

      if (userBalance < totalNeeded) {
        showToast('❌ الرصيد غير كافٍ لتكرار الرهان');
        return;
      }

      let placedAny = false;
      ['dream', 'lightning', 'fire'].forEach(char => {
        const amt = lastRoundUserBets[char];
        if (amt && amt > 0) {
          placedAny = true;
          socket.emit('place_bet', {
            character: char,
            amount: amt,
            userName: 'أنت',
            userAvatar: '👤'
          }, (response) => {
            if (response && response.success) {
              if (window.soundFx) window.soundFx.playChipSound();
            }
          });
        }
      });

      if (placedAny) {
        if (window.soundFx) window.soundFx.playChipSound();
      }
    });
  }
}

// Safely execute initApp regardless of script load timing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
