/**
 * audio.js - Procedural Sound Engine using Web Audio API
 * Generates dynamic, responsive audio effects for bubble interactions:
 * bloops, jelly boings, mini-pops, stress creaks, and explosive bursting.
 */

class BubbleAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isInitialized = false;
    this.masterGain = null;
    this.lastSoundTime = {};
  }

  /**
   * Initializes the AudioContext on the first user gesture.
   */
  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.75, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.isInitialized = true;
    } catch (e) {
      console.warn("Web Audio API not supported or blocked:", e);
    }
  }

  resume() {
    if (!this.isInitialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.75, this.ctx.currentTime, 0.05);
    }
    return !this.isMuted;
  }

  setMuted(mute) {
    this.isMuted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.75, this.ctx.currentTime, 0.05);
    }
  }

  // Throttle helper to avoid sound stuttering
  _canPlay(type, minIntervalMs = 50) {
    if (this.isMuted || !this.ctx) return false;
    const now = performance.now();
    if (this.lastSoundTime[type] && now - this.lastSoundTime[type] < minIntervalMs) {
      return false;
    }
    this.lastSoundTime[type] = now;
    return true;
  }

  /**
   * Play poke sound: A bouncy liquid "bloop"
   * @param {number} intensity - 0 to 1
   */
  playPoke(intensity = 0.5) {
    if (!this._canPlay('poke', 45)) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Frequency drops rapidly from ~500Hz to 180Hz (classic water droplet bloop)
    const baseFreq = 380 + intensity * 260;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);

    const vol = 0.3 + intensity * 0.4;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  /**
   * Play mini-bubble pop sound: high-pitched crisp pip!
   */
  playMiniPop() {
    if (!this._canPlay('miniPop', 30)) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const freq = 800 + Math.random() * 600;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.02);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.07);
  }

  /**
   * Play wall bounce / squash boing
   */
  playBounce(velocity = 0.5) {
    if (!this._canPlay('bounce', 90)) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const startFreq = 160 + velocity * 120;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 1.8, t + 0.06);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.22);

    const vol = Math.min(0.6, 0.2 + velocity * 0.4);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  /**
   * Play rubbery tension wobble when stretching
   */
  playStretch(tension = 0.5) {
    if (!this._canPlay('stretch', 140)) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const pitch = 220 + tension * 400;
    osc.frequency.setValueAtTime(pitch, t);
    osc.frequency.linearRampToValueAtTime(pitch * 1.15, t + 0.08);

    gain.gain.setValueAtTime(0.12 * tension, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.11);
  }

  /**
   * Play the ultimate POP!
   * Multi-layered sound: snappy noise burst + sub-bass impulse + resonance release
   */
  playPop() {
    if (this.isMuted || !this.ctx) return;
    this.resume();

    const t = this.ctx.currentTime;

    // 1. Noise burst (shatter transient)
    const bufferSize = this.ctx.sampleRate * 0.08;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1400, t);
    noiseFilter.Q.setValueAtTime(1.5, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    whiteNoise.start(t);
    whiteNoise.stop(t + 0.08);

    // 2. Sub-bass pop punch
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(320, t);
    subOsc.frequency.exponentialRampToValueAtTime(55, t + 0.15);

    subGain.gain.setValueAtTime(0.9, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    subOsc.start(t);
    subOsc.stop(t + 0.17);

    // 3. High pitch "plink"
    const highOsc = this.ctx.createOscillator();
    const highGain = this.ctx.createGain();
    highOsc.type = 'triangle';
    highOsc.frequency.setValueAtTime(1200, t);
    highOsc.frequency.exponentialRampToValueAtTime(2400, t + 0.03);
    highOsc.frequency.exponentialRampToValueAtTime(400, t + 0.1);

    highGain.gain.setValueAtTime(0.4, t);
    highGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    highOsc.connect(highGain);
    highGain.connect(this.masterGain);

    highOsc.start(t);
    highOsc.stop(t + 0.11);
  }

  /**
   * Play bubble respawn / inflation sound
   */
  playRespawn() {
    if (this.isMuted || !this.ctx) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(560, t + 0.35);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.46);
  }

  /**
   * Play sigh of relief sound
   */
  playSigh() {
    if (!this._canPlay('sigh', 1000)) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.28);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.33);
  }
}

window.bubbleAudio = new BubbleAudioEngine();

