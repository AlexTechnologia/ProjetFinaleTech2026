/**
 * audio.js — VeilCraft Procedural Audio Engine
 *
 * All sounds generated in real-time using Web Audio API.
 * No audio files required — everything is synthesized from oscillators,
 * noise, and filters.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.volume = 0.7;
    this.muted = false;
    this._initialized = false;
  }

  /**
   * Initialize AudioContext on first user interaction.
   * (Browsers block AudioContext until user gesture)
   */
  init() {
    if (this._initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this._initialized = true;
      console.log('[Audio] Engine initialized, sample rate:', this.ctx.sampleRate);
    } catch (e) {
      console.warn('[Audio] Web Audio API not available:', e);
    }
  }

  _ensureInit() {
    if (!this._initialized) return false;
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx?.currentTime || 0);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime
      );
    }
    return this.muted;
  }

  _osc(freq, type, startTime, duration, gain = 0.3, fadeOut = true) {
    if (!this._ensureInit()) return null;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gainNode.gain.setValueAtTime(gain, startTime);
    if (fadeOut) gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gainNode);
    gainNode.connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
    return { osc, gainNode };
  }

  _noise(startTime, duration, gain = 0.2, filterFreq = 1000, filterType = 'lowpass') {
    if (!this._ensureInit()) return null;
    const ctx = this.ctx;
    const bufLen = Math.max(1, Math.ceil(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(gain, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);
    source.start(startTime);
    source.stop(startTime + duration + 0.01);
    return { source, filter, gainNode };
  }

  playHitWood() {
    if (!this._ensureInit()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t); osc.stop(t + 0.3);
    this._noise(t, 0.12, 0.15, 600, 'bandpass');
  }

  playHitRock() {
    if (!this._ensureInit()) return;
    const t = this.ctx.currentTime;
    this._osc(1800, 'triangle', t, 0.08, 0.3);
    this._osc(1200, 'triangle', t, 0.12, 0.15);
    this._noise(t, 0.08, 0.3, 3000, 'highpass');
  }

  playPickup() {
    if (!this._ensureInit()) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      this._osc(freq, 'sine', t + i * 0.06, 0.2, 0.25 - i * 0.05);
    });
  }

  playEnemyHit() {
    if (!this._ensureInit()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const distortion = this.ctx.createWaveShaper();
    const gainNode = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x));
    }
    distortion.curve = curve;
    gainNode.gain.setValueAtTime(0.4, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(distortion);
    distortion.connect(gainNode);
    gainNode.connect(this.masterGain);
    osc.start(t); osc.stop(t + 0.2);
  }

  playPlayerHurt() {
    if (!this._ensureInit()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.2);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t); osc.stop(t + 0.3);
    this._noise(t, 0.1, 0.1, 800, 'bandpass');
  }

  playCraftSuccess() {
    if (!this._ensureInit()) return;
    const t = this.ctx.currentTime;
    const melody = [392, 523.25, 659.25, 880];
    melody.forEach((freq, i) => {
      this._osc(freq, 'sine', t + i * 0.08, 0.3, 0.2);
      this._osc(freq * 2, 'sine', t + i * 0.08, 0.15, 0.05);
    });
  }

  playNightStart() {
    if (!this._ensureInit()) return;
    const t = this.ctx.currentTime;
    for (const freq of [60, 80, 100]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 1);
      gain.gain.linearRampToValueAtTime(0, t + 4);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t); osc.stop(t + 5);
    }
    const alarm = this.ctx.createOscillator();
    const alarmGain = this.ctx.createGain();
    alarm.type = 'square';
    alarm.frequency.setValueAtTime(200, t + 0.5);
    alarm.frequency.linearRampToValueAtTime(600, t + 2);
    alarmGain.gain.setValueAtTime(0.1, t + 0.5);
    alarmGain.gain.exponentialRampToValueAtTime(0.001, t + 3);
    alarm.connect(alarmGain);
    alarmGain.connect(this.masterGain);
    alarm.start(t + 0.5); alarm.stop(t + 3.5);
  }

  playDayStart() {
    if (!this._ensureInit()) return;
    const t = this.ctx.currentTime;
    const chord = [261.63, 329.63, 392, 523.25];
    chord.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.1);
      gain.gain.setValueAtTime(0, t + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.15, t + i * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 1.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 2);
    });
  }

  playWaveSpawn() {
    if (!this._ensureInit()) return;
    const t = this.ctx.currentTime;
    for (let rep = 0; rep < 3; rep++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, t + rep * 0.4);
      osc.frequency.linearRampToValueAtTime(700, t + rep * 0.4 + 0.2);
      gain.gain.setValueAtTime(0.2, t + rep * 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, t + rep * 0.4 + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + rep * 0.4);
      osc.stop(t + rep * 0.4 + 0.4);
    }
  }

  playDeath() {
    if (!this._ensureInit()) return;
    const t = this.ctx.currentTime;
    const descend = [440, 349.23, 293.66, 220, 174.61];
    descend.forEach((freq, i) => {
      this._osc(freq, 'sine', t + i * 0.22, 0.4, 0.3 - i * 0.04);
    });
    this._noise(t, 0.5, 0.15, 200, 'lowpass');
  }

  playFootstep() {
    if (!this._ensureInit()) return;
    const t = this.ctx.currentTime;
    const freq = 100 + Math.random() * 40;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.07);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t); osc.stop(t + 0.12);
    this._noise(t, 0.06, 0.06, 400, 'lowpass');
  }

  update(dt, isMoving, isSprinting) {
    if (!this._ensureInit() || !isMoving) return;
    this._footstepTimer = (this._footstepTimer || 0) + dt;
    const interval = isSprinting ? 0.3 : 0.5;
    if (this._footstepTimer >= interval) {
      this._footstepTimer = 0;
      this.playFootstep();
    }
  }

  startWindLoop() {
    if (!this._ensureInit()) return () => {};
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const bufLen = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 200;
    filter.Q.value = 0.5;
    const gain = ctx.createGain();
    gain.gain.value = 0.04;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(t);
    return () => { try { source.stop(); } catch(e) {} };
  }
}

window.AudioEngine = AudioEngine;
window.audio = new AudioEngine();
