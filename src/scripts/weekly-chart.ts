import { categories } from '../lib/fantrax';
import type { standings } from '../lib/rankings';

type Row = ReturnType<typeof standings>[number];
type Point = { row: Row; week: number; rank: number; value: number; x: number; y: number };
type Scale = 'rank' | 'value';

const chart = document.querySelector<SVGSVGElement>('#chart')!;
const tip = document.querySelector<HTMLElement>('#point-tip')!;
const weeks: Row[][] = JSON.parse(document.querySelector('#data')!.textContent!).slice(1);
const periods: number[] = JSON.parse(chart.dataset.weeks!);
const teams = [...weeks[0]].sort((a, b) => a.id.localeCompare(b.id));
const colors = ['#2659a5', '#bc4527', '#007b68', '#8549a2', '#946500', '#b03368', '#13769c',
  '#596c24', '#6a55bd', '#87543c', '#236241', '#4e657c'];
const plot = { left: 54, right: 735, top: 31, bottom: 348 };
let metric = -1;
let scale: Scale = 'rank';
let pinned: string | null = null;
let points: Point[] = [];
let leaders: number[] = [];
let visiblePoint: Point | null = null;
let highlighted: string | null | undefined;
let lastPinned: string | null = null;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>,
  parent: SVGElement = chart, text?: string) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  parent.append(element);
  return element;
}

function shooting() { return categories[metric]?.endsWith('%') ?? false; }
function unit() { return metric < 0 ? 'roto points' : shooting() ? categories[metric] : categories[metric] + ' per player-game'; }
function amount(value: number) {
  if (shooting()) return value.toFixed(2) + '%';
  return metric < 0 ? String(value) : value.toFixed(2);
}
function valueOf(row: Row) {
  const value = metric < 0 ? row.score : row.values[metric];
  return value === null ? null : value * (shooting() ? 100 : 1);
}

function ticksFor(values: number[]) {
  if (scale === 'rank') return Array.from({ length: teams.length }, (_, i) => i + 1);
  if (!values.length) return [];
  const low = Math.min(...values), high = Math.max(...values);
  const roughStep = (high - low || Math.max(Math.abs(high) * .1, 1)) / 5;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = ([1, 2, 5, 10].find(n => n * magnitude >= roughStep) ?? 10) * magnitude;
  let start = Math.max(0, Math.floor(low / step));
  let end = Math.ceil(high / step);
  if (start === end) { start = Math.max(0, start - 1); end++; }
  const ticks = Array.from({ length: end - start + 1 }, (_, i) => Number(((start + i) * step).toPrecision(12)));
  return shooting() ? ticks.filter(n => n <= 100) : ticks;
}

function highlight(id: string | null) {
  if (id === highlighted && pinned === lastPinned) return;
  highlighted = id;
  lastPinned = pinned;
  for (const group of chart.querySelectorAll<SVGGElement>('[data-team]')) {
    group.classList.toggle('muted', !!id && group.dataset.team !== id);
    group.classList.toggle('highlighted', group.dataset.team === id);
    group.setAttribute('aria-pressed', String(group.dataset.team === pinned));
  }
}

function hideTip() {
  if (!visiblePoint) return;
  visiblePoint = null;
  tip.hidden = true;
  chart.querySelector('[aria-describedby]')?.removeAttribute('aria-describedby');
}

