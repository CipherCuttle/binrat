import { readFileSync } from 'node:fs';
import { LocalRatJobs } from '../dist/src/workforce/localJob.js';

// This CLI has no network or delivery adapters; accidental fetches fail closed.
globalThis.fetch = async () => { throw new Error('LOCAL_NETWORK_DENIED'); };
let store;
try {
  const [command, ...rest] = process.argv.slice(2);
  const allowed = {
    create: ['db', 'fixture'], advance: ['db', 'job-id', 'through-block'],
    inspect: ['db', 'job-id'], cancel: ['db', 'job-id'], export: ['db', 'job-id']
  };
  if (!Object.hasOwn(allowed, command)) throw new Error('LOCAL_COMMAND_INVALID');
  const args = {};
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index]?.slice(2), value = rest[index + 1];
    if (!rest[index]?.startsWith('--') || !allowed[command].includes(name) || !value || value.startsWith('--') || Object.hasOwn(args, name)) {
      throw new Error('LOCAL_ARGUMENT_INVALID');
    }
    args[name] = value;
  }
  if (allowed[command].some(name => !args[name])) throw new Error('LOCAL_ARGUMENT_REQUIRED');
  store = new LocalRatJobs(args.db, { create: command === 'create', readOnly: command === 'inspect' || command === 'export' });
  const result = command === 'create' ? await store.create(JSON.parse(readFileSync(args.fixture, 'utf8'))) :
    command === 'advance' ? await store.advance(args['job-id'], args['through-block']) :
    command === 'cancel' ? await store.cancel(args['job-id']) :
    command === 'export' ? store.exportEvidence(args['job-id']) : await store.inspect(args['job-id']);
  console.log(JSON.stringify(result, null, 2));
  if (result?.phase === 'HALTED') process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ error: error instanceof Error && /^[A-Z][A-Z0-9_]{0,100}$/.test(error.message)
    ? error.message : 'LOCAL_COMMAND_FAILED', evidencePreserved: true }));
  process.exitCode = 1;
} finally { store?.close(); }
