import type { Character, Team } from '../game/types';

/** Animated SVG chibi footballer used in menus/selection screens. */
export function ChibiSprite({
  character,
  team,
  size = 140,
  facing = 1,
  pose = 'idle',
  glow,
}: {
  character: Character;
  team: Team;
  size?: number;
  facing?: 1 | -1;
  pose?: 'idle' | 'kick' | 'celebrate' | 'sad';
  glow?: string;
}) {
  const kit = team.primary;
  const kit2 = team.secondary;
  const accent = team.accent;
  const skin = character.skin;
  const hair = character.hair;
  const kick = pose === 'kick';
  const celebrate = pose === 'celebrate';
  const bob = pose === 'idle' ? 0 : 0;

  return (
    <svg
      viewBox="0 0 120 140"
      width={size}
      height={size * 1.16}
      style={{
        transform: `scaleX(${facing})`,
        filter: glow ? `drop-shadow(0 0 14px ${glow})` : undefined,
      }}
    >
      <g className={celebrate ? 'anim-float' : ''} style={{ animationDuration: '1.1s' }}>
      <ellipse cx="60" cy="132" rx="26" ry="6" fill="rgba(0,0,0,0.35)" />
      <g transform={`translate(0 ${bob})`}>
        {/* back arm */}
        <g stroke={skin} strokeWidth="9" strokeLinecap="round">
          <line
            x1="46"
            y1="80"
            x2={celebrate ? 30 : 36}
            y2={celebrate ? 52 : 100}
          />
        </g>
        {/* back leg */}
        <g stroke={kit2} strokeWidth="10" strokeLinecap="round">
          <line x1="54" y1="98" x2={kick ? 40 : 48} y2={kick ? 112 : 124} />
        </g>
        <ellipse cx={kick ? 40 : 48} cy={kick ? 112 : 127} rx="8" ry="5" fill="#1c2434" />

        {/* torso */}
        <rect x="42" y="66" width="36" height="30" rx="12" fill={kit} />
        <rect x="58" y="66" width="5" height="30" fill="rgba(255,255,255,0.25)" />
        <rect x="44" y="90" width="32" height="14" rx="7" fill={kit2} />
        <text
          x="60"
          y="85"
          textAnchor="middle"
          fontSize="14"
          fontWeight="900"
          fill={accent}
          fontFamily="Impact, sans-serif"
          style={{ transform: `scaleX(${facing})`, transformOrigin: '60px 80px' }}
        >
          {character.number}
        </text>

        {/* front leg */}
        <g stroke={kit} strokeWidth="11" strokeLinecap="round">
          <line x1="66" y1="98" x2={kick ? 96 : 72} y2={kick ? 82 : 124} />
        </g>
        <ellipse cx={kick ? 96 : 72} cy={kick ? 82 : 127} rx="9" ry="5.5" fill="#f8fafc" />

        {/* front arm */}
        <g stroke={skin} strokeWidth="10" strokeLinecap="round">
          <line
            x1="74"
            y1="80"
            x2={celebrate ? 92 : kick ? 92 : 84}
            y2={celebrate ? 50 : kick ? 66 : 100}
          />
        </g>

        {/* neck + head */}
        <rect x="55" y="58" width="10" height="10" fill={skin} />
        <circle cx="60" cy="40" r="26" fill={skin} />
        {/* ears */}
        <circle cx="35" cy="43" r="5" fill={skin} />
        <circle cx="85" cy="43" r="5" fill={skin} />
        {/* hair */}
        <Hair style={character.hairStyle} color={hair} />
        {/* face */}
        <g>
          <ellipse cx="64" cy="38" rx="5" ry="6" fill="#fff" />
          <ellipse cx="78" cy="38" rx="5" ry="6" fill="#fff" />
          <circle cx="65.5" cy="39" rx="2.6" fill="#172033" />
          <circle cx="79.5" cy="39" rx="2.6" fill="#172033" />
          <circle cx="64.5" cy="37" rx="1" fill="#fff" />
          <circle cx="78.5" cy="37" rx="1" fill="#fff" />
          <path
            d={pose === 'sad' ? 'M66 52q6 -6 12 0' : 'M66 48q6 7 12 0'}
            stroke="rgba(90,30,30,0.9)"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M58 29q6 -2 11 0" stroke="rgba(30,20,12,0.8)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M74 29q6 -2 11 0" stroke="rgba(30,20,12,0.8)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <ellipse cx="56" cy="48" rx="4" ry="2.4" fill="rgba(255,120,120,0.25)" />
        </g>
      </g>
      </g>
    </svg>
  );
}

function Hair({ style, color }: { style: string; color: string }) {
  switch (style) {
    case 'spiky':
      return (
        <g fill={color}>
          <path d="M34 36a26 26 0 0 1 52 0q-6-8-12-4q-4-10-10-6q-6-10-12-2q-8-2-18 12z" />
          <path d="M36 24l6-12 6 12zM54 18l6-14 6 14zM72 24l7-11 4 13z" />
        </g>
      );
    case 'buzz':
      return <path d="M35 34a25 25 0 0 1 50 0q-10-12-25-12t-25 12z" fill={color} />;
    case 'curly':
      return (
        <g fill={color}>
          {[
            [40, 22, 11],
            [56, 14, 12],
            [74, 20, 11],
            [84, 32, 9],
            [30, 34, 9],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} />
          ))}
        </g>
      );
    case 'bun':
      return (
        <g fill={color}>
          <circle cx="34" cy="16" r="11" />
          <path d="M35 34a25 25 0 0 1 50 0q-12-14-25-14t-25 14z" />
        </g>
      );
    case 'afro':
      return (
        <g fill={color}>
          <circle cx="60" cy="26" r="30" />
          <circle cx="38" cy="34" r="16" />
          <circle cx="82" cy="34" r="16" />
        </g>
      );
    case 'long':
      return (
        <g fill={color}>
          <path d="M34 36a26 26 0 0 1 52 0q-8-12-26-12t-26 12z" />
          <path d="M32 34q-6 26 6 34q4-14 0-34zM88 34q6 26-6 34q-4-14 0-34z" />
        </g>
      );
    case 'mohawk':
      return (
        <g fill={color}>
          <path d="M36 32q6-18 10 0q4-20 10 0q4-18 10 0q-14-10-30 0z" />
          <path d="M46 12q14-10 28 0q-14-6-28 0z" />
        </g>
      );
    case 'waves':
      return (
        <g fill={color}>
          <path d="M34 34a26 26 0 0 1 52 0q-10-13-26-13t-26 13z" />
          <path d="M36 26q12-12 24-4q12-8 24 4q-12-4-24 2q-12-6-24-2z" opacity="0.9" />
        </g>
      );
    default:
      return null;
  }
}
