/* Procedural driving audio: engine, tyres, wind, impacts, horn, rain. */

export class DriveAudio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  engineBus!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  private osc1!: OscillatorNode;
  private osc2!: OscillatorNode;
  private osc3!: OscillatorNode;
  private engineGain!: GainNode;
  private engineFilter!: BiquadFilterNode;
  private skidGain!: GainNode;
  private windGain!: GainNode;
  private rainGain!: GainNode;
  private noiseBuf!: AudioBuffer;
  private musicTimer: number | null = null;
  private step = 0;
  private nextTime = 0;
  volumes = { master: 0.8, music: 0.35, sfx: 0.9 };
  started = false;

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volumes.master;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.volumes.sfx;
      this.sfxBus.connect(this.master);
      this.engineBus = this.ctx.createGain();
      this.engineBus.gain.value = 0;
      this.engineBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0;
      this.musicBus.connect(this.master);

      // noise buffer
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;

      // engine: three detuned saw/square oscillators through a lowpass
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 900;
      this.engineFilter.Q.value = 3;
      this.engineFilter.connect(this.engineBus);
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.5;
      this.engineGain.connect(this.engineFilter);
      this.osc1 = this.ctx.createOscillator();
      this.osc1.type = 'sawtooth';
      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = 'square';
      this.osc3 = this.ctx.createOscillator();
      this.osc3.type = 'sawtooth';
      const g2 = this.ctx.createGain();
      g2.gain.value = 0.35;
      const g3 = this.ctx.createGain();
      g3.gain.value = 0.2;
      this.osc1.connect(this.engineGain);
      this.osc2.connect(g2);
      g2.connect(this.engineGain);
      this.osc3.connect(g3);
      g3.connect(this.engineGain);
      this.osc1.start();
      this.osc2.start();
      this.osc3.start();

      // skid
      const skidSrc = this.ctx.createBufferSource();
      skidSrc.buffer = buf;
      skidSrc.loop = true;
      const skidFilter = this.ctx.createBiquadFilter();
      skidFilter.type = 'bandpass';
      skidFilter.frequency.value = 2400;
      skidFilter.Q.value = 1.4;
      this.skidGain = this.ctx.createGain();
      this.skidGain.gain.value = 0;
      skidSrc.connect(skidFilter);
      skidFilter.connect(this.skidGain);
      this.skidGain.connect(this.master);
      skidSrc.start();

      // wind
      const windSrc = this.ctx.createBufferSource();
      windSrc.buffer = buf;
      windSrc.loop = true;
      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 420;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;
      windSrc.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.master);
      windSrc.start();

      // rain
      const rainSrc = this.ctx.createBufferSource();
      rainSrc.buffer = buf;
      rainSrc.loop = true;
      const rainFilter = this.ctx.createBiquadFilter();
      rainFilter.type = 'highpass';
      rainFilter.frequency.value = 2600;
      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0;
      rainSrc.connect(rainFilter);
      rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.master);
      rainSrc.start();

      this.started = true;
    } catch {
      this.ctx = null;
    }
  }

  resume() {
    this.init();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(v: { master: number; music: number; sfx: number }) {
    this.volumes = v;
    if (!this.ctx) return;
    this.master.gain.value = v.master;
    this.sfxBus.gain.value = v.sfx;
    this.musicBus.gain.value = v.music * 0.5;
  }

  /** Called every frame with the current engine state. */
  updateEngine(rpm: number, load: number, speed: number, skid: number, rain: number, moving: boolean, muted: boolean) {
    if (!this.ctx || !this.started) return;
    const t = this.ctx.currentTime;
    const f = 26 + (rpm / 8600) * 118;
    this.osc1.frequency.setTargetAtTime(f, t, 0.05);
    this.osc2.frequency.setTargetAtTime(f * 1.005, t, 0.05);
    this.osc3.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    this.engineFilter.frequency.setTargetAtTime(500 + load * 2400 + (rpm / 8600) * 2600, t, 0.08);
    const vol = muted || !moving ? 0.0 : 0.1 + load * 0.16 + (rpm / 8600) * 0.16;
    this.engineBus.gain.setTargetAtTime(vol, t, 0.08);
    this.skidGain.gain.setTargetAtTime(muted ? 0 : skid * 0.2, t, 0.06);
    this.windGain.gain.setTargetAtTime(muted ? 0 : Math.min(0.16, (speed / 90) * 0.16), t, 0.15);
    this.rainGain.gain.setTargetAtTime(muted ? 0 : rain * 0.13, t, 0.4);
  }

  private noiseBurst(dur: number, freq: number, vol: number, type: BiquadFilterType = 'bandpass') {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', end?: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    if (end) o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  impact(force: number) {
    this.resume();
    const v = Math.min(0.55, force * 0.06);
    this.tone(90, 0.28, v, 'square', 40);
    this.noiseBurst(0.22, 300 + force * 60, v * 0.8, 'lowpass');
  }
  shift() {
    this.resume();
    this.noiseBurst(0.07, 1800, 0.1);
  }
  horn(on: boolean) {
    if (!on) return;
    this.resume();
    this.tone(420, 0.35, 0.16, 'square');
    this.tone(520, 0.35, 0.12, 'square');
  }
  click() {
    this.resume();
    this.tone(760, 0.05, 0.1, 'square', 1100);
  }
  startEngine() {
    this.resume();
    this.tone(60, 0.9, 0.2, 'sawtooth', 220);
    this.noiseBurst(0.5, 700, 0.14, 'lowpass');
  }

  /* --- ambient menu music (simple arpeggio loop) --- */
  startMusic() {
    this.init();
    if (!this.ctx || this.musicTimer) return;
    this.musicBus.gain.value = this.volumes.music * 0.5;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    const schedule = () => {
      if (!this.ctx) return;
      while (this.nextTime < this.ctx.currentTime + 0.25) {
        const notes = [55, 82.4, 110, 146.8, 164.8, 110, 82.4, 98];
        const n = notes[this.step % notes.length] * (this.step % 16 < 8 ? 1 : 1.5);
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = n * 2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, this.nextTime);
        g.gain.linearRampToValueAtTime(0.09, this.nextTime + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, this.nextTime + 0.42);
        o.connect(g);
        g.connect(this.musicBus);
        o.start(this.nextTime);
        o.stop(this.nextTime + 0.5);
        this.nextTime += 0.34;
        this.step++;
      }
      this.musicTimer = window.setTimeout(schedule, 60);
    };
    schedule();
  }

  stopMusic() {
    if (this.musicTimer) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
    if (this.ctx) this.musicBus.gain.value = 0;
  }
}

export const driveAudio = new DriveAudio();
