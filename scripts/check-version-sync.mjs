// The version is DERIVED, not stored: major.minor come from the latest git tag and
// the patch is the commit count since it, so `v1.1` plus 4 commits publishes as
// 1.1.4. Release CI computes that and stamps it into package.json and SKILL.md
// before publishing, and nothing is committed back.
//
// So this check cannot compare two static strings any more. What it can still do is
// guarantee the two things the stamp depends on:
//
//   1. both files carry a version line at all (SKILL.md is the copy every non-npm
//      consumer reads, and a missing frontmatter line means the stamp silently has
//      nothing to write into)
//   2. they agree with each other, so the repo never states two different versions,
//      and a stamped artifact is internally consistent
//
// Run locally it sees the tag-level base; run in CI after the stamp it sees the
// computed value. Both are valid, and it is the same assertion either way.
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const skill = readFileSync(new URL('../SKILL.md', import.meta.url), 'utf8');

if (!pkg.version) {
  console.error('package.json has no version field.');
  process.exit(1);
}

const m = skill.match(/^version:\s*(\S+)\s*$/m);
if (!m) {
  console.error('SKILL.md frontmatter has no version: line.');
  console.error('release CI stamps the derived version into that line, so it must exist.');
  process.exit(1);
}

if (m[1] !== pkg.version) {
  console.error(`version mismatch: package.json says ${pkg.version}, SKILL.md says ${m[1]}.`);
  console.error('these must agree. in the repo they hold the tag-level base; CI stamps both.');
  process.exit(1);
}

console.log(`version ok: ${pkg.version}`);
