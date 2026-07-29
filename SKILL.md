---
name: waterbear
description: Use when you want a Claude Code (or terminal AI) session to survive crashes, patches, quits, and reboots and come back on its own, when an agent is told to "waterbear yourself" / "make yourself always-on / unkillable / permanent", or when you want a respawn to RESUME the same conversation instead of starting blank. Most often an agent runs it on ITSELF to persist the current conversation. macOS/launchd reference implementation, adaptable to other OSes.
version: 1.0.0
---

# waterbear

## Overview

Keep a `claude --remote-control` session alive indefinitely. Named for the tardigrade, the
animal that suspends its life under stress and revives when conditions return. A crash, a patch, a
quit, or a reboot kills the process; waterbear brings it back on its own, and (optionally) resumes
the exact prior conversation from disk so the agent returns as itself, mid-thought.

## When to use

- you want a session that survives crash / patch / quit / reboot and restarts itself
- you want it reachable from phone / desktop / claude.ai the whole time (remote-control)
- you want a respawn to RESUME the prior conversation, not a fresh blank one
- someone says "make this agent always-on / persistent / unkillable / permanent"

Not for: a one-off task, or a session you WANT to end when you close the terminal.

## Where this runs (read first, it's local to one machine)

waterbear wires a launchd LaunchAgent + tmux + a `claude` CLI process on ONE computer. that has
consequences worth stating up front:

- **macOS only** (launchd). the pattern ports to linux/systemd (see "Other operating systems"), but
  this installer is mac. it is tied to that machine and user, the LaunchAgent is per-user and
  durable only while you are logged in, and the body does not follow you to another machine.