function showTip(point: Point) {
  if (point === visiblePoint) return;
  hideTip();
  visiblePoint = point;
  const label = document.createElement('strong');
  label.textContent = point.row.name;
  const context = document.createElement('div');
  context.textContent = 'Week ' + periods[point.week] + ' · Rank ' + point.rank;
  const value = document.createElement('div');
  const description = shooting() ? (categories[metric] === 'FG%' ? 'from the field' : 'at the line') : unit();
  value.textContent = amount(point.value) + ' ' + description;
  const gap = leaders[point.week] - point.value;
  if (gap > 0) {
    const difference = metric < 0 ? String(gap) : gap < .005 ? '<0.01' : gap.toFixed(2);
    value.append(' · ' + difference + (shooting() ? ' pp' : '') + ' behind first');
  } else {
    value.append(point.rank === 1 ? ' · Week leader' : ' · Tied for first');
  }
  tip.replaceChildren(label, context, value);
  tip.hidden = false;
  const matrix = chart.getScreenCTM()!;
  const anchor = new DOMPoint(point.x, point.y).matrixTransform(matrix);
  const bounds = tip.getBoundingClientRect();
  const left = Math.min(window.innerWidth - bounds.width - 8, Math.max(8, anchor.x - bounds.width / 2));
  const above = anchor.y - bounds.height - 10;
  tip.style.left = Math.max(8, left) + 'px';
  tip.style.top = (above >= 8 ? above : anchor.y + 10) + 'px';
  chart.querySelector('[data-team="' + CSS.escape(point.row.id) + '"]')?.setAttribute('aria-describedby', tip.id);
}

function draw() {
  hideTip();
  chart.replaceChildren();
  highlighted = undefined;
  points = [];
  const weeklyValues = weeks.map(week => week.map(valueOf).filter((v): v is number => v !== null));
  leaders = weeklyValues.map(values => Math.max(...values));
  const ticks = ticksFor(weeklyValues.flat());
  const axis = scale === 'rank' ? 'Rank' : unit();
  chart.setAttribute('aria-label', 'Weekly ' + (categories[metric] ?? 'overall') + ' · ' + axis);
  svg('text', { x: plot.left, y: 13, class: 'axis-caption' }, chart, axis[0].toUpperCase() + axis.slice(1));
  if (!ticks.length) {
    svg('text', { x: plot.left, y: 80 }, chart, 'No weekly values available.');
    return;
  }
  const first = ticks[0], last = ticks[ticks.length - 1];
  const y = (v: number) => plot.top + (plot.bottom - plot.top) * (scale === 'rank' ? v - first : last - v) / (last - first || 1);
  const x = (i: number) => weeks.length === 1 ? plot.right : plot.left + (plot.right - plot.left) * i / (weeks.length - 1);
  for (const tick of ticks) {
    svg('line', { x1: plot.left, x2: plot.right, y1: y(tick), y2: y(tick), stroke: '#e8e8e8' });
    svg('text', { x: plot.left - 12, y: y(tick) + 4, 'text-anchor': 'end', class: 'axis-label' },
      chart, String(tick) + (scale === 'value' && shooting() ? '%' : ''));
  }
  periods.forEach((week, i) => {
    if (i % Math.ceil(periods.length / 12) === 0 || i === periods.length - 1)
      svg('text', { x: x(i), y: 375, 'text-anchor': 'middle', class: 'axis-label' }, chart, 'W' + week);
  });

  const endpoints: { group: SVGGElement; point: Point; labelY: number; color: string }[] = [];
  teams.forEach((team, index) => {
    const color = colors[index];
    const group = svg('g', { 'data-team': team.id, tabindex: 0, role: 'button', 'aria-label': team.name,
      'aria-pressed': String(pinned === team.id) });
    const teamPoints: Point[] = [];
    let path = '';
    let previousPeriod: number | null = null;
    weeks.forEach((week, i) => {
      const row = week.find(row => row.id === team.id);
      if (!row) return;
      const rank = metric < 0 ? row.rank : row.ranks[metric];
      const value = valueOf(row);
      if (rank === null || value === null) return;
      const point = { row, week: i, rank, value, x: x(i), y: y(scale === 'rank' ? rank : value) };
      path += (previousPeriod === periods[i] - 1 ? ' L' : ' M') + point.x + ' ' + point.y;
      previousPeriod = periods[i];
      teamPoints.push(point);
      if (i === weeks.length - 1) endpoints.push({ group, point, labelY: point.y, color });
    });
    points.push(...teamPoints);
    svg('path', { d: path, fill: 'none', stroke: 'transparent', 'stroke-width': 10 }, group);
    svg('path', { d: path, fill: 'none', stroke: color, 'stroke-width': 2, class: 'trajectory' }, group);
    for (const point of teamPoints) {
      svg('circle', { cx: point.x, cy: point.y, r: 3, fill: color, 'data-week': periods[point.week] }, group);
    }
    group.addEventListener('focus', () => highlight(pinned ?? team.id));
    group.addEventListener('blur', () => { hideTip(); highlight(pinned); });
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleTeam(team.id);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const current = visiblePoint ? teamPoints.indexOf(visiblePoint) : -1;
        const next = current < 0 ? teamPoints.length - 1 : current + (event.key === 'ArrowRight' ? 1 : -1);
        const point = teamPoints[Math.max(0, Math.min(teamPoints.length - 1, next))];
        if (point) showTip(point);
      }
    });
  });
  endpoints.sort((a, b) => a.point.y - b.point.y || a.point.row.name.localeCompare(b.point.row.name));
  let floor = plot.top;
  for (const endpoint of endpoints) {
    endpoint.labelY = Math.max(floor, endpoint.point.y);
    floor = endpoint.labelY + 18;
  }
  let ceiling = plot.bottom;
  for (const endpoint of endpoints.reverse()) {
    const { group, point, color } = endpoint;
    const labelY = Math.min(endpoint.labelY, ceiling);
    ceiling = labelY - 18;
    svg('line', { x1: point.x + 4, x2: plot.right + 23, y1: point.y, y2: labelY, stroke: color, opacity: .55 }, group);
    svg('text', { x: plot.right + 28, y: labelY + 4, fill: color, class: 'endpoint' }, group,
      (scale === 'rank' ? point.rank : amount(point.value)) + '  ' + point.row.name);
  }
  highlight(pinned);
}

