import { readFile } from 'node:fs/promises';
import { checkTokenPublication } from '../src/tokenLaunch/publication.js';

const path = process.argv[2];
if (!path) throw new Error('Usage: pnpm token:publication-check <surfaces.json>');
const input = JSON.parse(await readFile(path, 'utf8'));
const checks = checkTokenPublication(input);
process.stdout.write(`${JSON.stringify({ readOnly: true, checks, status: checks.every((item) => item.status === 'PASS') ? 'PASS' : 'BLOCKED' }, null, 2)}\n`);
process.exitCode = checks.every((item) => item.status === 'PASS') ? 0 : 1;
