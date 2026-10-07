import { TeamBadge } from '../components/TeamBadge';
import { ChibiSprite } from '../components/ChibiSprite';
import { ArcadeButton, Confetti, StadiumBackdrop } from '../components/ui';
import { abilityById, charById, teamById } from '../game/data';

import type { MatchConfig, MatchResult } from '../game/types';

export function MatchResultScreen({
  result,
  config,
  onRematch,
  onContinue,
  onMenu,
  continueLabel,
}: {
  result: MatchResult;
  config: MatchConfig;
  onRematch: () => void;
  onContinue: () => void;
  onMenu: () => void;
  continueLabel: string;
}) {
  const { p1, p2 } = config;
  const w = result.winner;
  const twoPlayer = config.mode === '2p';
  const headline =
    w === 0 ? 'DRAW!' : twoPlayer ? `PLAYER ${w} WINS!` : w === 1 ? 'WINNER!' : 'MATCH OVER';
  const color = w === 0 ? '#ffd166' : w === 1 ? '#7ef07e' : '#ff6b81';
  const winnerSetup = w === 2 ? p2 : p1;
  const loserSetup = w === 2 ? p1 : p2;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <StadiumBackdrop dim={0.6} />
      {w !== 0 && <Confetti n={34} />}
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 px-3 py-4">
        <h2 className="font-arcade stroke-text anim-goal text-center text-4xl uppercase leading-none md:text-6xl" style={{ color }}>
          {headline}
        </h2>
        {w !== 0 && (
          <p className="font-arcade text-center text-xs uppercase tracking-[0.3em] text-white/70 md:text-base">
            {winnerSetup.character.name} · {winnerSetup.team.name}
          </p>
        )}
        {result.suddenDeath && (
          <p className="font-arcade text-[10px] uppercase tracking-widest text-red-300">decided by golden goal</p>
        )}

        <div className="panel anim-pop flex w-full max-w-lg items-center justify-between gap-2 p-3 md:p-4">
          <TeamColumn setup={p1} win={w === 1} />
          <div className="font-arcade shrink-0 text-4xl text-white md:text-6xl">
            {result.p1Goals}
            <span className="mx-1 text-white/40">-</span>
            {result.p2Goals}
          </div>
          <TeamColumn setup={p2} win={w === 2} />
        </div>

        <div className="panel w-full max-w-lg space-y-1.5 p-3 md:p-4">
          <div className="font-arcade mb-1 text-center text-[10px] uppercase tracking-[0.3em] text-cyan-300">
            match statistics
          </div>
          <StatRow label="Possession" a={result.stats.possession[0]} b={result.stats.possession[1]} suffix="%" />
          <StatRow label="Shots" a={result.stats.shots[0]} b={result.stats.shots[1]} />
          <StatRow label="Saves" a={result.stats.saves[0]} b={result.stats.saves[1]} />
          <StatRow label="Supershots" a={result.stats.supers[0]} b={result.stats.supers[1]} />
          <div className="pt-1 text-center text-[10px] font-bold uppercase tracking-wider text-white/55">
            {p1.team.short}: {p1.character.name} scored {result.p1Goals} · {p2.team.short}: {p2.character.name} scored{' '}
            {result.p2Goals}
          </div>
        </div>

        {w !== 0 && (
          <>
            <div className="pointer-events-none absolute bottom-2 left-2 opacity-90 md:bottom-6 md:left-10">
              <ChibiSprite
                character={winnerSetup.character}
                team={winnerSetup.team}
                size={82}
                pose="celebrate"
                glow={abilityById(winnerSetup.character.abilityId).color}
              />
            </div>
            <div className="pointer-events-none absolute bottom-2 right-2 opacity-70 md:bottom-6 md:right-10">
              <ChibiSprite character={loserSetup.character} team={loserSetup.team} size={72} pose="sad" />
            </div>
          </>
        )}

        <div className="flex w-full max-w-lg flex-col gap-2 pt-1 sm:flex-row">
          <ArcadeButton color="green" size="lg" className="flex-1" onClick={onContinue}>
            {continueLabel}
          </ArcadeButton>
          <ArcadeButton color="orange" size="lg" className="flex-1" onClick={onRematch}>
            ↺ REMATCH
          </ArcadeButton>
          <ArcadeButton color="dark" size="lg" className="flex-1" onClick={onMenu}>
            🏠 MENU
          </ArcadeButton>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, a, b, suffix = '' }: { label: string; a: number; b: number; suffix?: string }) {
  const total = a + b || 1;
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
        <span className="text-sky-300">
          {a}
          {suffix}
        </span>
        <span className="text-white/50">{label}</span>
        <span className="text-rose-300">
          {b}
          {suffix}
        </span>
      </div>
      <div className="mt-0.5 flex h-2 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
        <div className="h-full bg-gradient-to-r from-sky-400 to-sky-600" style={{ width: `${(a / total) * 100}%` }} />
        <div className="h-full flex-1 bg-gradient-to-l from-rose-400 to-rose-600" />
      </div>
    </div>
  );
}

