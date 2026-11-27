import type { standings } from '../lib/rankings';

export type TeamRow = ReturnType<typeof standings>[number];
const source = document.querySelector<HTMLScriptElement>('#data')!;
export const periodNumbers: number[] = JSON.parse(source.dataset.weeks!);
export const [seasonRows, ...weeklyRows]: TeamRow[][] = JSON.parse(source.textContent!);
export const rowsByPeriod = new Map([[0, seasonRows], ...periodNumbers.map((week, i) => [week, weeklyRows[i]] as const)]);
export const rosterBase = source.dataset.rosterBase!;
