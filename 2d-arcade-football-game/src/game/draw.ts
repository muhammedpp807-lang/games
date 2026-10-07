import { CEILING, GOAL_D, GOAL_H, GOAL_L_X, GOAL_R_X, GROUND, H, W, clamp } from './constants';

/* ---------------- seeded crowd ---------------- */
export interface Seat {
  x: number;
  y: number;
  c: string;
  p: number; // phase
  s: number; // size
}

const CROWD_COLORS = [
  '#ff5d73',
  '#ffd166',
  '#4cc9f0',
  '#f8f9fa',
  '#ffd6a5',
  '#8ecae6',
  '#f4978e',
  '#bdb2ff',
  '#ffca3a',
  '#1982c4',
  '#6a4c93',
  '#8ac926',
];

let seatsCache: { q: string; seats: Seat[] } | null = null;

export function getSeats(quality: string): Seat[] {
  if (seatsCache && seatsCache.q === quality) return seatsCache.seats;
  const seats: Seat[] = [];
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const rows = quality === 'low' ? 4 : quality === 'medium' ? 6 : 8;
  for (let r = 0; r < rows; r++) {
    const y = 150 + r * 34 + (r > 3 ? 6 : 0);
    const count = quality === 'low' ? 60 : quality === 'medium' ? 90 : 130;
    for (let i = 0; i < count; i++) {
      const x = (i / count) * (W + 40) - 20 + rnd() * 8;
      seats.push({
        x,
        y,
        c: CROWD_COLORS[Math.floor(rnd() * CROWD_COLORS.length)],
        p: rnd() * Math.PI * 2,
        s: 9 + r * 0.7 + rnd() * 3,
      });
    }
  }
  seatsCache = { q: quality, seats };
  return seats;
}

/* ---------------- stadium background ---------------- */
export function drawStadium(
  ctx: CanvasRenderingContext2D,
  t: number,
  quality: string,
  _shake: number,
  mood: number, // 0 calm .. 1 ecstatic
) {
  ctx.save();
  // sky / roof
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#071126');
  sky.addColorStop(0.45, '#0d2347');
  sky.addColorStop(1, '#06111f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // roof trusses
  ctx.strokeStyle = 'rgba(120,170,255,0.10)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 16; i++) {
    const x = (i / 15) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 30, 46);
    ctx.stroke();
  }

  // floodlights
  const lights = [W * 0.12, W * 0.38, W * 0.62, W * 0.88];
  lights.forEach((lx, i) => {
    const flick = 0.86 + Math.sin(t * 7 + i * 2.1) * 0.06;
    const g = ctx.createRadialGradient(lx, 40, 4, lx, 40, 340 * flick);
    g.addColorStop(0, 'rgba(255,255,235,0.55)');
    g.addColorStop(0.25, 'rgba(190,220,255,0.16)');
    g.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lx, 40, 340 * flick, 0, Math.PI * 2);
    ctx.fill();
    // mast
    ctx.fillStyle = '#0a1730';
    ctx.fillRect(lx - 5, 30, 10, 70);
    ctx.fillStyle = `rgba(255,255,240,${0.75 * flick})`;
    for (let k = -2; k <= 2; k++) ctx.fillRect(lx + k * 11 - 4, 18, 8, 12);
  });

  // stands
  const standGrad = ctx.createLinearGradient(0, 120, 0, 470);
  standGrad.addColorStop(0, '#122a4d');
  standGrad.addColorStop(1, '#0a1730');
  ctx.fillStyle = standGrad;
  ctx.beginPath();
  ctx.moveTo(0, 470);
  ctx.lineTo(0, 160);
  ctx.lineTo(W, 160);
  ctx.lineTo(W, 470);
  ctx.closePath();
  ctx.fill();

  // crowd
  const seats = getSeats(quality);
  const bounce = mood > 0.85 ? 4.5 : 2.2;
  for (const s of seats) {
    const dy = Math.sin(t * 3 + s.p) * bounce * (0.4 + mood);
    ctx.fillStyle = s.c;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.arc(s.x, s.y + dy, s.s * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.fillRect(s.x - s.s * 0.42, s.y + dy + s.s * 0.32, s.s * 0.84, s.s * 0.6);
  }
  ctx.globalAlpha = 1;

  // stand shadow / barrier
  const barrier = ctx.createLinearGradient(0, 452, 0, 486);
  barrier.addColorStop(0, 'rgba(3,8,18,0.9)');
  barrier.addColorStop(1, 'rgba(3,8,18,0.2)');
  ctx.fillStyle = barrier;
  ctx.fillRect(0, 452, W, 34);

  // advertising boards
  const ads = ['FOOTBALL LEGENDS', 'ARENA CUP 26', 'TURBO BOOTS', 'STAR COLA', 'MEGA GOAL', 'PLAY HARD'];
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 470, W, 52);
  ctx.clip();
  const boardGrad = ctx.createLinearGradient(0, 470, 0, 522);
  boardGrad.addColorStop(0, '#132b52');
  boardGrad.addColorStop(1, '#081426');
  ctx.fillStyle = boardGrad;
  ctx.fillRect(0, 470, W, 52);
  const scroll = (t * 40) % 420;
  ctx.font = '900 24px Impact, Haettenschweiler, "Arial Narrow", sans-serif';
  ctx.textBaseline = 'middle';
  for (let i = -1; i < 5; i++) {
    const bx = i * 420 - scroll;
    const label = ads[((i % ads.length) + ads.length) % ads.length];
    const hue = (i * 47) % 360;
    ctx.fillStyle = `hsl(${hue} 85% 45%)`;
    ctx.fillRect(bx, 474, 410, 44);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.textAlign = 'center';
    ctx.fillText(label, bx + 205, 497);
  }
  ctx.restore();

  // pitch
  const pitch = ctx.createLinearGradient(0, 512, 0, H);
  pitch.addColorStop(0, '#1f7a3d');
  pitch.addColorStop(0.35, '#2f9e52');
  pitch.addColorStop(1, '#1d6b37');
  ctx.fillStyle = pitch;
  ctx.fillRect(0, 522, W, H - 522);

  // mow stripes
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.05)';
    ctx.beginPath();
    const x0 = (i / 10) * W;
    const x1 = ((i + 1) / 10) * W;
    ctx.moveTo(x0, 522);
    ctx.lineTo(x1, 522);
    ctx.lineTo(x1 + 26, H);
    ctx.lineTo(x0 + 26, H);
    ctx.closePath();
    ctx.fill();
  }

  // pitch markings (side view: ellipse centre circle + boxes)
  ctx.strokeStyle = 'rgba(255,255,255,0.30)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(W / 2, GROUND + 24, 150, 40, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W / 2, GROUND + 12);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(GOAL_L_X + 40, GROUND + 30, 120, 34, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(GOAL_R_X - 40, GROUND + 30, 120, 34, 0, Math.PI, Math.PI * 2);
  ctx.stroke();

  // vignette
  const vig = ctx.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 820);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ---------------- goals ---------------- */
