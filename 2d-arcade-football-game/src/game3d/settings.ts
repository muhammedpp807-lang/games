export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export type ShadowQ = 'off' | 'low' | 'medium' | 'high';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'fog';

export interface GameSettings {
  quality: Quality;
  renderScale: number;
  shadows: ShadowQ;
  effects: number;
  master: number;
  music: number;
  sfx: number;
  camSensitivity: number;
  steerSensitivity: number;
  camDistance: number;
  trafficDensity: number;
  autoTime: boolean;
  timeOfDay: number;
  autoWeather: boolean;
  weather: Weather;
  musicOn: boolean;
  invertLook: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  quality: 'high',
  renderScale: 1,
  shadows: 'high',
  effects: 1,
  master: 0.8,
  music: 0.35,
  sfx: 0.9,
  camSensitivity: 1,
  steerSensitivity: 1,
  camDistance: 7.6,
  trafficDensity: 1,
  autoTime: true,
  timeOfDay: 9.5,
  autoWeather: true,
  weather: 'clear',
  musicOn: true,
  invertLook: false,
};

const KEY = 'openroad-settings-v1';

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<GameSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: GameSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export interface HudState {
  speed: number;
  rpm: number;
  gear: number;
  maxRpm: number;
  fuel: number;
  damage: number;
  handbrake: boolean;
  lightsOn: boolean;
  reverse: boolean;
  x: number;
  z: number;
  heading: number;
  gearLabel: string;
  odometer: number;
  drifting: boolean;
}

export const QUALITY_PRESETS: Record<Quality, { shadows: ShadowQ; renderScale: number; effects: number; label: string }> = {
  low: { shadows: 'off', renderScale: 0.7, effects: 0.3, label: 'Low' },
  medium: { shadows: 'low', renderScale: 0.85, effects: 0.6, label: 'Medium' },
  high: { shadows: 'high', renderScale: 1, effects: 1, label: 'High' },
  ultra: { shadows: 'high', renderScale: 1, effects: 1, label: 'Ultra' },
};
