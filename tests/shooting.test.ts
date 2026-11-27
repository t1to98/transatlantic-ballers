import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { weeklyShooting, seasonPercentage, type VerifiedWeek } from '../src/lib/shooting.ts';
import { seasonStandings } from '../src/lib/rankings.ts';

const team = {
  teamId: 'ni62wxhhmtyse8hs', teamName: 'Which Anthony?', gamesPlayed: 35,
  totals: { PTS: 505, '3PM': 56, 'FG%': 0.418317, 'FT%': 0.765517, REB: 214, AST: 125, STL: 47, BLK: 17 },
};

test('season percentages weight each verified week by attempts', () => {
  const first = weeklyShooting(team);
  const second = weeklyShooting({...team, gamesPlayed: 38,
    totals: {...team.totals, PTS: 578, '3PM': 66, 'FG%': 0.455982, 'FT%': 0.850394}});
  assert.deepEqual(first, {fg: {made: 169, attempted: 404}, ft: {made: 111, attempted: 145}});
  assert.equal(seasonPercentage([first, second], 'fg'), 371 / 847);
  assert.equal(seasonPercentage([first, second], 'ft'), 219 / 272);
});

test('only matching, independently checked lines can resolve an ambiguous week', () => {
  const {resolvedWeeks}: {resolvedWeeks: VerifiedWeek[]} = JSON.parse(
    readFileSync(new URL('../data/2026-27/shooting-verification.json', import.meta.url), 'utf8')
  );
  for (const v of resolvedWeeks) {
    const row = {...team, teamId: v.teamId,
      totals: {...team.totals, PTS: v.points, '3PM': v.threes, 'FG%': v.fgPct, 'FT%': v.ftPct}};
    assert.deepEqual(weeklyShooting(row), {fg: null, ft: null});
    assert.deepEqual(weeklyShooting(row, v), {fg: v.fg, ft: v.ft});
    assert.deepEqual(weeklyShooting(row, {...v, points: v.points + 1}), {fg: null, ft: null});
    assert.throws(() => weeklyShooting(row, {...v, fg: {made: v.fg.made + 1, attempted: v.fg.attempted}}));
  }
});

test('zero games contribute no attempts, while a played week at zero percent can hide misses', () => {
  const empty = weeklyShooting({...team, gamesPlayed: 0,
    totals: {PTS: 0, '3PM': 0, 'FG%': 0, 'FT%': 0, REB: 0, AST: 0, STL: 0, BLK: 0}});
  assert.deepEqual(empty, {fg: {made: 0, attempted: 0}, ft: {made: 0, attempted: 0}});
  assert.equal(seasonPercentage([empty], 'fg'), null);
  const played = weeklyShooting({...team, gamesPlayed: 1,
    totals: {...team.totals, PTS: 3, '3PM': 1, 'FG%': 0.5, 'FT%': 0}});
  assert.deepEqual(played, {fg: {made: 1, attempted: 2}, ft: null});
  assert.equal(seasonPercentage([weeklyShooting(team), played], 'ft'), null);
});

test('a later ambiguous week keeps the entire table on a disclosed verified cutoff', () => {
  const first = {period: 1, teams: [team]};
  const ambiguous = {...team, totals: {...team.totals, PTS: 431, '3PM': 39, 'FG%': .429825, 'FT%': .784}};
  const result = seasonStandings([first, {period: 2, teams: [ambiguous]}], []);
  assert.match(result.note, /Through Week 1/);
  assert.deepEqual(result.rows, seasonStandings([first], []).rows);
});
