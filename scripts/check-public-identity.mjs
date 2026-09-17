import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const policy = readFileSync(new URL('../docs/PUBLIC_IDENTITY_ACQUISITION.md', import.meta.url), 'utf8');

for (const marker of [
  'custom domain: **NOT VERIFIED OWNED**',
  'X/social handle: **NOT VERIFIED OWNED**',
  'A public search result, RDAP 404, X 404, or other apparent-availability signal is **not ownership**.'
]) {
  if (!policy.includes(marker)) throw new Error(`PUBLIC_IDENTITY_POLICY_DRIFT:${marker}`);
}

if (/href=["']https:\/\/(?:www\.)?x\.com\//i.test(html)) {
  throw new Error('PUBLIC_IDENTITY_X_LINK_PUBLISHED_BEFORE_OWNERSHIP');
}

if (/<link[^>]+rel=["']canonical["'][^>]*>/i.test(html)) {
  throw new Error('PUBLIC_IDENTITY_CANONICAL_URL_PUBLISHED_BEFORE_OWNERSHIP');
}

if (/<meta[^>]+property=["']og:url["'][^>]*>/i.test(html)) {
  throw new Error('PUBLIC_IDENTITY_OG_URL_PUBLISHED_BEFORE_OWNERSHIP');
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
