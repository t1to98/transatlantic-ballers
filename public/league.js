const periods=JSON.parse(document.querySelector('#data').textContent);
const period=document.querySelector('#period');
let sort=-1, production=false, metric=-1, selected=null;
function renderTable(){
  const rows=[...periods[Number(period.value)]];
  const rank=t=>sort<0?t.rank:t.ranks[sort];
  rows.sort((a,b)=>(rank(a)??99)-(rank(b)??99)||a.name.localeCompare(b.name));
  const body=document.querySelector('tbody');
  body.replaceChildren();
  for(const t of rows){
    const row=body.insertRow(),team=row.insertCell(),pos=document.createElement('small');
    pos.textContent=t.rank??'—';team.append(pos,t.name);
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
  document.querySelectorAll('[data-sort]').forEach(b=>b.parentNode.setAttribute('aria-sort',+b.dataset.sort===sort?'ascending':'none'));
  for(const id of ['rank','production'])document.getElementById(id).setAttribute('aria-pressed',String((id==='production')===production));
}
period.onchange=renderTable;
document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{sort=+b.dataset.sort;renderTable()});
for(const id of ['rank','production'])document.getElementById(id).onclick=()=>{production=id==='production';renderTable()};
const colors=['#286540','#b85830','#6b51a5','#167d98','#b33968','#887124','#5372ab','#438c70','#965088','#9b522d','#656f43','#3c5266'];
const teams=[...periods[1]].sort((a,b)=>a.id.localeCompare(b.id));
const chart=document.querySelector('#chart');
function svg(tag,attrs,parent=chart,text=''){
  const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,v] of Object.entries(attrs))el.setAttribute(key,v);
  el.textContent=text;parent.append(el);return el;
}
function draw(){
  chart.replaceChildren();const weeks=periods.slice(1);
  const x=i=>32+710*i/Math.max(1,weeks.length-1),y=r=>15+29*(r-1);
  for(let r=1;r<=12;r++){
    svg('line',{x1:30,x2:745,y1:y(r),y2:y(r),stroke:'#dbded4'});
    svg('text',{x:3,y:y(r)+4,fill:'#657065'},chart,r);
  }
  weeks.forEach((_,i)=>svg('text',{x:x(i),y:362,'text-anchor':'middle'},chart,'W'+(i+1)));
  const labels=[];
  teams.forEach((t,i)=>{
    const g=svg('g',{opacity:selected&&selected!==t.id?0.2:1,style:'cursor:pointer',tabindex:0,role:'button','aria-label':t.name,'aria-pressed':selected===t.id});
    const toggle=()=>{selected=selected===t.id?null:t.id;draw()};
    g.onclick=toggle;g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}};
    let path='';
    weeks.forEach((week,w)=>{
      const row=week.find(a=>a.id===t.id),r=metric<0?row.rank:row.ranks[metric];
      if(r===null)return;
      path+=(path?' L':'M')+x(w)+' '+y(r);
      const dot=svg('circle',{cx:x(w),cy:y(r),r:4,fill:colors[i]},g);
      svg('title',{},dot,row.name+' · Week '+(w+1)+' · Rank '+r);
      if(w===weeks.length-1)labels.push({g,r,name:row.name,color:colors[i]});
    });
    g.prepend(svg('path',{d:path,fill:'none',stroke:colors[i],'stroke-width':selected===t.id?4:2},g));
    g.prepend(svg('path',{d:path,fill:'none',stroke:'transparent','stroke-width':10},g));
  });
  let last=-10;
  for(const l of labels.sort((a,b)=>a.r-b.r)){last=Math.max(y(l.r),last+15);svg('text',{x:756,y:last+4,fill:l.color},l.g,l.name)}
  document.querySelectorAll('[data-metric]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.metric===metric)));
}
document.querySelectorAll('[data-metric]').forEach(b=>b.onclick=()=>{metric=+b.dataset.metric;draw()});
renderTable();draw();
