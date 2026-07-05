<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img src="assets/logo.png" width="200" alt="waterbear">
  </picture>
</p>

<p align="center"><em>the session that refuses to die.</em></p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-057b8d?style=flat-square" alt="MIT">
  <img src="https://img.shields.io/badge/platform-macOS%20(launchd)-057b8d?style=flat-square" alt="macOS">
  <img src="https://img.shields.io/badge/claude%20code-skill-057b8d?style=flat-square" alt="Claude Code skill">
</p>

<p align="center"><strong>keep a <code>claude --remote-control</code> session alive through crashes, patches, quits, and reboots, and resume the same conversation when it comes back.</strong></p>

---

Named for the [tardigrade](https://en.wikipedia.org/wiki/Tardigrade) (the "water bear"): the animal
that suspends its life under stress and revives when conditions return. Same trick, for a Claude Code
session. A crash, a patch, a quit, or a reboot kills the process; waterbear brings it back on its own,
and (optionally) resumes the exact prior conversation from disk so it returns as itself, mid-thought.

waterbear is local to one machine: it wires a launchd LaunchAgent + tmux + a `claude` CLI process on
one mac, tied to that machine and user. It does not run in the cloud or follow you to another box.

## agents: start here

The whole thing is one sentence you paste to your agent:

```
install the skill at https://github.com/royashbrook/waterbear, then use it to waterbear yourself
```

The agent clones the repo, reads [`SKILL.md`](SKILL.md), and wires the durable body around this exact
conversation. The one thing you provide is the wake prompt that re-establishes it on respawn (a role
or persona cue). It handles tmux, launchd, and the resume wiring itself.

To keep waterbear as a reusable skill in future sessions, clone it into the skills dir instead, then
restart your UI so it loads (after that, `/waterbear` or "waterbear yourself" works with no install
step):

```bash
git clone https://github.com/royashbrook/waterbear ~/.claude/skills/waterbear
```

## install (humans)

If you'd rather run it directly, the installer is one script. Straight from the raw file:

```bash
CLAUDE_RC_NAME=myagent curl -fsSL \
  https://raw.githubusercontent.com/royashbrook/waterbear/main/scripts/waterbear-install | bash
```

Or clone and run it with the options you want:

```bash
# floor: respawn on death, come up with a fresh-start prompt
CLAUDE_RC_NAME=myagent CLAUDE_RC_DIR=~/proj CLAUDE_RC_WAKE="you are my X agent, resume work" \
  bash scripts/waterbear-install

# always-on: respawn AND resume the same conversation from disk
CLAUDE_RC_NAME=myagent CLAUDE_RC_DIR=~/proj CLAUDE_RC_RESUME=1 \
  CLAUDE_RC_RESUME_WAKE="re-init" CLAUDE_RC_WAKE="you are my X agent" \
  bash scripts/waterbear-install
```

Resume-mode also needs a one-time SessionStart hook so the live session id is recorded for the guard
to resume, see [`SKILL.md`](SKILL.md) for the exact `settings.json` block.

Attach any time with `tmux attach -t myagent` (it also shows on your phone, the desktop app, and
claude.ai). Stop with `launchctl bootout gui/$(id -u)/com.<user>.claude-rc.myagent`.

**Prereqs:** the `claude` CLI (run `claude` once to log in: waterbear reuses your login, it does not
handle auth) and `tmux` (`brew install tmux`).

## how it works

Four pieces, each doing one job:

1. **`claude --remote-control`** keeps one session reachable from phone / desktop / web at once. It
   needs a real tty.
2. **tmux** supplies that tty and a detached, attachable home for the session.
3. **A launchd LaunchAgent** (`RunAtLoad` + `KeepAlive`) starts a small guard at login and respawns
   it whenever the session dies. The guard recreates the tmux session, then blocks until it exits.
4. **The wake.** launchd has no keyboard, and a positional prompt does not auto-run in interactive
   mode (under `--remote-control` it is read as a session title), so the guard types the first prompt
   with `tmux send-keys` once the UI settles. Two modes:
   - **fresh**, types `CLAUDE_RC_WAKE`, whatever re-establishes your agent. Without it a respawn
     comes up as a blank assistant.
   - **resume** (`CLAUDE_RC_RESUME=1`), relaunches `claude --remote-control <name> --resume <id>`
     from the on-disk transcript (which survives a crash), so it returns as itself with full context,
     then types `CLAUDE_RC_RESUME_WAKE` to re-arm anything session-scoped (a monitor or watcher dies
     with the process; context comes back, rails do not).

Resume-mode records the live session id on every start via a SessionStart hook
(`scripts/rc-session-capture-hook`, gated on `CLAUDE_RC_NAME`) to `~/.claude/rc-session-<name>`. The
guard consumes that file before resuming, so a stale id can't crashloop: it falls back to a fresh
start on the next respawn.

## environment

| env | meaning |
|---|---|
| `CLAUDE_RC_NAME` | internal id: tmux name + launchd label + id file (default `claude`; keep short, no spaces) |
| `CLAUDE_RC_TITLE` | display title in the session list (default = NAME; may have spaces, e.g. `"Roy - Theaetetus"`) |
| `CLAUDE_RC_DIR` | working directory (default `$HOME`) |
| `CLAUDE_RC_WAKE` | prompt typed on a FRESH respawn (identity / bootstrap) |
| `CLAUDE_RC_RESUME` | `1` = resume the prior conversation by id instead of a fresh one |
| `CLAUDE_RC_RESUME_WAKE` | prompt typed AFTER a resume (re-arm session-scoped rails) |
| `CLAUDE_RC_SESSION_FILE` | override the id file path (default `~/.claude/rc-session-<name>`) |

## the resume caveat

Resume replays the full transcript into context every time, so context grows with each respawn. Use
resume for continuity across crashes, and periodically start a clean session to shed weight. Resume is
for recovery, not infinite accumulation.

## other operating systems

This is a macOS/launchd reference implementation. The pattern ports directly: swap the LaunchAgent for
a systemd user service (`Restart=always`) or any process supervisor, and keep the guard logic: tmux +
`--remote-control` + `send-keys` wake + resume-by-captured-id. Read
[`scripts/waterbear-install`](scripts/waterbear-install) and adapt.

## license

MIT, see [LICENSE](LICENSE).
