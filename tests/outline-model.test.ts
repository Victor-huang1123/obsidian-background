import { describe, expect, it } from 'vitest';
import type { HeadingCache } from 'obsidian';
import { currentSection, headingLabel, outlineEntries } from '../src/outline-model';
const heading = (text: string, level: number, line: number): HeadingCache => ({ heading: text, level, position: { start: { line, col: 0, offset: 0 }, end: { line, col: text.length, offset: text.length } } });

describe('native chapter navigation', () => {
  it('keeps the existing bilingual template and omits only its redundant title', () => {
    const result = outlineEntries([heading('[[Simulated Annealing (模擬退火法)]]', 2, 0), heading('Introduction', 2, 3), heading('Core Concepts', 2, 10), heading('Acceptance probability', 3, 20)], 'Simulated Annealing (模擬退火法)');
    expect(result).toEqual([{label:'Introduction', line:3, depth:0}, {label:'Core Concepts', line:10, depth:0}, {label:'Acceptance probability', line:20, depth:1}]);
  });
  it('keeps a first heading that is a real section, even without a note title', () => {
    expect(outlineEntries([heading('Introduction', 2, 0)], 'Example')[0].label).toBe('Introduction');
  });
  it('uses human-readable labels for wiki aliases and inline links', () => {
    expect(headingLabel('**[[Method|方法]]** and [reference](https://example.com)')).toBe('方法 and reference');
  });
  it('preserves separate destinations for repeated headings', () => {
    const entries = outlineEntries([heading('Example', 2, 2), heading('Example', 2, 40)], 'Note');
    expect(entries.map(entry=>entry.line)).toEqual([2,40]);
    expect(currentSection(entries, 41)).toBe(1);
  });
  it('handles headings not yet reached, fractional scroll and an empty note', () => {
    const entries = outlineEntries([heading('Intro', 2, 4), heading('Core', 2, 14)], 'Note');
    expect(currentSection(entries, 0)).toBe(0);
    expect(currentSection(entries, 13.8)).toBe(1);
    expect(currentSection([], 10)).toBe(-1);
    expect(outlineEntries([], 'Empty')).toEqual([]);
  });
});
