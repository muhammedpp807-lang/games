/* Chibi footballer renderer — fully procedural, original artwork. */

export interface ChibiLook {
  kit: string;
  kit2: string;
  accent: string;
  skin: string;
  hair: string;
  hairStyle: string;
  number: number;
  keeper?: boolean;
}

export type Pose = 'idle' | 'run' | 'jump' | 'kick' | 'slide' | 'celebrate' | 'stun' | 'charge' | 'sad';

export interface ChibiOpts {
  glow?: string;
  charge?: number;
  frozen?: number;
  shadow?: boolean;
  celebration?: number; // 0 arms up, 1 spin, 2 backflip, 3 knee slide
  alpha?: number;
}

const HEAD_R = 21;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function limb(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  l1: number,
  l2: number,
  a1: number,
  a2: number,
  w1: number,
  w2: number,
  c1: string,
  c2: string,
  shoe: string | null,
) {
  const kx = x0 + Math.sin(a1) * l1;
  const ky = y0 + Math.cos(a1) * l1;
  const fx = kx + Math.sin(a1 - a2) * l2;
  const fy = ky + Math.cos(a1 - a2) * l2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = c1;
  ctx.lineWidth = w1;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(kx, ky);
  ctx.stroke();
  ctx.strokeStyle = c2;
  ctx.lineWidth = w2;
  ctx.beginPath();
  ctx.moveTo(kx, ky);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  if (shoe) {
    ctx.fillStyle = shoe;
    roundRect(ctx, fx - 6, fy - 5, 15, 8, 4);
    ctx.fill();
  }
  return { fx, fy };
}

