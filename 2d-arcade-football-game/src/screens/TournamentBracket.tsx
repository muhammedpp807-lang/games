import { TeamBadge } from '../components/TeamBadge';
import { ArcadeButton, Confetti, StadiumBackdrop, Title } from '../components/ui';
import { teamById } from '../game/data';
import { ROUND_NAMES, type Bracket, type TMatch } from '../game/tournament';

function MatchCard({ m, highlight }: { m: TMatch; highlight: boolean }) {
  const ta = teamById(m.a);
  const tb = teamById(m.b);
  const winnerA = m.played && m.sa >= m.sb;
  const winnerB = m.played && m.sb > m.sa;
  return (
    <div
      className={`w-[150px] rounded-xl border-2 p-1.5 text-left transition md:w-[186px] ${
        highlight ? 'border-amber-300 shadow-[0_0_18px_rgba(255,204,51,0.55)]' : 'border-white/15'
      } ${m.played ? 'bg-black/60' : 'bg-black/40'}`}
    >
      {[
        { t: ta, g: m.sa, win: winnerA },
        { t: tb, g: m.sb, win: winnerB },
      ].map((row, i) => (
        <div
          key={i}
          className={`flex items-center gap-1.5 rounded-lg px-1 py-0.5 ${row.win ? 'bg-white/10' : ''} ${i === 1 ? 'mt-0.5' : ''}`}
        >
          <TeamBadge team={row.t} size={22} />
          <span className={`flex-1 truncate font-arcade text-[10px] md:text-xs ${row.win ? 'text-amber-200' : 'text-white/75'}`}>
            {row.t.short}
          </span>
          <span className="font-arcade text-xs md:text-sm">{m.played ? row.g : '–'}</span>
        </div>
      ))}
      {highlight && (
        <div className="mt-1 text-center text-[8px] font-black uppercase tracking-widest text-amber-300">your match</div>
      )}
    </div>
  );
}

