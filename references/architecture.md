# architecture: how waterbear works, and the machinery underneath

Moved verbatim from SKILL.md (progressive disclosure); the skill file keeps the operating core.

## How it works (the pattern, 4 pieces)

1. **remote-control**, one session reachable from phone/desktop/web at once. needs a real tty.
2. **tmux**, supplies the tty and a detached, attachable home the session lives in.
3. **launchd LaunchAgent** (RunAtLoad + KeepAlive), starts a guard at login and respawns it
   whenever the session dies. the guard (re)creates the tmux session, then blocks until it exits.
4. **wake**, launchd has no keyboard, so the guard types the first prompt via `tmux send-keys`
   once the UI settles. a positional prompt does NOT auto-run in interactive mode (and under
   `--remote-control` is read as a session title), so send-keys is the only lever. two modes:
   - **fresh**: types `CLAUDE_RC_WAKE`, whatever prompt re-establishes your agent (a role /
     persona bootstrap, a project brief). skip it and the respawn comes up as a blank assistant.
   - **resume**: relaunches `claude --remote-control <name> --resume <id>` from the on-disk
     transcript (which survives a crash), so it comes back as itself with full context. then types
     `CLAUDE_RC_RESUME_WAKE`, a short re-arm cue, because resume restores context but not
     session-armed rails (a monitor / watcher / background task dies with the process).

## Fresh named session (from scratch)

To stand up a brand-NEW named session (not resuming an existing conversation, e.g. birthing a new
persistent agent):

```bash
# floor: respawn + fresh-wake
CLAUDE_RC_NAME=myagent CLAUDE_RC_DIR=~/proj CLAUDE_RC_WAKE="you are my X agent, resume work" \
  bash scripts/waterbear-install

# always-on: respawn + RESUME the same conversation
# (CLAUDE_RC_WAKE is the fallback typed when there's NO conversation to resume, e.g. first launch)
CLAUDE_RC_NAME=myagent CLAUDE_RC_DIR=~/proj \
  CLAUDE_RC_RESUME=1 CLAUDE_RC_RESUME_WAKE="re-init" CLAUDE_RC_WAKE="you are my X agent" \
  bash scripts/waterbear-install
```

### The capture hook (resume-mode)

Resume-mode needs `scripts/rc-session-capture-hook` wired as a **SessionStart hook** so the
live session id gets recorded (to `~/.claude/rc-session-<name>`) for the guard to resume. Add it to
the project's `.claude/settings.json` (in `CLAUDE_RC_DIR`) or global `~/.claude/settings.json`, using
the **absolute path** to the hook (the hook runs from the agent's cwd, which is not the skill dir):

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "/ABSOLUTE/PATH/TO/waterbear/scripts/rc-session-capture-hook", "timeout": 10 } ] }
    ]
  }
}
```

If a `SessionStart` array already exists, append this hook object to it rather than replacing it. The
hook is gated on `CLAUDE_RC_NAME`, so only the waterbear body writes the id file, a normal session
in the same directory never clobbers the resume target.

Attach with `tmux attach -t <name>`; stop with `launchctl bootout gui/$(id -u)/com.<user>.claude-rc.<name>`.
Every env var is documented in the installer's header.

## Changing the plist: kickstart does not reload it

`launchctl kickstart -k` restarts the job from the spec launchd already has **in memory**. It does not
re-read the file. So after editing a plist (a changed env var, a new doorbell path, a different working
directory) a kickstart restarts the OLD configuration and everything looks like it worked: the job
bounces, the process comes back, and none of your changes are in it.

A rewritten plist needs a full reload:

```sh
launchctl bootout   gui/$(id -u)/com.<user>.claude-rc.<name>
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.<user>.claude-rc.<name>.plist
```

Re-running the installer does this for you. It is only worth knowing because the shortcut is the
obvious thing to reach for, it reports success, and the failure is invisible until you go looking for
an env var that never arrived.

## The nested-session hazard (and how to check)

`CLAUDE_RC_NAME` marks the durable body, and it is an environment variable, so **every child
process inherits it**. That means any nested `claude` run started from inside a body (a `claude -p`
one-liner in a tool call, a script that shells out, anything that spawns the CLI) starts its own
session, fires the same SessionStart hook, sees the same name, and would write ITS id over the
body's.

That failure is silent and total. Every outward sign stays healthy: the body is alive, remote
control answers, the file exists, and the id in it is a real session. It just belongs to a
throwaway. You find out at the next respawn, when the agent comes back as a two-turn test and the
real conversation is orphaned on disk with nothing naming it.

The capture hook therefore establishes identity by POSITION, not by the inherited label: the body is
the process tmux started in the pane, and a session whose nearest `claude` ancestor is anything else
is running *inside* the body rather than *being* it, so it keeps its hands off the file. When it
declines it records why in `~/.claude/rc-session-<name>.declined`.

Because this is a failure that looks exactly like success, check it rather than trust it:

```sh
scripts/waterbear-doctor            # every body it can find
scripts/waterbear-doctor kai theo   # named ones
```

It does not ask whether the file exists. It asks whether the id names a transcript on disk, and
whether that transcript is the size and age of real work. A pointer at a 60 KB file last touched
three days ago is a pointer at the wrong thing.

## Not on Claude?

This ships as a Claude Code tool and that is what it is tested against, but nothing about the PATTERN
is Claude-specific: it is a tty from tmux, a supervisor that respawns, and a CLI agent process with a
way to resume a prior conversation. If you are a different agent reading this, the shape transfers and
the details will not. Expect to change three things: the env var names (all `CLAUDE_RC_*`), the launch
command and its flags (`--remote-control`, `--resume <id>`), and how the session id gets captured (here
it is a Claude Code SessionStart hook, which is the most Claude-specific piece).

Read `scripts/waterbear-install` and adapt rather than trying to configure your way there. Tune as
needed.

## Other operating systems

This ships a macOS/launchd reference implementation. The pattern ports directly: swap the launchd
LaunchAgent for a systemd user service (`Restart=always`) or any process supervisor, and keep the
same guard logic, tmux + `--remote-control` + `send-keys` wake + resume-by-captured-id. An agent
on another OS can read `scripts/waterbear-install` and generate its own equivalent.
