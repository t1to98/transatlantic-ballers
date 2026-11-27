import {readFile, writeFile} from 'node:fs/promises';
import {request,normalize} from '../src/lib/fantrax.ts';
import {weeklyShooting, type VerifiedWeek} from '../src/lib/shooting.ts';
const dir='data/2026-27/raw';
const {resolvedWeeks}: {resolvedWeeks: VerifiedWeek[]} = JSON.parse(
  await readFile('data/2026-27/shooting-verification.json','utf8')
);
const current=await request('getMatchupScores');
const latest=normalize(current);
const signature=w=>w.teams.map(t=>t.teamId).sort().join(',');
const baseline=normalize(await readFile(dir+'/week-1.json','utf8'),1);
const pending=new Map();
for(let p=1;p<=latest.period;p++){
  const path=dir+'/week-'+p+'.json';
  const old=await readFile(path,'utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e});
  if(old && p<latest.period-1 && !process.env.FULL_BACKFILL)continue;
  const raw=p===latest.period?current:await request('getMatchupScores',p);
  const week=normalize(raw,p);
  if(signature(week)!==signature(baseline))throw Error('Unexpected participants in week '+p);
  if(old && week.teams.every(t=>t.gamesPlayed===0) && normalize(old,p).teams.some(t=>t.gamesPlayed>0))
    throw Error('Refusing empty replacement for week '+p);
  for (const team of week.teams) {
    const evidence = resolvedWeeks.find(v=>v.period===p && v.teamId===team.teamId);
    const shots = weeklyShooting(team, evidence);
    if (!shots.fg || !shots.ft) {
      console.warn(`::warning file=${path}::Week ${p}, team ${team.teamId}: check the shooting totals against Fantrax Season Stats.`);
    }
  }
  pending.set(path,raw);
}
for(const [path,raw] of pending)await writeFile(path,raw);
