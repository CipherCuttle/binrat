import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const forbidden=[
  'web','web-v2','docs/design','docs/BRAND_ASSET.md','docs/WEB_V0.md',
  'docs/SHARE_CARDS_V0.md','docs/LAUNCH_PRESENTATION_V0.md',
  'docs/CODEPLAN.md','scripts/serve-web.mjs','scripts/check-web.mjs',
  'scripts/check-share-card.mjs','scripts/check-launch-presentation.mjs'
];
for(const path of forbidden)if(existsSync(resolve(root,path)))
  throw Error('FRONTEND_RESET_VIOLATION:'+path);
const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
if(Object.keys(pkg.scripts??{}).some(k=>k.startsWith('web:'))||
   Object.keys({...pkg.dependencies,...pkg.devDependencies}).some(k=>/react|vite/i.test(k)))
  throw Error('FRONTEND_RESET_PACKAGE_VIOLATION');
console.log('BACKEND_ONLY_MAIN_PASS: no frontend, visual lock or site build');
