import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const html=fs.readFileSync(new URL('index.html',root),'utf8');
const js=fs.readFileSync(new URL('review.js',root),'utf8');
const css=fs.readFileSync(new URL('review.css',root),'utf8');
const catalog=JSON.parse(fs.readFileSync(new URL('versions.json',root),'utf8'));
const embedded=JSON.parse(html.match(/<script id="catalog" type="application\/json">([\s\S]*?)<\/script>/)?.[1]||'[]');
test('exact 21 pinned snapshots with one feedback route each',()=>{
 assert.equal(catalog.length,21);
 assert.deepEqual(embedded,catalog);
 assert.equal(new Set(catalog.map(v=>v.id)).size,catalog.length);
 assert.equal(new Set(catalog.map(v=>v.url)).size,catalog.length);
 for(const v of catalog){
  assert.match(v.sha,/^[0-9a-f]{40}$/);
  assert.match(v.url,/^https:\/\/raw\.githack\.com\/CipherCuttle\/binrat\/[0-9a-f]{40}\//);
  assert.equal(v.url,'https://raw.githack.com/CipherCuttle/binrat/'+v.sha+'/'+v.path);
  assert.ok(Number.isInteger(v.pr));
 }
});
test('standalone UI syntax and explicit, local-first evidence flow',()=>{
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.match(js,/binrat\.design-feedback\.v1/);
 assert.match(js,/localStorage\.setItem/);
 assert.match(js,/allow-scripts allow-forms allow-popups/);
 assert.match(js,/Blob\(/);
 assert.match(js,/github\.com\/CipherCuttle\/binrat\/issues\/new/);
 assert.doesNotMatch(js,/fetch\(|sendBeacon\(|REACTBITS_LICENSE_KEY/);
 assert.match(html,/Blank scores are not interpreted as neutral/);
 assert.match(css,/@media\(max-width:420px\)/);
 assert.ok(catalog.find(v=>v.id==='g6a').flags.includes('art missing'));
 assert.ok(catalog.find(v=>v.id==='r5').flags.includes('superseded motion'));
});
