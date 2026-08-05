import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = mkdtempSync(join(tmpdir(), 'waterbear-skill-'));
const codexHome = join(root, 'codex-home');

try {
  const run = spawnSync(process.execPath, ['bin/waterbear.js', 'skill', 'all'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, HOME: root, CODEX_HOME: codexHome },
    encoding: 'utf8',
  });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout);

  for (const dir of [
    join(root, '.claude', 'skills', 'waterbear'),
    join(codexHome, 'skills', 'waterbear'),
  ]) {
    if (!existsSync(join(dir, 'SKILL.md'))) throw new Error(`missing skill at ${dir}`);
    if (!existsSync(join(dir, 'references', 'adapters.md'))) {
      throw new Error(`missing adapter contract at ${dir}`);
    }
  }
  console.log('skill targets ok: claude + codex');
} finally {
  rmSync(root, { recursive: true, force: true });
}
