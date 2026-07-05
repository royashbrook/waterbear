---
name: waterbear
description: Use when you want a Claude Code (or terminal AI) session to survive crashes, patches, quits, and reboots and come back on its own , keep an agent always-on / persistent / unkillable / durable, auto-restart a remote-control session, or have a respawn resume the SAME conversation instead of starting blank. macOS/launchd reference implementation, adaptable to other OSes.
---

# waterbear

## Overview

Keep a `claude --remote-control` session alive indefinitely. Named for the tardigrade , the
animal that suspends its life under stress and revives when conditions return. A crash, a patch, a
quit, or a reboot kills the process; waterbear brings it back on its own, and (optionally) resumes
the exact prior conversation from disk so the agent returns as itself, mid-thought.

## When to use

- you want a session that survives crash / patch / quit / reboot and restarts itself
- you want it reachable from phone / desktop / claude.ai the whole time (remote-control)
- you want a respawn to RESUME the prior conversation, not a fresh blank one
- someone says "make this agent always-on / persistent / unkillable / permanent"

Not for: a one-off task, or a session you WANT to end when you close the terminal.

## How it works (the pattern, 4 pieces)

1. **remote-control** , one session reachable from phone/desktop/web at once. needs a real tty.
2. **tmux** , supplies the tty and a detached, attachable home the session lives in.
3. **launchd LaunchAgent** (RunAtLoad + KeepAlive) , starts a guard at login and respawns it
   whenever the session dies. the guard (re)creates the tmux session, then blocks until it exits.
4. **wake** , launchd has no keyboard, so the guard types the first prompt via `tmux send-keys`
   once the UI settles. a positional prompt does NOT auto-run in interactive mode (and under
   `--remote-control` is read as a session title), so send-keys is the only lever. two modes:
   - **fresh**: types `CLAUDE_RC_WAKE` , whatever prompt re-establishes your agent (a role /
     persona bootstrap, a project brief). skip it and the respawn comes up as a blank assistant.
   - **resume**: relaunches `claude --remote-control <name> --resume <id>` from the on-disk
     transcript (which survives a crash), so it comes back as itself with full context. then types
     `CLAUDE_RC_RESUME_WAKE` , a short re-arm cue, because resume restores context but not
     session-armed rails (a monitor / watcher / background task dies with the process).

## Install (macOS)

```bash
# floor: respawn + fresh-wake
CLAUDE_RC_NAME=myagent CLAUDE_RC_DIR=~/proj CLAUDE_RC_WAKE="you are my X agent, resume work" \
  bash scripts/waterbear-install

# always-on: respawn + RESUME the same conversation
CLAUDE_RC_NAME=myagent CLAUDE_RC_DIR=~/proj CLAUDE_RC_RESUME=1 CLAUDE_RC_RESUME_WAKE="re-init" \
  bash scripts/waterbear-install
```

Resume-mode also needs `scripts/rc-session-capture-hook` wired as a **SessionStart hook** (in the
project's `.claude/settings.json` or global `~/.claude/settings.json`). It records the live session
id to `~/.claude/rc-session-<name>` every start so the guard knows which conversation to resume. It
is gated on `CLAUDE_RC_NAME`, so only the waterbear body writes it , a normal session in the same
directory never clobbers the resume target.

Run `scripts/waterbear-install` with no comment-reading needed; its header documents every env var.
Attach with `tmux attach -t <name>`; stop with `launchctl bootout gui/$(id -u)/com.<user>.claude-rc.<name>`.

## Quick reference

| env | meaning |
|---|---|
| `CLAUDE_RC_NAME` | session / tmux name (default `claude`) |
| `CLAUDE_RC_DIR` | working dir (default `$HOME`) |
| `CLAUDE_RC_WAKE` | prompt typed on a FRESH respawn (identity/bootstrap) |
| `CLAUDE_RC_RESUME` | `1` = resume the prior conversation by id instead of fresh |
| `CLAUDE_RC_RESUME_WAKE` | prompt typed AFTER a resume (re-arm rails) |

## The resume caveat (important)

Resume replays the FULL transcript into context every time , so context grows with each respawn.
Use resume for continuity across crashes, and periodically start a clean session to shed weight.
Resume is for recovery, not infinite accumulation.

## Other operating systems

This ships a macOS/launchd reference implementation. The pattern ports directly: swap the launchd
LaunchAgent for a systemd user service (`Restart=always`) or any process supervisor, and keep the
same guard logic , tmux + `--remote-control` + `send-keys` wake + resume-by-captured-id. An agent
on another OS can read `scripts/waterbear-install` and generate its own equivalent.

## Common mistakes

- **Naming the concept "zombie."** In unix a zombie process is a DEAD, unreaped process , the
  opposite of what this does. Use "waterbear / persistent / always-on."
- **Expecting a positional prompt to auto-run.** It doesn't in interactive mode; the guard uses
  `send-keys` after the UI settles. That is the only reliable lever.
- **Using `--continue` at a shared working dir.** It resumes the most-recent session in that dir,
  which may be a different agent. Resume a SPECIFIC id (what the capture hook records).
- **Resume-mode with no capture hook.** No recorded id means nothing to resume , it silently
  falls back to a fresh start.
