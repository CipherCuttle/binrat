import { readFileSync } from 'node:fs';
import { replay, scoreReplay } from '../dist/src/workforce/offline.js';

// Run from the repository root after pnpm build. No external adapters are loaded.
const fixture = JSON.parse(readFileSync('test/fixtures/workforce/sniffer-funding-to-pons-v1.json', 'utf8'));
const receipt = await replay(fixture);
const gates = await scoreReplay(fixture, receipt);
console.log(JSON.stringify({ evalId: fixture.evalId, receipt, gates }, null, 2));
if (!Object.values(gates).every(Boolean)) process.exitCode = 1;
