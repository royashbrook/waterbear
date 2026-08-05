import { readFileSync } from 'node:fs';

const files = ['SKILL.md', 'README.md', 'scripts/waterbear-doctor', 'scripts/waterbear-install'];
const text = files.map((file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')).join('\n');
const stale = [
  "end this session so the two don't run in parallel",
  'archive the native desktop chat',
  'One archive click per card',
  'fix: ARCHIVE that chat',
  'REQUIRED step of a desktop-origin conversion',
];

for (const phrase of stale) {
  if (text.includes(phrase)) throw new Error(`stale takeover guidance returned: ${phrase}`);
}
for (const phrase of [
  'Installing from inside your own session starts the durable body immediately',
  'archiving the extra entry is optional cosmetics',
  'continue at the durable',
]) {
  if (!text.includes(phrase)) throw new Error(`missing current takeover guidance: ${phrase}`);
}

console.log('takeover guidance ok: start now + optional archive');
