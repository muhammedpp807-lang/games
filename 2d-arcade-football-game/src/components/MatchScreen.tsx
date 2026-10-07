import { useCallback, useEffect, useRef, useState } from 'react';
import { MatchEngine, type HudState } from '../game/engine';
import { abilityById } from '../game/data';
import { audio } from '../game/audio';
import type { MatchConfig, MatchResult, Settings } from '../game/types';
import { TeamBadge } from './TeamBadge';
import { ArcadeButton, IconButton, Slider, Toggle } from './ui';

const keyActions = ['left', 'right', 'jump', 'slide', 'shoot', 'super'] as const;

export function MatchScreen({
  config,
  settings,
  onFinished,
  onQuit,
  onRestart,
  firstMatch,
}: {
  config: MatchConfig;
  settings: Settings;
  onFinished: (r: MatchResult) => void;
  onQuit: () => void;
  onRestart: () => void;
  firstMatch: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<MatchEngine | null>(null);
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hud, setHud] = useState<HudState>({ score: [0, 0], time: config.duration, charge: [0, 0], superOn: [false, false], phase: 'kickoff', suddenDeath: false });
  const [goalBanner, setGoalBanner] = useState<{ scorer: number; id: number } | null>(null);
  const [hint, setHint] = useState(firstMatch);
  const isTouch = useIsTouch(settings.touch);
  const [portrait, setPortrait] = useState(false);

  /* ---------- engine lifecycle ---------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const eng = new MatchEngine(canvas, config, {
      onGoal: (scorer) => {
        setGoalBanner({ scorer, id: Date.now() });
        window.setTimeout(() => setGoalBanner(null), 2200);
      },
      onEnd: (r) => onFinished(r),
      onPhase: (p) => {
        if (p !== 'goal') setGoalBanner(null);
      },
    });
    eng.setQuality(settings.quality, settings.shake);
    eng.start();
    engineRef.current = eng;
    audio.startCrowd();
    audio.applySettings(settings);
    const onResize = () => eng.resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    onResize();
    const ro = new ResizeObserver(() => eng.resize());
    ro.observe(canvas);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      ro.disconnect();
      eng.stop();
      audio.stopCrowd();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- hud sync ---------- */
  useEffect(() => {
    let raf = 0;
    let last = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const e = engineRef.current;
      if (!e) return;
      const h: HudState = {
        score: [e.score[0], e.score[1]],
        time: Math.max(0, Math.ceil(e.timeLeft)),
        charge: [Math.round(e.players[0].charge * 40) / 40, Math.round(e.players[1].charge * 40) / 40],
        superOn: [e.players[0].superT > 0, e.players[1].superT > 0],
        phase: e.state,
        suddenDeath: e.suddenDeath,
      };
      const sig = `${h.score[0]}|${h.score[1]}|${h.time}|${h.charge[0]}|${h.charge[1]}|${h.superOn[0]}|${h.superOn[1]}|${h.suddenDeath}`;
      if (sig !== last) {
        last = sig;
        setHud(h);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ---------- keep the clock frozen behind the intro / pause overlays ---------- */
  useEffect(() => {
    engineRef.current?.setPaused(hint || paused);
  }, [hint, paused]);

  /* ---------- portrait detection ---------- */
  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth * 1.05 && window.innerWidth < 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const doPause = useCallback(
    (p: boolean) => {
      setPaused(p);
      engineRef.current?.setPaused(p);
    },
    [],
  );

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const apply = (code: string, down: boolean) => {
      const eng = engineRef.current;
      if (!eng) return;
      const b = settings.bindings;
      (['p1', 'p2'] as const).forEach((pk, idx) => {
        const map = b[pk];
        const patch: Record<string, boolean> = {};
        keyActions.forEach((a) => {
          if (map[a] === code || (a === 'shoot' && map.altShoot === code) || (a === 'super' && map.altSuper === code)) {
            patch[a] = down;
          }
        });
        if (Object.keys(patch).length) eng.setInput(idx, patch);
      });
    };
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        setPaused((p) => {
          engineRef.current?.setPaused(!p);
          return !p;
        });
        return;
      }
      if (e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      apply(e.code, true);
    };
    const ku = (e: KeyboardEvent) => apply(e.code, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const blur = () => engineRef.current?.clearInputs();
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    };
  }, [settings.bindings]);

  const setInput = (i: number, patch: Partial<{ left: boolean; right: boolean; jump: boolean; slide: boolean; shoot: boolean; super: boolean; axis: number }>) =>
    engineRef.current?.setInput(i, patch);

  const p1 = config.p1;
  const p2 = config.p2;
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      {/* ---------- HUD ---------- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2 md:p-3">
        <div className="pointer-events-auto mr-12 flex w-full max-w-3xl items-stretch gap-1.5 rounded-2xl border-2 border-white/15 bg-gradient-to-b from-slate-900/85 to-slate-950/90 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-sm md:mr-0 md:gap-3 md:p-2">
          <TeamSide setup={p1} score={hud.score[0]} align="left" />
          <div className="flex min-w-[92px] flex-col items-center justify-center rounded-xl bg-black/50 px-2 py-1 ring-1 ring-white/10 md:min-w-[120px]">
            <div
              className={`font-arcade text-xl leading-none md:text-3xl ${hud.time <= 10 && !hud.suddenDeath ? 'text-red-400' : 'text-white'}`}
            >
              {hud.suddenDeath ? 'GG' : fmt(hud.time)}
            </div>
            <div className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-white/50 md:text-[10px]">
              {hud.suddenDeath ? 'Golden Goal' : config.mode === 'quick' ? 'Quick Match' : 'Arena Cup'}
            </div>
          </div>
          <TeamSide setup={p2} score={hud.score[1]} align="right" />
        </div>
      </div>

      {/* pause button */}
      <div className="absolute right-2 top-2 z-20 md:right-3 md:top-3">
        <IconButton title="Pause (P)" onClick={() => doPause(true)}>
          ❚❚
        </IconButton>
      </div>

      {/* charge meters */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-2 md:p-4">
        <ChargeMeter setup={p1} value={hud.charge[0]} active={hud.superOn[0]} label="P1" />
        {isTouch ? null : (
          <div className="hidden rounded-xl bg-black/45 px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-white/60 ring-1 ring-white/10 md:block">
            {keyLabel(settings.bindings.p1.jump)} jump · {keyLabel(settings.bindings.p1.shoot)} shoot ·{' '}
            {keyLabel(settings.bindings.p1.super)} super · {keyLabel('KeyP')} pause
          </div>
        )}
        <ChargeMeter setup={p2} value={hud.charge[1]} active={hud.superOn[1]} label={config.mode === '2p' ? 'P2' : 'CPU'} right />
      </div>

      {/* ---------- touch controls ---------- */}
      {isTouch && (
        <>
          <Joystick onAxis={(x) => setInput(0, { axis: x, left: x < -0.35, right: x > 0.35 })} />
          <div className="absolute bottom-16 right-3 z-20 flex items-end gap-2 md:bottom-20 md:right-6">
            <TouchBtn label="ACT" color="#8b5cf6" onDown={() => setInput(0, { slide: true })} onUp={() => setInput(0, { slide: false })} small />
            <TouchBtn label="JUMP" color="#22c55e" onDown={() => setInput(0, { jump: true })} onUp={() => setInput(0, { jump: false })} />
            <div className="flex flex-col gap-2">
              <TouchBtn label="SUPER" color="#f59e0b" onDown={() => setInput(0, { super: true })} onUp={() => setInput(0, { super: false })} small />
              <TouchBtn label="SHOOT" color="#ef4444" onDown={() => setInput(0, { shoot: true })} onUp={() => setInput(0, { shoot: false })} />
            </div>
          </div>
        </>
      )}

      {/* ---------- portrait hint ---------- */}
      {portrait && isTouch && (
        <div className="absolute inset-x-0 bottom-1/2 z-30 flex justify-center">
          <div className="anim-pop rounded-2xl border border-white/20 bg-black/80 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-300">
            ↻ Rotate to landscape for the best view
          </div>
        </div>
      )}

      {/* ---------- controls hint ---------- */}
      {hint && !isTouch && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-4" onClick={() => setHint(false)}>
          <div className="panel anim-pop w-full max-w-2xl p-5 md:p-7" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-arcade stroke-text-sm mb-4 text-center text-2xl text-amber-300 md:text-3xl">CONTROLS</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <ControlsCard title="PLAYER 1" color="#3ba7ff" bindings={settings.bindings.p1} />
              <ControlsCard title={config.mode === '2p' ? 'PLAYER 2' : 'CPU (AI)'} color="#ff5470" bindings={settings.bindings.p2} />
            </div>
            <p className="mt-4 text-center text-xs text-white/60">
              Tip: hold <b className="text-cyan-300">JUMP</b> while shooting for a lofted shot,{' '}
              <b className="text-cyan-300">SLIDE</b> for a driven low strike. Fill the charge bar then hit{' '}
              <b className="text-amber-300">SUPER</b>!
            </p>
            <div className="mt-5 flex justify-center">
              <ArcadeButton color="green" size="lg" onClick={() => setHint(false)}>
                KICK OFF ⚽
              </ArcadeButton>
            </div>
          </div>
        </div>
      )}

      {/* ---------- goal banner ---------- */}
      {goalBanner && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="anim-goal text-center">
            <div
              className="font-arcade stroke-text text-6xl uppercase leading-none md:text-8xl"
              style={{ color: goalBanner.scorer === 1 ? '#ffd166' : '#ff8fa3' }}
            >
              GOAL!
            </div>
            <div className="mt-2 font-arcade text-lg text-white drop-shadow md:text-2xl">
              {goalBanner.scorer === 1 ? p1.character.name : p2.character.name}
            </div>
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/70">
              {goalBanner.scorer === 1 ? p1.ability.name : p2.ability.name}
            </div>
          </div>
        </div>
      )}

      {/* ---------- pause menu ---------- */}
      {paused && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/75 p-4">
          <div className="panel anim-pop w-full max-w-md p-6">
            <h3 className="font-arcade stroke-text-sm mb-1 text-center text-3xl text-white md:text-4xl">GAME PAUSED</h3>
            <p className="mb-5 text-center text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">
              {p1.team.name} {hud.score[0]} – {hud.score[1]} {p2.team.name}
            </p>
            {showSettings ? (
              <div className="space-y-3">
                <button
                  className="mb-1 text-xs font-bold uppercase tracking-widest text-white/50 hover:text-white"
                  onClick={() => {
                    audio.click();
                    setShowSettings(false);
                  }}
                >
                  ← back
                </button>
                <Slider label="Master" value={settings.master} onChange={(v) => audio.applySettings({ ...settings, master: v })} />
                <Slider label="Music" value={settings.music} onChange={(v) => audio.applySettings({ ...settings, music: v })} />
                <Slider label="Effects" value={settings.sfx} onChange={(v) => audio.applySettings({ ...settings, sfx: v })} />
                <Toggle label="Screen shake" value={settings.shake} onChange={(v) => engineRef.current?.setQuality(settings.quality, v)} />
                <p className="text-center text-[10px] uppercase tracking-widest text-white/40">
                  Full settings are available from the main menu
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                <ArcadeButton color="green" size="lg" onClick={() => doPause(false)}>
                  RESUME
                </ArcadeButton>
                <div className="grid grid-cols-2 gap-3">
                  <ArcadeButton color="orange" onClick={onRestart}>
                    RESTART
                  </ArcadeButton>
                  <ArcadeButton color="blue" onClick={() => setShowSettings(true)}>
                    SETTINGS
                  </ArcadeButton>
                </div>
                <ArcadeButton color="red" onClick={onQuit}>
                  QUIT TO MENU
                </ArcadeButton>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function keyLabel(code: string) {
  if (!code) return '';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Arrow')) return code === 'ArrowUp' ? '↑' : code === 'ArrowDown' ? '↓' : code === 'ArrowLeft' ? '←' : '→';
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  if (code === 'Space') return 'Space';
  return code.length === 1 ? code.toUpperCase() : code;
}

function ControlsCard({ title, color, bindings }: { title: string; color: string; bindings: Record<string, string> }) {
  const rows: [string, string][] = [
    ['Move', `${keyLabel(bindings.left)} / ${keyLabel(bindings.right)}`],
    ['Jump', keyLabel(bindings.jump)],
    ['Slide / Block', keyLabel(bindings.slide)],
    ['Shoot', `${keyLabel(bindings.shoot)} or ${keyLabel(bindings.altShoot)}`],
    ['Supershot', `${keyLabel(bindings.super)} or ${keyLabel(bindings.altSuper)}`],
  ];
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3">
      <div className="font-arcade mb-2 text-sm" style={{ color }}>
        {title}
      </div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between border-b border-white/5 py-1 text-xs last:border-0">
          <span className="text-white/60">{k}</span>
          <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11px] font-bold text-white">{v}</span>
        </div>
      ))}
    </div>
  );
}

