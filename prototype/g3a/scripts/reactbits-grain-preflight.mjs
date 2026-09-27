import { createHash } from 'node:crypto';

// Read the licensed component only inside this authenticated GitHub Actions job.
// Never commit, upload or echo the registry response or license key.
const licenseKey = process.env.REACTBITS_LICENSE_KEY;
if (!licenseKey) {
  throw new Error('REACTBITS_LICENSE_KEY missing from the isolated workflow environment');
}
const registryUrl = 'https://pro.reactbits.dev/api/r/starter/grain-wave-css.json';
const response = await fetch(registryUrl, {
  headers: { Authorization: `Bearer ${licenseKey}`, Accept: 'application/json' }
});
if (!response.ok) {
  throw new Error(`React Bits Starter registry returned HTTP ${response.status}. Confirm key tier and secret availability.`);
}
const item = await response.json();
const manifest = {
  name: item.name,
  type: item.type,
  fileCount: item.files?.length,
  files: (item.files || []).map(f => ({
    basename: String(f.path || f.target || '').split('/').pop(),
    targetBasename: String(f.target || '').split('/').pop(),
    extension: String(f.path || '').split('.').pop(),
    bytes: f.content?.length ?? 0,
    sha256: createHash('sha256').update(String(f.content || '')).digest('hex')
  })),
  dependencies: item.dependencies || [],
  devDependencies: item.devDependencies || [],
  registryDependencies: item.registryDependencies || [],
  imports: [...new Set((item.files || []).flatMap(f =>
    [...String(f.content || '').matchAll(/from\\s+['"]([^'"./][^'"]*)['"]/g)].map(m => m[1])
  ))]
};
console.log('LICENSED_COMPONENT_METADATA=' + JSON.stringify(manifest));
