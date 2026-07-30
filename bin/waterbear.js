#!/usr/bin/env node
// The npm face of waterbear. One thin dispatcher, zero dependencies.
//
// The real tools are bash scripts in scripts/, and they stay bash: launchd and
// tmux are shell problems, and the scripts must keep working for people who
// cloned the repo and never touched npm. This shim exists so `npx
// @royashbrook/waterbear <cmd>` works as an install line, and it does nothing
// except find the right script and exec it with the same argv and env.
//
// Node is a fair assumption here rather than a new dependency: every user of
// this already runs a CLI agent that ships on node.
const { spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, cpSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');
const CMDS = {
  install: 'waterbear-install',
  start: 'waterbear-start',
  uninstall: 'waterbear-uninstall',
  doctor: 'waterbear-doctor',
  selfcmd: 'waterbear-selfcmd',
};

const arg = process.argv[2];

function usage() {
  console.log(`waterbear -- keep a CLI agent session alive through crashes, patches, and reboots.

usage:
  waterbear install     wire this machine (launchd + tmux + wake). env-driven, see docs.
  waterbear start       start a body that was wired but deferred (after you close the caller).
  waterbear uninstall   take a body down. preserves the resume pointer unless --forget.
  waterbear doctor      check every body's resume pointer against what is actually on disk.
  waterbear selfcmd     let a session drive its own terminal (modal commands over remote control).
  waterbear skill       copy the skill into ~/.claude/skills/waterbear so agents can use it.
  waterbear docs        print where the full documentation lives.

every command passes its arguments straight through to the underlying script.
repo + docs: https://github.com/royashbrook/waterbear`);
}

if (!arg || arg === '-h' || arg === '--help') {
  usage();
  process.exit(arg ? 0 : 1);
}

if (arg === 'docs') {
  console.log('https://github.com/royashbrook/waterbear#readme');
  process.exit(0);
}

// `skill` serves the agent half. npm delivers files to node_modules, which no
// agent scans for skills, so this copies the package into the skills dir where
// Claude Code (and anything else reading that layout) actually looks.
if (arg === 'skill') {
  const dest = path.join(os.homedir(), '.claude', 'skills', 'waterbear');
  if (existsSync(dest)) {
    console.log(`already present: ${dest}`);
    console.log('it may be a git clone or a symlink; not overwriting it from npm.');
    process.exit(0);
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(ROOT, dest, { recursive: true });
  console.log(`installed skill -> ${dest}`);
  console.log('restart your agent UI so it picks the skill up.');
  process.exit(0);
}

const script = CMDS[arg];
if (!script) {
  console.error(`unknown command: ${arg}\n`);
  usage();
  process.exit(1);
}

const file = path.join(ROOT, 'scripts', script);
const r = spawnSync('bash', [file, ...process.argv.slice(3)], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
