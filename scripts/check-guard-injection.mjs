// check-guard-injection.mjs — the guard must inject EVERY identity var per-session.
//
// The regression this pins down: all bodies share one tmux server, and the first
// guard to boot seeds the server's GLOBAL environment with its own CLAUDE_RC_*
// values, which every later session hands to its panes. The only structural defense
// is the guard's `-e` list at `tmux new-session`: any identity var missing from it
// leaves that var ambient, and a body silently wears another session's value (seen
// live: a body carrying another session's TITLE, WAKE, and DIR for days, and an
// installer re-run writing them into its plist). NAME alone was injected for months
// while the comment above it described this exact leak — a leak fixed for one var
// is fixed for none.
//
// Single source of truth for "identity var" is the installer's ambient-strip list;
// this test asserts the guard's every `tmux new-session` invocation injects each of
// those vars, and that the installer's plist-inherit block covers each one too
// (except NAME, which selects the plist and cannot inherit from it).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const install = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "waterbear-install"),
  "utf8",
);
const fail = (msg) => {
  console.error(`guard-injection: ${msg}`);
  process.exit(1);
};

// canonical identity vars = the ambient-strip loop's list
const stripLine = install.match(/^\s*for _v in ((?:CLAUDE_RC_\w+\s*)+); do$/m);
if (!stripLine) fail("cannot find the ambient-strip var list in waterbear-install");
const vars = stripLine[1].trim().split(/\s+/);
if (vars.length < 7) fail(`ambient-strip list suspiciously short: ${vars.join(" ")}`);

// the guard heredoc
const guard = install.match(/^cat > "\$GUARD" <<'GUARD_EOF'$([\s\S]*?)^GUARD_EOF$/m);
if (!guard) fail("cannot find the GUARD_EOF heredoc in waterbear-install");

// every `tmux new-session` in the guard, with backslash continuations joined
const launches = guard[1]
  .replace(/\\\n\s*/g, " ")
  .split("\n")
  .filter((l) => l.includes("tmux new-session"));
if (launches.length < 2) fail(`expected at least 2 tmux new-session launches, found ${launches.length}`);

for (const [i, launch] of launches.entries()) {
  for (const v of vars) {
    if (!launch.includes(`-e "${v}=`)) {
      fail(`launch #${i + 1} does not inject ${v}: a session born from it carries the tmux server's ambient value instead\n  ${launch.trim()}`);
    }
  }
}

// the plist-inherit block must cover every identity var except NAME
for (const v of vars) {
  if (v === "CLAUDE_RC_NAME") continue;
  if (!install.includes(`inherit ${v}`)) {
    fail(`plist-inherit block does not cover ${v}: a self-repair with that env var unset silently drops it from the plist`);
  }
}

console.log(`guard-injection ok: ${launches.length} launches inject all ${vars.length} identity vars, inherit covers ${vars.length - 1}`);
