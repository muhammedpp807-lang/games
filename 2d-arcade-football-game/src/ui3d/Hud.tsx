import { useEffect, useRef } from 'react';
import type { HudState, GameSettings } from '../game3d/settings';

export interface MapGeo {
  xRoad: number[];
  zRoad: number[];
  PLATE: { x0: number; x1: number; z0: number; z1: number };
  BRIDGE: { x0: number; x1: number; halfW: number };
  PORT: { x0: number; x1: number; z0: number; z1: number };
  AIRPORT: { x0: number; x1: number; z0: number; z1: number };
  INDUSTRIAL: { x0: number; x1: number; z0: number; z1: number };
}

const MAP_RANGE = 1150;

export function Minimap({
  geo,
  hud,
  traffic,
  size = 168,
}: {
  geo: MapGeo;
  hud: HudState;
  traffic: { x: number; z: number }[];
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const staticRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // bake the static road network once — it is the real map data
    const c = document.createElement('canvas');
    const S = size * 2;
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d')!;
    const w2m = (v: number) => ((v + MAP_RANGE) / (MAP_RANGE * 2)) * S;

    ctx.fillStyle = '#0b2130';
    ctx.fillRect(0, 0, S, S);
    // land plate
    ctx.fillStyle = '#20262b';
    ctx.fillRect(w2m(geo.PLATE.x0), w2m(geo.PLATE.z0), w2m(geo.PLATE.x1) - w2m(geo.PLATE.x0), w2m(geo.PLATE.z1) - w2m(geo.PLATE.z0));
    ctx.fillStyle = '#1d2328';
    ctx.fillRect(w2m(geo.PORT.x0), w2m(geo.PORT.z0), w2m(geo.PORT.x1) - w2m(geo.PORT.x0), w2m(geo.PORT.z1) - w2m(geo.PORT.z0));
    ctx.fillRect(w2m(geo.AIRPORT.x0), w2m(geo.AIRPORT.z0), w2m(geo.AIRPORT.x1) - w2m(geo.AIRPORT.x0), w2m(geo.AIRPORT.z1) - w2m(geo.AIRPORT.z0));
    ctx.fillRect(
      w2m(geo.INDUSTRIAL.x0),
      w2m(geo.INDUSTRIAL.z0),
      w2m(geo.INDUSTRIAL.x1) - w2m(geo.INDUSTRIAL.x0),
      w2m(geo.INDUSTRIAL.z1) - w2m(geo.INDUSTRIAL.z0),
    );
    // bridge
    ctx.strokeStyle = '#8c3a2e';
    ctx.lineWidth = Math.max(2, S / 90);
    ctx.beginPath();
    ctx.moveTo(w2m(geo.BRIDGE.x0), w2m(0));
    ctx.lineTo(w2m(geo.BRIDGE.x1), w2m(0));
    ctx.stroke();
    // roads
    ctx.strokeStyle = '#5b6167';
    ctx.lineWidth = Math.max(1.4, S / 190);
    geo.zRoad.forEach((z) => {
      ctx.beginPath();
      ctx.moveTo(w2m(geo.PLATE.x0), w2m(z));
      ctx.lineTo(w2m(geo.PLATE.x1), w2m(z));
      ctx.stroke();
    });
    geo.xRoad.forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(w2m(x), w2m(geo.PLATE.z0));
      ctx.lineTo(w2m(x), w2m(geo.PLATE.z1));
      ctx.stroke();
    });
    // connectors
    ctx.beginPath();
    ctx.moveTo(w2m((geo.PORT.x0 + geo.PORT.x1) / 2), w2m(geo.PORT.z1));
    ctx.lineTo(w2m((geo.PORT.x0 + geo.PORT.x1) / 2), w2m(geo.PLATE.z0));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w2m(geo.PLATE.x1), w2m(0));
    ctx.lineTo(w2m(geo.AIRPORT.x0), w2m(0));
    ctx.stroke();
    staticRef.current = c;
  }, [geo, size]);

  useEffect(() => {
    const cv = canvasRef.current;
    const bg = staticRef.current;
    if (!cv || !bg) return;
    const ctx = cv.getContext('2d')!;
    const S = size * 2;
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(bg, 0, 0);
    const w2m = (v: number) => ((v + MAP_RANGE) / (MAP_RANGE * 2)) * S;

    // traffic
    ctx.fillStyle = '#ffd166';
    traffic.forEach((t) => {
      ctx.beginPath();
      ctx.arc(w2m(t.x), w2m(t.z), Math.max(1.6, S / 260), 0, Math.PI * 2);
      ctx.fill();
    });

    // player arrow
    const px = w2m(hud.x);
    const py = w2m(hud.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-hud.heading);
    ctx.fillStyle = '#ff2d3c';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -S / 34);
    ctx.lineTo(S / 78, S / 44);
    ctx.lineTo(0, S / 66);
    ctx.lineTo(-S / 78, S / 44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [hud, traffic, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size * 2}
      height={size * 2}
      style={{ width: size, height: size }}
      className="rounded-xl border border-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
    />
  );
}