- **Claude Desktop app**: you CAN invoke this from a desktop session, but the durable body is a
  CLI/tmux process, and it will NOT resume that desktop conversation, resume-by-id is a CLI feature
  the desktop app does not expose. installing births a SEPARATE CLI body; you then drive it from the
  desktop / phone / web via remote-control. (identity still survives if your wake prompt
  reconstitutes the agent from durable state; only the in-flight desktop chat is what you'd lose.)
- **cloud / Claude Code on web**: not applicable, there is no local machine, launchd, or tmux to
  keep alive. waterbear is for a session running on your own computer.
- **auth expiry needs an interactive re-login**: the CLI runs on your subscription login (OAuth),
  which expires periodically. when it does, the session STAYS ALIVE and shows an auth error on each
  request, so it announces itself (you see it via remote-control on your phone or desktop), it does
  NOT silently die. run `claude` + `/login` at the machine to clear it. waterbear can't self-heal
  this (launchd cannot drive a browser auth), and it's expected with a subscription backbone, not a
  bug (API-key auth would avoid it but flips billing to metered). Separately, the guard has a
  crashloop net (notify + back off) for a session that genuinely dies and respawns in a loop, e.g. a
  bad resume id or corrupt state; an expired login does not trigger it.

If you do not want an always-on process tied to your mac, do not install it.

## Waterbear yourself (the common case)

Most often an agent runs this ON ITSELF, "waterbear yourself", to make THIS conversation survive
restarts and resume automatically. The defaults do the work: your current directory, your current
session.

The scripts live in `scripts/` next to this file. If you were handed only the repo URL and don't
have it locally yet, clone it first, and to make the skill reusable in every future session, clone
it straight into the skills dir:

```bash
git clone https://github.com/royashbrook/waterbear ~/.claude/skills/waterbear
```

Then run the installer at `~/.claude/skills/waterbear/scripts/waterbear-install`. Minimal steps:

1. Pick a short internal name (no spaces), usually your own (`kai`, `theo`). Optionally a pretty
   `CLAUDE_RC_TITLE` for the session list.
2. Pin THIS conversation as the resume target:
   ```bash
   mkdir -p ~/.claude && printf '%s\n' "$CLAUDE_CODE_SESSION_ID" > ~/.claude/rc-session-<name>
   ```
3. Make sure the capture hook is wired as a SessionStart hook (see "the capture hook" below) so that
   id self-heals on every future restart. If your project already wires it, skip this.
4. Install the guard in resume-mode, defaulting to where you are:
   ```bash
   CLAUDE_RC_NAME=<name> CLAUDE_RC_DIR="$(pwd)" CLAUDE_RC_RESUME=1 \
     bash ~/.claude/skills/waterbear/scripts/waterbear-install
   ```
   Optional: `CLAUDE_RC_RESUME_WAKE="<short re-init cue>"` (typed after each resume, e.g. to re-arm a
   monitor/watcher) and `CLAUDE_RC_WAKE="<identity bootstrap>"` (used only if there is ever no
   conversation to resume).
5. Enter the durable body. It lives in tmux under launchd. **Already inside a tmux session named
   `<name>`?** you are durable now, nothing else to do. **Not in tmux?** installing starts your
   durable tmux body, end this session so the two don't run in parallel, and you continue in the
   tmux body resuming this exact conversation.

Only ask the human if they want to override a default (a different directory, custom wake prompts).
Otherwise just set yourself up and confirm.

## The first wake must be prompt-free

A session blocked on a permission prompt is not running, cannot check its own screen, and never
times out, and in the fresh post-resume window a prompt can fail to forward to remote control, so an
unattended body can sit blocked forever while looking busy from every remote surface. Before ending
your install turn: make sure the wake path (your scripts, your git shapes) is covered by allow rules
the body's directory inherits, or tell the human the FIRST wake should be watched in tmux so they can
answer "don't ask again" once. Steady-state prompts forward normally; it is only the wake window that
needs this care.

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

## Quick reference

| env | meaning |
|---|---|
| `CLAUDE_RC_NAME` | internal id, tmux name + launchd label + id file (default `claude`; keep short, no spaces) |
| `CLAUDE_RC_TITLE` | display title in the session list (default = NAME; may have spaces, e.g. `"Roy - Theaetetus"`) |
| `CLAUDE_RC_DIR` | working dir (default `$HOME`) |
| `CLAUDE_RC_WAKE` | prompt typed on a FRESH respawn (identity/bootstrap) |
| `CLAUDE_RC_RESUME` | `1` = resume the prior conversation by id instead of fresh |
| `CLAUDE_RC_RESUME_WAKE` | prompt typed AFTER a resume (re-arm rails) |

## Renaming

- **Change the display title only** (`CLAUDE_RC_TITLE`): just re-run the installer with the new
  title. It takes effect on the next respawn (a live session's title is fixed at launch, so kill
  the session to apply it now, in resume-mode it comes right back with the new title). No orphan,
  because the internal `CLAUDE_RC_NAME` (and thus the launchd label) is unchanged.
- **Change the internal `CLAUDE_RC_NAME`**: this changes the launchd label, plist path, tmux name,
  and id file, so the OLD LaunchAgent is orphaned. Tear it down first, then install fresh:
  ```bash
  launchctl bootout gui/$(id -u)/com.<user>.claude-rc.<OLDNAME>   # stop old agent
  rm -f ~/Library/LaunchAgents/com.<user>.claude-rc.<OLDNAME>.plist
  mv ~/.claude/rc-session-<OLDNAME> ~/.claude/rc-session-<NEWNAME> 2>/dev/null || true  # keep resume target
  CLAUDE_RC_NAME=<NEWNAME> ... bash scripts/waterbear-install
  ```

## When a command can't be driven over remote control

If you are about to tell the human "run `/hooks` for me" (or `/config`, `/login`, `/mcp`, any command
that opens a modal in the terminal), **don't just ask**. Remote control drives the conversation, not
the terminal, so that request means they have to physically get to the machine. You are in tmux, so
you can drive your own terminal:

```sh
scripts/waterbear-selfcmd '/hooks'         # type it into your own input and submit
scripts/waterbear-selfcmd --screen         # capture your own screen
scripts/waterbear-selfcmd --keys Down Enter   # drive the modal you just opened
scripts/waterbear-selfcmd --where          # attach command, for when a human really IS needed
```

**Give the human the attach command before you drive.** Every driving form prints it first:

```
attach: tmux attach -t theo
  (if this goes wrong, that command puts you in the terminal. Ctrl-b d detaches.)
screen: /Users/you/.claude/waterbear-screen-theo.txt
```

Relay that `attach:` line in the same message where you say you are driving. This is the one thing you
do that can lock a human out of their own terminal: a modal opens under them, or the driver wedges,
and their reflex (talk to the session) no longer works, because the session is not reading the
conversation any more. Handing over the escape hatch first, while the terminal is still in a known
state, costs one line and is the difference between an inconvenience and being stuck.

Every form also prints a `screen:` file path holding the rendered screen. **You can only read it on your NEXT turn**:
keys you send to your own pane are buffered until this turn ends, and when the modal opens you are not
running. The script forks a driver to bridge that gap. So the shape is: run it, tell the human what
you just did, end your turn, then read the screen file and keep driving with `--keys`.

Rules, each of them paid for:

**This is for modal commands, not for handing yourself work.** Nothing in the mechanism stops you
typing a task into your own input and answering it next turn. That is a loop with no human in it.
Drive your own terminal to reach a command you cannot otherwise reach, never to give yourself
something to do.

**Say what you did** before ending the turn, so a modal appearing on the human's screen is not a
mystery, and pass them the `attach:` line.

**Escape and C-c are refused (exit 6), and there is no override.** They abort rather than navigate:
this TUI routes them to the interrupt path before any open modal sees them, so from a background
driver they cancel whatever turn is running, leave the modal up, and strand the human at a terminal
they have to walk to. That is not theoretical, it happened on the first real drive. Finish a modal by
navigating it (Down/Up/Enter/Tab/digits) until it closes on its own, which is fully self-drivable.
Abandoning one is a human action, so hand over the attach command instead.

**Do not `--force` your way past a refusal you have not looked at.** Exit 4 (your input box has text
in it) is a fine `--force` case once `--screen` shows you it is your own queued text. Exit 5 (a modal
is open) refuses `--force` outright, because free text typed at a modal is not text: every character
becomes a keystroke picking and confirming whatever that widget is showing. Use `--keys` there.

**Read the `screen:` file only by its header.** Each capture is stamped with a sequence number and
what was sent. There is one slot per session, so two drives in flight overwrite each other; if the
header does not name what you just sent, you are looking at someone else's capture or a stale one.

Not in tmux (desktop, cloud, a body started some other way)? It exits 3. Then, and only then, ask the
human, and hand them `tmux attach -t <name>` rather than making them remember it.

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

## The resume caveat (important)

Resume replays the FULL transcript into context every time, so context grows with each respawn.
Use resume for continuity across crashes, and periodically start a clean session to shed weight.
Resume is for recovery, not infinite accumulation.

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

## Common mistakes

- **Naming the concept "zombie."** In unix a zombie process is a DEAD, unreaped process, the
  opposite of what this does. Use "waterbear / persistent / always-on."
- **Expecting a positional prompt to auto-run.** It doesn't in interactive mode; the guard uses
  `send-keys` after the UI settles. That is the only reliable lever.
- **Using `--continue` at a shared working dir.** It resumes the most-recent session in that dir,
  which may be a different agent. Resume a SPECIFIC id (what the capture hook records).
- **Resume-mode with no capture hook.** No recorded id means nothing to resume, it silently
  falls back to a fresh start.
- **Hand-setting the resume id while several same-named bodies are alive.** The id file names ONE
  session. If you've run multiple bodies for the same name over a day (a cloud one, a local one, a
  throwaway test one, the one you actually worked in), the id your env reports (`$CLAUDE_CODE_SESSION_ID`)
  is just whichever body you happen to be in right now, NOT necessarily the one you want to keep, and a
  wrong id resumes the wrong body silently (it's still "a" valid session, so nothing errors). The human's
  pinned / actively-used session is ground truth for which one to continue, read the id from inside that
  exact session, or don't hand-edit at all: the capture hook self-heals the LIVE session's id on every
  start, so the safest path is to just keep using the body you want and let its hook keep the id file
  current.

## Taking a body down

Teardown is three operations that people say with one word, and the difference between them is
whether a conversation survives. `scripts/waterbear-uninstall <name>` does the right one by default.

| | what it does | the conversation |
|---|---|---|
| `--stop` | stops the guard. It returns at next login. | untouched |
| (default) | stops the guard, removes the LaunchAgent, kills the tmux session | **preserved**, reinstall resumes it |
| `--forget` | all of the above, plus deletes the resume pointer | **unreachable** |

**The file that must survive a teardown is `~/.claude/rc-session-<name>`.** It reads like a name file
and is not one: it holds a SESSION ID. It is the only pointer from "the seat called kai" to "the
conversation kai has been having", and nothing regenerates it, because the id was minted by a session
that no longer exists. Deleting it during cleanup looks like tidying and is data loss: the transcript
is still on disk, but nothing knows which of hundreds of files it is.

That distinction is what makes a body disposable rather than precious. Remove one and you have paused
an agent. Forget one and you have ended it.

Order matters, and the script gets it right: launchd first. It is the thing that RESPAWNS, so killing
the tmux session while the LaunchAgent is still loaded just hands you a fresh body a second later.

It refuses to tear down the session it is running inside unless you pass `--self`, because that dies
partway through and leaves the worst half-state: LaunchAgent removed, body still up, nothing left to
respawn it. `--dry-run` prints the plan.
