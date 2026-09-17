import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const dataSource = readFileSync(new URL('../web/data-source.js', import.meta.url), 'utf8');
const shareCard = readFileSync(new URL('../web/share-card.js', import.meta.url), 'utf8');
const policy = readFileSync(new URL('../docs/PUBLIC_IDENTITY_ACQUISITION.md', import.meta.url), 'utf8');

for (const marker of [
  'custom domain: **NOT VERIFIED OWNED**',
  'X/social handle: **NOT VERIFIED OWNED**',
  'A public search result, RDAP 404, X 404, or other apparent-availability signal is **not ownership**.'
]) {
  if (!policy.includes(marker)) throw new Error(`PUBLIC_IDENTITY_POLICY_DRIFT:${marker}`);
}

// Until ownership is verified, browser-facing code is intentionally self-contained.
// This fails closed on links, redirects, or embedded remote identity URLs introduced
// through either HTML or JavaScript.
const browserCorpus = `${html}\n${app}\n${dataSource}\n${shareCard}`;
if (/https?:\/\//i.test(browserCorpus)) {
  throw new Error('PUBLIC_IDENTITY_ABSOLUTE_BROWSER_URL_PUBLISHED_BEFORE_OWNERSHIP');
}

if (/<link[^>]+rel=["']canonical["'][^>]*>/i.test(html)) {
  throw new Error('PUBLIC_IDENTITY_CANONICAL_URL_PUBLISHED_BEFORE_OWNERSHIP');
}

if (/<meta[^>]+property=["']og:url["'][^>]*>/i.test(html)) {
  throw new Error('PUBLIC_IDENTITY_OG_URL_PUBLISHED_BEFORE_OWNERSHIP');
}

if (/<meta[^>]+name=["']twitter:(?:site|creator)["'][^>]*>/i.test(html)) {
  throw new Error('PUBLIC_IDENTITY_SOCIAL_HANDLE_METADATA_PUBLISHED_BEFORE_OWNERSHIP');
}

const ownershipClaims = [
  'OFFICIAL X',
  'OFFICIAL DOMAIN',
  'DOMAIN SECURED',
  'HANDLE SECURED'
];
for (const claim of ownershipClaims) {
  if (html.toUpperCase().includes(claim)) throw new Error(`PUBLIC_IDENTITY_PREMATURE_OWNERSHIP_CLAIM:${claim}`);
}

console.log('BINRAT public identity acquisition boundary: PASS');
