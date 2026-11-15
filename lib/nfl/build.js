// The NFL build the site runs: lib/nfl/picks.js's with the learned read's trees on it (lib/nfl/model.js; `PARAMS.MODEL`).
// Server side only: the trees are a 0.4 MB file, and picks.js is pure (the replay passes its own trees, or none).
import MODEL from './model-trees.json';
import { makeBuild } from './picks';

export const NFL_MODEL = MODEL;
export const buildBoard = makeBuild(undefined, { params: { MODEL } });