function drawHair(ctx: CanvasRenderingContext2D, style: string, color: string) {
  ctx.fillStyle = color;
  switch (style) {
    case 'spiky':
      ctx.beginPath();
      ctx.arc(0, -2, HEAD_R + 0.5, Math.PI * 1.02, Math.PI * 1.98);
      ctx.fill();
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 6 - 4, -HEAD_R + 4);
        ctx.lineTo(i * 6 + (i % 2 ? 5 : -5), -HEAD_R - 9 - Math.abs(i) * -1.5);
        ctx.lineTo(i * 6 + 4, -HEAD_R + 5);
        ctx.closePath();
        ctx.fill();
      }
      break;
    case 'buzz':
      ctx.beginPath();
      ctx.arc(0, -2, HEAD_R + 0.5, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.fillRect(-HEAD_R + 1, -8, 5, 8);
      ctx.fillRect(HEAD_R - 6, -8, 5, 8);
      ctx.globalAlpha = 1;
      break;
    case 'curly':
      for (let i = -3; i <= 3; i++) {
        const a = Math.PI * 1.08 + (i + 3) * (Math.PI * 0.84 / 6);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * (HEAD_R - 1), Math.sin(a) * (HEAD_R - 1) - 2, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'bun':
      ctx.beginPath();
      ctx.arc(0, -2, HEAD_R + 0.5, Math.PI * 1.03, Math.PI * 1.97);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-11, -HEAD_R - 5, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'afro':
      ctx.beginPath();
      ctx.arc(0, -8, HEAD_R + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.arc(-4, -12, HEAD_R + 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'long':
      ctx.beginPath();
      ctx.arc(0, -3, HEAD_R + 1, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-HEAD_R - 1, -6);
      ctx.quadraticCurveTo(-HEAD_R - 4, 16, -6, 14);
      ctx.quadraticCurveTo(-HEAD_R, 2, -HEAD_R + 2, -4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(HEAD_R + 1, -6);
      ctx.quadraticCurveTo(HEAD_R + 4, 12, 8, 12);
      ctx.quadraticCurveTo(HEAD_R, 0, HEAD_R - 2, -4);
      ctx.closePath();
      ctx.fill();
      break;
    case 'mohawk':
      ctx.beginPath();
      ctx.arc(0, -3, HEAD_R + 0.5, Math.PI * 1.08, Math.PI * 1.92);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-9, -HEAD_R + 3);
      ctx.quadraticCurveTo(0, -HEAD_R - 16, 9, -HEAD_R + 3);
      ctx.closePath();
      ctx.fill();
      break;
    case 'waves':
      ctx.beginPath();
      ctx.arc(0, -3, HEAD_R + 0.8, Math.PI * 1.02, Math.PI * 1.96);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-HEAD_R + 3, -HEAD_R + 8);
      ctx.quadraticCurveTo(0, -HEAD_R - 4, HEAD_R - 3, -HEAD_R + 8);
      ctx.stroke();
      break;
    default:
      break;
  }
}

function drawFace(ctx: CanvasRenderingContext2D, pose: Pose, celebration?: number) {
  // eyes
  const ex = [3, 13];
  for (const x of ex) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x, -3, 4.2, pose === 'stun' ? 3 : 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#172033';
    ctx.beginPath();
    ctx.arc(x + 1.2, -2.6, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(x + 0.2, -3.8, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  // brows
  ctx.strokeStyle = 'rgba(30,20,12,0.85)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (pose === 'charge' || pose === 'kick') {
    ctx.moveTo(0, -9);
    ctx.lineTo(8, -7);
    ctx.moveTo(11, -7);
    ctx.lineTo(17, -9);
  } else {
    ctx.moveTo(0, -8.5);
    ctx.lineTo(7, -9.5);
    ctx.moveTo(11, -9.5);
    ctx.lineTo(17, -8.5);
  }
  ctx.stroke();
  // mouth
  ctx.strokeStyle = 'rgba(90,30,30,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (celebration !== undefined) {
    ctx.fillStyle = '#7d1f2e';
    ctx.beginPath();
    ctx.ellipse(9, 7, 6, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff8f9e';
    ctx.beginPath();
    ctx.ellipse(9, 10, 4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (pose === 'sad') {
    ctx.arc(9, 11, 4, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else if (pose === 'charge' || pose === 'kick') {
    ctx.fillStyle = '#7d1f2e';
    ctx.beginPath();
    ctx.ellipse(9, 8, 4, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.arc(9, 5, 5, 0.15, Math.PI - 0.5);
    ctx.stroke();
  }
}

export function drawChibi(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  facing: number,
  look: ChibiLook,
  pose: Pose,
  phase: number,
  opts: ChibiOpts = {},
) {
  const alpha = opts.alpha ?? 1;
  ctx.save();
  ctx.globalAlpha = alpha;

  // ground shadow
  if (opts.shadow !== false) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 26 * scale, 7 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // aura
  if (opts.glow) {
    ctx.save();
    const pulse = 1 + Math.sin(phase * 6) * 0.06;
    const g = ctx.createRadialGradient(x, y - 46 * scale, 6, x, y - 46 * scale, 78 * scale * pulse);
    g.addColorStop(0, opts.glow);
    g.addColorStop(0.55, opts.glow.replace(/[\d.]+\)$/, '0.35)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y - 46 * scale, 78 * scale * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.translate(x, y);
  ctx.scale(facing * scale, scale);

  let bodyRot = 0;
  let bodyY = 0;
  if (pose === 'slide') {
    bodyRot = -1.05;
    bodyY = -6;
  } else if (pose === 'celebrate' && opts.celebration === 2) {
    bodyRot = -phase * 1.4;
  } else if (pose === 'stun') {
    bodyRot = Math.sin(phase * 4) * 0.12;
  }
  ctx.translate(0, bodyY);
  ctx.rotate(bodyRot);

  const run = pose === 'run';
  const swing = run ? Math.sin(phase * 11) : pose === 'celebrate' ? Math.sin(phase * 9) * 0.5 : 0;
  const air = pose === 'jump' || pose === 'kick';

  const frozen = opts.frozen ?? 0;

  // back leg
  limb(
    ctx,
    -3,
    -23,
    12,
    12,
    pose === 'slide' ? 1.3 : pose === 'kick' ? -0.55 : air ? -0.5 + swing * 0.3 : -swing * 0.85,
    pose === 'kick' ? 0.4 : 0.5,
    9,
    7,
    look.kit2,
    look.skin,
    '#1c2434',
  );
  // back arm
  limb(
    ctx,
    -7,
    -49,
    10,
    9,
    pose === 'celebrate' ? -2.5 + Math.sin(phase * 9) * 0.25 : pose === 'kick' ? -1.5 : 0.7 + swing * 0.6,
    0.5,
    7,
    6,
    look.kit,
    look.skin,
    look.keeper ? '#ffe08a' : null,
  );

  // torso
  const torsoGrad = ctx.createLinearGradient(-14, 0, 14, 0);
  torsoGrad.addColorStop(0, look.kit);
  torsoGrad.addColorStop(1, look.kit2);
  ctx.fillStyle = torsoGrad;
  roundRect(ctx, -15, -55, 30, 24, 8);
  ctx.fill();
  // kit detail
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(-3, -55, 4, 24);
  // shorts
  ctx.fillStyle = look.kit2;
  roundRect(ctx, -14, -34, 28, 13, 5);
  ctx.fill();
  // number
  ctx.fillStyle = look.accent;
  ctx.font = '900 12px Impact, Haettenschweiler, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(look.number), 0, -40);

  // front leg
  const kickT = pose === 'kick' ? Math.min(1, Math.abs(Math.sin(phase * 6))) : 0;
  limb(
    ctx,
    3,
    -23,
    12,
    12,
    pose === 'slide' ? 0.35 : pose === 'kick' ? -1.25 - kickT * 0.5 : air ? 0.35 + swing * 0.3 : swing * 0.9,
    pose === 'kick' ? -0.2 : pose === 'slide' ? 1.2 : 0.45,
    10,
    8,
    look.kit,
    look.skin,
    '#f8fafc',
  );
  // front arm
  limb(
    ctx,
    8,
    -49,
    10,
    9,
    pose === 'celebrate' ? -2.9 + Math.sin(phase * 9 + 1) * 0.3 : pose === 'kick' ? -2.0 : -0.6 - swing * 0.6,
    0.6,
    8,
    6.5,
    look.kit,
    look.skin,
    look.keeper ? '#ffe08a' : null,
  );

  // neck
  ctx.fillStyle = look.skin;
  ctx.fillRect(-5, -60, 10, 7);

  // head
  const headY = -76 + (pose === 'celebrate' ? Math.sin(phase * 9) * 2 : 0);
  ctx.save();
  if (pose === 'slide') ctx.rotate(0.35);
  const hg = ctx.createRadialGradient(-6, headY - 8, 4, 0, headY, HEAD_R * 1.3);
  hg.addColorStop(0, '#ffffff');
  hg.addColorStop(0.28, look.skin);
  hg.addColorStop(1, look.skin);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, headY, HEAD_R, 0, Math.PI * 2);
  ctx.fill();
  // ears
  ctx.beginPath();
  ctx.arc(-HEAD_R + 2, headY + 3, 4, 0, Math.PI * 2);
  ctx.arc(HEAD_R - 2, headY + 3, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, headY);
  drawHair(ctx, look.hairStyle, look.hair);
  drawFace(ctx, pose, pose === 'celebrate' ? opts.celebration : undefined);

  if (frozen > 0) {
    ctx.globalAlpha = Math.min(0.65, frozen);
    ctx.fillStyle = '#9be8ff';
    ctx.beginPath();
    ctx.arc(0, 0, HEAD_R + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * HEAD_R, Math.sin(a) * HEAD_R);
      ctx.lineTo(Math.cos(a) * (HEAD_R + 10), Math.sin(a) * (HEAD_R + 10));
      ctx.stroke();
    }
  }
  ctx.restore();

  // stun stars
  if (pose === 'stun') {
    ctx.fillStyle = '#ffe14d';
    for (let i = 0; i < 3; i++) {
      const a = phase * 5 + (i / 3) * Math.PI * 2;
      ctx.save();
      ctx.translate(Math.cos(a) * 26, -92 + Math.sin(a) * 8);
      ctx.rotate(a);
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const aa = (k / 5) * Math.PI * 2 - Math.PI / 2;
        const r = k % 2 === 0 ? 6 : 2.6;
        const px = Math.cos(aa) * r;
        const py = Math.sin(aa) * r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // charge arcs
  if (opts.charge && opts.charge > 0.99) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = phase * 8 + i * 2;
      ctx.beginPath();
      ctx.arc(0, -46, 40 + i * 5, a, a + 1.1);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/** Small portrait used in HUD / selection cards */
export function drawPortrait(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  facing: number,
  look: ChibiLook,
  pose: Pose = 'idle',
  phase = 0,
) {
  drawChibi(ctx, x, y, size / 100, facing, look, pose, phase, { shadow: false });
}
