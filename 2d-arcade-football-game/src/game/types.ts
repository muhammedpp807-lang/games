export type Stat = 'speed' | 'power' | 'jump' | 'shooting' | 'defense';

export type AbilityEffect =
  | 'blaze' // huge speed + burn trail
  | 'freeze' // freezes opponent
  | 'stun' // stuns keeper / zig-zag ball
  | 'smash' // meteor arc + ground shockwave
  | 'curve' // wind curve toward goal
  | 'dash' // player rocket dash
  | 'magnet' // ball magnetised to player
  | 'shield'; // energy wall in front of own goal

export interface Ability {
  id: string;
  name: string;
  icon: string;
  effect: AbilityEffect;
  color: string;
  color2: string;
  desc: string;
}

export interface Character {
  id: string;
  name: string;
  teamId: string;
  abilityId: string;
  skin: string;
  hair: string;
  hairStyle: 'spiky' | 'buzz' | 'curly' | 'bun' | 'afro' | 'long' | 'mohawk' | 'bald' | 'waves';
  number: number;
  stats: Record<Stat, number>; // 1..10
  tag: string;
}

export interface Team {
  id: string;
  name: string;
  short: string;
  city: string;
  primary: string;
  secondary: string;
  accent: string;
  badge: 'shield' | 'stripes' | 'crown' | 'stars' | 'tower' | 'diamond' | 'circle' | 'wing';
  rating: number;
  motto: string;
}

export interface PlayerSetup {
  character: Character;
  team: Team;
  ability: Ability;
  control: 'human' | 'ai';
}

export type Mode = '1p' | '2p' | 'quick' | 'tournament';

export interface MatchConfig {
  p1: PlayerSetup;
  p2: PlayerSetup;
  duration: number; // seconds
  difficulty: Difficulty;
  mode: Mode;
  suddenDeath: boolean;
  tournamentMatch?: { round: number; index: number };
}

export type Difficulty = 'easy' | 'normal' | 'hard' | 'legend';

export interface KeyBindings {
  p1: Record<string, string>;
  p2: Record<string, string>;
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  musicOn: boolean;
  soundOn: boolean;
  difficulty: Difficulty;
  duration: number;
  shake: boolean;
  quality: 'low' | 'medium' | 'high';
  touch: 'auto' | 'on' | 'off';
  bindings: KeyBindings;
}

export interface MatchResult {
  p1Goals: number;
  p2Goals: number;
  winner: 0 | 1 | 2; // 0 = draw
  stats: {
    possession: [number, number];
    shots: [number, number];
    saves: [number, number];
    supers: [number, number];
  };
  suddenDeath: boolean;
}

export interface TournamentState {
  teamIds: string[];
  charIds: (string | null)[];
  playerTeamIndex: number;
  playerCharId: string;
  round: number; // 0 QF, 1 SF, 2 Final, 3 champion
  results: { round: number; index: number; a: number; b: number; aId: string; bId: string; playerWon?: boolean }[];
  done: boolean;
  championId?: string;
}
