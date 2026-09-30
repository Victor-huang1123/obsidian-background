import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
await build({ entryPoints: ['src/main.ts'], bundle: true, external: ['obsidian'], format: 'cjs', target: 'es2018', outfile: 'main.js', logLevel: 'info' });
await writeFile('styles.css', (await Promise.all(['native.css', 'outline.css', 'modal.css'].map(path => readFile(path, 'utf8')))).join('\n'));
