// The version is DERIVED, not stored: major.minor come from the latest git tag and
// the patch is the commit count since it, so `v1.1` plus 4 commits publishes as
// 1.1.4. Release CI computes that and stamps it into package.json before
// publishing, and nothing is committed back.
//
// SKILL.md deliberately has no version key: current skill frontmatter rejects it.
// This check protects both sides of that boundary.
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const skill = readFileSync(new URL('../SKILL.md', import.meta.url), 'utf8');

if (!pkg.version) {
  console.error('package.json has no version field.');
  process.exit(1);
}

if (/^version:\s*/m.test(skill)) {
  console.error('SKILL.md frontmatter must not contain version; the skill schema rejects it.');
  process.exit(1);
}

console.log(`version boundary ok: npm ${pkg.version}, skill unversioned`);
