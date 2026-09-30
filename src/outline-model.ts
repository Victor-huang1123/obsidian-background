import type { HeadingCache } from 'obsidian';

export interface OutlineEntry { label: string; line: number; depth: number; }

export function headingLabel(value: string): string {
  return value.replace(/!?\[\[([^\]]+)\]\]/g, (_match, link: string) => {
    const parts = link.split('|'); return parts[parts.length - 1];
  }).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim();
}

export function outlineEntries(headings: HeadingCache[], basename: string): OutlineEntry[] {
  const sections = headings.filter((heading, i) => !(i === 0 && headingLabel(heading.heading) === basename));
  const baseLevel = Math.min(...sections.map(heading => heading.level));
  return sections.map(heading => ({ label: headingLabel(heading.heading), line: heading.position.start.line, depth: heading.level - baseLevel }));
}

export function currentSection(entries: OutlineEntry[], line: number): number {
  let active = entries.length ? 0 : -1;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].line > line + 0.25) break;
    active = i;
  }
  return active;
}
