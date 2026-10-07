import { useEffect, useState } from 'react';
import { ArcadeButton, StadiumBackdrop, StatBar } from '../components/ui';
import { TeamBadge } from '../components/TeamBadge';
import { ChibiSprite } from '../components/ChibiSprite';
import { CHARACTERS, TEAMS, abilityById, charsForTeam } from '../game/data';
import { audio } from '../game/audio';
import type { Mode, PlayerSetup } from '../game/types';

function Arrow({ dir, onClick, color }: { dir: 'l' | 'r'; onClick: () => void; color: string }) {
  return (
    <button
      onPointerEnter={() => audio.hover()}
      onClick={() => {
        audio.click();
        onClick();
      }}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 text-lg font-black text-white shadow-[0_5px_0_rgba(0,0,0,0.4)] transition active:translate-y-0.5 md:h-14 md:w-14"
      style={{ borderColor: color, background: `linear-gradient(180deg, ${color}, rgba(0,0,0,0.55))` }}
    >
      {dir === 'l' ? '◀' : '▶'}
    </button>
  );
}

function Side({
  label,
  color,
  isCpu,
  teamIdx,
  charIdx,
  onTeam,
  onChar,
  ready,
  onReady,
  randomize,
}: {
  label: string;
  color: string;
  isCpu?: boolean;
  teamIdx: number;
  charIdx: number;
  onTeam: (d: number) => void;
  onChar: (d: number) => void;
  ready: boolean;
  onReady: () => void;
  randomize: () => void;
}) {
  const team = TEAMS[teamIdx];
  const chars = charsForTeam(team.id);
  const ch = chars[charIdx % chars.length];
  const ab = abilityById(ch.abilityId);
  return (
    <div
      className="panel anim-pop relative flex w-full flex-col gap-2 p-3 md:p-4"
      style={{ borderColor: `${color}66`, boxShadow: `0 0 0 1px ${color}22, 0 18px 40px rgba(0,0,0,0.5)` }}
    >
      <div className="flex items-center justify-between">
        <span className="font-arcade rounded-lg px-2 py-1 text-[11px] tracking-wider text-white md:text-sm" style={{ background: color }}>
          {label}
        </span>
        <button
          onClick={() => {
            audio.click();
            randomize();
          }}
          className="rounded-lg border border-white/20 bg-black/40 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/70 hover:text-white"
        >
          🎲 random
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Arrow dir="l" color={color} onClick={() => onTeam(-1)} />
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <TeamBadge team={team} size={52} />
          <div className="font-arcade mt-1 truncate text-center text-[11px] uppercase leading-tight text-white md:text-sm">
            {team.name}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-white/45">{team.city}</div>
        </div>
        <Arrow dir="r" color={color} onClick={() => onTeam(1)} />
      </div>

      <div className="flex items-center gap-1">
        <Arrow dir="l" color={color} onClick={() => onChar(-1)} />
        <div className="flex flex-1 items-center justify-center rounded-xl bg-black/30 py-1">
          <ChibiSprite character={ch} team={team} size={78} pose={ready ? 'celebrate' : 'idle'} glow={ready ? ab.color : undefined} />
        </div>
        <Arrow dir="r" color={color} onClick={() => onChar(1)} />
      </div>

      <div className="text-center">
        <div className="font-arcade text-sm text-white md:text-lg">{ch.name}</div>
        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
          {ch.tag}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/40 p-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{ab.icon}</span>
          <span className="font-arcade text-[11px] uppercase" style={{ color: ab.color }}>
            {ab.name}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] leading-tight text-white/60">{ab.desc}</p>
      </div>

      <div className="space-y-1">
        <StatBar label="Speed" value={ch.stats.speed} color={color} />
        <StatBar label="Power" value={ch.stats.power} color={color} />
        <StatBar label="Jump" value={ch.stats.jump} color={color} />
        <StatBar label="Shooting" value={ch.stats.shooting} color={color} />
        <StatBar label="Defense" value={ch.stats.defense} color={color} />
      </div>

      <ArcadeButton color={ready ? 'green' : 'dark'} size="md" className="w-full" onClick={onReady}>
        {ready ? '✔ READY' : isCpu ? '✔ LOCK CPU' : '✔ READY'}
      </ArcadeButton>
    </div>
  );
}

