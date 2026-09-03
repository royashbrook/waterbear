# operations: repair, driving your own terminal, renaming, teardown

Moved verbatim from SKILL.md (progressive disclosure); the skill file keeps the operating core.
This is also where lifecycle verbs land as they ship (restart-after-update, park/unpark).

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
attach: tmux attach -t max
  (if this goes wrong, that command puts you in the terminal. Ctrl-b d detaches.)
screen: /Users/you/.claude/waterbear-screen-max.txt
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

## Parking a body (down on purpose, reboot-stable)

`waterbear-uninstall --stop` boots the guard out but leaves the RunAtLoad plist live, so the body
returns at next login; plain remove deletes the wiring. Parking is the reversible middle:

```sh
scripts/waterbear-park <name>          # stop guard, kill session, rename plist to .plist.park
scripts/waterbear-park <name> --wake   # rename back, bootstrap, verify the session comes up
```

launchd never loads a `.park` file, so a parked body stays down through every login and reboot
until it is woken, and waking rebuilds nothing: the resume pointer and doorbell offset were never
touched, so it comes back as itself. Parking the body you are inside needs `--self` (the shell
dies mid-command), and `--dry-run` prints the plan. Park is "down on purpose"; for actual
teardown, read on.

## Rolling bodies onto a new binary

`claude update` installs a new binary and touches no running client: every body keeps running
the old version (and the old model) until something restarts it, and the backend gates
remote-control resume on a minimum client version, so the drift is an outage waiting for its
moment, not cosmetic. The restart is cheap because the guard already does the hard part:

```sh
scripts/waterbear-restart --list     # per body: running client version vs installed binary
scripts/waterbear-restart <name>     # idle-gate, kill the CLIENT, verify the respawn
scripts/waterbear-restart <name> --rc  # same, after disconnecting a dead remote-control registration
```

It kills the client process in the tmux pane, never the guard and never by a `*claude*` glob
(that takes out the guard and every other body on the machine); the guard respawns the session
on the installed binary with `--resume`, so the conversation survives. It refuses a body whose
composer holds input or whose turn is in flight (both would be eaten), reading the pane with
escapes so the client's faint ghost-autocomplete does not read as typed text. It then verifies
the effect, not the declaration: a new pid, the running version equal to the installed one, and
remote control actually registered. Registration can fail on the way up during a desktop-app
update window (`/rc failed` in the status bar) while the session itself resumes fine, so the verb
re-bounces once for that and stops with a real finding if it fails twice.

A body the remote surfaces list but cannot reach ("unable to reach the computer" in the desktop
app, while the session is idle and healthy in tmux) is a registration problem, and the cost of
each fix is different, so take them in order. First a plain `scripts/waterbear-restart <name>`:
the session keeps its stored registration across a resume, so if the remote side merely lost
the connection this brings it back with the desktop chat history intact. Only if it is still
unreachable after that, `scripts/waterbear-restart <name> --rc`: disconnect the registration
through the client's own `/rc` menu, then bounce, so the guard's titled relaunch mints a fresh
one. That costs the remote-side history: the desktop keys its chat on the registration, so the
body shows up as a new, empty chat under its usual title (the conversation itself is intact, in
the tmux scrollback and the transcript). Two wrong turns are easy to take by hand and the verb
exists to avoid them. Typing a bare `/rc` into the session registers it again under an
auto-generated name (hostname prefix), so the title is gone and the remote list shows a stranger;
restarting after that keeps the stranger, because the resume reuses it. `--rc` verifies each step
on screen and refuses to call it done unless the remote-control url actually changed.

Every restart leaves a trail. The verb writes one line to `~/.claude/rc-restart-<name>` (who,
when, why; `--why "…"` sets the reason, otherwise a default that names the operation) before the
kill, and the guard prefixes it to the wake it types into the resumed session, then deletes it.
The body comes back knowing it was restarted on purpose. Without that line, a deliberate bounce
and a crash are the same event from inside: a body that got bounced twice in three minutes spent
its afternoon eliminating crash causes, because the only evidence it had was two clean
re-registrations. A death with no note beside it is a real crash, which is what makes the note
worth anything.

Rolling the guard itself is a different operation from rolling a body. The installer writes the
shared guard file by rename (never in place), so guards already running keep the file they started
with; to move a running guard onto a new guard file, `launchctl kickstart -k` its label. The guard
adopts an existing tmux session on start and resumes the doorbell offset from its sibling file, so
the session is untouched. Do it one guard at a time and verify the effect: new guard pid, same
pane pid.

Rolling several bodies is the operator's loop, on purpose: restart one as the canary, watch it
resume end to end, then the rest, and the body you are working from last (`--self`, and your
current turn does not survive the kill).

## Taking a body down

Teardown is three operations that people say with one word, and the difference between them is
whether a conversation survives. `scripts/waterbear-uninstall <name>` does the right one by default.

| | what it does | the conversation |
|---|---|---|
| `--stop` | stops the guard. It returns at next login. | untouched |
| (default) | stops the guard, removes the LaunchAgent, kills the tmux session | **preserved**, reinstall resumes it |
| `--forget` | all of the above, plus deletes the resume pointer | **unreachable** |

**The file that must survive a teardown is `~/.claude/rc-session-<name>`.** It reads like a name file
and is not one: it holds a SESSION ID. It is the only pointer from the name `max` to the
conversation that agent has been having, and nothing regenerates it, because the id was minted by a
session that no longer exists. Deleting it during cleanup looks like tidying and is data loss: the
transcript is still on disk, but nothing knows which of hundreds of files it is.

That distinction is what makes a body disposable rather than precious. Remove one and you have paused
an agent. Forget one and you have ended it.

Order matters, and the script gets it right: launchd first. It is the thing that RESPAWNS, so killing
the tmux session while the LaunchAgent is still loaded just hands you a fresh body a second later.

It refuses to tear down the session it is running inside unless you pass `--self`, because that dies
partway through and leaves the worst half-state: LaunchAgent removed, body still up, nothing left to
respawn it. `--dry-run` prints the plan.
