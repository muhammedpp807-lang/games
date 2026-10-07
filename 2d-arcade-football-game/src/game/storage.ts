import type { KeyBindings, Settings } from './types';

const KEY = 'football-legends-settings-v1';
const TKEY = 'football-legends-tournament-v1';

export const DEFAULT_BINDINGS: KeyBindings = {
  p1: { left: 'KeyA', right: 'KeyD', jump: 'KeyW', slide: 'KeyS', shoot: 'KeyL', super: 'KeyK', altShoot: 'KeyX', altSuper: 'KeyZ' },
  p2: {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    jump: 'ArrowUp',
    slide: 'ArrowDown',
    shoot: 'Comma',
    super: 'Period',
    altShoot: 'Numpad1',
    altSuper: 'Numpad2',
  },
};

export const ACTION_LABELS: Record<string, string> = {
  left: 'Move Left',
  right: 'Move Right',
  jump: 'Jump',
  slide: 'Slide / Block',
  shoot: 'Shoot',
  super: 'Supershot',
};

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  music: 0.45,
  sfx: 0.9,
  musicOn: true,
  soundOn: true,
  difficulty: 'normal',
  duration: 90,
  shake: true,
  quality: 'high',
  touch: 'auto',
  bindings: DEFAULT_BINDINGS,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      bindings: {
        p1: { ...DEFAULT_BINDINGS.p1, ...(parsed.bindings?.p1 ?? {}) },
        p2: { ...DEFAULT_BINDINGS.p2, ...(parsed.bindings?.p2 ?? {}) },
      },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function loadTournament<T>(): T | null {
  try {
    const raw = localStorage.getItem(TKEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveTournament(t: unknown) {
  try {
    localStorage.setItem(TKEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
}

export function clearTournament() {
  try {
    localStorage.removeItem(TKEY);
  } catch {
    /* ignore */
  }
}
