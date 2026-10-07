import {
  BALL_GRAVITY,
  BALL_R,
  CEILING,
  GOAL_H,
  GOAL_L_X,
  GOAL_R_X,
  GRAVITY,
  GROUND,
  H,
  W,
  clamp,
  lerp,
  rand,
} from './constants';
import { drawBall, drawGoal, drawStadium, Particles } from './draw';
import { drawChibi, type ChibiLook, type Pose } from './chibi';
import { abilityById } from './data';
import { DIFFICULTY_INFO } from './data';
import { audio } from './audio';
import type { MatchConfig, MatchResult, PlayerSetup } from './types';

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  slide: boolean;
  shoot: boolean;
  super: boolean;
  axis: number; // touch joystick -1..1
}

export interface HudState {
  score: [number, number];
  time: number;
  charge: [number, number];
  superOn: [boolean, boolean];
  phase: 'kickoff' | 'play' | 'goal' | 'ended';
  suddenDeath: boolean;
}

interface Ent {
  i: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  pose: Pose;
  phase: number;
  kickT: number;
  kickHit: boolean;
  slideT: number;
  slideCd: number;
  jumpCd: number;
  stun: number;
  freeze: number;
  dashT: number;
  superT: number;
  charge: number;
  cooldown: number;
  goals: number;
  shots: number;
  saves: number;
  supers: number;
  celebration: number;
  touchTime: number;
  input: InputState;
  prevShoot: boolean;
  prevSuper: boolean;
  aiTimer: number;
  aiPlan: string;
  setup: PlayerSetup;
  look: ChibiLook;
}

interface Keeper {
  side: -1 | 1;
  x: number;
  y: number;
  vy: number;
  look: ChibiLook;
  stun: number;
  saves: number;
  dive: number;
  react: number;
  targetY: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  trail: { x: number; y: number; a: number }[];
  superBy: number; // 0 none, 1/2 player index+1
  superEffect: string | null;
  superColor: string;
  curveT: number;
  curveDir: number;
  magnetT: number;
  magnetTo: number;
  smashT: number;
  lastTouch: number;
}

export interface EngineCallbacks {
  onGoal?: (scorer: number) => void;
  onEnd?: (r: MatchResult) => void;
  onPhase?: (p: HudState['phase'], suddenDeath: boolean) => void;
}

const emptyInput = (): InputState => ({
  left: false,
  right: false,
  jump: false,
  slide: false,
  shoot: false,
  super: false,
  axis: 0,
});

