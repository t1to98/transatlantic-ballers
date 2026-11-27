const dataElement=document.querySelector('#data');
const periods=JSON.parse(dataElement.textContent);
function rosterUrl(teamId){
  return dataElement.dataset.rosterBase+';teamId='+encodeURIComponent(teamId);
}
const period=document.querySelector('#period');
let bestFirst=true;
let sort=-1, production=false;
function renderTable(){
  const rows=[...periods[Number(period.value)]];
  const sortValue=t=>sort<0?t.rank:production?t.values[sort]:t.ranks[sort];
  const ascending=production && sort>=0 ? !bestFirst : bestFirst;
  rows.sort((a,b)=>{
    const left=sortValue(a), right=sortValue(b);
    if(left===null && right!==null)return 1;
    if(right===null && left!==null)return -1;
    return (ascending?1:-1)*(left-right)||a.name.localeCompare(b.name);
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
      if(r===null && (!production || t.values[i]===null)){cell.textContent='—';return;}
      if(r!==null)cell.className='tier'+Math.min(3,Math.floor((Math.ceil(r)-1)/3));
      const percent=i===0||i===2;
      cell.textContent=production?(percent?(100*t.values[i]).toFixed(2)+'%':t.values[i].toFixed(2)):r;
    });
  }
  const note=document.querySelector('#note');
  note.hidden=period.value!=='0' || !note.textContent.trim();
  for(const button of document.querySelectorAll('[data-sort]')){
    if(Number(button.dataset.sort)===sort)button.parentNode.setAttribute('aria-sort',ascending?'ascending':'descending');
    else button.parentNode.removeAttribute('aria-sort');
  }
  for(const id of ['rank','production'])document.getElementById(id).setAttribute('aria-pressed',String((id==='production')===production));
}
period.onchange=renderTable;
document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{const next=Number(b.dataset.sort);bestFirst=next===sort?!bestFirst:true;sort=next;renderTable()});
for(const id of ['rank','production'])document.getElementById(id).onclick=()=>{production=id==='production';renderTable()};
renderTable();

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