function TeamColumn({ setup, win }: { setup: MatchConfig['p1']; win: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col items-center ${win ? 'opacity-100' : 'opacity-75'}`}>
      <TeamBadge team={setup.team} size={44} />
      <span className={`font-arcade mt-1 truncate text-[11px] md:text-sm ${win ? 'text-amber-200' : 'text-white/80'}`}>
        {setup.team.name}
      </span>
      {win && <span className="text-[9px] font-black uppercase tracking-widest text-amber-300">🏆 winner</span>}
    </div>
  );
}

/* ---------------- champion ---------------- */
export function ChampionScreen({
  championTeamId,
  charId,
  stats,
  onNew,
  onMenu,
}: {
  championTeamId: string;
  charId: string;
  stats: { rounds: string[]; goals: number; conceded: number };
  onNew: () => void;
  onMenu: () => void;
}) {
  const team = teamById(championTeamId);
  const hero = charById(charId);
  return (
    <div className="relative h-full w-full overflow-hidden">
      <StadiumBackdrop dim={0.35} />
      <Confetti n={60} />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[10, 25, 45, 65, 85].map((x, i) => (
          <div
            key={x}
            className="anim-glow absolute h-1.5 w-1.5 rounded-full bg-amber-200"
            style={{
              left: `${x}%`,
              top: `${18 + (i % 3) * 9}%`,
              boxShadow: '0 0 22px 10px rgba(255,200,80,0.55)',
              animationDelay: `${i * 0.35}s`,
            }}
          />
        ))}
      </div>
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 px-4 py-4">
        <h2 className="font-arcade stroke-text anim-goal text-center text-5xl uppercase leading-none text-amber-300 md:text-7xl">
          Champion!
        </h2>
        <div className="font-arcade anim-float text-6xl drop-shadow-[0_8px_20px_rgba(255,190,60,0.6)] md:text-8xl">🏆</div>
        <div className="panel anim-pop flex items-center gap-3 px-4 py-3">
          <TeamBadge team={team} size={62} />
          <div>
            <div className="font-arcade text-lg uppercase text-white md:text-2xl">{team.name}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-300">{team.motto}</div>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-2 left-2 md:left-16">
          <ChibiSprite character={hero} team={team} size={96} pose="celebrate" glow="#ffcc33" />
        </div>
        <div className="panel mt-2 w-full max-w-md p-3">
          <div className="font-arcade mb-1 text-center text-[10px] uppercase tracking-[0.3em] text-cyan-300">
            tournament run
          </div>
          <ul className="space-y-0.5">
            {stats.rounds.map((r, i) => (
              <li key={i} className="text-center text-[11px] font-bold text-white/75">
                {r}
              </li>
            ))}
          </ul>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-black/40 p-1.5">
              <div className="font-arcade text-lg text-emerald-300">{stats.goals}</div>
              <div className="text-[9px] uppercase tracking-widest text-white/50">goals scored</div>
            </div>
            <div className="rounded-lg bg-black/40 p-1.5">
              <div className="font-arcade text-lg text-rose-300">{stats.conceded}</div>
              <div className="text-[9px] uppercase tracking-widest text-white/50">conceded</div>
            </div>
          </div>
        </div>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <ArcadeButton color="green" size="lg" onClick={onNew}>
            🏆 NEW TOURNAMENT
          </ArcadeButton>
          <ArcadeButton color="dark" size="lg" onClick={onMenu}>
            🏠 MAIN MENU
          </ArcadeButton>
        </div>
      </div>
    </div>
  );
}
