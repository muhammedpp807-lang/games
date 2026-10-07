import { useEffect, useRef, useState } from 'react';
import { driveAudio } from '../game3d/audio3d';
import { Gauge, Minimap, StatusIcons, type MapGeo } from './Hud';
import type { GameSettings, HudState, Quality, ShadowQ, Weather } from '../game3d/settings';
import type { CameraMode, Game } from '../game3d/Game';

/* ---------------- shared chrome ---------------- */
export function MenuButton({
  children,
  onClick,
  variant = 'primary',
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'accent';
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary: 'bg-gradient-to-b from-slate-200 to-slate-400 text-slate-900 border-white/60',
    accent: 'bg-gradient-to-b from-cyan-300 to-sky-600 text-white border-cyan-100/60',
    ghost: 'bg-white/5 text-white/85 border-white/20 hover:bg-white/10',
    danger: 'bg-gradient-to-b from-rose-400 to-red-700 text-white border-rose-200/50',
  };
  return (
    <button
      onPointerEnter={() => driveAudio.click()}
      onClick={() => {
        driveAudio.click();
        onClick?.();
      }}
      className={`w-full rounded-md border px-6 py-3 text-sm font-bold uppercase tracking-[0.2em] shadow-[0_4px_0_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.5)] transition active:translate-y-0.5 active:shadow-[0_1px_0_rgba(0,0,0,0.45)] ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 py-2.5 last:border-0">
      <span className="text-xs font-bold uppercase tracking-widest text-white/60">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Slider({ label, value, min = 0, max = 1, step = 0.05, onChange, fmt }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <Row label={label}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="h-1.5 w-40 cursor-pointer appearance-none rounded-full bg-white/20 accent-cyan-400" />
      <span className="w-12 text-right font-mono text-xs text-cyan-300">{fmt ? fmt(value) : `${Math.round(value * 100)}%`}</span>
    </Row>
  );
}

function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <Row label={label}>
      <div className="flex overflow-hidden rounded-md border border-white/15">
        {options.map((o) => (
          <button
            key={String(o.v)}
            onClick={() => {
              driveAudio.click();
              onChange(o.v);
            }}
            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${value === o.v ? 'bg-cyan-400 text-slate-900' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </Row>
  );
}

/* ---------------- loading ---------------- */
export function LoadingScreen({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#05080d]">
      <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(ellipse at 50% 40%, #16324a 0%, #05080d 70%)' }} />
      <div className="relative w-full max-w-lg px-8">
        <h1 className="mb-1 text-center text-3xl font-black tracking-[0.35em] text-white">OPEN ROAD</h1>
        <p className="mb-8 text-center text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-300/70">Free-roam driving simulator</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-200 transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-widest text-white/40">
          <span>{label}</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- main menu ---------------- */
export function MainMenu({
  onPlay,
  onSettings,
  settings,
}: {
  onPlay: () => void;
  onSettings: (s: GameSettings) => void;
  settings: GameSettings;
}) {
  const [tab, setTab] = useState<'main' | 'settings' | 'controls' | 'graphics' | 'sound'>('main');
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#05080d]">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 70% 20%, #14344c 0%, #060a11 60%)' }} />
      <div className="relative flex flex-1 flex-col justify-center px-8 md:px-20">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.5em] text-cyan-300/70">Realistic driving simulator</div>
        <h1 className="mb-8 text-5xl font-black leading-none tracking-tight text-white md:text-7xl">
          OPEN<span className="text-cyan-300">ROAD</span>
        </h1>
        <div className="w-full max-w-sm space-y-2.5">
          {tab === 'main' && (
            <>
              <MenuButton variant="accent" onClick={onPlay}>Play</MenuButton>
              <MenuButton variant="ghost" onClick={() => setTab('settings')}>Settings</MenuButton>
              <MenuButton variant="ghost" onClick={() => setTab('controls')}>Controls</MenuButton>
              <MenuButton variant="ghost" onClick={() => setTab('graphics')}>Graphics</MenuButton>
              <MenuButton variant="ghost" onClick={() => setTab('sound')}>Sound</MenuButton>
            </>
          )}
          {tab !== 'main' && (
            <div className="rounded-lg border border-white/10 bg-black/50 p-4 backdrop-blur">
              {tab === 'settings' && (
                <>
                  <Seg<Quality> label="Preset" value={settings.quality} onChange={(v) => onSettings({ ...settings, quality: v })} options={[{ v: 'low', l: 'Low' }, { v: 'medium', l: 'Med' }, { v: 'high', l: 'High' }, { v: 'ultra', l: 'Ultra' }]} />
                  <Slider label="Render scale" value={settings.renderScale} min={0.5} max={1.25} step={0.05} onChange={(v) => onSettings({ ...settings, renderScale: v })} />
                  <Slider label="Steering sensitivity" value={settings.steerSensitivity} min={0.4} max={2} step={0.05} onChange={(v) => onSettings({ ...settings, steerSensitivity: v })} />
                  <Slider label="Camera distance" value={settings.camDistance} min={4} max={12} step={0.2} onChange={(v) => onSettings({ ...settings, camDistance: v })} fmt={(v) => `${v.toFixed(1)} m`} />
                  <Slider label="Camera sensitivity" value={settings.camSensitivity} min={0.4} max={2} step={0.05} onChange={(v) => onSettings({ ...settings, camSensitivity: v })} />
                </>
              )}
              {tab === 'graphics' && (
                <>
                  <Seg<ShadowQ> label="Shadows" value={settings.shadows} onChange={(v) => onSettings({ ...settings, shadows: v })} options={[{ v: 'off', l: 'Off' }, { v: 'low', l: 'Low' }, { v: 'medium', l: 'Med' }, { v: 'high', l: 'High' }]} />
                  <Slider label="Effects" value={settings.effects} onChange={(v) => onSettings({ ...settings, effects: v })} />
                  <Seg<Weather> label="Weather" value={settings.weather} onChange={(v) => onSettings({ ...settings, weather: v })} options={[{ v: 'clear', l: 'Clear' }, { v: 'cloudy', l: 'Cloud' }, { v: 'rain', l: 'Rain' }, { v: 'fog', l: 'Fog' }]} />
                  <Seg<number> label="Time of day" value={Math.round(settings.timeOfDay)} onChange={(v) => onSettings({ ...settings, timeOfDay: v, autoTime: false })} options={[{ v: 6, l: 'Dawn' }, { v: 12, l: 'Noon' }, { v: 18, l: 'Dusk' }, { v: 0, l: 'Night' }]} />
                </>
              )}
              {tab === 'sound' && (
                <>
                  <Slider label="Master" value={settings.master} onChange={(v) => onSettings({ ...settings, master: v })} />
                  <Slider label="Music" value={settings.music} onChange={(v) => onSettings({ ...settings, music: v })} />
                  <Slider label="Effects" value={settings.sfx} onChange={(v) => onSettings({ ...settings, sfx: v })} />
                  <MenuButton variant="ghost" onClick={() => driveAudio.startMusic()}>Test music</MenuButton>
                </>
              )}
              {tab === 'controls' && <ControlsList />}
              <div className="mt-4">
                <MenuButton variant="primary" onClick={() => setTab('main')}>Back</MenuButton>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="relative px-8 pb-6 text-[10px] font-bold uppercase tracking-[0.3em] text-white/25 md:px-20">
        WASD drive · Space handbrake · C camera · R reset · Esc pause
      </div>
    </div>
  );
}

export function ControlsList() {
  const rows: [string, string][] = [
    ['Accelerate', 'W'],
    ['Brake / Reverse', 'S'],
    ['Steer', 'A / D'],
    ['Handbrake', 'Space'],
    ['Change camera', 'C'],
    ['Reset vehicle', 'R'],
    ['Horn', 'H'],
    ['Headlights', 'L'],
    ['Pause', 'Esc'],
  ];
  return (
    <div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between border-b border-white/5 py-2 text-xs last:border-0">
          <span className="text-white/60">{k}</span>
          <span className="rounded bg-white/10 px-2 py-0.5 font-mono font-bold text-white">{v}</span>
        </div>
      ))}
      <p className="mt-3 text-[10px] uppercase tracking-widest text-white/35">Touch devices show on-screen controls automatically.</p>
    </div>
  );
}

/* ---------------- pause ---------------- */
export function PauseMenu({
  onResume,
  onReset,
  onMenu,
  settings,
  onSettingsChange,
}: {
  onResume: () => void;
  onReset: () => void;
  onMenu: () => void;
  settings: GameSettings;
  onSettingsChange: (s: GameSettings) => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-white/15 bg-[#0a0f16]/95 p-6 shadow-2xl">
        <h2 className="mb-1 text-center text-2xl font-black uppercase tracking-[0.3em] text-white">Paused</h2>
        <p className="mb-5 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/70">Simulation halted</p>
        {showSettings ? (
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <Seg<Quality> label="Preset" value={settings.quality} onChange={(v) => onSettingsChange({ ...settings, quality: v })} options={[{ v: 'low', l: 'Low' }, { v: 'medium', l: 'Med' }, { v: 'high', l: 'High' }, { v: 'ultra', l: 'Ultra' }]} />
            <Slider label="Render scale" value={settings.renderScale} min={0.5} max={1.25} step={0.05} onChange={(v) => onSettingsChange({ ...settings, renderScale: v })} />
            <Slider label="Master" value={settings.master} onChange={(v) => onSettingsChange({ ...settings, master: v })} />
            <Slider label="Effects" value={settings.sfx} onChange={(v) => onSettingsChange({ ...settings, sfx: v })} />
            <Slider label="Music" value={settings.music} onChange={(v) => onSettingsChange({ ...settings, music: v })} />
            <div className="mt-4">
              <MenuButton variant="primary" onClick={() => setShowSettings(false)}>Back</MenuButton>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <MenuButton variant="accent" onClick={onResume}>Resume</MenuButton>
            <MenuButton variant="ghost" onClick={onReset}>Reset vehicle</MenuButton>
            <MenuButton variant="ghost" onClick={() => setShowSettings(true)}>Settings</MenuButton>
            <MenuButton variant="danger" onClick={onMenu}>Main menu</MenuButton>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- HUD overlay ---------------- */
export function HudOverlay({
  hud,
  geo,
  traffic,
  settings,
  game,
  camMode,
  onPause,
  onCam,
  onReset,
}: {
  hud: HudState;
  geo: MapGeo;
  traffic: { x: number; z: number }[];
  settings: GameSettings;
  game: Game | null;
  camMode: CameraMode;
  onPause: () => void;
  onCam: () => void;
  onReset: () => void;
}) {
  const isTouch = useRef(false);
  const [, force] = useState(0);
  useEffect(() => {
    isTouch.current = window.matchMedia('(pointer: coarse)').matches;
    force((n) => n + 1);
  }, []);

  const camLabel: Record<CameraMode, string> = { chase: 'Chase', far: 'Far', hood: 'Cockpit', cinematic: 'Cinematic' };

  return (
    <>
      {/* top-left: gauges */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-2">
        <div className="rounded-lg border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-sm">
          <Gauge hud={hud} />
        </div>
        <div className="rounded-lg border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-sm">
          <StatusIcons hud={hud} settings={settings} />
        </div>
      </div>

      {/* top-right: minimap */}
      <div className="pointer-events-none absolute right-3 top-3 z-20 flex flex-col items-end gap-2">
        <Minimap geo={geo} hud={hud} traffic={traffic} size={window.innerWidth < 640 ? 116 : 168} />
        <div className="rounded-md border border-white/10 bg-black/50 px-2 py-1 font-mono text-[10px] text-white/60">
          {hud.x.toFixed(0)}, {hud.z.toFixed(0)} · {(hud.odometer / 1000).toFixed(2)} km
        </div>
      </div>

      {/* top-centre controls */}
      <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2">
        <button onClick={onPause} className="rounded-md border border-white/20 bg-black/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/80 backdrop-blur transition hover:bg-black/70">
          ❚❚ Esc
        </button>
        <button onClick={onCam} className="rounded-md border border-white/20 bg-black/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/80 backdrop-blur transition hover:bg-black/70">
          ⛶ {camLabel[camMode]}
        </button>
        <button onClick={onReset} className="rounded-md border border-white/20 bg-black/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/80 backdrop-blur transition hover:bg-black/70">
          ↺ Reset
        </button>
      </div>

      {/* bottom-right camera hint */}
      <div className="pointer-events-none absolute bottom-3 right-3 z-20 hidden rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/40 md:block">
        C camera · R reset · H horn · L lights
      </div>

      {isTouch.current && (
        <TouchControls
          onSteer={(v) => game && (game.touch.steer = v)}
          onPedal={(kind, v) => {
            if (!game) return;
            if (kind === 'gas') game.touch.throttle = v;
            else game.touch.brake = v;
          }}
          onHandbrake={(v) => game && (game.touch.handbrake = v)}
          onCam={() => game && (game.touch.cam = true)}
          onReset={() => game && (game.touch.reset = true)}
        />
      )}
    </>
  );
}

/* ---------------- touch controls ---------------- */
function TouchControls({
  onSteer,
  onPedal,
  onHandbrake,
  onCam,
  onReset,
}: {
  onSteer: (v: number) => void;
  onPedal: (kind: 'gas' | 'brake', v: number) => void;
  onHandbrake: (v: boolean) => void;
  onCam: () => void;
  onReset: () => void;
}) {
  const btn = (label: string, extra: string, onDown: () => void, onUp: () => void, bg = 'rgba(255,255,255,0.12)') => (
    <button
      className={`pointer-events-auto select-none rounded-full border border-white/30 font-black uppercase text-white backdrop-blur-sm active:scale-95 ${extra}`}
      style={{ background: bg, touchAction: 'none' }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
    >
      {label}
    </button>
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="absolute bottom-5 left-4 flex gap-3">
        {btn('◀', 'h-20 w-20 text-2xl', () => onSteer(-1), () => onSteer(0))}
        {btn('▶', 'h-20 w-20 text-2xl', () => onSteer(1), () => onSteer(0))}
      </div>
      <div className="absolute bottom-5 right-4 flex items-end gap-3">
        {btn('HB', 'h-14 w-14 text-[11px]', () => onHandbrake(true), () => onHandbrake(false), 'rgba(248,113,113,0.28)')}
        {btn('BRK', 'h-20 w-20 text-xs', () => onPedal('brake', 1), () => onPedal('brake', 0), 'rgba(251,146,60,0.28)')}
        {btn('GAS', 'h-24 w-24 text-sm', () => onPedal('gas', 1), () => onPedal('gas', 0), 'rgba(56,189,248,0.32)')}
      </div>
      <div className="absolute bottom-28 right-4 flex flex-col gap-2">
        {btn('CAM', 'h-12 w-12 text-[10px]', onCam, () => undefined)}
        {btn('RST', 'h-12 w-12 text-[10px]', onReset, () => undefined)}
      </div>
    </div>
  );
}
