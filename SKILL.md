---
name: waterbear
description: Keep a local terminal AI session alive through crashes, patches, quits, and reboots, and resume the exact conversation when it returns. Use when an agent is told to "waterbear yourself", become always-on or persistent, recover a durable body, diagnose its reachability, or port that capability to another agent host or operating system. Defines a cross-substrate behavior contract and ships a Claude Code + macOS adapter.
---

# waterbear

## Overview

Keep one local terminal agent body alive and resume its exact conversation after process or machine
failure. Named for the tardigrade, which suspends its life under stress and revives when conditions
return.

Waterbear is a behavior contract with host adapters. Read
[`references/adapters.md`](references/adapters.md) before installing or porting it. Run the bundled
runtime scripts only for a **shipped** matrix row. The current scripts implement Claude Code on
macOS; another host is not supported merely because it has a terminal.

## Where this runs (read first, it's local to one machine)

waterbear wires a launchd LaunchAgent + tmux + a `claude` CLI process on ONE computer. that has
consequences worth stating up front:

- **macOS only** (launchd). the pattern ports to linux/systemd (see "Other operating systems"), but
  this installer is mac. it is tied to that machine and user, the LaunchAgent is per-user and
  durable only while you are logged in, and the body does not follow you to another machine.
- **Claude Desktop app**: works. desktop and CLI write the same on-disk transcripts, so the CLI body
  CAN resume a desktop conversation by id, provided it launches in the conversation's own working
  directory (the never-move guard enforces this). the desktop window becomes one more remote-control
  view of the now-durable session. (an earlier version of this doc claimed desktop conversations
  could not be resumed; that was wrong, and it was disproven by doing it.)
- **cloud / Claude Code on web**: not applicable, there is no local machine, launchd, or tmux to
  keep alive. waterbear is for a session running on your own computer.
- **auth expiry needs an interactive re-login**: the CLI runs on your subscription login (OAuth),
  which expires periodically. The tmux body can remain alive while remote control is unavailable,
  so phone and desktop views may provide no useful signal. Inspect the tmux pane, complete
  `claude` + `/login` at the machine, then restart the body so remote control registers again.
  Waterbear cannot self-heal browser authentication, and doctor does not yet prove auth or remote
  reachability. Separately, the guard has a crashloop net (notify + back off) for a session that
  genuinely exits repeatedly; an expired login may not trigger it.

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

1. Pick a short internal name (no spaces), usually your own (`kai`, `theo`). For `CLAUDE_RC_TITLE`,
   use **the name the human already calls this conversation**, their word for it, not a title you
   invent. The remote-control entry replaces their chat in the session list, and coming back under a
   self-chosen new name reads as a different agent appearing and theirs vanishing. If you do not know
   what they call it, ask, it is one question and it is their name, not yours.
2. Nothing to do: with `CLAUDE_RC_RESUME=1` the installer pins the session you run it from, so THIS
   conversation is what comes back. It prints which conversation that is. **Read that line.** If it
   says the body will start FRESH, stop and fix it before going further, because a fresh start means
   the human ends up with a brand-new empty agent beside their real one, which is the single worst
   outcome this tool can produce. (`--no-pin` exists for the rare case where you deliberately do not
   want your own id carried; if you use it, say so out loud.)
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
   `<name>`?** you are durable now, nothing else to do. **Not in tmux?** installing starts the
   durable body and registers its remote-control entry. The current CLI window remains a view of the
   same transcript; do not invent a close-and-restart handoff.

Only ask the human if they want to override a default (a different directory, custom wake prompts).
Otherwise just set yourself up and confirm.

## Do not move the agent

`CLAUDE_RC_DIR` is where the agent is **actually running right now**, and the default (your current
directory) is almost always correct. Do not set it to where you feel the agent "belongs", or to a
project home, or to a worktree you consider its base. Those are your ideas about the agent; the
directory is a fact about it.

The failure is silent and total: `claude --resume` only finds a session inside its own project
directory, so a body pointed elsewhere starts a FRESH conversation, and the human is left with their
real agent in one window and an empty impostor in another. The installer now refuses this, but the
refusal is a net, not a plan. Just do not move the agent.

## Waterbear yourself: the takeover is automatic, say only what is true

Installing from inside your own session starts the durable body immediately, and the body resumes
THIS conversation: same session id, same single transcript, appended to. The window the human is
looking at is a VIEW of that conversation, and it catches up when remote control registers. Nothing
forks, there is no second body, and there is nothing the human must close first.

So after installing, tell the human three true things, and no homework:

1. done: this conversation is now durable, it survives crashes, patches, quits, and reboots
2. the window may blink or briefly show a stale view while remote control re-registers; the
   conversation underneath is one transcript on disk and it is whole
3. they can reach it from anywhere: their phone, the desktop app, or `tmux attach -t <name>`

**Desktop-born exception:** the desktop keeps its native chat beside the new remote-control entry.
The installer prints the required handoff: tell the human to continue at the named durable entry and
retire this window. They may leave it alone; archiving the extra entry is optional cosmetics and
never deletes the transcript.

## The human's command outranks your beliefs: ALWAYS run the installer

