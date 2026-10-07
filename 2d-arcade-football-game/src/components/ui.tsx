import type { ReactNode } from 'react';
import { audio } from '../game/audio';

type Color = 'cyan' | 'green' | 'orange' | 'purple' | 'red' | 'gold' | 'blue' | 'dark';

export function ArcadeButton({
  children,
  onClick,
  color = 'cyan',
  className = '',
  disabled,
  size = 'md',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  color?: Color;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  title?: string;
}) {
  const sizes: Record<string, string> = {
    sm: 'text-xs md:text-sm px-3 py-1.5',
    md: 'text-sm md:text-base px-5 py-2.5',
    lg: 'text-lg md:text-2xl px-7 py-3.5',
    xl: 'text-2xl md:text-4xl px-10 py-5',
  };
  return (
    <button
      title={title}
      disabled={disabled}
      onPointerEnter={() => !disabled && audio.hover()}
      onClick={() => {
        if (disabled) return;
        audio.click();
        onClick?.();
      }}
      className={`arcade-btn ${color} font-arcade text-white ${sizes[size]} ${className}`}
    >
      <span className="relative z-10 drop-shadow-[0_2px_0_rgba(0,0,0,0.45)]">{children}</span>
    </button>
  );
}

export function IconButton({
  children,
  onClick,
  active = true,
  title,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      title={title}
      onClick={() => {
        audio.click();
        onClick?.();
      }}
      className={`grid h-11 w-11 place-items-center rounded-2xl border-2 text-lg transition active:translate-y-0.5 ${
        active
          ? 'border-cyan-300/60 bg-gradient-to-b from-cyan-400/80 to-blue-700/90 text-white shadow-[0_5px_0_rgba(0,0,0,0.35)]'
          : 'border-white/15 bg-gradient-to-b from-slate-600/60 to-slate-900/80 text-slate-300 shadow-[0_5px_0_rgba(0,0,0,0.35)]'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function StatBar({ label, value, color = '#38e1ff' }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[62px] shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/70">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${value * 10}%`, background: `linear-gradient(90deg, ${color}, #ffffff90)` }}
        />
      </div>
      <span className="w-5 text-right text-[10px] font-black text-white/80">{value}</span>
    </div>
  );
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-white/70">
        <span>{label}</span>
        <span className="text-cyan-300">{format ? format(value) : `${Math.round((value / max) * 100)}%`}</span>
      </div>
      <input
        type="range"
        className="arc-range w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

export function Toggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      onClick={() => {
        audio.click();
        onChange(!value);
      }}
      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-left transition hover:border-cyan-300/40"
    >
      <span>
        <span className="block text-sm font-bold">{label}</span>
        {hint && <span className="block text-[10px] uppercase tracking-wide text-white/45">{hint}</span>}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          value ? 'bg-gradient-to-r from-cyan-400 to-blue-500' : 'bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? 'left-6' : 'left-1'}`}
        />
      </span>
    </button>
  );
}

export function SegButtons<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-white/70">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o.value)}
            onClick={() => {
              audio.click();
              onChange(o.value);
            }}
            className={`flex-1 rounded-xl border-2 px-3 py-2 text-xs font-black uppercase tracking-wide transition ${
              value === o.value
                ? 'border-cyan-200 bg-gradient-to-b from-cyan-400 to-blue-600 text-white shadow-[0_4px_0_rgba(0,0,0,0.35)]'
                : 'border-white/15 bg-black/30 text-white/70 hover:border-cyan-300/40'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Confetti({ n = 40 }: { n?: number }) {
  const colors = ['#ffd166', '#ff5d73', '#4cc9f0', '#8ac926', '#bdb2ff', '#ffffff'];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          className="anim-confetti absolute block rounded-sm"
          style={{
            left: `${(i * 97) % 100}%`,
            width: 8 + (i % 4) * 3,
            height: 12 + (i % 3) * 4,
            background: colors[i % colors.length],
            animationDuration: `${2.6 + ((i * 13) % 30) / 10}s`,
            animationDelay: `${-((i * 7) % 40) / 10}s`,
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
}

export function StadiumBackdrop({ dim = 0.55 }: { dim?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,#123a6b_0%,#071427_55%,#03080f_100%)]" />
      {/* floodlights */}
      {[12, 38, 62, 88].map((x, i) => (
        <div key={x}>
          <div
            className="absolute -top-24 h-[70vh] w-[38vw] origin-top opacity-30 blur-2xl"
            style={{
              left: `${x - 19}%`,
              background: `conic-gradient(from ${180 + (i % 2 ? -16 : 16)}deg at 50% 0%, transparent 40%, rgba(190,225,255,0.55) 50%, transparent 60%)`,
            }}
          />
          <div
            className="absolute top-0 h-3 w-16 -translate-x-1/2 rounded-b bg-amber-100/80 blur-[2px]"
            style={{ left: `${x}%` }}
          />
        </div>
      ))}
      {/* crowd silhouette */}
      <div className="absolute inset-x-0 top-[34%] h-[14vh] opacity-60">
        {Array.from({ length: 90 }).map((_, i) => (
          <span
            key={i}
            className="absolute bottom-0 block rounded-t-full bg-black/70"
            style={{
              left: `${(i * 1.12) % 100}%`,
              width: `${1 + (i % 3) * 0.4}vw`,
              height: `${2.2 + ((i * 7) % 5) * 0.5}vh`,
              bottom: `${(i % 3) * 0.7}vh`,
            }}
          />
        ))}
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-[46%]"
        style={{
          background:
            'repeating-linear-gradient(90deg, rgba(31,122,61,0.95) 0 60px, rgba(24,98,49,0.95) 60px 120px)',
          boxShadow: 'inset 0 30px 60px rgba(0,0,0,0.6)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[46%]"
        style={{ background: 'radial-gradient(ellipse at 50% 120%, rgba(255,255,255,0.12), transparent 60%)' }}
      />
      <div className="absolute inset-0" style={{ background: `rgba(2,6,14,${dim})` }} />
    </div>
  );
}

export function Title({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={`font-arcade stroke-text text-center text-3xl uppercase tracking-wide text-white md:text-5xl ${className}`}
    >
      {children}
    </h2>
  );
}
