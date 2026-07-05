# waterbear

Keep a `claude --remote-control` session alive indefinitely , through crashes, patches, quits,
and reboots , and (optionally) have it resume the exact same conversation when it comes back.

Named for the [tardigrade](https://en.wikipedia.org/wiki/Tardigrade): the animal that suspends its
life under stress and revives when conditions return. Same trick, for a Claude Code session.

## Quickstart (macOS)

```bash
# floor: session respawns itself, comes up with a fresh-start prompt
CLAUDE_RC_NAME=myagent CLAUDE_RC_DIR=~/proj CLAUDE_RC_WAKE="you are my X agent, resume work" \
  bash scripts/waterbear-install

# always-on: session respawns AND resumes the same conversation from disk
# (CLAUDE_RC_WAKE is the fallback used only when there's no conversation to resume, e.g. first run)
CLAUDE_RC_NAME=myagent CLAUDE_RC_DIR=~/proj \
  CLAUDE_RC_RESUME=1 CLAUDE_RC_RESUME_WAKE="re-init" CLAUDE_RC_WAKE="you are my X agent" \
  bash scripts/waterbear-install
```

Resume-mode also needs a one-time SessionStart hook so the live session id is recorded for the guard
to resume , see [`SKILL.md`](SKILL.md) for the exact `settings.json` block.

Or straight from the raw script:

```bash
CLAUDE_RC_NAME=myagent curl -fsSL \
  https://raw.githubusercontent.com/royashbrook/waterbear/main/scripts/waterbear-install | bash
```

Attach any time with `tmux attach -t myagent` (it also shows on your phone, the desktop app, and
claude.ai). Stop with `launchctl bootout gui/$(id -u)/com.<user>.claude-rc.myagent`.

**Prereqs:** the `claude` CLI (run `claude` once to log in , waterbear reuses your login, it does
not handle auth) and `tmux` (`brew install tmux`).

## How it works

Four pieces, each doing one job:

1. **`claude --remote-control`** keeps one session reachable from phone / desktop / web at once. It
   needs a real tty.
2. **tmux** supplies that tty and a detached, attachable home for the session.
3. **A launchd LaunchAgent** (`RunAtLoad` + `KeepAlive`) starts a small guard at login and respawns
   it whenever the session dies. The guard recreates the tmux session, then blocks until it exits.
4. **The wake.** launchd has no keyboard, and a positional prompt does not auto-run in interactive
   mode (under `--remote-control` it is read as a session title), so the guard types the first
   prompt with `tmux send-keys` once the UI has settled. Two modes:
   - **fresh** , types `CLAUDE_RC_WAKE`, whatever re-establishes your agent (a role/persona
     bootstrap, a project brief). Without it a respawn comes up as a blank assistant.
   - **resume** (`CLAUDE_RC_RESUME=1`) , relaunches `claude --remote-control <name> --resume <id>`
     from the on-disk transcript (which survives a crash), so it returns as itself with full
     context, then types `CLAUDE_RC_RESUME_WAKE` to re-arm anything session-scoped (a monitor /
     watcher / background task dies with the process; context comes back, rails do not).

Resume-mode records the live session id on every start via a **SessionStart hook**
(`scripts/rc-session-capture-hook`, gated on `CLAUDE_RC_NAME` so only the waterbear body writes it)
to `~/.claude/rc-session-<name>`. The guard consumes that file before resuming, so a stale id can't
crashloop , it falls back to a fresh start on the next respawn.

## Environment

| env | meaning |
|---|---|
| `CLAUDE_RC_NAME` | session / tmux name (default `claude`) |
| `CLAUDE_RC_DIR` | working directory (default `$HOME`) |
| `CLAUDE_RC_WAKE` | prompt typed on a FRESH respawn (identity / bootstrap) |
| `CLAUDE_RC_RESUME` | `1` = resume the prior conversation by id instead of a fresh one |
| `CLAUDE_RC_RESUME_WAKE` | prompt typed AFTER a resume (re-arm session-scoped rails) |
| `CLAUDE_RC_SESSION_FILE` | override the id file path (default `~/.claude/rc-session-<name>`) |

## The resume caveat

Resume replays the full transcript into context every time, so context grows with each respawn. Use
resume for continuity across crashes, and periodically start a clean session to shed weight. Resume
is for recovery, not infinite accumulation.

## Other operating systems

This is a macOS/launchd reference implementation. The pattern ports directly: swap the LaunchAgent
for a systemd user service (`Restart=always`) or any process supervisor, and keep the guard logic ,
tmux + `--remote-control` + `send-keys` wake + resume-by-captured-id. Read
[`scripts/waterbear-install`](scripts/waterbear-install) and adapt.

## For coding agents

`SKILL.md` is a [Claude Code skill](https://docs.claude.com/en/docs/claude-code/skills): point an
agent at this repo and it can set itself up as always-on. The one thing you provide is the wake
prompt that re-establishes the agent (e.g. a persona or role cue).

## License

MIT , see [LICENSE](LICENSE).
