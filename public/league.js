const dataElement=document.querySelector('#data');
const periods=JSON.parse(dataElement.textContent);
function rosterUrl(teamId){
  return dataElement.dataset.rosterBase+';teamId='+encodeURIComponent(teamId);
}
const period=document.querySelector('#period');
let bestFirst=true;
let sort=-1, production=false, metric=-1, selected=null;
function renderTable(){
  const rows=[...periods[Number(period.value)]];
  const rank=t=>sort<0?t.rank:t.ranks[sort];
  rows.sort((a,b)=>{
    const left=rank(a), right=rank(b);
    if(left===null && right!==null)return 1;
    if(right===null && left!==null)return -1;
    return (bestFirst?1:-1)*(left-right)||a.name.localeCompare(b.name);
  });
  const body=document.querySelector('tbody');
  body.replaceChildren();
  for(const t of rows){
    const row=body.insertRow();
    row.insertCell().textContent=t.rank??'—';
    const roster=document.createElement('a');
    roster.href=rosterUrl(t.id);
    roster.target='_blank';
    roster.rel='noopener';
    roster.textContent=t.name;
    roster.title='Open '+t.name+' on Fantrax (new tab)';
    row.insertCell().append(roster);
    row.insertCell().textContent=t.score??'—';
    row.insertCell().textContent=t.gp;
    t.ranks.forEach((r,i)=>{
      const cell=row.insertCell();
      if(r===null){cell.textContent='—';return;}
      cell.className='tier'+Math.min(3,Math.floor((Math.ceil(r)-1)/3));
      const percent=i===0||i===2;
      cell.textContent=production?(percent?(100*t.values[i]).toFixed(2)+'%':t.values[i].toFixed(2)):r;
    });
  }
  document.querySelector('#note').hidden=period.value!=='0';
  const ascending=production && sort>=0 ? !bestFirst : bestFirst;
  for(const button of document.querySelectorAll('[data-sort]')){
    if(Number(button.dataset.sort)===sort)button.parentNode.setAttribute('aria-sort',ascending?'ascending':'descending');
    else button.parentNode.removeAttribute('aria-sort');
  }
  for(const id of ['rank','production'])document.getElementById(id).setAttribute('aria-pressed',String((id==='production')===production));
}
period.onchange=renderTable;
document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{const next=Number(b.dataset.sort);bestFirst=next===sort?!bestFirst:true;sort=next;renderTable()});
for(const id of ['rank','production'])document.getElementById(id).onclick=()=>{production=id==='production';renderTable()};
const colors=['#2659a5','#bc4527','#007b68','#8549a2','#946500','#b03368','#13769c','#596c24','#6a55bd','#87543c','#236241','#4e657c'];
const teams=[...periods[1]].sort((a,b)=>a.id.localeCompare(b.id));
const chart=document.querySelector('#chart');
function svg(tag,attrs,parent=chart,text=''){
  const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,v] of Object.entries(attrs))el.setAttribute(key,v);
  el.textContent=text;parent.append(el);return el;
}
function highlight(id){
  for(const group of chart.querySelectorAll('[data-team]')){
    group.classList.toggle('muted',Boolean(id && group.dataset.team!==id));
    group.classList.toggle('highlighted',group.dataset.team===id);
    group.querySelector('[role="button"]').setAttribute('aria-pressed',String(group.dataset.team===selected));
  }
}
function draw(){
  chart.replaceChildren();const weeks=periods.slice(1);
  const x=i=>32+710*i/Math.max(1,weeks.length-1),y=r=>15+29*(r-1);
  for(let r=1;r<=12;r++){
    svg('line',{x1:30,x2:745,y1:y(r),y2:y(r),stroke:'#e7e7e7'});
    svg('text',{x:3,y:y(r)+4,fill:'#657065'},chart,r);
  }
  weeks.forEach((_,i)=>svg('text',{x:x(i),y:362,'text-anchor':'middle'},chart,'W'+(i+1)));
  const labels=[];
  teams.forEach((t,i)=>{
    const g=svg('g',{'data-team':t.id});
    const line=svg('g',{tabindex:0,role:'button','aria-label':'Pin '+t.name},g);
    g.onpointerenter=e=>{if(e.pointerType!=='touch')highlight(t.id)};
    g.onpointerleave=()=>highlight(selected);
    g.onfocusin=()=>highlight(t.id);
    g.onfocusout=()=>highlight(selected);
    const toggle=()=>{
      selected=selected===t.id?null:t.id;
      highlight(selected);
    };
    line.onclick=toggle;
    line.onkeydown=e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}
      if(e.key==='Escape'){selected=null;highlight(null)}
    };
    let path='';
    weeks.forEach((week,w)=>{
      const row=week.find(a=>a.id===t.id),r=metric<0?row.rank:row.ranks[metric];
      if(r===null)return;
      path+=(path?' L':'M')+x(w)+' '+y(r);
      const dot=svg('circle',{cx:x(w),cy:y(r),r:3,fill:colors[i]},line);
      svg('title',{},dot,row.name+' · Week '+(w+1)+' · Rank '+r);
      if(w===weeks.length-1)labels.push({g,r,id:t.id,name:row.name,color:colors[i]});
    });
    line.prepend(svg('path',{d:path,fill:'none',stroke:colors[i],class:'trajectory','stroke-width':2},line));
    line.prepend(svg('path',{d:path,fill:'none',stroke:'transparent','stroke-width':10},line));
  });
  labels.sort((a,b)=>a.r-b.r||a.name.localeCompare(b.name));
  let last=-16;
  for(const label of labels){
    label.top=Math.max(y(label.r),last+17);
    last=label.top;
  }
  let ceiling=y(12);
  for(const label of labels.slice().reverse()){
    label.top=Math.min(label.top,ceiling);
    ceiling=label.top-17;
    svg('line',{x1:746,x2:764,y1:y(label.r),y2:label.top,stroke:label.color,opacity:.55},label.g);
    const roster=svg('a',{href:rosterUrl(label.id),target:'_blank',rel:'noopener',
      'aria-label':'Open '+label.name+' on Fantrax (new tab)'},label.g);
    svg('text',{x:769,y:label.top+4,fill:label.color},roster,label.r+'  '+label.name);
  }
  highlight(selected);
  document.querySelectorAll('[data-metric]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.metric===metric)));
}
document.querySelectorAll('[data-metric]').forEach(b=>b.onclick=()=>{metric=+b.dataset.metric;draw()});
renderTable();draw();

const powerLink=document.querySelector('nav a[href="#power"]');
const weeklyLink=document.querySelector('nav a[href="#motion"]');
const motion=document.querySelector('#motion');
function updateNavigation(){
  const weekly=motion.getBoundingClientRect().top<=window.innerHeight*.4 ||
    window.scrollY>0 && window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-2;
  powerLink.toggleAttribute('aria-current',!weekly);
  weeklyLink.toggleAttribute('aria-current',weekly);
  (weekly?weeklyLink:powerLink).setAttribute('aria-current','location');
}
window.addEventListener('scroll',updateNavigation,{passive:true});
window.addEventListener('resize',updateNavigation);
updateNavigation();