export function Gauge({ hud }: { hud: HudState }) {
  const kmh = Math.abs(hud.speed);
  const rpmPct = Math.min(1, hud.rpm / hud.maxRpm);
  const redline = rpmPct > 0.86;
  return (
    <div className="flex items-end gap-3">
      <div className="text-right">
        <div className="font-mono text-4xl font-black leading-none text-white tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] md:text-5xl">
          {Math.round(kmh)}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">km/h</div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <div
          className={`grid h-11 w-11 place-items-center rounded-lg border-2 font-mono text-xl font-black ${
            hud.reverse ? 'border-amber-300 bg-amber-400/20 text-amber-200' : 'border-white/25 bg-black/45 text-white'
          }`}
        >
          {hud.gearLabel}
        </div>
        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-black/60">
          <div
            className={`h-full rounded-full transition-[width] duration-75 ${redline ? 'bg-red-500' : 'bg-cyan-300'}`}
            style={{ width: `${rpmPct * 100}%` }}
          />
        </div>
        <div className="font-mono text-[9px] text-white/50">{Math.round(hud.rpm)} rpm</div>
      </div>
    </div>
  );
}

export function StatusIcons({ hud, settings }: { hud: HudState; settings: GameSettings }) {
  const items: { on: boolean; icon: string; label: string; color: string }[] = [
    { on: hud.lightsOn, icon: '☀', label: 'Lights', color: '#7dd3fc' },
    { on: hud.handbrake, icon: '(P)', label: 'Handbrake', color: '#f87171' },
    { on: hud.damage > 12, icon: '⚠', label: 'Damage', color: '#fb923c' },
    { on: hud.fuel < 25, icon: '⛽', label: 'Fuel', color: '#fbbf24' },
    { on: hud.drifting, icon: '↯', label: 'Drift', color: '#a78bfa' },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {items.map((it) => (
        <div
          key={it.label}
          title={it.label}
          data-on={it.on ? '1' : '0'}
          className={
            'grid h-7 w-7 place-items-center rounded-md border text-[11px] font-black transition ' +
            (it.on ? 'border-white/40' : 'border-white/10 opacity-25')
          }
          style={{ background: it.on ? it.color + '22' : 'transparent', color: it.on ? it.color : '#94a3b8' }}
        >
          {it.icon}
        </div>
      ))}
      <div className="ml-1 flex flex-col gap-1">
        <Meter label="FUEL" value={hud.fuel / 100} color="#38bdf8" />
        <Meter label="BODY" value={1 - hud.damage / 100} color={hud.damage > 55 ? '#f87171' : '#4ade80'} />
      </div>
      <div className="hidden text-[10px] font-bold uppercase tracking-widest text-white/40 md:block">
        {settings.quality} · {(settings.renderScale * 100).toFixed(0)}%
      </div>
    </div>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-8 text-[8px] font-black uppercase tracking-wider text-white/50">{label}</span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/60">
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
      </div>
    </div>
  );
}
