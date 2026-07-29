// The version lives in exactly one place: package.json. Everything else that
// states a version must agree with it, and this check is what makes that a rule
// instead of a hope.
//
// Why it matters: the version is the update signal. SKILL.md's frontmatter is
// what non-npm consumers (agents reading the skill from a clone or a skills dir)
// see; package.json is what npm consumers see. If they drift, two audiences hold
// two different beliefs about whether they are current, and both are sure they
// are right. Publishing with a stale SKILL.md version is precisely the failure
// nobody notices until it has already shipped.
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const skill = readFileSync(new URL('../SKILL.md', import.meta.url), 'utf8');

const m = skill.match(/^version:\s*(\S+)\s*$/m);
if (!m) {
  console.error('SKILL.md frontmatter has no version: line. add one matching package.json.');
  process.exit(1);
}
if (m[1] !== pkg.version) {
  console.error(`version mismatch: package.json says ${pkg.version}, SKILL.md says ${m[1]}.`);
  console.error('package.json is the source of truth; update SKILL.md to match.');
  process.exit(1);
}
console.log(`version ok: ${pkg.version}`);