export function drawGoal(ctx: CanvasRenderingContext2D, side: -1 | 1, t: number) {
  const lineX = side < 0 ? GOAL_L_X : GOAL_R_X;
  const backX = side < 0 ? GOAL_L_X - GOAL_D : GOAL_R_X + GOAL_D;
  const top = GROUND - GOAL_H;

  // net interior
  const g = ctx.createLinearGradient(backX, top, lineX, GROUND);
  g.addColorStop(0, 'rgba(230,245,255,0.30)');
  g.addColorStop(1, 'rgba(200,225,255,0.10)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(backX, GROUND);
  ctx.lineTo(backX, top + 14);
  ctx.lineTo(lineX, top);
  ctx.lineTo(lineX, GROUND);
  ctx.closePath();
  ctx.fill();

  // net mesh
  ctx.strokeStyle = 'rgba(255,255,255,0.42)';
  ctx.lineWidth = 1.2;
  const step = 13;
  ctx.beginPath();
  for (let x = Math.min(backX, lineX); x <= Math.max(backX, lineX); x += step) {
    ctx.moveTo(x, GROUND);
    ctx.lineTo(x, top + (x === backX ? 14 : 0));
  }
  for (let y = GROUND; y > top; y -= step) {
    ctx.moveTo(backX, y);
    ctx.lineTo(lineX, y - (lineX === backX ? 0 : 12));
  }
  ctx.stroke();

  // posts
  ctx.fillStyle = '#f8fafc';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 10;
  ctx.fillRect(lineX - 5, top - 6, 10, GOAL_H + 6);
  ctx.fillRect(Math.min(backX, lineX) - 3, top - 8, Math.abs(lineX - backX) + 6, 9);
  ctx.shadowBlur = 0;
  // post shine
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(lineX + 1, top - 6, 3, GOAL_H + 6);
  void t;
}

/* ---------------- ball ---------------- */
export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, glow?: string) {
  ctx.save();
  ctx.translate(x, y);
  if (glow) {
    const g = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.6);
    g.addColorStop(0, glow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.rotate(rot);
  const bg = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.2, 0, 0, r * 1.15);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(0.75, '#e8eef7');
  bg.addColorStop(1, '#b9c6d8');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // pentagon patches
  ctx.fillStyle = '#152036';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.save();
    ctx.translate(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const aa = (k / 5) * Math.PI * 2 + a;
      const px = Math.cos(aa) * r * 0.3;
      const py = Math.sin(aa) * r * 0.3;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,30,50,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* ---------------- particles ---------------- */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 'spark' | 'ring' | 'smoke' | 'star' | 'confetti' | 'text';
  grav: number;
  rot?: number;
  vr?: number;
  text?: string;
}

export class Particles {
  list: Particle[] = [];
  spawn(p: Partial<Particle> & { x: number; y: number }) {
    this.list.push({
      vx: 0,
      vy: 0,
      life: 0.6,
      max: 0.6,
      size: 6,
      color: '#fff',
      kind: 'spark',
      grav: 0,
      rot: 0,
      vr: 0,
      ...p,
    } as Particle);
  }
  burst(x: number, y: number, n: number, color: string, speed = 240, kind: Particle['kind'] = 'spark') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.9);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: 0.35 + Math.random() * 0.5,
        max: 0.85,
        size: 3 + Math.random() * 5,
        color,
        kind,
        grav: kind === 'confetti' ? 420 : 320,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 12,
      });
    }
  }
  ring(x: number, y: number, color: string, size = 40) {
    this.spawn({ x, y, life: 0.4, max: 0.4, size, color, kind: 'ring' });
  }
  text(x: number, y: number, str: string, color = '#fff') {
    this.spawn({ x, y, vy: -70, life: 0.9, max: 0.9, size: 34, color, kind: 'text', text: str });
  }
  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.rot !== undefined) p.rot += (p.vr ?? 0) * dt;
    }
    if (this.list.length > 600) this.list.splice(0, this.list.length - 600);
  }
  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.list) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      if (p.kind === 'ring') {
        const r = p.size * (1 + (1 - a) * 2.2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 6 * a + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'confetti') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.kind === 'text') {
        ctx.font = '900 34px Impact, Haettenschweiler, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.strokeText(p.text ?? '', p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text ?? '', p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? 1 + (1 - a) : a * 0.6 + 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  clear() {
    this.list = [];
  }
}

export { W as WORLD_W, H as WORLD_H, GROUND, CEILING };