function targetTeam(event: Event) {
  return (event.target as Element).closest<SVGGElement>('[data-team]')?.dataset.team ?? null;
}

function nearPoint(event: MouseEvent) {
  const matrix = chart.getScreenCTM();
  if (!matrix) return null;
  const cursor = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  const radius = 7 / matrix.a;
  const target = targetTeam(event);
  let nearest: Point | null = null;
  let distance = radius;
  for (const point of points) {
    const d = Math.hypot(point.x - cursor.x, point.y - cursor.y);
    // When marks coincide, prefer the pinned team, then the line under the cursor.
    if (d < distance || (d === distance && (point.row.id === pinned || (nearest?.row.id !== pinned && point.row.id === target)))) {
      nearest = point;
      distance = d;
    }
  }
  return nearest;
}

function toggleTeam(id: string) {
  pinned = pinned === id ? null : id;
  highlight(pinned);
}
chart.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch') return;
  const point = nearPoint(event);
  highlight(pinned ?? point?.row.id ?? targetTeam(event));
  if (point) showTip(point); else hideTip();
});
chart.addEventListener('pointerleave', () => { hideTip(); highlight(pinned); });
chart.addEventListener('click', event => {
  const point = nearPoint(event);
  const id = point?.row.id ?? targetTeam(event);
  if (id) toggleTeam(id);
  if (point) showTip(point); else hideTip();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && (chart.contains(document.activeElement) || visiblePoint)) {
    pinned = null;
    hideTip();
    highlight(null);
  }
});
window.addEventListener('scroll', hideTip, { capture: true, passive: true });
window.addEventListener('resize', hideTip);
for (const button of document.querySelectorAll<HTMLButtonElement>('.chart-controls button')) {
  button.addEventListener('click', () => {
    if (button.dataset.metric !== undefined) metric = Number(button.dataset.metric);
    else scale = button.dataset.scale as Scale;
    for (const sibling of button.parentElement!.querySelectorAll('button'))
      sibling.setAttribute('aria-pressed', String(sibling === button));
    draw();
  });
}
draw();
