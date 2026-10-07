import { useState } from 'react';
import { ArcadeButton, SegButtons, Slider, StadiumBackdrop, Title, Toggle } from '../components/ui';
import { audio } from '../game/audio';
import { ACTION_LABELS, DEFAULT_BINDINGS } from '../game/storage';
import type { Difficulty, KeyBindings, Settings } from '../game/types';

export function SettingsScreen({
  settings,
  onChange,
  onBack,
  onReset,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<'audio' | 'gameplay' | 'controls' | 'display'>('audio');
  const [binding, setBinding] = useState<{ player: 'p1' | 'p2'; action: string } | null>(null);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });

  const setBind = (player: 'p1' | 'p2', action: string, code: string) => {
    const b: KeyBindings = { ...settings.bindings, [player]: { ...settings.bindings[player], [action]: code } };
    onChange({ ...settings, bindings: b });
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <StadiumBackdrop dim={0.7} />
      <div className="relative z-10 mx-auto flex h-full max-w-3xl flex-col gap-3 px-3 py-4">
        <Title>SETTINGS</Title>
        <div className="flex flex-wrap justify-center gap-2">
          {(['audio', 'gameplay', 'controls', 'display'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                audio.click();
                setTab(t);
              }}
              className={`font-arcade rounded-xl border-2 px-4 py-2 text-xs uppercase transition ${
                tab === t
                  ? 'border-cyan-200 bg-gradient-to-b from-cyan-400 to-blue-600 text-white'
                  : 'border-white/15 bg-black/40 text-white/60 hover:border-cyan-300/40'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="panel no-scrollbar flex-1 overflow-y-auto p-4 md:p-6">
          {tab === 'audio' && (
            <div className="space-y-4">
              <Slider
                label="Master volume"
                value={settings.master}
                onChange={(v) => {
                  set('master', v);
                  audio.applySettings({ ...settings, master: v });
                }}
              />
              <Toggle
                label="Music"
                hint="Chiptune stadium theme"
                value={settings.musicOn}
                onChange={(v) => {
                  set('musicOn', v);
                  audio.applySettings({ ...settings, musicOn: v });
                }}
              />
              <Slider
                label="Music volume"
                value={settings.music}
                onChange={(v) => {
                  set('music', v);
                  audio.applySettings({ ...settings, music: v });
                }}
              />
              <Toggle
                label="Sound effects"
                hint="Kicks, goals, crowd"
                value={settings.soundOn}
                onChange={(v) => {
                  set('soundOn', v);
                  audio.applySettings({ ...settings, soundOn: v });
                }}
              />
              <Slider
                label="Effects volume"
                value={settings.sfx}
                onChange={(v) => {
                  set('sfx', v);
                  audio.applySettings({ ...settings, sfx: v });
                }}
              />
              <div className="flex gap-2">
                <ArcadeButton
                  color="blue"
                  size="sm"
                  onClick={() => {
                    audio.kick(1);
                    audio.goal();
                  }}
                >
                  🔊 TEST SFX
                </ArcadeButton>
                <ArcadeButton
                  color="purple"
                  size="sm"
                  onClick={() => {
                    if (audio.playing) audio.stopMusic();
                    else audio.startMusic();
                  }}
                >
                  {audio.playing ? '⏸ STOP MUSIC' : '▶ PLAY MUSIC'}
                </ArcadeButton>
              </div>
            </div>
          )}

          {tab === 'gameplay' && (
            <div className="space-y-5">
              <SegButtons<Difficulty>
                label="Difficulty"
                value={settings.difficulty}
                onChange={(v) => set('difficulty', v)}
                options={[
                  { value: 'easy', label: 'Easy' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'hard', label: 'Hard' },
                  { value: 'legend', label: 'Legend' },
                ]}
              />
              <SegButtons<number>
                label="Match duration"
                value={settings.duration}
                onChange={(v) => set('duration', v)}
                options={[
                  { value: 60, label: '60s' },
                  { value: 90, label: '90s' },
                  { value: 120, label: '120s' },
                  { value: 180, label: '3 min' },
                ]}
              />
              <Toggle label="Camera shake" hint="Impact feedback on big hits" value={settings.shake} onChange={(v) => set('shake', v)} />
            </div>
          )}

          {tab === 'controls' && (
            <div className="space-y-4">
              <SegButtons<'auto' | 'on' | 'off'>
                label="Touch controls"
                value={settings.touch}
                onChange={(v) => set('touch', v)}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'on', label: 'Always on' },
                  { value: 'off', label: 'Off' },
                ]}
              />
              {(['p1', 'p2'] as const).map((p) => (
                <div key={p} className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="font-arcade mb-2 text-sm text-cyan-300">{p === 'p1' ? 'PLAYER 1' : 'PLAYER 2'}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.keys(ACTION_LABELS).map((action) => (
                      <KeyCapture
                        key={action}
                        label={ACTION_LABELS[action]}
                        code={settings.bindings[p][action]}
                        listening={binding?.player === p && binding?.action === action}
                        onClick={() => {
                          audio.click();
                          setBinding({ player: p, action });
                        }}
                        onCode={(code) => {
                          setBind(p, action, code);
                          setBinding(null);
                        }}
                        onCancel={() => setBinding(null)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <ArcadeButton color="dark" size="sm" onClick={() => onChange({ ...settings, bindings: DEFAULT_BINDINGS })}>
                ↺ RESET DEFAULT KEYS
              </ArcadeButton>
            </div>
          )}

          {tab === 'display' && (
            <div className="space-y-5">
              <SegButtons<'low' | 'medium' | 'high'>
                label="Animation quality"
                value={settings.quality}
                onChange={(v) => set('quality', v)}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
              />
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                <p className="mb-2 font-bold uppercase tracking-widest text-cyan-300">Display</p>
                <p>Fullscreen stretches the arena to your whole screen. Press ESC or the button again to exit.</p>
                <ArcadeButton
                  className="mt-3"
                  color="cyan"
                  size="sm"
                  onClick={() => {
                    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.();
                    else void document.exitFullscreen?.();
                  }}
                >
                  ⛶ TOGGLE FULLSCREEN
                </ArcadeButton>
              </div>
              <ArcadeButton color="red" size="sm" onClick={onReset}>
                ↺ RESTORE ALL DEFAULTS
              </ArcadeButton>
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <ArcadeButton color="green" size="lg" onClick={onBack}>
            ← BACK
          </ArcadeButton>
        </div>
      </div>
    </div>
  );
}

function KeyCapture({
  label,
  code,
  listening,
  onClick,
  onCode,
  onCancel,
}: {
  label: string;
  code: string;
  listening: boolean;
  onClick: () => void;
  onCode: (c: string) => void;
  onCancel: () => void;
}) {
  const pretty = (c: string) =>
    !c ? '—' : c.startsWith('Key') ? c.slice(3) : c.startsWith('Arrow') ? { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[c] ?? c : c.startsWith('Numpad') ? `Num${c.slice(6)}` : c;
  return (
    <button
      onClick={() => (listening ? onCancel() : onClick())}
      onKeyDown={(e) => {
        if (listening) {
          e.preventDefault();
          if (e.code !== 'Escape') onCode(e.code);
          else onCancel();
        }
      }}
      className={`flex items-center justify-between rounded-lg border-2 px-3 py-2 text-xs transition ${
        listening ? 'animate-pulse border-amber-300 bg-amber-500/20' : 'border-white/15 bg-black/40 hover:border-cyan-300/50'
      }`}
    >
      <span className="text-white/70">{label}</span>
      <span className="rounded bg-white/15 px-2 py-0.5 font-mono font-bold text-white">
        {listening ? 'PRESS KEY…' : pretty(code)}
      </span>
    </button>
  );
}
