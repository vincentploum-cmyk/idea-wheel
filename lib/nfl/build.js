// The NFL build the site runs: lib/nfl/picks.js's with the learned read's trees on it (lib/nfl/model.js; `PARAMS.MODEL`) and
// the teammate-back read (lib/nfl/returns.js; `PARAMS.ROLE_BACK`: it needs who plays tonight, which no replay knows).
// Server side only: the trees are a 0.4 MB file, and picks.js is pure (the replay passes its own trees, or none).
import MODEL from './model-trees.json';
import { makeBuild } from './picks';
import { BACK } from './returns';

export const NFL_MODEL = MODEL;
export const buildBoard = makeBuild(undefined, { params: { MODEL, ROLE_BACK: BACK } });
