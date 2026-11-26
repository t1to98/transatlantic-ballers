import {categories, normalize} from './fantrax.ts';
type Week = ReturnType<typeof normalize>;
function ranks(values:(number|null)[]) {
  return values.map(v => v===null ? null : 1+values.filter(n=>n!==null && n>v).length+(values.filter(n=>n===v).length-1)/2);
}
export function standings(weeks:Week[]) {
  const rows=weeks.at(-1)!.teams.map(team=>{
    const history=weeks.map(w=>w.teams.find(t=>t.teamId===team.teamId)!);
    const gp=history.reduce((s,t)=>s+t.gamesPlayed,0);
    const values=categories.map(c=>{
      if (!gp) return null;
      if (!c.endsWith('%')) return history.reduce((s,t)=>s+t.totals[c],0)/gp;
      if (weeks.length===1) return team.totals[c];
      return null;
    });
    return {id:team.teamId,name:team.teamName,gp,values};
  });
  const columns=categories.map((_,i)=>ranks(rows.map(t=>t.values[i])));
  const complete=columns.every(col=>col.every(n=>n!==null));
  const scores=rows.map((_,i)=>complete?columns.reduce((s,col)=>s+13-col[i]!,0):null);
  const overall=ranks(scores);
  return rows.map((row,i)=>({...row,ranks:columns.map(col=>col[i]),score:scores[i],rank:overall[i]}));
}
