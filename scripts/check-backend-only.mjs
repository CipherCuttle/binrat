import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const forbidden=[
  'web','web-v2','docs/design','docs/BRAND_ASSET.md',
  'docs/SHARE_CARDS_V0.md','docs/PREVIEW_INFRASTRUCTURE.md',
  '.github/workflows/binrat-githack-preview.yml',
  'cloudflare/wrangler.journey-preview.jsonc',
  'scripts/deploy-cloudflare-web-assets.py','scripts/serve-web.mjs',
  'scripts/publish-githack-static.mjs','src/preview','src/ponsPreview'
];
for(const name of forbidden) {
  if(existsSync(resolve(root,name))) throw Error('BACKEND_ONLY_FRONTEND_REMAINING:'+name);
}
const files=[
  ['package.json',/web:serve|web:check|vite|react/i],
  ['pnpm-workspace.yaml',/web-v2/],
  ['pnpm-lock.yaml',/web-v2:|react@|vite@|@vitejs\/|rolldown@/],
  ['cloudflare/wrangler.example.jsonc',/"assets"\s*:/],
  ['.github/workflows/ci.yml',/web-v2|browser-smoke|playwright|githack/i],
  ['src/server.ts',/webRoot|createReadStream|\.html'|\.css'/],
  ['AGENTS.md',/docs\/design\/BENTO_DASHBOARD_V1|only.*visual.*direction/i],
  ['docs/ROADMAP_V0.md',/docs\/design\/BENTO_DASHBOARD_V1/i]
];
for(const [name,pattern] of files) {
  const content=readFileSync(resolve(root,name),'utf8');
  if(pattern.test(content)) throw Error('BACKEND_ONLY_FORBIDDEN_REFERENCE:'+name);
}
const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
for(const dependency of Object.keys({...pkg.dependencies,...pkg.devDependencies})) {
  if(/react|vite/i.test(dependency)) throw Error('BACKEND_ONLY_FRONTEND_DEPENDENCY:'+dependency);
}
console.log('BINRAT_BACKEND_ONLY_TREE_PASS: no web app, design lock, preview publisher or static binding');