When the human invokes waterbear ("waterbear yourself", again, a third time, any time), you RUN THE
INSTALLER. Every time. You do not decide it is unnecessary, you do not conclude from history that
things are done, and you do not stop to ask the human what they are seeing before running it.

The reasoning error this forbids has happened: an agent ran the installer twice, believed "done" both
times, and on the third ask REFUSED and asked the human to troubleshoot with it, while the body's
in-memory context was weeks behind the whole time. Every check the agent invented (pointer matches,
process matches, "all three facts agree") verified the ID and said nothing about the MEMORY, so its
confidence was unearned and its refusal blocked the one code path built to fix the actual problem.

The rules that follow:

1. the installer is idempotent, so running it when everything is right costs nothing. your judgment
   is not idempotent: refusing when something is wrong costs the human their agent.
2. a human REPEATING the command is evidence the last run did not achieve what they needed, never
   evidence that they are confused. the correct response to the Nth ask is the same as the first:
   run it, then report what IT did, not what you believe.
3. the tool is the judge, you are the hands. if there is nothing to do, the installer says so, and
   relaying that is honest. deciding not to consult it is not.

## CONVERGE: when you discover you are the desktop twin of your own body

You ran waterbear (or doctor) and found this: you are the desktop-app instance of a conversation
that already has a durable tmux body. Do NOT stop and hand the human homework, and NEVER tell them
to archive the window they are typing in as the fix. You do the whole repair yourself, from this
window, because for a normal user this window is the only window there is:

1. say "found the problem, fixing it now", one line
2. restart the body so it reloads the FULL transcript, your human's newest turns included:
   `tmux kill-session -t <name>` (safe: you are the desktop process, not the tmux one; the guard
   respawns the body onto the complete file within ~30s)
3. verify, never assume: the respawned body's process shows `--resume <the tip id>`, and
   `waterbear doctor <name>` is green
4. then your LAST message in this window is the handoff, and it is the fix's final act:
   "done. i am durable now. talk to me at the <entry name> chat (it is the one on your phone),
   this window is retired and will go stale. nothing needs archiving, you can just leave it."
5. archiving the retired window is OPTIONAL COSMETIC, offer it only as "if the extra entry bothers
   you", never as a required step.

Why the handoff message matters more than any mechanism: the body only reads the transcript when it
resumes, so a human who keeps typing into the retired desktop window makes the body stale again.
The one thing that keeps the agent converged is the human knowing which door is the real one, and
the retired window itself telling them is the most reliable place to say it.

## Re-running waterbear IS the repair

The installer is idempotent and self-healing, so "run waterbear again" is always the answer when
something looks wrong, typed into ANY of the agent's windows:

1. **a compact rolled the conversation**: desktop compacts silently start a new conversation that
   continues the old one, so a body can end up faithfully persisting a conversation the human
   already left. The installer walks the continuation chain (the new conversation records its
   parent) and resumes the TIP, wherever the command was typed. The stale window and the live
   window converge on the same answer.
2. **the body is on the wrong conversation**: a running same-name body that does not match the
   target is replaced, and the replacement is deferred + forked when the body being replaced is the
   one running the command, so it finishes saying what is happening before its floor is removed.
3. **everything is already right**: nothing happens. A correct install re-run is a no-op, which is
   what makes it safe to tell a confused user "just run it again".

## The singleton rule

A waterbeared agent is ONE agent. The installer enforces the half it can see: if a conversation
already has a body (any name), a second install against it is refused with directions to the
existing body. The half it cannot see is surfaces: a fossil desktop chat, an old window someone
types into. Never wake an agent through an old surface and waterbear it again, that is how one
agent becomes two. If you are unsure whether a conversation already has a body, `waterbear doctor`
lists every pinned conversation on the machine.

**After converting a desktop-born agent, run `waterbear doctor --twins` and relay the card.** The
transcript records where every entry came from, so doctor can tell a desktop-born conversation from a
CLI-born one, and for each likely twin it prints the fingerprint a human needs to find the retired
chat in the desktop UI: birth date and opening message, which survive renames when titles do not. It
also reports whether the retired surface is still writing and directs the human to the durable entry.

If the installer output says the body will start FRESH instead of resuming, STOP and fix that before
saying anything else (see the pin section above). And `--defer` exists if a human explicitly wants to
start the body themselves later; it is not the default because every operator who met the deferred
handoff read a correct install as an incomplete one.

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

## The first wake must be prompt-free

A session blocked on a permission prompt is not running, cannot check its own screen, and never
times out, and in the fresh post-resume window a prompt can fail to forward to remote control, so an
unattended body can sit blocked forever while looking busy from every remote surface. Before ending
your install turn: make sure the wake path (your scripts, your git shapes) is covered by allow rules
the body's directory inherits, or tell the human the FIRST wake should be watched in tmux so they can
answer "don't ask again" once. Steady-state prompts forward normally; it is only the wake window that
needs this care.

## How the Claude Code + macOS adapter works

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

## Porting to another host

Use the contract and matrix in [`references/adapters.md`](references/adapters.md). Map outcomes to
native host mechanisms, prove them end to end, and record the tested versions and remaining gaps.
Do not run or mechanically translate the Claude/macOS scripts on an unshipped row.

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