function TeamSide({ setup, score, align }: { setup: MatchConfig['p1']; score: number; align: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <div className="shrink-0">
        <TeamBadge team={setup.team} size={34} />
      </div>
      <div className={`min-w-0 ${align === 'right' ? 'items-end' : ''}`}>
        <div className="truncate font-arcade text-[11px] leading-tight text-white md:text-base">{setup.team.short}</div>
        <div className="truncate text-[9px] font-bold uppercase tracking-wider text-white/55 md:text-[11px]">
          {setup.character.name}
        </div>
      </div>
      <div
        className={`font-arcade shrink-0 text-2xl leading-none md:text-4xl ${align === 'right' ? 'order-first' : ''}`}
        style={{ color: align === 'left' ? '#7fd1ff' : '#ff9db1' }}
      >
        {score}
      </div>
    </div>
  );
}

function ChargeMeter({
  setup,
  value,
  active,
  label,
  right,
}: {
  setup: MatchConfig['p1'];
  value: number;
  active: boolean;
  label: string;
  right?: boolean;
}) {
  const ab = abilityById(setup.character.abilityId);
  const pct = Math.round(value * 100);
  return (
    <div className={`w-32 md:w-52 ${right ? 'text-right' : ''}`}>
      <div className={`flex items-center gap-1 ${right ? 'justify-end' : ''}`}>
        <span className="text-sm md:text-base">{ab.icon}</span>
        <span className="font-arcade truncate text-[9px] uppercase tracking-wider text-white/80 md:text-xs">{ab.name}</span>
        <span className="rounded bg-white/10 px-1 text-[8px] font-black text-white/60">{label}</span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full border border-white/20 bg-black/60">
        <div
          className="h-full rounded-full transition-[width] duration-100"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${ab.color2}, ${ab.color})`,
            boxShadow: pct >= 100 ? `0 0 12px ${ab.color}` : undefined,
          }}
        />
      </div>
      {active && (
        <div className="font-arcade mt-0.5 animate-pulse text-[9px] uppercase tracking-widest" style={{ color: ab.color }}>
          super active!
        </div>
      )}
    </div>
  );
}

/* ---------------- touch widgets ---------------- */
function Joystick({ onAxis }: { onAxis: (x: number) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState(0);
  const active = useRef(false);

  const handle = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const dx = Math.max(-1, Math.min(1, (clientX - cx) / (r.width / 2)));
    setKnob(dx * (r.width / 2 - 24));
    onAxis(Math.abs(dx) < 0.18 ? 0 : dx);
  };

  return (
    <div
      ref={ref}
      className="absolute bottom-16 left-4 z-20 h-32 w-32 touch-none rounded-full border-2 border-white/25 bg-black/35 backdrop-blur-sm md:bottom-20 md:left-8 md:h-40 md:w-40"
      onPointerDown={(e) => {
        active.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        handle(e.clientX);
      }}
      onPointerMove={(e) => active.current && handle(e.clientX)}
      onPointerUp={() => {
        active.current = false;
        setKnob(0);
        onAxis(0);
      }}
      onPointerCancel={() => {
        active.current = false;
        setKnob(0);
        onAxis(0);
      }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40 bg-gradient-to-b from-cyan-300 to-blue-600 shadow-lg"
        style={{ transform: `translate(calc(-50% + ${knob}px), -50%)` }}
      />
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-[10px] font-black uppercase tracking-widest text-white/40">
        move
      </div>
    </div>
  );
}

function TouchBtn({
  label,
  color,
  onDown,
  onUp,
  small,
}: {
  label: string;
  color: string;
  onDown: () => void;
  onUp: () => void;
  small?: boolean;
}) {
  const [down, setDown] = useState(false);
  const size = small ? 'h-14 w-14 text-[9px]' : 'h-20 w-20 text-[11px]';
  return (
    <button
      className={`font-arcade ${size} touch-none rounded-full border-2 border-white/40 font-black uppercase text-white shadow-[0_6px_0_rgba(0,0,0,0.4)] transition-transform ${down ? 'translate-y-1 scale-95' : ''}`}
      style={{ background: `radial-gradient(circle at 35% 28%, ${color}ee, ${color}88 60%, #00000066)` }}
      onPointerDown={(e) => {
        e.preventDefault();
        setDown(true);
        onDown();
      }}
      onPointerUp={() => {
        setDown(false);
        onUp();
      }}
      onPointerLeave={() => {
        if (down) {
          setDown(false);
          onUp();
        }
      }}
      onPointerCancel={() => {
        setDown(false);
        onUp();
      }}
    >
      {label}
    </button>
  );
}

export function useIsTouch(mode: 'auto' | 'on' | 'off') {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    if (mode === 'on') setTouch(true);
    else if (mode === 'off') setTouch(false);
    else {
      const mq = window.matchMedia('(pointer: coarse)');
      const check = () => setTouch(mq.matches || 'ontouchstart' in window);
      check();
      mq.addEventListener?.('change', check);
      return () => mq.removeEventListener?.('change', check);
    }
  }, [mode]);
  return touch;
}
