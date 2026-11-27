import { categories } from '../lib/fantrax';
import { quartiles, stackDots } from '../lib/distribution';
import type { TeamRow } from './league-data';

type Mark = { team: string; name: string; value: number; button: HTMLButtonElement };
const root = document.querySelector<HTMLElement>('#distributions')!;
const tip = document.querySelector<HTMLElement>('#spread-tip')!;
const rows = Array.from(root.querySelectorAll<HTMLElement>('.spread-row'), element => ({
  element, category: element.dataset.category!,
  track: element.querySelector<HTMLElement>('.spread-track')!,
  range: element.querySelector<HTMLElement>('.spread-range')!,
  middle: element.querySelector<HTMLElement>('.spread-middle')!,
  marks: [] as Mark[],
  stats: null as ReturnType<typeof quartiles>,
}));
let pinned: string | null = null;
let inspected: HTMLButtonElement | null = null;

function formatted(value: number, category: string) {
  if (category === 'GP') return String(value);
  return category.endsWith('%') ? (value * 100).toFixed(2) + '%' : value.toFixed(2);
}

function layout() {
  for (const { track, marks, stats } of rows) {
    if (!stats) continue;
    const width = Math.max(0, track.clientWidth - 20);
    const x = (value: number) => 10 + width * (stats.high === stats.low ? .5 : (value - stats.low) / (stats.high - stats.low));
    const positions = marks.map(mark => x(mark.value));
    const lanes = stackDots(positions, 15);
    const baseline = 12 - Math.min(...lanes);
    track.style.height = (baseline + Math.max(...lanes) + 12) + 'px';
    track.style.setProperty('--baseline', baseline + 'px');
    track.style.setProperty('--q1', x(stats.q1) + 'px');
    track.style.setProperty('--band-width', (x(stats.q3) - x(stats.q1)) + 'px');
    track.style.setProperty('--median', x(stats.median) + 'px');
    marks.forEach(({ button }, i) => {
      button.style.left = positions[i] + 'px';
      button.style.top = (baseline + lanes[i]) + 'px';
    });
  }
}

function highlight(team: string | null) {
  for (const { marks } of rows) {
    for (const mark of marks) {
      mark.button.classList.toggle('traced', mark.team === team);
      mark.button.setAttribute('aria-pressed', String(mark.team === pinned));
    }
  }
}

function dismiss() {
  inspected?.removeAttribute('aria-describedby');
  inspected = null;
  tip.hidden = true;
  highlight(pinned);
}

function inspect(button: HTMLButtonElement) {
  if (inspected !== button) inspected?.removeAttribute('aria-describedby');
  inspected = button;
  highlight(button.dataset.team!);
  const name = document.createElement('strong');
  name.textContent = button.dataset.name!;
  const value = document.createElement('div');
  value.textContent = button.dataset.detail!;
  tip.replaceChildren(name, value);
  tip.hidden = false;
  button.setAttribute('aria-describedby', tip.id);
  const box = button.getBoundingClientRect();
  const left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, box.left + box.width / 2 - tip.offsetWidth / 2));
  const above = box.top - tip.offsetHeight - 4;
  tip.style.left = left + 'px';
  tip.style.top = (above >= 45 ? above : box.bottom + 4) + 'px';
}

export function renderSpread(teams: TeamRow[]) {
  dismiss();
  rows.forEach(row => {
    const { element, track, range, middle, category } = row;
    row.marks.forEach(mark => mark.button.remove());
    row.marks = [];
    const gamesPlayed = category === 'GP';
    const categoryIndex = categories.findIndex(name => name === category);
    const sorted = teams.flatMap(team => {
      const value = gamesPlayed ? team.gp : team.values[categoryIndex];
      return value === null ? [] : [{ team: team.id, name: team.name, value }];
    }).sort((a, b) => a.value - b.value || a.team.localeCompare(b.team));
    const stats = row.stats = quartiles(sorted.map(mark => mark.value));
    element.classList.toggle('empty', !stats);
    const percent = category.endsWith('%');
    middle.textContent = stats ? formatted(stats.median, category) : '—';
    range.firstElementChild!.textContent = stats ? formatted(stats.low, category) : 'No data';
    range.lastElementChild!.textContent = stats ? formatted(stats.high, category) : '';
    if (!stats) return;
    const unit = gamesPlayed ? 'games played' : percent ? category : category + ' per player-game';
    const fragment = document.createDocumentFragment();
    row.marks = sorted.map((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'spread-dot';
      button.dataset.team = item.team;
      button.dataset.name = item.name;
      const diff = (item.value - stats.median) * (percent ? 100 : 1);
      const gap = gamesPlayed ? String(Math.abs(diff)) : Math.abs(diff) < .005 ? '<0.01' : Math.abs(diff).toFixed(2);
      const delta = diff === 0 ? 'At the median' : gap + (percent ? ' pp' : '') + (diff > 0 ? ' above median' : ' below median');
      const detail = formatted(item.value, category) + ' ' + unit + ' · ' + delta;
      button.dataset.detail = detail;
      button.setAttribute('aria-label', item.name + ', ' + detail);
      button.tabIndex = index === Math.floor((sorted.length - 1) / 2) ? 0 : -1;
      fragment.append(button);
      return { ...item, button };
    });
    track.append(fragment);
  });
  layout();
  highlight(pinned);
}

function dot(event: Event) {
  return (event.target as Element).closest<HTMLButtonElement>('.spread-dot');
}
root.addEventListener('pointerover', event => {
  const button = dot(event);
  if (button && event.pointerType !== 'touch') inspect(button);
});
root.addEventListener('pointerout', event => {
  if (dot(event) && event.pointerType !== 'touch') dismiss();
});
root.addEventListener('focusin', event => {
  const button = dot(event);
  if (button) inspect(button);
});
root.addEventListener('focusout', dismiss);
root.addEventListener('click', event => {
  const button = dot(event);
  if (!button) return;
  pinned = pinned === button.dataset.team ? null : button.dataset.team!;
  if (pinned) inspect(button); else dismiss();
});
root.addEventListener('keydown', event => {
  const button = dot(event);
  if (event.key === 'Escape') { pinned = null; dismiss(); return; }
  if (!button || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const siblings = Array.from(button.parentElement!.querySelectorAll<HTMLButtonElement>('.spread-dot'));
  const index = siblings.indexOf(button) + (event.key === 'ArrowRight' ? 1 : -1);
  const next = event.key === 'Home' ? siblings[0] : event.key === 'End' ? siblings.at(-1)! : siblings[Math.max(0, Math.min(index, siblings.length - 1))];
  siblings.forEach(sibling => { sibling.tabIndex = sibling === next ? 0 : -1; });
  next.focus();
});
let measuredWidth = 0;
new ResizeObserver(([entry]) => {
  if (entry.contentRect.width === measuredWidth) return;
  measuredWidth = entry.contentRect.width;
  layout();
  if (inspected) inspect(inspected);
}).observe(root);
window.addEventListener('scroll', () => { if (inspected) dismiss(); }, { capture: true, passive: true });
document.addEventListener('pointerdown', event => {
  if (inspected && !dot(event)) dismiss();
});
