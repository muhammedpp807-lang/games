import type { Team } from '../game/types';

/** Original procedural team badges drawn as SVG. */
export function TeamBadge({ team, size = 64 }: { team: Team; size?: number }) {
  const { primary: p, secondary: s, accent: a, badge } = team;
  const id = `bg-${team.id}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p} />
          <stop offset="100%" stopColor={s} />
        </linearGradient>
      </defs>

      {badge === 'shield' && (
        <>
          <path d="M50 6 88 16v38c0 22-18 34-38 40C30 88 12 76 12 54V16z" fill={`url(#${id})`} stroke="#0b1220" strokeWidth="4" />
          <path d="M50 16 78 23v30c0 15-13 24-28 29-15-5-28-14-28-29V23z" fill="none" stroke={a} strokeWidth="3" opacity="0.8" />
          <circle cx="50" cy="46" r="15" fill={a} opacity="0.92" />
          <path d="M50 33l4.2 8.6 9.5 1.4-6.9 6.7 1.6 9.4L50 54.8l-8.4 4.3 1.6-9.4-6.9-6.7 9.5-1.4z" fill={p} />
        </>
      )}

      {badge === 'stripes' && (
        <>
          <path d="M50 6 88 16v38c0 22-18 34-38 40C30 88 12 76 12 54V16z" fill="#f8fafc" stroke="#0b1220" strokeWidth="4" />
          <g clipPath={`url(#clip-${team.id})`}>
            <defs>
              <clipPath id={`clip-${team.id}`}>
                <path d="M50 6 88 16v38c0 22-18 34-38 40C30 88 12 76 12 54V16z" />
              </clipPath>
            </defs>
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={18 + i * 18} y="6" width="9" height="90" fill={p} />
            ))}
          </g>
          <circle cx="50" cy="48" r="16" fill={s} stroke={a} strokeWidth="3" />
          <path d="M50 36l3.6 7.4 8.2 1.2-6 5.8 1.4 8.1L50 54.6l-7.2 3.9 1.4-8.1-6-5.8 8.2-1.2z" fill={a} />
        </>
      )}

      {badge === 'crown' && (
        <>
          <path d="M50 8 86 18v36c0 21-17 32-36 38C31 86 14 75 14 54V18z" fill={`url(#${id})`} stroke="#0b1220" strokeWidth="4" />
          <path
            d="M28 58V36l9 8 7-13 6 13 9-8v22z"
            fill={s}
            stroke={a}
            strokeWidth="3"
          />
          <circle cx="50" cy="30" r="4.5" fill={a} />
          <text x="50" y="76" textAnchor="middle" fontSize="15" fontWeight="900" fill={a} fontFamily="Impact, sans-serif">
            FC
          </text>
        </>
      )}

      {badge === 'stars' && (
        <>
          <circle cx="50" cy="50" r="42" fill={`url(#${id})`} stroke="#0b1220" strokeWidth="4" />
          <circle cx="50" cy="50" r="33" fill="none" stroke={a} strokeWidth="3" opacity="0.7" />
          {[0, 1, 2].map((i) => {
            const ang = -Math.PI / 2 + i * ((Math.PI * 2) / 3);
            const cx = 50 + Math.cos(ang) * 16;
            const cy = 50 + Math.sin(ang) * 16;
            return (
              <path
                key={i}
                d={`M${cx} ${cy - 11}l3.4 6.9 7.6 1.1-5.5 5.4 1.3 7.6L50 ${cy + 5.6}l-6.8 3.6 1.3-7.6-5.5-5.4 7.6-1.1z`}
                transform={`translate(${cx - 50} 0) scale(1)`}
                fill={a}
                opacity="0.95"
              />
            );
          })}
        </>
      )}

      {badge === 'tower' && (
        <>
          <path d="M50 6 88 16v38c0 22-18 34-38 40C30 88 12 76 12 54V16z" fill={`url(#${id})`} stroke="#0b1220" strokeWidth="4" />
          <path d="M50 22l4 10h-8zM45 34h10l-1.5 6h-7zM43.5 42h13l-1.5 6h-10zM42 50h16l-2 7H44z" fill={a} />
          <path d="M34 62c10 4 22 4 32 0v10c-10 4-22 4-32 0z" fill={s} stroke={a} strokeWidth="2" />
        </>
      )}

      {badge === 'diamond' && (
        <>
          <circle cx="50" cy="50" r="42" fill="#f8fafc" stroke="#0b1220" strokeWidth="4" />
          <g clipPath={`url(#clipc-${team.id})`}>
            <defs>
              <clipPath id={`clipc-${team.id}`}>
                <circle cx="50" cy="50" r="42" />
              </clipPath>
            </defs>
            {[0, 1, 2].map((r) =>
              [0, 1, 2].map((c) => (
                <rect
                  key={`${r}-${c}`}
                  x={8 + c * 28 + (r % 2) * 14}
                  y={8 + r * 28}
                  width="14"
                  height="14"
                  fill={p}
                  transform={`rotate(45 ${15 + c * 28 + (r % 2) * 14} ${15 + r * 28})`}
                />
              )),
            )}
          </g>
          <circle cx="50" cy="50" r="18" fill={s} stroke={a} strokeWidth="3" />
          <text x="50" y="57" textAnchor="middle" fontSize="18" fontWeight="900" fill={a} fontFamily="Impact, sans-serif">
            AR
          </text>
        </>
      )}

      {badge === 'circle' && (
        <>
          <circle cx="50" cy="50" r="42" fill={`url(#${id})`} stroke="#0b1220" strokeWidth="4" />
          <circle cx="50" cy="50" r="28" fill="none" stroke={a} strokeWidth="6" />
          <circle cx="50" cy="50" r="14" fill={a} opacity="0.9" />
          <path d="M50 40l3.1 6.3 7 1-5 4.9 1.2 6.9L50 55.8l-6.3 3.3 1.2-6.9-5-4.9 7-1z" fill={s} />
        </>
      )}

      {badge === 'wing' && (
        <>
          <path d="M50 8 84 20v34c0 20-16 31-34 37C32 85 16 74 16 54V20z" fill={`url(#${id})`} stroke="#0b1220" strokeWidth="4" />
          <path d="M50 44c-12-10-24-8-30 2 8-2 14 0 18 4-8 0-14 4-16 10 8-4 16-2 20 2l8 6 8-6c4-4 12-6 20-2-2-6-8-10-16-10 4-4 10-6 18-4-6-10-18-12-30-2z" fill={a} />
          <circle cx="50" cy="34" r="6" fill={s} stroke="#0b1220" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
