// The three leagues' marks, served from /public (ESPN's league logos, kept with the site so the
// landing and the start screen never wait on a CDN).
export const LEAGUES = ['nfl', 'nba', 'nhl'];
export const leagueLogo = (code) => `/img/leagues/${String(code || '').toLowerCase()}.png`;
export const leagueName = (code) => String(code || '').toUpperCase();
