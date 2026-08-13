// Web Audio API High-Energy Synthesizer for Exciting Arcade Game Audio Effects

class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 🪙 Casino Poker Chip Placement (اصوات فيشات كازينو حماسية ومعدنية)
  playChipSound() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // High metallic clink
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1400, now);
    osc1.frequency.exponentialRampToValueAtTime(2800, now + 0.06);

    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.07);

    // Subtle wooden impact thump
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(320, now);
    osc2.frequency.exponentialRampToValueAtTime(160, now + 0.05);

    gain2.gain.setValueAtTime(0.3, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.05);
  }

  // ⏰ Countdown Warning Ticks (صوت تنازلي حماسي ومحفز)
  playTickSound() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  // 🎡 Wheel Sector Pass Click (صوت طقطقة العجلة السريع، الواقعي والمبهر)
  playSpinTickSound() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Wooden/Crystal Peg Click (ضربة السهم الذهبي للقطاع)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(1800, now);
    osc1.frequency.exponentialRampToValueAtTime(750, now + 0.025);

    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.025);

    // 2. High Golden Ring Resonance (رنين دقيق وممتع)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2600, now);
    osc2.frequency.exponentialRampToValueAtTime(1300, now + 0.018);

    gain2.gain.setValueAtTime(0.2, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.018);
  }

  // 🎉 Victorious Fanfare Jackpot (نغمة انتصار ومكافأة حماسية جداً)
  playWinSound(isDream = false) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = isDream 
      ? [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98] // Grand Dream x10 Fanfare (C5-E5-G5-C6-E6-G6)
      : [440.00, 554.37, 659.25, 880.00, 1108.73];          // Exciting Winner Fanfare (A4-C#5-E5-A5-C#6)
    
    const noteDuration = 0.12;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = isDream ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * noteDuration);

      gain.gain.setValueAtTime(0.45, now + idx * noteDuration);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (idx + 1) * noteDuration + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * noteDuration);
      osc.stop(now + (idx + 1) * noteDuration + 0.25);
    });

    // Deep triumph bass drop
    const bassOsc = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(isDream ? 150 : 130, now);
    bassOsc.frequency.exponentialRampToValueAtTime(50, now + 0.6);

    bassGain.gain.setValueAtTime(0.5, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    bassOsc.connect(bassGain);
    bassGain.connect(this.ctx.destination);
    bassOsc.start(now);
    bassOsc.stop(now + 0.6);
  }
}

window.soundFx = new SoundSynthesizer();
