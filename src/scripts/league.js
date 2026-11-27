import { periodNumbers, rowsByPeriod, rosterBase } from './league-data';
import { renderSpread } from './category-spread';
import { showChartPeriod } from './weekly-chart';

function rosterUrl(teamId){
  return rosterBase+';teamId='+encodeURIComponent(teamId);
}
let currentPeriod=periodNumbers.at(-1);
let bestFirst=true;
let sort=-1, production=false;
function renderTable(){
  const rows=[...rowsByPeriod.get(currentPeriod)];
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
  for(const button of document.querySelectorAll('[data-sort]')){
    if(Number(button.dataset.sort)===sort)button.parentNode.setAttribute('aria-sort',ascending?'ascending':'descending');
    else button.parentNode.removeAttribute('aria-sort');
  }
  for(const id of ['rank','production'])document.getElementById(id).setAttribute('aria-pressed',String((id==='production')===production));
}
const pickers = document.querySelectorAll('.period-picker');
const periodOrder = [...periodNumbers, 0];
let lastWeek = currentPeriod;
function stepTo(direction) {
  return periodOrder[periodOrder.indexOf(currentPeriod) + direction];
}
function showPeriod(week) {
  if (!rowsByPeriod.has(week)) return;
  currentPeriod = week;
  if (week !== 0) lastWeek = week;
  for (const picker of pickers) {
    const shortcut = picker.querySelector('.season-shortcut');
    if (shortcut) shortcut.textContent = week === 0 ? 'Back to Week ' + lastWeek : 'Season to date';
    const select = picker.querySelector('select');
    select.value = String(week);
    picker.querySelector('.period-label').textContent = select.selectedOptions[0].text;
    for (const button of picker.querySelectorAll('[data-step]')) {
      const direction = Number(button.dataset.step);
      const next = stepTo(direction);
      button.disabled = next === undefined;
      const label = next === 0 ? 'Go to season to date' : week === 0 && direction < 0 ? 'Go to latest week' : direction > 0 ? 'Next week' : 'Previous week';
      button.setAttribute('aria-label', label);
      button.title = button.disabled ? '' : label;
    }
  }
  for (const note of document.querySelectorAll('#note, #spread-note'))
    note.hidden = week !== 0 || !note.textContent.trim();
  renderTable();
  renderSpread(rowsByPeriod.get(week));
  showChartPeriod(week);
}
for (const picker of pickers) {
  picker.querySelector('.season-shortcut')?.addEventListener('click', () => showPeriod(currentPeriod === 0 ? lastWeek : 0));
  const select = picker.querySelector('select');
  select.addEventListener('change', () => showPeriod(Number(select.value)));
  // Native selects can retain :focus-visible after a mouse or touch selection.
  select.addEventListener('pointerdown', () => select.setAttribute('data-pointer-focus', ''));
  const clearPointerFocus = () => select.removeAttribute('data-pointer-focus');
  select.addEventListener('keydown', clearPointerFocus);
  select.addEventListener('blur', clearPointerFocus);
  for (const button of picker.querySelectorAll('[data-step]'))
    button.addEventListener('click', () => showPeriod(stepTo(Number(button.dataset.step))));
}
document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{const next=Number(b.dataset.sort);bestFirst=next===sort?!bestFirst:true;sort=next;renderTable()});
for(const id of ['rank','production'])document.getElementById(id).onclick=()=>{production=id==='production';renderTable()};
showPeriod(currentPeriod);

const links = [...document.querySelectorAll('nav a[href]')].filter(link => link.hash !== '#top');
const sections = links.map(link => document.querySelector(link.hash));
function updateNavigation() {
  const atBottom = window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  const active = atBottom ? sections.at(-1) : sections.filter(section => section.getBoundingClientRect().top <= window.innerHeight * .4).at(-1) ?? sections[0];
  for (const link of links) {
    if (link.hash === '#' + active.id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}
window.addEventListener('scroll',updateNavigation,{passive:true});
window.addEventListener('resize',updateNavigation);
updateNavigation();