export function TeamSelect({
  mode,
  onStart,
  onBack,
}: {
  mode: Mode;
  onStart: (p1: PlayerSetup, p2: PlayerSetup) => void;
  onBack: () => void;
}) {
  const mk = (): [number, number] => {
    const t = Math.floor(Math.random() * TEAMS.length);
    const chars = charsForTeam(TEAMS[t].id);
    return [t, Math.floor(Math.random() * chars.length)];
  };
  const [s1, setS1] = useState<[number, number]>(mk);
  const [s2, setS2] = useState<[number, number]>(mk);
  const [ready1, setReady1] = useState(false);
  const [ready2, setReady2] = useState(false);

  const move = (side: 1 | 2, dTeam: number, dChar: number) => {
    if (side === 1) {
      setS1(([t, c]) => {
        const nt = (t + dTeam + TEAMS.length) % TEAMS.length;
        const chars = charsForTeam(TEAMS[nt].id);
        return [nt, dChar ? (c + dChar + chars.length) % chars.length : Math.min(c, chars.length - 1)];
      });
    } else {
      setS2(([t, c]) => {
        const nt = (t + dTeam + TEAMS.length) % TEAMS.length;
        const chars = charsForTeam(TEAMS[nt].id);
        return [nt, dChar ? (c + dChar + chars.length) % chars.length : Math.min(c, chars.length - 1)];
      });
    }
  };
  const rand = (side: 1 | 2) => (side === 1 ? setS1(mk()) : setS2(mk()));

  const bothReady = ready1 && (ready2 || mode === '1p');
  const start = () => {
    const build = (s: [number, number], control: 'human' | 'ai'): PlayerSetup => {
      const team = TEAMS[s[0]];
      const chars = charsForTeam(team.id);
      const character = chars[s[1] % chars.length];
      return { character, team, ability: abilityById(character.abilityId), control };
    };
    onStart(build(s1, 'human'), build(s2, mode === '1p' ? 'ai' : 'human'));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowLeft':
          move(1, 0, -1);
          break;
        case 'ArrowRight':
          move(1, 0, 1);
          break;
        case 'ArrowUp':
          move(1, -1, 0);
          break;
        case 'ArrowDown':
          move(1, 1, 0);
          break;
        case 'KeyA':
          if (mode === '2p') move(2, 0, -1);
          break;
        case 'KeyD':
          if (mode === '2p') move(2, 0, 1);
          break;
        case 'KeyW':
          if (mode === '2p') move(2, -1, 0);
          break;
        case 'KeyS':
          if (mode === '2p') move(2, 1, 0);
          break;
        case 'Enter':
          if (!bothReady) {
            setReady1(true);
            setReady2(true);
          } else start();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bothReady, s1, s2]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <StadiumBackdrop dim={0.66} />
      <div className="relative z-10 flex h-full flex-col gap-2 px-2 py-3 md:px-6">
        <div className="flex items-center justify-between gap-2">
          <ArcadeButton color="red" size="sm" onClick={onBack}>
            ← BACK
          </ArcadeButton>
          <h2 className="font-arcade stroke-text-sm text-center text-xl uppercase text-white md:text-3xl">
            {mode === 'tournament' ? 'PICK YOUR CUP SQUAD' : mode === '2p' ? 'SELECT YOUR LEGENDS' : 'SELECT YOUR LEGEND'}
          </h2>
          <div className="font-arcade hidden rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/60 md:block">
            {CHARACTERS.length} legends
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 items-start gap-2 overflow-y-auto no-scrollbar md:grid-cols-2 md:gap-4">
          <Side
            label="PLAYER 1"
            color="#3ba7ff"
            teamIdx={s1[0]}
            charIdx={s1[1]}
            onTeam={(d) => move(1, d, 0)}
            onChar={(d) => move(1, 0, d)}
            ready={ready1}
            onReady={() => setReady1((r) => !r)}
            randomize={() => rand(1)}
          />
          <Side
            label={mode === '1p' ? 'CPU OPPONENT' : 'PLAYER 2'}
            color="#ff5470"
            isCpu={mode === '1p'}
            teamIdx={s2[0]}
            charIdx={s2[1]}
            onTeam={(d) => move(2, d, 0)}
            onChar={(d) => move(2, 0, d)}
            ready={ready2}
            onReady={() => setReady2((r) => !r)}
            randomize={() => rand(2)}
          />
        </div>

        <div className="flex flex-col items-center gap-1 pb-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/45">
            {mode === '2p' ? 'P1: arrow keys · P2: W A S D · Enter = ready' : 'Arrow keys browse · Enter = ready'}
          </div>
          <ArcadeButton color={bothReady ? 'green' : 'orange'} size="lg" className="w-full max-w-md" onClick={start} disabled={!bothReady}>
            {bothReady ? '⚽ START MATCH' : mode === '1p' ? 'PRESS READY TO CONTINUE' : 'PRESS READY ON BOTH SIDES'}
          </ArcadeButton>
        </div>
      </div>
    </div>
  );
}
