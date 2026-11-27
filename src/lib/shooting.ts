import type { normalize } from './fantrax.ts';

type TeamWeek = ReturnType<typeof normalize>['teams'][number];
interface Shots { made: number; attempted: number }
interface Shooting { fg: Shots | null; ft: Shots | null }
export interface VerifiedWeek {
  period: number;
  teamId: string;
  points: number;
  threes: number;
  fgPct: number;
  ftPct: number;
  fg: Shots;
  ft: Shots;
}

// Fantrax rounds ratios to six decimals. Include both half-unit boundaries
// conservatively so a rounding convention cannot manufacture a unique answer.
function attemptsFor(made: number, fraction: number) {
  const scaled = Math.round(fraction * 1_000_000);
  const numerator = made * 2_000_000;
  const min = Math.max(made, Math.ceil(numerator / (2 * scaled + 1)));
  const max = scaled === 0 ? Infinity : Math.floor(numerator / (2 * scaled - 1));
  return min <= max ? { min, max } : null;
}

function matches(shots: Shots, fraction: number) {
  const { made, attempted } = shots;
  const possible = attemptsFor(made, fraction);
  return Number.isSafeInteger(made) && Number.isSafeInteger(attempted) && made >= 0 &&
    !!possible && attempted >= possible.min && attempted <= possible.max &&
    (attempted > 0 || fraction === 0);
}

export function weeklyShooting(team: TeamWeek, verified?: VerifiedWeek): Shooting {
  const { PTS: points, '3PM': threes, 'FG%': fgPct, 'FT%': ftPct } = team.totals;
  if (team.gamesPlayed === 0 && Object.values(team.totals).every(value => value === 0)) {
    return { fg: { made: 0, attempted: 0 }, ft: { made: 0, attempted: 0 } };
  }
  if (verified && verified.teamId === team.teamId && verified.points === points &&
      verified.threes === threes && verified.fgPct === fgPct && verified.ftPct === ftPct) {
    if (verified.fg.made < threes || 2 * verified.fg.made + threes + verified.ft.made !== points ||
        !matches(verified.fg, fgPct) || !matches(verified.ft, ftPct)) {
      throw new Error('Invalid verified shooting line for ' + team.teamId);
    }
    return { fg: verified.fg, ft: verified.ft };
  }

  // PTS = 2 × FGM + 3PM + FTM. Enumerate every feasible makes pair.
  // A second pair changes both makes, so neither category can be resolved.
  let candidate: Shooting | undefined;
  for (let fgMade = threes; 2 * fgMade + threes <= points; fgMade++) {
    const ftMade = points - 2 * fgMade - threes;
    if ((fgMade === 0 && fgPct > 0) || (ftMade === 0 && ftPct > 0)) continue;
    const fg = attemptsFor(fgMade, fgPct);
    const ft = attemptsFor(ftMade, ftPct);
    if (!fg || !ft) continue;
    if (candidate) return { fg: null, ft: null };
    candidate = {
      fg: fg.min === fg.max ? { made: fgMade, attempted: fg.min } : null,
      ft: ft.min === ft.max ? { made: ftMade, attempted: ft.min } : null,
    };
  }
  return candidate ?? { fg: null, ft: null };
}

export function seasonPercentage(lines: Shooting[], category: keyof Shooting) {
  let made = 0;
  let attempted = 0;
  for (const line of lines) {
    const shots = line[category];
    if (!shots) return null;
    made += shots.made;
    attempted += shots.attempted;
  }
  return attempted > 0 ? made / attempted : null;
}