export function TournamentBracket({
  bracket,
  onPlay,
  onBack,
  onNew,
  difficulty,
}: {
  bracket: Bracket;
  onPlay: () => void;
  onBack: () => void;
  onNew: () => void;
  difficulty: string;
}) {
  const pm = bracket.rounds[bracket.round]?.find((m) => m.isPlayer);
  const nextOpponentId = pm ? (pm.a === bracket.playerTeam ? pm.b : pm.a) : null;
  const eliminated = bracket.eliminated;
  const champion = bracket.champion ? teamById(bracket.champion) : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <StadiumBackdrop dim={0.68} />
      {champion?.id === bracket.playerTeam && <Confetti n={30} />}
      <div className="relative z-10 flex h-full flex-col gap-2 px-2 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between gap-2">
          <ArcadeButton color="red" size="sm" onClick={onBack}>
            ← MENU
          </ArcadeButton>
          <div className="flex items-center gap-2">
            <span className="text-2xl md:text-4xl">🏆</span>
            <h2 className="font-arcade stroke-text-sm text-xl uppercase text-amber-300 md:text-3xl">Tournament</h2>
          </div>
          <div className="font-arcade hidden rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/60 md:block">
            {ROUND_NAMES[Math.min(bracket.round, 2)]} · {difficulty}
          </div>
        </div>

        <div className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/25 p-2 md:gap-6 md:p-4">
          {[0, 1, 2].map((r) => (
            <div key={r} className="flex shrink-0 flex-col justify-around gap-3">
              <div className="font-arcade text-center text-[9px] uppercase tracking-widest text-cyan-300 md:text-xs">
                {ROUND_NAMES[r]}
              </div>
              {(bracket.rounds[r]?.length ? bracket.rounds[r] : []).map((m, i) => (
                <MatchCard key={i} m={m} highlight={m.isPlayer && !m.played} />
              ))}
              {!bracket.rounds[r]?.length && (
                <div className="grid h-16 w-[150px] place-items-center rounded-xl border-2 border-dashed border-white/10 text-[10px] uppercase text-white/25 md:w-[186px]">
                  to be decided
                </div>
              )}
            </div>
          ))}
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div className="font-arcade text-center text-[9px] uppercase tracking-widest text-amber-300 md:text-xs">Champion</div>
            <div
              className={`grid h-24 w-[120px] place-items-center rounded-xl border-2 ${
                champion ? 'border-amber-300 bg-amber-400/10' : 'border-dashed border-white/10 bg-black/30'
              }`}
            >
              {champion ? (
                <div className="flex flex-col items-center gap-1">
                  <TeamBadge team={champion} size={40} />
                  <span className="font-arcade text-[10px] text-amber-200">{champion.short}</span>
                </div>
              ) : (
                <span className="text-3xl opacity-40">🏆</span>
              )}
            </div>
          </div>
        </div>

        {bracket.log.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-black/40 p-2">
            <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-white/45">Previous results</div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
              {bracket.log.slice(0, 4).map((l, i) => (
                <span key={i} className="text-[10px] font-bold text-white/70">
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          {eliminated || champion ? (
            <>
              <p className="font-arcade text-center text-sm uppercase text-white/80 md:text-lg">
                {champion?.id === bracket.playerTeam
                  ? '🏆 You conquered the Arena Cup!'
                  : `You were knocked out in the ${ROUND_NAMES[bracket.round]}`}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <ArcadeButton color="green" onClick={onNew}>
                  🏆 NEW TOURNAMENT
                </ArcadeButton>
                <ArcadeButton color="dark" onClick={onBack}>
                  MAIN MENU
                </ArcadeButton>
              </div>
            </>
          ) : (
            <>
              <p className="font-arcade text-center text-xs uppercase tracking-widest text-white/60 md:text-sm">
                Up next:{' '}
                <span className="text-amber-300">
                  {nextOpponentId ? teamById(nextOpponentId).name : 'TBD'}
                </span>
              </p>
              <ArcadeButton color="green" size="lg" className="w-full max-w-md" onClick={onPlay}>
                ⚽ PLAY MATCH
              </ArcadeButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function HowTo({ onBack }: { onBack: () => void }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <StadiumBackdrop dim={0.72} />
      <div className="relative z-10 mx-auto flex h-full max-w-2xl flex-col gap-3 px-4 py-5">
        <Title>HOW TO PLAY</Title>
        <div className="panel no-scrollbar flex-1 space-y-3 overflow-y-auto p-4 text-sm text-white/80">
          <p>
            <b className="text-cyan-300">Goal:</b> outscore your rival before the clock hits zero. Draws go to{' '}
            <b className="text-red-300">golden goal</b> in knockout games.
          </p>
          <ul className="space-y-1.5">
            <li>
              <b>Move &amp; jump</b> with the stick/keys. Land on the ball to head it, run into it to dribble.
            </li>
            <li>
              <b>Shoot</b> to kick. Hold <b className="text-cyan-300">jump</b> while shooting for a lofted effort, or{' '}
              <b className="text-cyan-300">slide</b> for a driven low shot.
            </li>
            <li>
              <b>Slide tackle</b> steals the ball and blocks shots — it has a short cooldown.
            </li>
            <li>
              <b>Supershot:</b> fill the charge bar (fight for the ball to charge faster), then hit the super button for your
              legend's signature ability.
            </li>
            <li>
              <b>Keepers</b> patrol each goal — beat them with corners, lobs or abilities.
            </li>
          </ul>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <div className="font-arcade mb-1 text-xs text-sky-300">PLAYER 1</div>
              <p className="text-xs">A / D move · W jump · S slide · L or X shoot · K or Z supershot · P pause</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <div className="font-arcade mb-1 text-xs text-rose-300">PLAYER 2</div>
              <p className="text-xs">← → move · ↑ jump · ↓ slide · , or Num1 shoot · . or Num2 supershot</p>
            </div>
          </div>
          <p className="text-xs text-white/50">All keys can be remapped in Settings → Controls. Touch devices get an on-screen stick and buttons.</p>
        </div>
        <div className="flex justify-center">
          <ArcadeButton color="green" size="lg" onClick={onBack}>
            GOT IT
          </ArcadeButton>
        </div>
      </div>
    </div>
  );
}