export class MatchEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cfg: MatchConfig;
  cb: EngineCallbacks;
  players: Ent[] = [];
  keepers: Keeper[] = [];
  ball!: Ball;
  parts = new Particles();
  state: HudState['phase'] = 'kickoff';
  timeLeft: number;
  score: [number, number] = [0, 0];
  suddenDeath: boolean;
  phaseTimer = 2.2;
  goalTimer = 0;
  goalScorer = 0;
  celebration = 0;
  shake = 0;
  zoom = 1;
  camX = W / 2;
  camY = H / 2;
  zoomTarget = 1;
  camTargetX = W / 2;
  running = false;
  paused = false;
  raf = 0;
  lastT = 0;
  t = 0;
  quality: string;
  shakeOn: boolean;
  mood = 0;
  flash = 0;
  dpr = 1;
  cssW = W;
  cssH = H;
  ended = false;
  shields: number[] = [0, 0];
  private poss: [number, number] = [0, 0];

  constructor(canvas: HTMLCanvasElement, cfg: MatchConfig, cb: EngineCallbacks = {}) {
    this.canvas = canvas;
    const c = canvas.getContext('2d', { alpha: false });
    if (!c) throw new Error('no 2d context');
    this.ctx = c;
    this.cfg = cfg;
    this.cb = cb;
    this.timeLeft = cfg.duration;
    this.suddenDeath = cfg.suddenDeath;
    this.quality = 'high';
    this.shakeOn = true;
    this.resize();
    this.buildTeams();
    this.resetPositions(0);
    this.state = 'kickoff';
    this.phaseTimer = 2.4;
  }

  /* ---------- setup ---------- */
  private mkEnt(setup: PlayerSetup, i: number): Ent {
    return {
      i,
      x: i === 0 ? W * 0.32 : W * 0.68,
      y: GROUND,
      vx: 0,
      vy: 0,
      facing: i === 0 ? 1 : -1,
      onGround: true,
      pose: 'idle',
      phase: 0,
      kickT: 0,
      kickHit: false,
      slideT: 0,
      slideCd: 0,
      jumpCd: 0,
      stun: 0,
      freeze: 0,
      dashT: 0,
      superT: 0,
      charge: 0,
      cooldown: 0,
      goals: 0,
      shots: 0,
      saves: 0,
      supers: 0,
      celebration: 0,
      touchTime: 0,
      input: emptyInput(),
      prevShoot: false,
      prevSuper: false,
      aiTimer: 0,
      aiPlan: 'chase',
      setup,
      look: {
        kit: setup.team.primary,
        kit2: setup.team.secondary,
        accent: setup.team.accent,
        skin: setup.character.skin,
        hair: setup.character.hair,
        hairStyle: setup.character.hairStyle,
        number: setup.character.number,
      },
    };
  }

  private buildTeams() {
    this.players = [this.mkEnt(this.cfg.p1, 0), this.mkEnt(this.cfg.p2, 1)];
    const kKit = (c: string, c2: string): ChibiLook => ({
      kit: c,
      kit2: c2,
      accent: '#ffffff',
      skin: '#f0c39b',
      hair: '#2b1d14',
      hairStyle: 'buzz',
      number: 1,
      keeper: true,
    });
    this.keepers = [
      { side: -1, x: GOAL_L_X + 34, y: GROUND - 26, vy: 0, look: kKit('#2ec4b6', '#0b7a75'), stun: 0, saves: 0, dive: 0, react: 0.2, targetY: GROUND - 62 },
      { side: 1, x: GOAL_R_X - 34, y: GROUND - 26, vy: 0, look: kKit('#ff8c42', '#c1440e'), stun: 0, saves: 0, dive: 0, react: 0.2, targetY: GROUND - 62 },
    ];
    this.ball = {
      x: W / 2,
      y: GROUND - BALL_R - 60,
      vx: 0,
      vy: 0,
      r: BALL_R,
      rot: 0,
      vr: 0,
      trail: [],
      superBy: 0,
      superEffect: null,
      superColor: '#ffffff',
      curveT: 0,
      curveDir: 1,
      magnetT: 0,
      magnetTo: 0,
      smashT: 0,
      lastTouch: -1,
    };
  }

  setQuality(q: string, shake: boolean) {
    this.quality = q;
    this.shakeOn = shake;
  }

  /* ---------- input ---------- */
  setInput(i: number, patch: Partial<InputState>) {
    const p = this.players[i];
    if (!p) return;
    Object.assign(p.input, patch);
  }
  clearInputs() {
    this.players.forEach((p) => {
      p.input = emptyInput();
    });
  }

  /* ---------- lifecycle ---------- */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      let dt = (now - this.lastT) / 1000;
      this.lastT = now;
      if (dt > 0.05) dt = 0.05;
      if (!this.paused) {
        this.t += dt;
        this.update(dt);
      }
      this.render();
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
  setPaused(p: boolean) {
    this.paused = p;
    if (p) this.clearInputs();
    else this.lastT = performance.now();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 2);
    this.dpr = dpr;
    this.cssW = Math.max(320, rect.width);
    this.cssH = Math.max(200, rect.height);
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
  }

  get baseScale() {
    return Math.min(this.cssW / W, this.cssH / H);
  }

  /* ---------- match flow ---------- */
  resetPositions(dir: number) {
    // dir: 1 = kickoff toward right, -1 left, 0 neutral
    this.players.forEach((p, i) => {
      p.x = i === 0 ? W * 0.3 : W * 0.7;
      p.y = GROUND;
      p.vx = 0;
      p.vy = 0;
      p.onGround = true;
      p.pose = 'idle';
      p.kickT = 0;
      p.slideT = 0;
      p.stun = 0;
      p.freeze = 0;
      p.dashT = 0;
      p.facing = i === 0 ? 1 : -1;
      if (dir !== 0) p.x = i === 0 ? W * 0.3 : W * 0.7;
    });
    this.keepers.forEach((k) => {
      k.y = GROUND - 26;
      k.vy = 0;
      k.stun = 0;
    });
    this.ball.x = W / 2;
    this.ball.y = GROUND - BALL_R - 46;
    this.ball.vx = dir * 90;
    this.ball.vy = -160;
    this.ball.superBy = 0;
    this.ball.superEffect = null;
    this.ball.magnetT = 0;
    this.ball.smashT = 0;
    this.ball.curveT = 0;
    this.ball.trail = [];
    this.zoomTarget = 1;
    this.camTargetX = W / 2;
  }

  private endMatch() {
    if (this.ended) return;
    this.ended = true;
    this.state = 'ended';
    this.cb.onPhase?.('ended', this.suddenDeath);
    const total = this.poss[0] + this.poss[1] || 1;
    const winner: 0 | 1 | 2 = this.score[0] > this.score[1] ? 1 : this.score[1] > this.score[0] ? 2 : 0;
    audio.whistle(true);
    this.cb.onEnd?.({
      p1Goals: this.score[0],
      p2Goals: this.score[1],
      winner,
      suddenDeath: this.suddenDeath,
      stats: {
        possession: [
          Math.round((this.poss[0] / total) * 100),
          100 - Math.round((this.poss[0] / total) * 100),
        ],
        shots: [this.players[0].shots, this.players[1].shots],
        saves: [this.keepers[0].saves + this.players[0].saves, this.keepers[1].saves + this.players[1].saves],
        supers: [this.players[0].supers, this.players[1].supers],
      },
    });
  }

  private scoreGoal(scorer: number) {
    this.score[scorer === 1 ? 0 : 1] += 1;
    this.goalScorer = scorer;
    this.state = 'goal';
    this.goalTimer = 3.5;
    this.celebration = Math.floor(rand(0, 4));
    this.cb.onPhase?.('goal', this.suddenDeath);
    this.cb.onGoal?.(scorer);
    const e = this.players[scorer === 1 ? 0 : 1];
    e.goals += 1;
    e.pose = 'celebrate';
    e.phase = 0;
    const loser = this.players[scorer === 1 ? 1 : 0];
    loser.pose = 'sad';
    this.shake = this.shakeOn ? 26 : 12;
    this.flash = 1;
    this.zoomTarget = 1.45;
    this.camTargetX = clamp(e.x, W * 0.37, W * 0.63);
    this.mood = 1;
    audio.goal();
    audio.crowdSwell();
    const col = e.setup.team.primary;
    for (let i = 0; i < 60; i++) {
      this.parts.spawn({
        x: rand(W * 0.15, W * 0.85),
        y: rand(-40, 120),
        vx: rand(-90, 90),
        vy: rand(60, 260),
        life: rand(1.6, 3),
        max: 3,
        size: rand(6, 12),
        color: i % 3 === 0 ? '#ffd166' : i % 3 === 1 ? col : e.setup.team.secondary,
        kind: 'confetti',
        grav: 130,
        rot: rand(0, 6),
        vr: rand(-8, 8),
      });
    }
    this.parts.text(e.x, e.y - 140, 'GOAL!', '#ffe14d');
  }

  /* ---------- update ---------- */
  update(dt: number) {
    const step = Math.min(dt, 1 / 30);
    if (this.state === 'kickoff') {
      this.phaseTimer -= step;
      if (this.phaseTimer <= 0) {
        this.state = 'play';
        this.cb.onPhase?.('play', this.suddenDeath);
        audio.whistle();
      }
    } else if (this.state === 'play') {
      if (!this.suddenDeath) {
        this.timeLeft -= step;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          if (this.score[0] === this.score[1]) {
            if (!this.suddenDeath) {
              this.suddenDeath = true;
              this.cb.onPhase?.('play', true);
              audio.whistle();
            }
          } else {
            this.endMatch();
          }
        }
      }
    } else if (this.state === 'goal') {
      this.goalTimer -= step;
      if (this.goalTimer <= 0) {
        if (this.suddenDeath) {
          this.endMatch();
        } else {
          this.state = 'kickoff';
          this.phaseTimer = 1.6;
          this.resetPositions(this.goalScorer === 1 ? -1 : 1);
          this.cb.onPhase?.('kickoff', this.suddenDeath);
        }
      }
    }

    // possession stat
    if (this.state === 'play') {
      const owner = this.ball.x < W / 2 ? 0 : 1;
      this.poss[owner] += step;
    }

    this.mood = lerp(this.mood, this.state === 'goal' ? 1 : 0.25, step * 2);

    if (this.state !== 'goal' && this.state !== 'ended') {
      this.players.forEach((p, i) => {
        if (p.setup.control === 'ai') this.updateAI(p, i, step);
        this.updatePlayer(p, step);
      });
      this.updateKeepers(step);
      this.updateBall(step);
      this.playerBallCollisions();
    } else {
      // celebration anim
      this.players.forEach((p) => {
        p.phase += step;
        if (p.pose === 'celebrate') {
          if (this.celebration === 3) {
            p.vx *= 0.9;
            p.x += p.vx * step;
            p.y = GROUND;
          }
        }
        p.y = Math.min(GROUND, p.y + p.vy * step);
        if (p.y < GROUND) p.vy += GRAVITY * step;
      });
      this.updateBall(step * 0.35);
    }

    this.parts.update(step);
    this.shake = Math.max(0, this.shake - step * 40);
    this.flash = Math.max(0, this.flash - step * 2.2);

    // camera
    this.zoom = lerp(this.zoom, this.zoomTarget, step * 4);
    this.camX = lerp(this.camX, this.camTargetX, step * 3.5);
    this.camY = lerp(this.camY, this.camTargetY(), step * 3.5);
    if (this.state === 'play') {
      this.zoomTarget = 1;
      this.camTargetX = W / 2 + clamp((this.ball.x - W / 2) * 0.06, -30, 30);
    }
  }

  private camTargetY() {
    if (this.state === 'goal') return H / 2 - 40;
    return H / 2;
  }

  /* ---------- player physics ---------- */
  private maxSpeed(e: Ent) {
    const base = 268 + e.setup.character.stats.speed * 27;
    const aiMul = e.setup.control === 'ai' ? DIFFICULTY_INFO[this.cfg.difficulty].speed : 1;
    return base * aiMul * (e.superT > 0 ? 1.18 : 1);
  }

  private updatePlayer(e: Ent, dt: number) {
    const inp = e.input;
    const frozen = e.freeze > 0;
    const stunned = e.stun > 0;
    e.freeze = Math.max(0, e.freeze - dt);
    e.stun = Math.max(0, e.stun - dt);
    e.slideCd = Math.max(0, e.slideCd - dt);
    e.jumpCd = Math.max(0, e.jumpCd - dt);
    e.cooldown = Math.max(0, e.cooldown - dt);
    e.kickT = Math.max(0, e.kickT - dt);
    e.superT = Math.max(0, e.superT - dt);

    const canAct = !frozen && !stunned && this.state === 'play';
    const axis = inp.axis !== 0 ? inp.axis : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const maxS = this.maxSpeed(e);

    if (e.slideT > 0) {
      e.slideT -= dt;
      e.pose = 'slide';
      e.vx = lerp(e.vx, e.facing * maxS * 1.35, dt * 6);
    } else if (canAct) {
      if (axis !== 0) {
        e.vx += axis * 2300 * dt;
        e.vx = clamp(e.vx, -maxS, maxS);
        if (e.dashT <= 0) e.facing = axis > 0 ? 1 : -1;
        e.pose = e.onGround ? 'run' : 'jump';
      } else {
        e.vx *= e.onGround ? 0.82 : 0.97;
        if (Math.abs(e.vx) < 12) e.vx = 0;
        if (e.onGround && e.dashT <= 0) e.facing = this.ball.x > e.x ? 1 : -1;
        e.pose = e.onGround ? 'idle' : 'jump';
      }
      // jump
      if (inp.jump && e.onGround && e.jumpCd <= 0) {
        e.vy = -(560 + e.setup.character.stats.jump * 24);
        e.onGround = false;
        e.jumpCd = 0.28;
        audio.jump();
        this.parts.ring(e.x, GROUND, 'rgba(255,255,255,0.5)', 22);
      }
      // slide
      if (inp.slide && e.onGround && e.slideCd <= 0 && Math.abs(e.vx) > 60) {
        e.slideT = 0.38;
        e.slideCd = 0.95;
        audio.slide();
        for (let i = 0; i < 8; i++)
          this.parts.spawn({
            x: e.x,
            y: GROUND - 4,
            vx: -e.facing * rand(40, 200),
            vy: rand(-120, -20),
            life: 0.4,
            max: 0.4,
            size: rand(3, 7),
            color: '#8fd694',
            kind: 'smoke',
            grav: 260,
          });
      }
      // shoot (edge triggered, with small buffer)
      const shootPressed = inp.shoot && !e.prevShoot;
      if (shootPressed && e.kickT <= 0 && e.slideT <= 0) {
        e.kickT = 0.26;
        e.kickHit = false;
        e.shots++;
        if (this.distToBall(e) < 150) audio.kick(0.4);
      }
      // supershot
      const superPressed = inp.super && !e.prevSuper;
      if (superPressed && e.charge >= 1 && e.cooldown <= 0) this.activateSuper(e);
    } else {
      e.vx *= 0.9;
      e.pose = frozen ? 'idle' : 'stun';
      if (e.slideT > 0) e.pose = 'slide';
    }
    e.prevShoot = inp.shoot;
    e.prevSuper = inp.super;

    // dash
    if (e.dashT > 0) {
      e.dashT -= dt;
      e.vx = e.facing * 900;
      e.pose = 'jump';
      const ab = abilityById(e.setup.character.abilityId);
      if (this.quality !== 'low')
        this.parts.spawn({
          x: e.x - e.facing * 14,
          y: e.y - 40,
          vx: -e.facing * rand(30, 120),
          vy: rand(-40, 40),
          life: 0.32,
          max: 0.32,
          size: rand(5, 11),
          color: ab.color,
          kind: 'smoke',
          grav: 0,
        });
    }

    // gravity + ground
    e.vy += GRAVITY * dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.y >= GROUND) {
      if (!e.onGround && e.vy > 400) this.parts.ring(e.x, GROUND, 'rgba(255,255,255,0.35)', 18);
      e.y = GROUND;
      e.vy = 0;
      e.onGround = true;
    }
    e.x = clamp(e.x, GOAL_L_X + 34, GOAL_R_X - 34);
    e.phase += dt * (e.onGround ? 1 : 0.7);

    // charge build
    if (this.state === 'play' && e.cooldown <= 0 && e.charge < 1) {
      const near = 1 - Math.min(1, this.distToBall(e) / 420);
      e.charge = Math.min(1, e.charge + dt * (0.058 + near * 0.055));
      if (e.charge >= 1) {
        audio.charge();
        this.parts.ring(e.x, e.y - 46, abilityById(e.setup.character.abilityId).color, 40);
      }
    }

    // aura particles in super mode
    if (e.superT > 0 && this.quality !== 'low' && Math.random() < 0.5) {
      const ab = abilityById(e.setup.character.abilityId);
      this.parts.spawn({
        x: e.x + rand(-18, 18),
        y: e.y - rand(0, 80),
        vx: rand(-30, 30),
        vy: rand(-140, -60),
        life: 0.5,
        max: 0.5,
        size: rand(3, 6),
        color: Math.random() < 0.5 ? ab.color : ab.color2,
        kind: 'spark',
        grav: -60,
      });
    }
    if (e.kickT > 0) e.pose = 'kick';
  }

  private distToBall(e: Ent) {
    return Math.hypot(this.ball.x - e.x, this.ball.y - (e.y - 46));
  }

  /* ---------- supershot ---------- */
  private activateSuper(e: Ent) {
    const ab = abilityById(e.setup.character.abilityId);
    e.charge = 0;
    e.cooldown = 1.6;
    e.superT = 4.6;
    e.supers++;
    audio.superShot();
    this.shake = this.shakeOn ? 20 : 8;
    this.zoomTarget = 1.18;
    this.flash = 0.6;
    this.parts.ring(e.x, e.y - 46, ab.color, 60);
    this.parts.burst(e.x, e.y - 46, 26, ab.color, 320);
    this.parts.text(e.x, e.y - 150, ab.name.toUpperCase(), ab.color);

    const near = this.distToBall(e) < 132;
    const eff = ab.effect;
    if (eff === 'shield') {
      const k = this.keepers[e.i];
      k.stun = 0;
      this.parts.text(this.keepers[e.i].x, GROUND - GOAL_H - 30, 'SHIELD UP!', ab.color);
      (this as unknown as { shields: number[] }).shields = [0, 0];
      (this as unknown as { shields: number[] }).shields[e.i] = 5;
      return;
    }
    if (eff === 'freeze') {
      const o = this.players[e.i === 0 ? 1 : 0];
      o.freeze = 1.4;
      this.parts.burst(o.x, o.y - 46, 30, '#9be8ff', 200);
    }
    if (eff === 'dash') {
      e.dashT = 0.45;
      this.ball.magnetT = 0.5;
      this.ball.magnetTo = e.i;
    }
    if (eff === 'magnet') {
      this.ball.magnetT = 2.6;
      this.ball.magnetTo = e.i;
    }
    if (near) this.superKick(e);
  }

  private superKick(e: Ent) {
    const ab = abilityById(e.setup.character.abilityId);
    const b = this.ball;
    const dirX = e.facing;
    const aimUp = e.input.jump;
    const aimDown = e.input.slide;
    let sp = (820 + e.setup.character.stats.power * 40) * (ab.effect === 'smash' ? 1.05 : 1.2);
    b.vx = dirX * sp;
    b.vy = aimDown ? -90 : aimUp ? -520 : -300;
    b.superBy = e.i + 1;
    b.superEffect = ab.effect;
    b.superColor = ab.color;
    b.lastTouch = e.i;
    if (ab.effect === 'curve') {
      b.curveT = 1.1;
      b.curveDir = e.i === 0 ? 1 : -1;
    }
    if (ab.effect === 'smash') {
      b.smashT = 1.6;
      b.vy = -760;
      b.vx = dirX * sp * 0.7;
    }
    this.shake = this.shakeOn ? 26 : 10;
    this.parts.ring(b.x, b.y, ab.color, 44);
    this.parts.burst(b.x, b.y, 34, ab.color, 420);
    audio.kick(1.4);
  }

  /* ---------- keepers ---------- */
  private updateKeepers(dt: number) {
    const d = DIFFICULTY_INFO[this.cfg.difficulty];
    this.keepers.forEach((k, i) => {
      k.stun = Math.max(0, k.stun - dt);
      const skill = k.stun > 0 ? 0.18 : 0.3 + d.smart * 0.55;
      const top = GROUND - GOAL_H + 30;
      const bottom = GROUND - 26;
      // keepers re-read the play on a delay: weaker keepers react later and drift off line
      k.react -= dt;
      if (k.react <= 0) {
        k.react = 0.07 + (1 - d.smart) * 0.42;
        const towards = i === 0 ? this.ball.vx < -40 : this.ball.vx > 40;
        const distToLine = Math.abs(this.ball.x - k.x);
        let targetY: number;
        if (towards && distToLine < 780) {
          const t = distToLine / Math.max(60, Math.abs(this.ball.vx));
          targetY = this.ball.y + this.ball.vy * t + 0.5 * BALL_GRAVITY * t * t;
          targetY += (Math.random() - 0.5) * 120 * (1 - d.smart);
        } else {
          targetY = GROUND - 62 + Math.sin(this.t * 1.6 + i) * 26;
        }
        k.targetY = clamp(targetY, top, bottom);
      }
      const targetY = k.targetY;
      k.vy = lerp(k.vy, clamp((targetY - k.y) * 4.2, -470 * skill, 470 * skill), dt * 6);
      k.y += k.vy * dt;
      k.y = clamp(k.y, top, bottom);
      // small x tracking
      const homeX = i === 0 ? GOAL_L_X + 34 : GOAL_R_X - 34;
      k.x = lerp(k.x, homeX + (i === 0 ? 1 : -1) * clamp((this.ball.x - homeX) * 0.02, -12, 12), dt * 3);
    });
  }

  /* ---------- ball ---------- */
  private updateBall(dt: number) {
    const b = this.ball;
    b.vy += BALL_GRAVITY * dt * (b.smashT > 0 ? 1.9 : 1);
    b.smashT = Math.max(0, b.smashT - dt);
    if (b.curveT > 0) {
      b.curveT -= dt;
      const targetY = GROUND - 40;
      const steer = (targetY - b.y) * 0.9;
      b.vy += clamp(steer, -900, 900) * dt * b.curveDir;
    }
    if (b.magnetT > 0) {
      b.magnetT -= dt;
      const p = this.players[b.magnetTo];
      const dx = p.x - b.x;
      const dy = p.y - 50 - b.y;
      const d = Math.hypot(dx, dy) || 1;
      b.vx += (dx / d) * 900 * dt;
      b.vy += (dy / d) * 900 * dt;
    }
    // drag
    const drag = b.y < GROUND - 2 ? 0.16 : 1.6;
    b.vx -= b.vx * drag * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += (b.vx / b.r) * dt * 0.6;

    // ground
    if (b.y + b.r > GROUND) {
      b.y = GROUND - b.r;
      if (b.vy > 60) {
        audio.bounce();
        this.parts.ring(b.x, GROUND, 'rgba(255,255,255,0.3)', 12);
        if (b.smashT > 0 && b.superBy) {
          // meteor impact
          this.parts.burst(b.x, GROUND - 6, 28, b.superColor, 400);
          this.parts.ring(b.x, GROUND, b.superColor, 50);
          this.shake = this.shakeOn ? 24 : 8;
          this.players.forEach((p) => {
            if (Math.abs(p.x - b.x) < 190) {
              p.vx += (p.x < b.x ? -1 : 1) * 380;
              p.vy = -320;
              p.stun = 0.45;
            }
          });
          b.smashT = 0;
        }
      }
      b.vy = -Math.abs(b.vy) * 0.62;
      b.vx *= 0.92;
      if (Math.abs(b.vy) < 40) b.vy = 0;
    }
    // ceiling
    if (b.y - b.r < CEILING) {
      b.y = CEILING + b.r;
      b.vy = Math.abs(b.vy) * 0.6;
      audio.bounce();
    }
    // side walls (behind the goals)
    if (b.x - b.r < 8) {
      b.x = 8 + b.r;
      b.vx = Math.abs(b.vx) * 0.5;
    }
    if (b.x + b.r > W - 8) {
      b.x = W - 8 - b.r;
      b.vx = -Math.abs(b.vx) * 0.5;
    }

    // goal detection
    const inMouthL = b.y - b.r > GROUND - GOAL_H + 4;
    if (b.x + b.r < GOAL_L_X && inMouthL && this.state === 'play') {
      this.ballInNet(1);
      return;
    }
    if (b.x - b.r > GOAL_R_X && b.y - b.r > GROUND - GOAL_H + 4 && this.state === 'play') {
      this.ballInNet(0);
      return;
    }

    // crossbar collisions
    if (b.y < GROUND - GOAL_H && (b.x < GOAL_L_X + 10 || b.x > GOAL_R_X - 10)) {
      if (b.x - b.r < GOAL_L_X && b.y + b.r > GROUND - GOAL_H) {
        b.y = GROUND - GOAL_H - b.r;
        b.vy = -Math.abs(b.vy) * 0.7;
        audio.bounce();
      }
      if (b.x + b.r > GOAL_R_X && b.y + b.r > GROUND - GOAL_H) {
        b.y = GROUND - GOAL_H - b.r;
        b.vy = -Math.abs(b.vy) * 0.7;
        audio.bounce();
      }
    }

    // shields
    const shields = this.shields;
    if (shields) {
      shields[0] = Math.max(0, shields[0] - dt);
      shields[1] = Math.max(0, shields[1] - dt);
      [0, 1].forEach((i) => {
        if (shields[i] > 0) {
          const x = i === 0 ? GOAL_L_X + 14 : GOAL_R_X - 14;
          if (Math.abs(b.x - x) < 26) {
            b.vx = (i === 0 ? 1 : -1) * Math.max(300, Math.abs(b.vx) * 1.1);
            b.x = x + (i === 0 ? 26 : -26);
            this.parts.ring(x, b.y, '#cfd8e3', 30);
            audio.bounce();
          }
          if (this.quality !== 'low' && Math.random() < 0.3)
            this.parts.spawn({
              x: x + rand(-6, 6),
              y: rand(GROUND - GOAL_H, GROUND),
              vx: (i === 0 ? 1 : -1) * 40,
              vy: rand(-30, 30),
              life: 0.4,
              max: 0.4,
              size: 4,
              color: '#cfd8e3',
              kind: 'spark',
              grav: 0,
            });
        }
      });
    }

    // super trail
    if (b.superBy && b.superEffect) {
      b.trail.push({ x: b.x, y: b.y, a: 1 });
      if (this.quality !== 'low' && Math.random() < 0.8)
        this.parts.spawn({
          x: b.x,
          y: b.y,
          vx: rand(-40, 40),
          vy: rand(-40, 40),
          life: 0.35,
          max: 0.35,
          size: rand(4, 9),
          color: Math.random() < 0.5 ? b.superColor : '#ffffff',
          kind: 'spark',
          grav: 0,
        });
      if (b.superEffect === 'stun') {
        b.vy += Math.sin(this.t * 26) * 900 * dt;
      }
      if (b.superEffect === 'blaze') b.vx *= 1 + 0.25 * dt;
    }
    if (b.trail.length > 14) b.trail.shift();
    b.trail.forEach((p) => (p.a -= dt * 2.4));
    if (!b.superBy) b.trail = b.trail.filter((p) => p.a > 0);
  }

  private ballInNet(scorer: number) {
    const b = this.ball;
    b.vx *= 0.2;
    b.vy = Math.min(b.vy, 60);
    audio.crowd(1);
    if (b.superBy) {
      this.parts.burst(b.x, b.y, 40, b.superColor, 420);
      this.shake = this.shakeOn ? 32 : 12;
    }
    this.scoreGoal(scorer);
  }

  /* ---------- collisions ---------- */
  private playerBallCollisions() {
    const b = this.ball;
    this.players.forEach((e) => {
      // head
      const hx = e.x;
      const hy = e.y - 76;
      const hr = 22;
      let dx = b.x - hx;
      let dy = b.y - hy;
      let d = Math.hypot(dx, dy);
      if (d < b.r + hr) {
        const nx = dx / (d || 1);
        const ny = dy / (d || 1);
        b.x = hx + nx * (b.r + hr);
        b.y = hy + ny * (b.r + hr);
        const headVx = e.vx * 1.15;
        const headVy = e.onGround ? e.vy * 0.6 : e.vy * 1.1 - 120;
        b.vx = nx * (Math.abs(b.vx) * 0.55 + 330) + headVx;
        b.vy = ny * 260 + headVy - 60;
        b.superBy = 0;
        b.superEffect = null;
        b.lastTouch = e.i;
        e.touchTime = this.t;
        e.charge = Math.min(1, e.charge + 0.06);
        audio.kick(0.5);
        this.parts.burst(b.x, b.y, 6, '#ffffff', 160);
        return;
      }
      // body (rounded box)
      const bx = e.x - 18;
      const by = e.y - 56;
      const bw = 36;
      const bh = 36;
      const cx = clamp(b.x, bx, bx + bw);
      const cy = clamp(b.y, by, by + bh);
      dx = b.x - cx;
      dy = b.y - cy;
      d = Math.hypot(dx, dy);
      if (d < b.r) {
        const nx = d === 0 ? (b.x < e.x ? -1 : 1) : dx / d;
        const ny = d === 0 ? -1 : dy / d;
        b.x = cx + nx * (b.r + 1);
        b.y = cy + ny * (b.r + 1);
        const speed = Math.hypot(b.vx, b.vy);
        b.vx = nx * (speed * 0.6 + 210) + e.vx * 0.85;
        b.vy = Math.min(b.vy, 0) * 0.4 + ny * 140 - Math.abs(e.vy) * 0.2;
        b.lastTouch = e.i;
        e.touchTime = this.t;
        e.charge = Math.min(1, e.charge + 0.03);
        audio.bounce();
      }
      // kick / slide hitbox
      const kicking = e.kickT > 0 || e.slideT > 0;
      if (kicking && !e.kickHit) {
        const fx = e.x + e.facing * (e.slideT > 0 ? 26 : 34);
        const fy = e.y - (e.slideT > 0 ? 14 : 30);
        const fr = e.slideT > 0 ? 26 : 22;
        dx = b.x - fx;
        dy = b.y - fy;
        d = Math.hypot(dx, dy);
        if (d < b.r + fr) {
          e.kickHit = true;
          this.doKick(e);
        }
      }
    });

    // keeper save
    this.keepers.forEach((k, i) => {
      if (k.stun > 0) return; // a stunned keeper cannot stop the ball
      const dx = b.x - k.x;
      const dy = b.y - k.y;
      const d = Math.hypot(dx, dy);
      if (d < b.r + 26) {
        // signature shots blast the keeper out of the play
        if (b.superBy && (b.superEffect === 'stun' || b.superEffect === 'blaze' || b.superEffect === 'smash')) {
          k.stun = 1.5;
          k.vy = (i === 0 ? 1 : -1) * 260;
          this.parts.burst(k.x, k.y, 24, b.superColor, 320);
          this.parts.text(k.x, k.y - 60, b.superEffect === 'stun' ? 'ZAP!' : 'BLAST!', b.superColor);
          this.shake = this.shakeOn ? 18 : 6;
          audio.superShot();
          // let the ball continue on its way
          b.vx *= 0.92;
          return;
        }
        const nx = dx / (d || 1);
        const ny = dy / (d || 1);
        b.x = k.x + nx * (b.r + 26);
        b.y = k.y + ny * (b.r + 26);
        b.vx = nx * (Math.abs(b.vx) * 0.55 + 260);
        b.vy = ny * 200 - 140;
        b.superBy = 0;
        b.superEffect = null;
        k.saves++;
        this.players[i].saves++;
        audio.bounce();
        this.parts.burst(b.x, b.y, 10, '#ffffff', 200);
        this.parts.text(k.x, k.y - 60, 'SAVE!', '#ffffff');
      }
    });

    // player vs player
    const [a, c] = this.players;
    const dx = c.x - a.x;
    if (Math.abs(dx) < 34 && Math.abs(c.y - a.y) < 80) {
      const push = (34 - Math.abs(dx)) * 0.5 * (dx > 0 ? 1 : -1);
      a.x -= push;
      c.x += push;
      const av = a.vx;
      a.vx = a.vx * 0.5 + c.vx * 0.2;
      c.vx = c.vx * 0.5 + av * 0.2;
    }
  }

  private doKick(e: Ent) {
    const b = this.ball;
    const st = e.setup.character.stats;
    const ab = abilityById(e.setup.character.abilityId);
    const aimUp = e.input.jump;
    const aimDown = e.input.slide || e.slideT > 0;
    const volley = !e.onGround ? 1.12 : 1;
    let sp = (600 + st.power * 42) * volley;
    if (e.slideT > 0) sp *= 0.9;
    b.vx = e.facing * sp * (aimDown ? 1.05 : 0.95);
    b.vy = aimDown ? -60 : aimUp ? -520 : -260;
    b.lastTouch = e.i;
    if (e.superT > 0) {
      this.superKick(e);
      return;
    }
    if (e.charge >= 1 && e.input.super) {
      this.superKick(e);
      return;
    }
    b.superBy = 0;
    b.superEffect = null;
    audio.kick(0.9 + st.power / 20);
    e.charge = Math.min(1, e.charge + 0.05);
    this.parts.burst(b.x, b.y, 8, ab.color, 220);
    this.shake = this.shakeOn && sp > 800 ? 8 : this.shake;
  }

  /* ---------- AI ---------- */
  private updateAI(e: Ent, i: number, dt: number) {
    const d = DIFFICULTY_INFO[this.cfg.difficulty];
    const b = this.ball;
    const opp = this.players[i === 0 ? 1 : 0];
    const inp = e.input;
    inp.axis = 0;
    inp.left = inp.right = inp.jump = inp.slide = inp.shoot = inp.super = false;

    e.aiTimer -= dt;
    const myGoal = i === 0 ? GOAL_L_X : GOAL_R_X;
    const oppGoal = i === 0 ? GOAL_R_X : GOAL_L_X;
    const dirSign = i === 0 ? 1 : -1;
    const ballDist = Math.abs(b.x - e.x);
    const ballAbove = e.y - b.y;
    const ballComing = (i === 0 && b.vx < -20) || (i === 1 && b.vx > 20);
    const smart = d.smart;

    if (e.aiTimer <= 0) {
      e.aiTimer = 0.12 + (1 - smart) * 0.35 + Math.random() * 0.12;
      // --- decide plan ---
      const ballInMyHalf = i === 0 ? b.x < W / 2 : b.x > W / 2;
      const behindMe = i === 0 ? b.x < e.x : b.x > e.x;
      const oppNearOwnGoal = Math.abs(opp.x - myGoal) < 300;
      if (ballInMyHalf && behindMe) e.aiPlan = 'recover';
      else if (ballDist < 150) e.aiPlan = 'attack';
      else if (ballInMyHalf && oppNearOwnGoal) e.aiPlan = 'defend';
      else if (ballComing && ballDist > 260) e.aiPlan = 'intercept';
      else e.aiPlan = 'press';
      if (Math.random() > 0.35 + smart * 0.65) e.aiPlan = 'idle';
    }

    let desiredX = e.x;
    switch (e.aiPlan) {
      case 'recover':
        desiredX = b.x - dirSign * 20;
        break;
      case 'attack':
        desiredX = b.x - dirSign * (26 + 8 * Math.random());
        break;
      case 'defend': {
        // sit between ball and own goal
        desiredX = lerp(b.x, myGoal, 0.45);
        break;
      }
      case 'intercept': {
        const t = ballDist / Math.max(80, Math.abs(b.vx));
        desiredX = b.x + b.vx * t * 0.55;
        break;
      }
      case 'press':
        desiredX = b.x - dirSign * 90;
        break;
      default:
        desiredX = i === 0 ? W * 0.42 : W * 0.58;
    }
    // keep some spacing from own goal on easy
    desiredX = clamp(desiredX, GOAL_L_X + 46, GOAL_R_X - 46);

    const diff = desiredX - e.x;
    if (Math.abs(diff) > 14) {
      if (diff > 0) inp.right = true;
      else inp.left = true;
    }

    // jump decisions
    const canReach = ballAbove > 55 && ballAbove < 165 && ballDist < 90;
    if (canReach && Math.random() < 0.25 + smart * 0.6 && e.onGround) inp.jump = true;
    if (b.y < GROUND - 150 && ballDist < 70 && e.onGround && Math.random() < smart) inp.jump = true;

    // shooting
    const shootRange = 82;
    if (ballDist < shootRange && Math.abs(b.y - (e.y - 40)) < 95) {
      const distToGoal = Math.abs(oppGoal - e.x);
      if (distToGoal < 980 && Math.random() < 0.4 + smart * 0.55) {
        inp.shoot = true;
        if (b.y < GROUND - 70) inp.jump = true;
        // keep the shot on target: step toward the goal line
        if (Math.sign(oppGoal - e.x) !== dirSign && Math.abs(diff) < 12) {
          if (dirSign > 0) inp.right = true;
          else inp.left = true;
        }
      }
    }
    // clear the ball when deep in own half
    if (Math.abs(e.x - myGoal) < 260 && ballDist < 95 && Math.random() < 0.45 + smart * 0.3) inp.shoot = true;

    // slide tackle / block
    if (
      smart > 0.45 &&
      Math.abs(opp.x - e.x) < 130 &&
      Math.abs(opp.x - b.x) < 70 &&
      e.slideCd <= 0 &&
      Math.random() < smart * 0.45
    ) {
      inp.slide = true;
    }

    // supershot usage
    if (e.charge >= 1 && e.cooldown <= 0 && ballDist < 150 && Math.random() < d.superUse * 0.4) {
      inp.super = true;
    }
    // react to a human charging a shot nearby: block the lane
    if (smart > 0.7 && opp.kickT > 0 && ballComing && Math.abs(b.x - e.x) < 320) {
      if (b.y < e.y - 60 && e.onGround) inp.jump = true;
    }
  }

  /* ---------- render ---------- */
  render() {
    const ctx = this.ctx;
    const s = this.baseScale;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#04080f';
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    ctx.save();
    ctx.translate(this.cssW / 2, this.cssH / 2);
    const z = s * this.zoom;
    const sh = this.shake;
    const shakeX = sh ? rand(-sh, sh) * 0.35 : 0;
    const shakeY = sh ? rand(-sh, sh) * 0.35 : 0;
    ctx.scale(z, z);
    ctx.translate(-this.camX + shakeX / z, -this.camY + shakeY / z);

    drawStadium(ctx, this.t, this.quality, sh, this.mood);
    drawGoal(ctx, -1, this.t);
    drawGoal(ctx, 1, this.t);

    const shields = this.shields;
    if (shields) {
      [0, 1].forEach((i) => {
        if (shields[i] > 0) {
          const x = i === 0 ? GOAL_L_X + 14 : GOAL_R_X - 14;
          const g = ctx.createLinearGradient(x - 22, 0, x + 22, 0);
          g.addColorStop(0, 'rgba(207,216,227,0.04)');
          g.addColorStop(0.5, 'rgba(220,235,255,0.55)');
          g.addColorStop(1, 'rgba(207,216,227,0.04)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 22, GROUND - GOAL_H, 44, GOAL_H);
        }
      });
    }

    const order = [...this.players].sort((a, b) => a.y - b.y);
    order.forEach((e) => {
      const ab = abilityById(e.setup.character.abilityId);
      const glow = e.superT > 0 ? hexToGlow(ab.color, 0.75) : e.charge >= 1 ? hexToGlow(ab.color, 0.4) : undefined;
      drawChibi(ctx, e.x, e.y, 1, e.facing, e.look, e.pose, e.phase, {
        glow,
        charge: e.charge,
        frozen: e.freeze > 0 ? 0.6 : 0,
        celebration: this.celebration,
      });
      const isP1 = e.i === 0;
      const ty = e.y - 132 + Math.sin(this.t * 4 + e.i) * 4;
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = isP1 ? '#3ba7ff' : '#ff5470';
      ctx.beginPath();
      ctx.moveTo(e.x, ty + 12);
      ctx.lineTo(e.x - 11, ty);
      ctx.lineTo(e.x + 11, ty);
      ctx.closePath();
      ctx.fill();
      ctx.font = '900 15px Impact, Haettenschweiler, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isP1 ? 'P1' : 'P2', e.x, ty - 4);
      ctx.restore();
    });

    this.keepers.forEach((k) => {
      drawChibi(ctx, k.x, k.y + 26, 0.82, k.side === -1 ? 1 : -1, k.look, 'jump', this.t, { celebration: 0 });
    });

    const b = this.ball;
    if (b.trail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 1; i < b.trail.length; i++) {
        const p = b.trail[i];
        ctx.globalAlpha = Math.max(0, p.a) * 0.45;
        ctx.strokeStyle = b.superBy ? b.superColor : '#ffffff';
        ctx.lineWidth = (i / b.trail.length) * b.r * 1.5;
        ctx.beginPath();
        ctx.moveTo(b.trail[i - 1].x, b.trail[i - 1].y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawBall(ctx, b.x, b.y, b.r, b.rot, b.superBy ? hexToGlow(b.superColor, 0.9) : undefined);
    this.parts.draw(ctx);

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.32})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.state === 'kickoff') {
      const n = Math.ceil(this.phaseTimer);
      const label = n > 3 ? 'READY' : n > 0 ? String(n) : 'GO!';
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.font = '900 120px Impact, Haettenschweiler, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 12;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(label, W / 2, 260);
      const g = ctx.createLinearGradient(0, 180, 0, 265);
      g.addColorStop(0, '#fff6c9');
      g.addColorStop(1, '#ffb703');
      ctx.fillStyle = g;
      ctx.fillText(label, W / 2, 260);
      ctx.restore();
    }

    if (this.suddenDeath && this.state !== 'ended') {
      ctx.save();
      ctx.font = '900 34px Impact, Haettenschweiler, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,90,90,${0.6 + Math.sin(this.t * 6) * 0.3})`;
      ctx.fillText('GOLDEN GOAL — NEXT SCORE WINS', W / 2, 122);
      ctx.restore();
    }

    ctx.restore();
  }
}

function hexToGlow(hex: string, a = 0.75) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function makeHud(e: MatchEngine): HudState {
  return {
    score: [e.score[0], e.score[1]],
    time: Math.max(0, Math.ceil(e.timeLeft)),
    charge: [e.players[0]?.charge ?? 0, e.players[1]?.charge ?? 0],
    superOn: [(e.players[0]?.superT ?? 0) > 0, (e.players[1]?.superT ?? 0) > 0],
    phase: e.state,
    suddenDeath: e.suddenDeath,
  };
}