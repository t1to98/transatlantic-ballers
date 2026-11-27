import {categories, normalize} from './fantrax.ts';
import {seasonPercentage, weeklyShooting, type VerifiedWeek} from './shooting.ts';
type Week = ReturnType<typeof normalize>;
function ranks(values:(number|null)[]) {
  return values.map(v => v===null ? null : 1+values.filter(n=>n!==null && n>v).length+(values.filter(n=>n===v).length-1)/2);
}
export function standings(weeks:Week[], verified:VerifiedWeek[] = []) {
  const rows=weeks.at(-1)!.teams.map(team=>{
    const history=weeks.map(w=>w.teams.find(t=>t.teamId===team.teamId)!);
    const gp=history.reduce((s,t)=>s+t.gamesPlayed,0);
    const shooting=weeks.length>1 ? history.map((t,i)=>weeklyShooting(t,
      verified.find(v=>v.period===weeks[i].period && v.teamId===t.teamId))) : [];
    const values=categories.map(c=>{
      if (!gp) return null;
      if (!c.endsWith('%')) return history.reduce((s,t)=>s+t.totals[c],0)/gp;
      if (weeks.length===1) return team.totals[c];
      return seasonPercentage(shooting,c==='FG%'?'fg':'ft');
    });
    return {id:team.teamId,name:team.teamName,gp,values};
  });
  const columns=categories.map((_,i)=>{
    const values=rows.map(t=>t.values[i]);
    if (weeks.length>1 && values.includes(null)) return values.map(()=>null);
    return ranks(values);
  });
  const complete=columns.every(col=>col.every(n=>n!==null));
  const scores=rows.map((_,i)=>complete?columns.reduce((s,col)=>s+13-col[i]!,0):null);
  const overall=ranks(scores);
  return rows.map((row,i)=>({...row,ranks:columns.map(col=>col[i]),score:scores[i],rank:overall[i]}));
}

// Keep every category and GP on the same cutoff when a newer box score
// cannot yet yield exact shooting totals.
export function seasonStandings(weeks: Week[], verified: VerifiedWeek[]) {
  const current = standings(weeks, verified);
  if (current.every(team => team.score !== null)) return { rows: current, note: '' };
  for (let count = weeks.length - 1; count > 0; count--) {
    const previous = standings(weeks.slice(0, count), verified);
    if (previous.every(team => team.score !== null)) {
      const cutoff = weeks[count - 1].period;
      return { rows: previous, note: `Through Week ${cutoff}. Later shooting totals are awaiting verification.` };
    }
  }
  return { rows: current, note: 'Some shooting totals are awaiting verification. Overall ranks need all eight categories.' };
}
