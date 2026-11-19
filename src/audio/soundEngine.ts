import { WeaponSpec } from '../types/game';

class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.noiseBuffer && this.ctx) {
      const bufferSize = this.ctx.sampleRate * 1.2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    return this.ctx;
  }

  public unlock() {
    this.ensureContext();
  }

  public playShot(profile: WeaponSpec['soundProfile']) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    if (profile === 'plasma' || profile === 'laser') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = profile === 'plasma' ? 'sawtooth' : 'square';
      const startFreq = profile === 'plasma' ? 920 : 1280;
      const endFreq = profile === 'plasma' ? 180 : 340;
      const dur = profile === 'plasma' ? 0.14 : 0.18;

      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur);
      return;
    }

    // Gunpowder noise burst + low punch
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const noiseGain = ctx.createGain();

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    let dur = 0.14;
    let freq = 1100;
    let vol = 0.25;
    let punchFreq = 140;

    switch (profile) {
      case 'pistol':
        dur = 0.11;
        freq = 1400;
        vol = 0.22;
        punchFreq = 160;
        break;
      case 'smg':
        // Suppressed crisp subsonic thump
        dur = 0.065;
        freq = 980;
        vol = 0.13;
        punchFreq = 220;
        break;
      case 'rifle':
        dur = 0.15;
        freq = 1280;
        vol = 0.27;
        punchFreq = 135;
        break;
      case 'heavy':
        dur = 0.19;
        freq = 900;
        vol = 0.31;
        punchFreq = 110;
        break;
      case 'shotgun':
        dur = 0.3;
        freq = 700;
        vol = 0.4;
        punchFreq = 85;
        break;
      case 'sniper':
        dur = 0.38;
        freq = 1100;
        vol = 0.44;
        punchFreq = 72;
        break;
      case 'lmg':
        dur = 0.14;
        freq = 1050;
        vol = 0.24;
        punchFreq = 128;
        break;
      case 'grenade':
        dur = 0.22;
        freq = 420;
        vol = 0.3;
        punchFreq = 85;
        break;
    }

    filter.frequency.setValueAtTime(freq, now);
    filter.Q.setValueAtTime(0.8, now);

    noiseGain.gain.setValueAtTime(vol, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(punchFreq, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + dur * 0.7);
    oscGain.gain.setValueAtTime(vol * 0.85, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.7);

    noise.connect(filter).connect(noiseGain).connect(ctx.destination);
    osc.connect(oscGain).connect(ctx.destination);

    noise.start(now);
    noise.stop(now + dur);
    osc.start(now);
    osc.stop(now + dur * 0.75);
  }

  public playExplosion() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(620, now);
    filter.frequency.exponentialRampToValueAtTime(65, now + 0.65);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.72);
  }

  public playReload() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [0, 0.16].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(idx === 0 ? 420 : 660, now + offset);
      osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 220 : 880, now + offset + 0.05);
      gain.gain.setValueAtTime(0.09, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.07);
    });
  }

  public playHit(headshot: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = headshot ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(headshot ? 1480 : 680, now);
    osc.frequency.exponentialRampToValueAtTime(headshot ? 1960 : 380, now + 0.07);
    gain.gain.setValueAtTime(headshot ? 0.16 : 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playEmptyClick() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(950, now);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  public playHurt() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playWaveStart() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.linearRampToValueAtTime(195, now + 0.35);
    osc.frequency.linearRampToValueAtTime(155, now + 0.75);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.85);
  }

  public playBossSpawn() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [95, 72, 118].forEach((baseFreq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 1 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.55, now + 1.15);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(i === 1 ? 0.18 : 0.14, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.3);
    });
  }

  public playPickup() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.055);
      gain.gain.setValueAtTime(0.1, now + i * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.13);
    });
  }

  public playStoneThrow() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.14);
  }

  public playStoneImpact() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.075].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 520 : 690, now + offset);
      osc.frequency.exponentialRampToValueAtTime(160, now + offset + 0.05);
      gain.gain.setValueAtTime(idx === 0 ? 0.24 : 0.12, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.065);
    });
  }

  public playCrateOpen() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [220, 330, 587].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.14, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.15);
    });
  }

  public playCarHorn() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [340, 425].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.setValueAtTime(0.12, now + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    });
  }

  public playVehicleHit() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.2);
  }

  public playPinPull() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1620, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.06);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playTrapPlace() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.065].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(i === 0 ? 310 : 480, now + offset);
      osc.frequency.exponentialRampToValueAtTime(140, now + offset + 0.05);
      gain.gain.setValueAtTime(0.1, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.055);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.06);
    });
  }

  public playTrapSnap() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1450, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.15);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.11);
    oscGain.gain.setValueAtTime(0.18, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playMeleeSwing(heavy = false) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(heavy ? 360 : 720, now);
    filter.frequency.exponentialRampToValueAtTime(heavy ? 180 : 320, now + 0.14);
    filter.Q.setValueAtTime(1.3, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.17);
  }

  public playMeleeHit(headshot: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(headshot ? 1200 : 650, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(headshot ? 0.3 : 0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.13);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(headshot ? 260 : 145, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.1);
    oscGain.gain.setValueAtTime(0.26, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}

export const soundEngine = new ProceduralSoundEngine();
