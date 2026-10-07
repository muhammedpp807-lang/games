export const W = 1280;
export const H = 720;
export const GROUND = 612;
export const GOAL_H = 186;
export const GOAL_D = 76;
export const GOAL_L_X = 96; // left goal line
export const GOAL_R_X = W - 96; // right goal line
export const CEILING = 54;
export const BALL_R = 17;
export const PLAYER_W = 54;
export const PLAYER_H = 96;
export const GRAVITY = 2100;
export const BALL_GRAVITY = 1500;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
