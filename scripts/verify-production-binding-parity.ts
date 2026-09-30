import { execFileSync } from 'node:child_process';
import { readFileSync as readFile } from 'node:fs';
import { verifyCandidateManifest, verifyWorkerBindingParity } from '../src/cloudflare/deploymentBindingParity.js';

const args = process.argv.slice(2);
const worker = argument('--worker');
const activeVersion = argument('--active-version');
const candidateVersion = argument('--candidate-version');
const configPath = argument('--config');
const controlledRatActivation = args.includes('--controlled-rat-activation');
const controlledTelegramUiV2Activation = args.includes('--controlled-telegram-ui-v2-activation');
if (controlledRatActivation && controlledTelegramUiV2Activation) {
  throw new Error('CONTROLLED_ACTIVATION_MODE_AMBIGUOUS');
}
if (!worker || !activeVersion || !candidateVersion || !configPath) {
  throw new Error('USAGE: --worker <name> --active-version <id> --candidate-version <id> --config <path> [--controlled-rat-activation|--controlled-telegram-ui-v2-activation]');
}

const active = version(worker, activeVersion);
const candidate = version(worker, candidateVersion);
const options = { controlledRatActivation, controlledTelegramUiV2Activation };
const manifest = verifyCandidateManifest(JSON.parse(readFile(configPath, 'utf8')), options);
const parity = verifyWorkerBindingParity(active, candidate, options);
const errors = [...manifest.errors, ...parity.errors];
if (errors.length > 0) throw new Error(`BINDING_PARITY_FAILED:${errors.join(',')}`);
console.log(JSON.stringify({ status: 'BINDING_PARITY_PASS', worker, activeVersion, candidateVersion, controlledRatActivation, controlledTelegramUiV2Activation }));

function version(name: string, id: string): unknown {
  const output = execFileSync('pnpm', ['dlx', 'wrangler@4.135.0', 'versions', 'view', id, '--name', name, '--json'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  });
  return JSON.parse(output);
}
function argument(name: string): string | null {
  const index = args.indexOf(name);
  return index >= 0 && typeof args[index + 1] === 'string' ? args[index + 1]! : null;
}
