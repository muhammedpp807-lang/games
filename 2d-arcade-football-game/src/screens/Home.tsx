import { ArcadeButton, IconButton, StadiumBackdrop } from '../components/ui';
import { audio } from '../game/audio';
import { ChibiSprite } from '../components/ChibiSprite';
import { charById, teamById } from '../game/data';

export function Logo({ small }: { small?: boolean }) {
  return (
    <div className={`relative flex flex-col items-center ${small ? 'scale-75' : ''}`}>
      <div className="relative">
        <svg viewBox="0 0 100 100" className={`absolute -top-8 left-1/2 -translate-x-1/2 ${small ? 'w-12' : 'w-16 md:w-20'} anim-float`}>
          <circle cx="50" cy="50" r="42" fill="#ffffff" stroke="#0b1220" strokeWidth="5" />
          <path d="M50 20l12 9-5 14H43l-5-14z" fill="#0b1220" />
          <path d="M50 20l12 9 14-2M62 29l5 14-9 12M62 43H43l-9 12M43 43l-5-14M34 62l16 12 16-12" stroke="#0b1220" strokeWidth="4" fill="none" />
          <path d="M22 12l6 12M78 12l-6 12" stroke="#ffcc33" strokeWidth="6" strokeLinecap="round" />
          <path d="M20 8h20l-10 14z" fill="#ffcc33" stroke="#0b1220" strokeWidth="3" />
          <path d="M60 8h20L70 22z" fill="#ffcc33" stroke="#0b1220" strokeWidth="3" />
        </svg>
        <h1
          className={`font-arcade logo-grad stroke-text relative text-center leading-[0.86] ${
            small ? 'text-4xl' : 'text-5xl md:text-7xl'
          }`}
        >
          FOOTBALL
          <br />
          <span className="text-amber-300">LEGENDS</span>
        </h1>
      </div>
      <div className="mt-1 rounded-full border border-cyan-300/40 bg-black/50 px-3 py-0.5 text-[9px] font-black uppercase tracking-[0.35em] text-cyan-200 md:text-[11px]">
        Arena Arcade Soccer
      </div>
    </div>
  );
}

export function Home({
  onPlay,
  onSettings,
  soundOn,
  musicOn,
  onToggleSound,
  onToggleMusic,
  onFullscreen,
  hasTournament,
  onResumeTournament,
}: {
  onPlay: (mode: 'quick' | 'menu') => void;
  onSettings: () => void;
  soundOn: boolean;
  musicOn: boolean;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onFullscreen: () => void;
  hasTournament: boolean;
  onResumeTournament: () => void;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <StadiumBackdrop dim={0.45} />
      <div className="relative z-10 flex h-full flex-col items-center justify-between px-4 py-4">
        <div className="mt-6 md:mt-10">
          <Logo />
        </div>

        <div className="flex w-full max-w-md flex-col items-stretch gap-2.5 md:gap-3">
          <ArcadeButton size="lg" color="green" className="w-full" onClick={() => onPlay('quick')}>
            ⚡ QUICK MATCH
          </ArcadeButton>
          <ArcadeButton size="lg" color="blue" className="w-full" onClick={() => onPlay('menu')}>
            🎮 GAME MODES
          </ArcadeButton>
          {hasTournament && (
            <ArcadeButton size="md" color="gold" className="w-full" onClick={onResumeTournament}>
              🏆 RESUME TOURNAMENT
            </ArcadeButton>
          )}
          <div className="mt-1 flex items-center justify-center gap-3">
            <IconButton title="Sound effects" active={soundOn} onClick={onToggleSound}>
              {soundOn ? '🔊' : '🔇'}
            </IconButton>
            <IconButton title="Music" active={musicOn} onClick={onToggleMusic}>
              🎵
            </IconButton>
            <IconButton title="Settings" onClick={onSettings}>
              ⚙️
            </IconButton>
            <IconButton title="Fullscreen" onClick={onFullscreen}>
              ⛶
            </IconButton>
          </div>
        </div>

        <div className="pointer-events-none relative h-24 w-full max-w-3xl md:h-32">
          <div className="absolute bottom-0 left-0 opacity-95">
            <ChibiSprite character={charById('leo')} team={teamById('cats')} size={90} pose="kick" />
          </div>
          <div className="absolute bottom-0 right-0 opacity-95">
            <ChibiSprite character={charById('cris')} team={teamById('crown')} size={90} facing={-1} pose="celebrate" />
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">
            Original arcade football · 12 clubs · 24 legends
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModeSelect({
  onPick,
  onBack,
  onHowTo,
}: {
  onPick: (m: '1p' | '2p' | 'quick' | 'tournament') => void;
  onBack: () => void;
  onHowTo: () => void;
}) {
  const cards = [
    {
      id: '1p' as const,
      title: '1 PLAYER',
      desc: 'Face the AI across four difficulty levels.',
      icon: '🧑‍🎤',
      color: 'from-emerald-400 to-green-700',
    },
    {
      id: '2p' as const,
      title: '2 PLAYERS',
      desc: 'Local versus on one keyboard. Winner takes glory.',
      icon: '🧑‍🤝‍🧑',
      color: 'from-sky-400 to-blue-700',
    },
    {
      id: 'quick' as const,
      title: 'QUICK MATCH',
      desc: 'Instant kickoff with a randomly drawn fixture.',
      icon: '⚡',
      color: 'from-amber-400 to-orange-600',
    },
    {
      id: 'tournament' as const,
      title: 'TOURNAMENT',
      desc: 'Eight clubs. Three rounds. One champion.',
      icon: '🏆',
      color: 'from-fuchsia-400 to-purple-700',
    },
  ];
  return (
    <div className="relative h-full w-full overflow-hidden">
      <StadiumBackdrop dim={0.62} />
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-5 px-4 py-6">
        <h2 className="font-arcade stroke-text text-center text-4xl text-white md:text-6xl">SELECT MODE</h2>
        <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 md:gap-5">
          {cards.map((c, i) => (
            <button
              key={c.id}
              onPointerEnter={() => audio.hover()}
              onClick={() => {
                audio.click();
                onPick(c.id);
              }}
              className="anim-pop group relative overflow-hidden rounded-2xl border-2 border-white/25 p-4 text-left shadow-[0_10px_0_rgba(0,0,0,0.35),0_20px_40px_rgba(0,0,0,0.5)] transition hover:-translate-y-1 hover:border-white/60 active:translate-y-0.5"
              style={{ animationDelay: `${i * 60}ms`, background: 'linear-gradient(160deg, rgba(255,255,255,0.12), rgba(0,0,0,0.35))' }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${c.color} opacity-45 transition group-hover:opacity-70`} />
              <div className="relative flex items-center gap-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-black/40 text-3xl ring-1 ring-white/25">
                  {c.icon}
                </span>
                <span>
                  <span className="font-arcade block text-xl text-white drop-shadow md:text-2xl">{c.title}</span>
                  <span className="block text-xs text-white/80">{c.desc}</span>
                </span>
              </div>
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <ArcadeButton color="dark" onClick={onHowTo}>
            📖 HOW TO PLAY
          </ArcadeButton>
          <ArcadeButton color="red" onClick={onBack}>
            ← BACK
          </ArcadeButton>
        </div>
      </div>
    </div>
  );
}
