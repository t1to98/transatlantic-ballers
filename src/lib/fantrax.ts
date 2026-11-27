export const categories = ['FG%', '3PM', 'FT%', 'PTS', 'REB', 'AST', 'STL', 'BLK'] as const;
const leagueId = 'jdc94v3kmtvppxcs';
export const rosterBase = `https://www.fantrax.com/fantasy/league/${leagueId}/team/roster`;
const aliases: Record<string,string> = { '3PTM': '3PM', ST: 'STL' };

export async function request(endpoint: 'getLeagueInfo' | 'getMatchupScores', period?: number) {
  const url = new URL(endpoint, 'https://www.fantrax.com/fxea/general/');
  url.searchParams.set('leagueId', leagueId);
  if (period !== undefined) url.searchParams.set('period', String(period));
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'TransatlanticBallers/1.0' },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('Fantrax HTTP ' + response.status);
  return response.text();
}

interface Side { teamName: string; teamId: string; gamesPlayed: number }
interface Category { shortName: string; away: {value: number}; home: {value: number} }
interface Match {away: Side; home: Side; categories: Category[]}

export function normalize(raw: string, expectedPeriod?: number) {
  const payload = JSON.parse(raw);
  if (!Number.isInteger(payload.period) || payload.period < 1 ||
      (expectedPeriod !== undefined && payload.period !== expectedPeriod))
    throw new Error('Unexpected scoring period');
  if (!Array.isArray(payload.matchups) || payload.matchups.length !== 6)
    throw new Error('Expected six matchups');
  const seen = new Set<string>();
  const teams = (payload.matchups as Match[]).flatMap(match => (['away','home'] as const).map(side => {
    const {teamName, teamId, gamesPlayed} = match[side];
    if (typeof teamId !== 'string' || !teamId || seen.has(teamId) || typeof teamName !== 'string' || !teamName ||
        !Number.isInteger(gamesPlayed) || gamesPlayed < 0) throw new Error('Invalid team line');
    seen.add(teamId);
    const totals: Record<string,number> = {};
    for (const category of match.categories) {
      const key = aliases[category.shortName] ?? category.shortName;
      const value = category[side].value;
      if (key in totals || !Number.isFinite(value) || value < 0 ||
          (key.endsWith('%') ? value > 1 : !Number.isInteger(value))) throw new Error('Invalid category ' + key);
      totals[key] = value;
    }
    if (Object.keys(totals).length !== 8 || categories.some(key => !(key in totals)))
      throw new Error('Unexpected scoring categories');
    return {teamId, teamName, gamesPlayed, totals};
  }));
  return {period: payload.period as number, teams};
}
