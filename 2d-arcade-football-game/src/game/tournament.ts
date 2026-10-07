import { TEAMS, charById, teamById } from './data';
import type { Team } from './types';

export interface TMatch {
  a: string;
  b: string;
  sa: number;
  sb: number;
  played: boolean;
  isPlayer: boolean;
}

export interface Bracket {
  rounds: TMatch[][];
  playerTeam: string;
  playerChar: string;
  round: number; // index of the round the player still has to play
  champion?: string;
  eliminated: boolean;
  log: string[];
  goals: number;
  conceded: number;
}

export const ROUND_NAMES = ['QUARTER FINALS', 'SEMI FINALS', 'FINAL'];

export function createBracket(playerTeam: string, playerChar: string): Bracket {
  const pool = TEAMS.map((t) => t.id).filter((id) => id !== playerTeam);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const others = pool.slice(0, 7);
  const ids = [playerTeam, ...others];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const first: TMatch[] = [];
  for (let i = 0; i < 8; i += 2) {
    first.push({ a: ids[i], b: ids[i + 1], sa: 0, sb: 0, played: false, isPlayer: ids[i] === playerTeam || ids[i + 1] === playerTeam });
  }
  return {
    rounds: [first, [], []],
    playerTeam,
    playerChar,
    round: 0,
    eliminated: false,
    log: [],
    goals: 0,
    conceded: 0,
  };
}

const rating = (id: string) => (TEAMS.find((t) => t.id === id)?.rating ?? 85) / 100;

/** Simulates an AI-vs-AI fixture with plausible arcade scores. */
export function simulateMatch(m: TMatch) {
  const pa = rating(m.a) + Math.random() * 0.45;
  const pb = rating(m.b) + Math.random() * 0.45;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < 5; i++) {
    if (pa > pb + Math.random() * 0.6) sa++;
    else if (pb > pa + Math.random() * 0.6) sb++;
  }
  if (sa === sb) sa += Math.random() < 0.5 ? 1 : 0;
  if (sa === sb) sb += 1;
  m.sa = sa;
  m.sb = sb;
  m.played = true;
}

export function playerMatch(b: Bracket): TMatch | null {
  const r = b.rounds[b.round];
  if (!r) return null;
  return r.find((m) => m.isPlayer) ?? null;
}

/** Called after the player's fixture is resolved. */
export function resolveRound(b: Bracket, playerGoals: number, oppGoals: number): Bracket {
  const nb: Bracket = JSON.parse(JSON.stringify(b));
  const r = nb.rounds[nb.round];
  const pm = r.find((m) => m.isPlayer);
  if (pm) {
    pm.sa = playerGoals;
    pm.sb = oppGoals;
    pm.played = true;
  }
  r.forEach((m) => {
    if (!m.played) simulateMatch(m);
  });
  nb.goals += playerGoals;
  nb.conceded += oppGoals;
  const winnerOf = (m: TMatch) => (m.sa >= m.sb ? m.a : m.b);
  const winners = r.map(winnerOf);
  const playerWon = pm ? winnerOf(pm) === nb.playerTeam : false;
  nb.log.unshift(
    `${ROUND_NAMES[nb.round]}: ${teamById(pm?.a ?? '').short} ${pm?.sa ?? 0}-${pm?.sb ?? 0} ${teamById(pm?.b ?? '').short} ${
      playerWon ? '✅' : '❌'
    }`,
  );
  if (!playerWon) {
    nb.eliminated = true;
    // simulate the rest of the competition
    let cur = winners;
    for (let i = nb.round + 1; i < 3; i++) {
      const next: TMatch[] = [];
      for (let j = 0; j < cur.length; j += 2) {
        const m: TMatch = { a: cur[j], b: cur[j + 1], sa: 0, sb: 0, played: false, isPlayer: false };
        simulateMatch(m);
        next.push(m);
      }
      nb.rounds[i] = next;
      cur = next.map(winnerOf);
    }
    nb.champion = cur[0];
    return nb;
  }
  if (nb.round === 2) {
    nb.champion = nb.playerTeam;
    return nb;
  }
  // build next round
  const next: TMatch[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    next.push({
      a: winners[i],
      b: winners[i + 1],
      sa: 0,
      sb: 0,
      played: false,
      isPlayer: winners[i] === nb.playerTeam || winners[i + 1] === nb.playerTeam,
    });
  }
  nb.rounds[nb.round + 1] = next;
  nb.round += 1;
  return nb;
}

export const bracketTeam = (id: string): Team => teamById(id);

export const bracketCharName = (id: string) => charById(id).name;
