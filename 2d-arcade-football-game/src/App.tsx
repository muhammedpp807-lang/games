import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Game, type CameraMode } from './game3d/Game';
import { driveAudio } from './game3d/audio3d';
import { loadSettings, saveSettings, type GameSettings, type HudState } from './game3d/settings';
import { HudOverlay, LoadingScreen, MainMenu, PauseMenu, ControlsList } from './ui3d/Menus';
import type { MapGeo } from './ui3d/Hud';

type Stage = 'loading' | 'menu' | 'playing' | 'paused';

const EMPTY_HUD: HudState = {
  speed: 0,
  rpm: 900,
  gear: 1,
  maxRpm: 8600,
  fuel: 100,
  damage: 0,
  handbrake: false,
  lightsOn: false,
  reverse: false,
  x: -280,
  z: -35,
  heading: 1.57,
  gearLabel: '1',
  odometer: 0,
  drifting: false,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState('Initialising renderer');
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [geo, setGeo] = useState<MapGeo | null>(null);
  const [traffic, setTraffic] = useState<{ x: number; z: number }[]>([]);
  const [camMode, setCamMode] = useState<CameraMode>('chase');
  const [error, setError] = useState<string | null>(null);

  /* ---------- asset pipeline ---------- */
  useEffect(() => {
    let cancelled = false;
    const stages: [string, number, () => void][] = [
      ['Compiling shaders', 0.15, () => undefined],
      ['Streaming city map', 0.42, () => undefined],
      ['Placing buildings & props', 0.68, () => undefined],
      ['Spawning traffic AI', 0.86, () => undefined],
      ['Calibrating vehicle', 1, () => undefined],
    ];
    let idx = 0;
    const run = () => {
      if (cancelled) return;
      if (idx >= stages.length) {
        try {
          boot();
        } catch (e) {
          setError(String(e));
        }
        return;
      }
      const [text, p] = stages[idx];
      setLabel(text);
      setProgress(p);
      idx++;
      window.setTimeout(run, 180);
    };
    const boot = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const game = new Game(canvas, settings, {
        onHud: (h) => {
          setHud(h);
          const g = gameRef.current;
          if (g) setTraffic(g.trafficPositions());
        },
      });
      gameRef.current = game;
      setGeo(game.minimapGeometry());
      game.paused = true;
      game.start();
      setStage('menu');
    };
    window.setTimeout(run, 120);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- lifecycle ---------- */
  useEffect(() => {
    return () => {
      gameRef.current?.dispose();
      gameRef.current = null;
      driveAudio.stopMusic();
    };
  }, []);

  useEffect(() => {
    saveSettings(settings);
    gameRef.current?.applySettings(settings);
    driveAudio.setVolumes({ master: settings.master, music: settings.music, sfx: settings.sfx });
  }, [settings]);

  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    g.paused = stage !== 'playing';
    if (stage === 'playing') {
      driveAudio.resume();
      driveAudio.startMusic();
      g.resize();
    }
  }, [stage]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        setStage((s) => (s === 'playing' ? 'paused' : s === 'paused' ? 'playing' : s));
        return;
      }
      if (e.code === 'Space') e.preventDefault();
      if (stage !== 'playing') return;
      gameRef.current?.handleKey(e.code, true);
    };
    const up = (e: KeyboardEvent) => gameRef.current?.handleKey(e.code, false);
    const blur = () => gameRef.current?.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    const resize = () => gameRef.current?.resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    };
  }, [stage]);

  const play = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    driveAudio.resume();
    driveAudio.startEngine();
    g.paused = false;
    g.resize();
    setStage('playing');
  }, []);

  const applyPreset = useCallback((s: GameSettings) => {
    setSettings({ ...s });
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black text-white">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none" />

      {stage === 'playing' && geo && (
        <HudOverlay
          hud={hud}
          geo={geo}
          traffic={traffic}
          settings={settings}
          game={gameRef.current}
          camMode={camMode}
          onPause={() => setStage('paused')}
          onCam={() => {
            gameRef.current?.cycleCamera();
            setCamMode(gameRef.current?.camMode ?? 'chase');
          }}
          onReset={() => gameRef.current?.car.recover(gameRef.current.world)}
        />
      )}

      {stage === 'menu' && (
        <>
          <MainMenu
            settings={settings}
            onPlay={play}
            onSettings={(s) => applyPreset(s)}
          />
          <div className="pointer-events-none absolute bottom-16 right-8 z-50 hidden max-w-xs rounded-lg border border-white/10 bg-black/60 p-4 text-[11px] leading-relaxed text-white/60 backdrop-blur md:block">
            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300">Vehicle</div>
            V12 hypercar · 1580 kg · RWD-biased AWD · 7-speed auto
            <div className="mt-2 mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300">Map</div>
            Grid city · suspension bridge · container port · airport · industrial docks
          </div>
        </>
      )}

      {stage === 'paused' && (
        <PauseMenu
          settings={settings}
          onSettingsChange={(s) => applyPreset(s)}
          onResume={() => setStage('playing')}
          onReset={() => {
            gameRef.current?.car.recover(gameRef.current.world);
            setStage('playing');
          }}
          onMenu={() => {
            const g = gameRef.current;
            if (g) {
              g.paused = true;
              g.car.reset(new THREE.Vector3(-280, 0.8, -35), Math.PI / 2);
            }
            setStage('menu');
          }}
        />
      )}

      {stage === 'loading' && <LoadingScreen progress={progress} label={label} />}

      {error && (
        <div className="absolute inset-0 z-[60] grid place-items-center bg-black/90 p-6 text-center">
          <div>
            <p className="mb-2 text-lg font-bold text-red-300">Graphics init failed</p>
            <p className="mb-4 max-w-md text-xs text-white/60">{error}</p>
            <ControlsList />
          </div>
        </div>
      )}
    </div>
  );
}
