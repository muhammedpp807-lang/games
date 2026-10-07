/* Procedural audio engine — all sounds are synthesised, no external assets. */

type Ctx = AudioContext & { _unlocked?: boolean };

class AudioEngine {
  ctx: Ctx | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  crowdBus!: GainNode;
  crowdSource: AudioBufferSourceNode | null = null;
  crowdGain: GainNode | null = null;
  musicTimer: number | null = null;
  step = 0;
  nextNoteTime = 0;
  tempo = 128;
  playing = false;
  volumes = { master: 0.8, sfx: 0.9, music: 0.45 };
  soundOn = true;
  musicOn = true;
  private noiseBuffer: AudioBuffer | null = null;

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC() as Ctx;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volumes.master;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.volumes.sfx;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0;
      this.musicBus.connect(this.master);
      this.crowdBus = this.ctx.createGain();
      this.crowdBus.gain.value = 0;
      this.crowdBus.connect(this.master);
    } catch {
      this.ctx = null;
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(v: { master: number; sfx: number; music: number }) {
    this.volumes = v;
    if (!this.ctx) return;
    this.master.gain.value = v.master;
    this.sfxBus.gain.value = v.sfx;
    if (this.musicOn && this.playing) this.musicBus.gain.value = v.music * 0.6;
    if (this.crowdGain) this.crowdGain.gain.value = v.music * 0.35;
  }

  private noise(): AudioBuffer {
    const ctx = this.ctx!;
    if (this.noiseBuffer) return this.noiseBuffer;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
    return buf;
  }

  private env(node: AudioNode, t: number, a: number, d: number, peak = 1) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    node.connect(g);
    return g;
  }

  private tone(
    freq: number,
    t: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    bus: AudioNode,
    freqEnd?: number,
    detune = 0,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    if (detune) o.detune.value = detune;
    const g = this.env(o, t, 0.008, dur, vol);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.06);
  }

  private noiseHit(t: number, dur: number, vol: number, filterFreq: number, bus: AudioNode, q = 1) {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise();
    src.playbackRate.value = 1;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filterFreq;
    f.Q.value = q;
    src.connect(f);
    const g = this.env(f, t, 0.005, dur, vol);
    g.connect(bus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /* ------- SFX ------- */
  click() {
    if (!this.soundOn) return;
    this.resume();
    const t = this.ctx?.currentTime ?? 0;
    this.tone(660, t, 0.06, 'square', 0.16, this.sfxBus, 990);
    this.noiseHit(t, 0.04, 0.08, 2600, this.sfxBus);
  }
  hover() {
    if (!this.soundOn) return;
    this.resume();
    const t = this.ctx?.currentTime ?? 0;
    this.tone(880, t, 0.04, 'triangle', 0.06, this.sfxBus, 1200);
  }
  kick(power = 1) {
    if (!this.soundOn) return;
    this.resume();
    const t = this.ctx?.currentTime ?? 0;
    this.tone(220 + power * 60, t, 0.12 + power * 0.05, 'square', 0.28 * power, this.sfxBus, 70);
    this.noiseHit(t, 0.09 + power * 0.05, 0.24 * power, 1200 + power * 500, this.sfxBus, 0.8);
  }
  bounce() {
    if (!this.soundOn) return;
    this.resume();
    const t = this.ctx?.currentTime ?? 0;
    this.tone(340, t, 0.07, 'sine', 0.14, this.sfxBus, 180);
    this.noiseHit(t, 0.04, 0.06, 900, this.sfxBus);
  }
  jump() {
    if (!this.soundOn) return;
    this.resume();
    const t = this.ctx?.currentTime ?? 0;
    this.tone(300, t, 0.12, 'triangle', 0.13, this.sfxBus, 640);
  }
  slide() {
    if (!this.soundOn) return;
    this.resume();
    const t = this.ctx?.currentTime ?? 0;
    this.noiseHit(t, 0.3, 0.12, 700, this.sfxBus, 0.6);
  }
  superShot() {
    if (!this.soundOn) return;
    this.resume();
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(140, t, 0.5, 'sawtooth', 0.3, this.sfxBus, 1500);
    this.tone(70, t, 0.6, 'square', 0.25, this.sfxBus, 40);
    this.noiseHit(t, 0.45, 0.3, 1800, this.sfxBus, 0.4);
    for (let i = 0; i < 5; i++) this.tone(500 + i * 180, t + i * 0.05, 0.25, 'triangle', 0.12, this.sfxBus, 1800 + i * 200);
  }
  charge() {
    if (!this.soundOn) return;
    this.resume();
    const t = this.ctx?.currentTime ?? 0;
    this.tone(400, t, 0.35, 'sine', 0.14, this.sfxBus, 1400);
  }
  goal() {
    if (!this.soundOn) return;
    this.resume();
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => this.tone(n, t + i * 0.09, 0.3, 'square', 0.22, this.sfxBus));
    this.tone(1568, t + 0.38, 0.6, 'triangle', 0.2, this.sfxBus);
    this.noiseHit(t, 0.5, 0.18, 700, this.sfxBus, 0.5);
  }
  whistle(long = false) {
    if (!this.soundOn) return;
    this.resume();
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const dur = long ? 0.75 : 0.28;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(2100, t);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 28;
    const lg = ctx.createGain();
    lg.gain.value = 90;
    lfo.connect(lg);
    lg.connect(o.frequency);
    const g = this.env(o, t, 0.02, dur, 0.2);
    g.connect(this.sfxBus);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.1);
    lfo.stop(t + dur + 0.1);
  }
  crowd(intensity = 1) {
    if (!this.soundOn) return;
    this.resume();
    const t = this.ctx?.currentTime ?? 0;
    this.noiseHit(t, 0.7 * intensity, 0.1 * intensity, 500, this.crowdBus ?? this.sfxBus, 0.4);
  }
  trophy() {
    if (!this.soundOn) return;
    this.resume();
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const seq = [392, 523, 659, 784, 1046, 1318];
    seq.forEach((n, i) => {
      this.tone(n, t + i * 0.14, 0.5, 'square', 0.2, this.sfxBus);
      this.tone(n * 2, t + i * 0.14, 0.3, 'triangle', 0.09, this.sfxBus);
    });
    this.tone(1046, t + 0.95, 1.4, 'triangle', 0.16, this.sfxBus);
    this.noiseHit(t + 0.9, 1.2, 0.12, 900, this.sfxBus, 0.3);
  }

  /* ------- Crowd ambience loop ------- */
  startCrowd() {
    this.init();
    const ctx = this.ctx;
    if (!ctx || this.crowdSource) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise();
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 480;
    f.Q.value = 0.5;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'lowpass';
    f2.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f);
    f.connect(f2);
    f2.connect(g);
    g.connect(this.master);
    src.start();
    this.crowdSource = src;
    this.crowdGain = g;
    g.gain.linearRampToValueAtTime(this.musicOn ? this.volumes.music * 0.3 : 0, ctx.currentTime + 1.2);
    // slow modulation for a "living" crowd
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lg = ctx.createGain();
    lg.gain.value = 0.06;
    lfo.connect(lg);
    lg.connect(g.gain);
    lfo.start();
  }
  stopCrowd() {
    if (this.crowdSource) {
      try {
        this.crowdSource.stop();
      } catch {
        /* noop */
      }
      this.crowdSource = null;
      this.crowdGain = null;
    }
  }
  crowdSwell() {
    if (!this.crowdGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.crowdGain.gain.cancelScheduledValues(t);
    this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, t);
    this.crowdGain.gain.linearRampToValueAtTime(Math.min(1, this.volumes.music * 1.1), t + 0.12);
    this.crowdGain.gain.linearRampToValueAtTime(this.volumes.music * 0.3, t + 2.2);
  }

  /* ------- Music: chiptune scheduler ------- */
  private bass = [0, 0, 7, 7, 5, 5, 3, 3];
  private lead = [12, 16, 19, 16, 17, 14, 12, 9, 12, 19, 24, 19, 17, 16, 14, 12];

  startMusic() {
    this.init();
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    if (this.musicOn) this.musicBus.gain.value = this.volumes.music * 0.6;
    const schedule = () => {
      if (!this.ctx || !this.playing) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.2) {
        this.playStep(this.step, this.nextNoteTime);
        this.nextNoteTime += 60 / this.tempo / 2;
        this.step++;
      }
      this.musicTimer = window.setTimeout(schedule, 40);
    };
    schedule();
  }

  stopMusic() {
    this.playing = false;
    if (this.musicTimer) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
    if (this.ctx) this.musicBus.gain.value = 0;
  }

  private playStep(step: number, t: number) {
    const bus = this.musicBus;
    const root = 55; // A1
    const bar = Math.floor(step / 8) % 4;
    const roots = [0, 5, 7, 3];
    const b = this.bass[step % 8] + roots[bar];
    this.tone(root * Math.pow(2, b / 12), t, 0.16, 'square', 0.2, bus);
    if (step % 2 === 0) this.noiseHit(t, 0.05, 0.09, 4200, bus, 2);
    if (step % 8 === 4) this.noiseHit(t, 0.12, 0.14, 1800, bus, 0.8);
    if (step % 4 === 0) this.tone(root * Math.pow(2, b / 12) * 2, t, 0.1, 'triangle', 0.1, bus);
    const l = this.lead[step % 16] + roots[bar];
    if (this.playing) this.tone(root * 2 * Math.pow(2, l / 12), t, 0.14, 'square', 0.07, bus);
  }

  applySettings(s: { master: number; music: number; sfx: number; musicOn: boolean; soundOn: boolean }) {
    this.setVolumes({ master: s.master, sfx: s.sfx, music: s.music });
    this.soundOn = s.soundOn;
    this.musicOn = s.musicOn;
    if (s.musicOn && this.playing && this.ctx) this.musicBus.gain.value = s.music * 0.6;
    else if (this.ctx) this.musicBus.gain.value = 0;
    if (this.crowdGain && this.ctx) this.crowdGain.gain.value = s.musicOn ? s.music * 0.3 : 0;
  }
}

export const audio = new AudioEngine();
