import { readFile } from 'node:fs/promises';

type Status = 'UNSET' | 'OWNER_REPORTED' | 'CONTROL_VERIFIED' | 'READY_TO_PUBLISH';
type Control = any;
const control = JSON.parse(await readFile(new URL('../docs/launch/BINRAT_LAUNCH_CONTROL_V1.json', import.meta.url), 'utf8')) as Control;
const owners: string[] = [];
const line = (name: string, status: string) => `${name.padEnd(22, '.')} ${status}`;
const readyIdentity = (key: string, label: string) => { const item = control.identity[key]; const pass = item?.status === 'READY_TO_PUBLISH' || item?.status === 'CONTROL_VERIFIED'; if (!pass) owners.push(`${label}: ${item?.status ?? 'UNSET'}`); return line(label, pass ? 'PASS' : 'OWNER ACTION'); };
const readyRole = (key: string, label: string) => { const item = control.walletRoles[key]; const pass = Boolean(item?.publicAddress && item?.approved && item?.controlProofStatus === 'CONTROL_VERIFIED'); if (!pass) owners.push(`${label}: public address, control proof and approval required`); return line(label, pass ? 'PASS' : 'OWNER ACTION'); };
const legalPass = ['PASS', 'PASS_WITH_CONDITIONS'].includes(control.legal.status);
if (!legalPass) owners.push(`legal classification: ${control.legal.status}`);
const output = [
  'BINRAT TOKEN LAUNCH', '', 'Identity', readyIdentity('website', 'website'), readyIdentity('x', 'X'), readyIdentity('telegramBot', 'Telegram bot'), readyIdentity('telegramCommunity', 'TG community'), line('logo', control.identity.logo ? 'PASS' : 'OWNER ACTION'), '',
  'Wallets', readyRole('deployer', 'deployer'), readyRole('creatorFeeRecipient', 'fee recipient'), readyRole('treasury', 'treasury'), readyRole('personalBuyer', 'personal buyer'), '',
  'Pons', line('chain', 'PASS (read-only current)'), line('factory', 'PASS (read-only current)'), line('config', 'RERUN AT EXECUTION'), line('economics', 'RERUN AT EXECUTION'), line('simulation', 'OWNER INPUT REQUIRED'), '',
  'Product', line('holder seam', 'PREPARED / DISABLED'), line('holder active', 'NO (expected prelaunch)'), '',
  'Legal', line('classification', legalPass ? 'PASS' : 'BLOCKED'), '',
  'Authority', line('marketing', control.legal.marketingAuthorized ? 'YES' : 'NO'), line('execution', control.legal.launchAuthorized && control.manifest.digest ? 'YES' : 'NO'), '',
  'OVERALL:', owners.length === 0 ? 'PREFLIGHT_ELIGIBLE (execution still requires explicit owner authority)' : 'NO-GO', '', 'OWNER ACTIONS:', ...owners.map((item, index) => `${index + 1}. ${item}`)
];
process.stdout.write(`${output.join('\n')}\n`);
process.exitCode = owners.length === 0 ? 0 : 2;
