import { startLocalDen } from '../dist/src/workforce/localDen.js';

let den;
try {
  const args = process.argv.slice(2), values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!['--db', '--port'].includes(key) || !args[index + 1] || Object.hasOwn(values, key)) throw new Error('LOCAL_ARGUMENT_INVALID');
    values[key] = args[index + 1];
  }
  if (!values['--db']) throw new Error('LOCAL_DB_PATH_REQUIRED');
  const port = values['--port'] === undefined ? 4185 : Number(values['--port']);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('LOCAL_PORT_INVALID');
  // No provider or delivery adapters. No credentials are read.
  globalThis.fetch = async () => { throw new Error('LOCAL_NETWORK_DENIED'); };
  den = await startLocalDen({ dbPath: values['--db'], port });
  console.log(`BINRAT local Den (synthetic replay only): ${den.url}`);
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; await den.close(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
} catch (error) {
  console.error(error instanceof Error && /^[A-Z][A-Z0-9_]{0,100}$/.test(error.message) ? error.message : 'LOCAL_DEN_START_FAILED');
  process.exitCode = 1;
}
