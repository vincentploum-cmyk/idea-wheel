// The key a skater's model row is joined on everywhere a run meets the site's data (the slate's
// chips, the scorecard, the board reads): team abbreviation + the normalised name. Pure, with no
// store import, so the client bundles (the Model tab overlaying the board's chances on its rows)
// can key their rows the same way the server does.
import { teamAbbrFromText } from './teams';

/** Same normalisation as the model's normalizePlayerName() (components/nhl/model-core.js). */
export function normName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(?:C|LW|RW|D)\b$/i, '')
    .replace(/\b(?:JR|SR|III|II|IV)\b/gi, '')
    .replace(/[-]/g, ' ')
    .replace(/[.,'’‘`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export const modelKey = (team, name) => `${teamAbbrFromText(team) || String(team || '').toUpperCase()}|${normName(name)}`;
