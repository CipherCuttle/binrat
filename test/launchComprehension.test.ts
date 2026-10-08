import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderLegacyAutonomousOutcome } from '../src/autonomous/telegram.js';
import { HOME_INTRO, HOME_WATCH_NOTE } from '../src/autonomous/homeCopy.js';
import { renderRatCard } from '../src/telegram/ui/cards.js';
import { makeRatAnswerPlan, renderRatVoice } from '../src/telegram/voice.js';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const frontdoor = readFileSync(new URL('../web/frontdoor.js', import.meta.url), 'utf8');
const FUTURE_AS_CURRENT = /\b(buy|sell|stake to employ|get in early|earn apy|working rat live|employing tripwire|you employed)\b/i;

function helpText(): string {
  const reply = renderRatVoice(makeRatAnswerPlan('HELP', 'DIGGING', {} as never));
  return typeof reply === 'string' ? reply : JSON.stringify(reply);
}

test('UI V2 home labels discovery FRESH FINDS and never calls a discovery candidate a Rat', () => {
  const card = renderRatCard({ kind: 'HOME' });
  const labels = card.keyboard.flat().map((button) => button.text);
  assert.deepEqual(labels, ['FRESH FINDS', 'DIG', 'MY WATCHES']);
  assert.doesNotMatch(`${card.caption}\n${labels.join('\n')}`, /fresh rats/i);
  assert.doesNotMatch(card.caption, FUTURE_AS_CURRENT);
});

test('current Watch is never presented as Tripwire employment; Tripwire stays future', () => {
  const home = renderRatCard({ kind: 'HOME' }).caption;
  assert.match(home, /Where enabled, Watch alerts you/);
  assert.match(home, /Watch is not Tripwire/);
  assert.match(home, /Tripwire is a future Rat, still being built/);
  assert.doesNotMatch(home, /employ/i);
  assert.match(helpText(), /not Tripwire employment/);
});

test('legacy text home and UI V2 home teach the same product (shared intro and Watch note)', () => {
  const legacy = renderLegacyAutonomousOutcome({ kind: 'HOME' });
  const card = renderRatCard({ kind: 'HOME' }).caption;
  for (const shared of [HOME_INTRO, HOME_WATCH_NOTE]) {
    assert.ok(legacy.includes(shared), 'legacy home drifted from shared copy');
    assert.ok(card.includes(shared), 'card home drifted from shared copy');
  }
  assert.match(legacy, /\/rats — fresh finds/);
  assert.doesNotMatch(legacy, /fresh rats/i);
});

test('HELP leads with the same story and names /rats as fresh finds', () => {
  const help = helpText();
  assert.match(help, /Rat Zero is BINRAT's current Scout/);
  assert.match(help, /\/rats — fresh finds/);
  assert.match(help, /Other Rats are not ready yet/);
  assert.doesNotMatch(help, /fresh rats/i);
});

test('web: Rat Zero is the only actionable Rat; Den is not primary navigation; no Fresh Rats collision', () => {
  const nav = html.match(/<nav aria-label="(?:Primary|Mobile primary)">[\s\S]*?<\/nav>/g) ?? [];
  assert.equal(nav.length, 2);
  for (const block of nav) assert.doesNotMatch(block, /#den/);
  assert.doesNotMatch(html, /fresh rats/i);
  assert.match(html, /Only Rat Zero is open for use, and only while its status above says LIVE/);
  assert.match(html, /Tripwire is being built and Sniffer is still being proven/);
  assert.match(html, /Watch is not Tripwire/);
  const hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="fresh-proof"'));
  assert.doesNotMatch(hero, /future product direction|employ|staking/i);
  assert.doesNotMatch(html, FUTURE_AS_CURRENT);
});

test('web: page-loading is CHECKING, canonical failure remains UNVERIFIED', () => {
  assert.doesNotMatch(html, /data-product-status="[a-z-]+"[^>]*>UNVERIFIED</);
  assert.match(html, /data-product-status="rat-zero">CHECKING</);
  assert.match(frontdoor, /projectionSettled \? \(productRat\(id\)\?\.status \?\? "UNVERIFIED"\) : "CHECKING"/);
});
