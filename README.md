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

Via npm, which also gets you updates (`npm outdated` / `npm update -g` work like anywhere else):

```bash
npx @royashbrook/waterbear install     # one-off, or:
npm i -g @royashbrook/waterbear        # then: waterbear install / doctor / uninstall / selfcmd
waterbear skill                        # copy the skill into ~/.claude/skills for your agent
```

Or skip npm entirely; the installer is one script. Straight from the raw file:

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

**Auth expiry:** the CLI runs on your subscription login (OAuth), which expires now and then. When it
does, the session stays alive and shows an auth error on each request, so it announces itself (you
see it via remote-control), it does not silently die. Run `claude` + `/login` at the machine to clear
it. waterbear cannot drive a browser re-login, so this one stays a manual step. Expected with a
subscription backbone. (The guard also has a crashloop net that notifies and backs off if a session
genuinely dies in a loop, e.g. a bad resume id; an expired login does not trigger that.)

## waterbear never moves your agent

The promise is **identical, except now it cannot be killed**. The working directory is part of
identical: an agent working in `~/code/foo` that comes back somewhere else is not the same agent,
whatever its transcript says.

This is mechanical, not philosophical. `claude --resume <id>` resolves a session **within the project
directory it is launched from**. Point the body at a different directory and the id simply is not
there, so the resume finds nothing and quietly starts a FRESH session instead. Nothing errors. You end
up with your real conversation in one place and a brand-new empty agent in another, and the new one's
capture hook overwrites the pointer to the real one within seconds.

So the working directory defaults to **where you ran the installer**, and if you pin a conversation
that does not live there, the install refuses and tells you where it actually lives. If you genuinely
want a body elsewhere with a fresh start, that is a different thing and you say so: `--no-pin` with
resume off.

## it carries THIS conversation, and it tells you so

With `CLAUDE_RC_RESUME=1`, the installer pins the session you ran it from, so the durable body comes
back as the conversation you were just having. It prints which conversation that will be, and if there
is nothing to carry it says so in block capitals rather than leaving a blank field.

That warning exists because the silent version of this is the worst thing the tool can do. Install
succeeds, the body comes up FRESH, and you are left looking at two live sessions: your real
conversation, and a brand-new empty agent beside it. Nothing errored, so nothing told you the promise
had quietly inverted. Now it does.

## waterbear yourself: the handoff is two steps, on purpose

The common case is an agent running this on ITSELF, from inside the conversation you want to make
durable. That creates one ordering problem worth understanding, because the alternative is alarming.

If the body started immediately, your caller's client would still be alive and registered, so you
would briefly have **two live sessions holding one conversation**: the window you are looking at, and
a new one that renders only the turns after the resume point and therefore looks EMPTY. It reads like
the tool forked your agent and ate your history. It did not, but nobody debugs from there.

So when the installer can see it is running inside a session, it wires everything and **stops**:

```
1. finish up, then close or end the calling session
2. waterbear start <name>      (or just log out and back in, launchd does it)
3. tmux attach -t <name>       (also your phone / desktop app / claude.ai)
```

Step 1 is ordering, not etiquette: two clients on one conversation both append to the same transcript.

This cannot be automated. The CLI does not hold its transcript open, so there is no handle to watch,
and a desktop client is not attributable to a process worth polling, which means nothing can detect
the caller letting go. `--now` skips the deferral if you would rather manage the overlap yourself.

**Resume really is resume.** It reattaches to the same session: same id, same single transcript file,
appended to, with the full context available. (Verified: a session was created, exited, resumed by id,
and recalled a fact from before the resume, while the transcript stayed one file that grew rather than
a second file appearing.) So if a client ever shows you a shorter scrollback than you expected, that is
a rendering question and not lost history, and the data on disk is whole.

## Versioning and releases

The version is **derived, not stored**: `major.minor` come from the latest git tag and the patch is the
number of commits since it, so `v1.1` plus four commits publishes as `1.1.4`. Cutting a minor release
is just `git tag v1.2 && git push --tags`, and every commit after it numbers itself.

Every push to `main` publishes. Release CI computes the version, stamps it into `package.json` and
`SKILL.md` in the build only, and publishes; nothing is committed back, because a commit from CI would
itself move the number it just computed.

The consequence worth knowing if you read the source: **a committed file cannot hold its own accurate
version**, since the patch depends on the commit containing it. The repo carries the tag-level base
(`1.1.0`), and the published artifact carries the computed one. If you want to know exactly what you
have installed, ask npm or read the version in the package you installed, not the version in the repo.

### A fresh start you fell back to is not a fresh start you asked for

`CLAUDE_RC_WAKE` fires only when there was no conversation to resume. If you asked for resume and got
this, something went wrong, and that is the worst possible moment to run an unconstrained
identity-bootstrap prompt: a wake that says "self-locate, your home is X" will competently act on it in
a session that was meant to be a continuation. That is how a body ends up correctly following
instructions in the wrong place.

So the guard now says it, in its log and in the session, and prepends a warning to the wake prompt
itself telling the agent that a resume was intended and failed, that prior context does not exist, and
not to relocate or reconfigure anything until the human confirms.

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

## the first wake

Permission prompts are the one thing that can stall an unattended body invisibly: a session blocked
on one is not running, so it cannot check its own screen, and nothing times out. In steady state
prompts forward to remote-control clients normally; the fragile window is a fresh session's first
turns right after a resume + auto-compact, where a raised prompt has been observed not to forward,
leaving every remote surface showing "running" while the terminal waits.

So make the wake path prompt-free before it matters: seed allow rules covering whatever your wake
runs (your git shapes, your scripts) in settings the body's directory inherits, or run the first
wake attended (`tmux attach -t <name>`) and answer "don't ask again" once. After that first clean
wake, a body that looks busy-but-silent from remote is worth one look in tmux before assuming it is
thinking.

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
| `CLAUDE_RC_CONNECT_URL` | URL the guard fetches to test real internet (default `https://1.1.1.1/`; an IP avoids a DNS dependency) |
| `CLAUDE_RC_NET_CHECK_SECS` | how often to probe connectivity in the watch loop (default `30`) |
| `CLAUDE_RC_OUTAGE_RESPAWN_SECS` | an outage longer than this, once internet recovers, triggers a respawn (default `600`; set `0` to respawn on any connectivity blip) |

## network recovery

Remote control registers when the process starts and rides a persistent connection. A **sustained**
loss of real internet kills that connection and it does **not** reconnect on its own: the process stays
alive but is reachable only from the local tmux, which defeats the whole point. You hit this after
travel (offline in transit, online at the destination), a reboot where the network hadn't settled,
**captive-portal wifi** (hotel / airport), or a **router that's up with a dead WAN**.

There's no external signal for "is remote control up" (a live remote-control session can show zero
persistent connections), so the guard keys off the actual cause: **real internet reachability**. It
does a genuine connectivity probe (a TLS fetch of `CLAUDE_RC_CONNECT_URL`, an IP so there's no DNS
dependency), not a route check, because a route check reports "wifi connected but no internet" as fine.
The TLS fetch only succeeds with working internet: behind a captive portal the handshake fails or is
redirected, and with no route it can't connect. This is the same mechanism the OS uses to light its
"no internet" indicator. Four behaviors, all feeding one respawn (respawn re-registers remote control):

- **launch-gate.** The guard won't start `claude --remote-control` into a dead network, launching remote
  control without internet is guaranteed to fail. It **waits** for real connectivity (up to ~1 hour)
  before launching, then a short settle. No delay when the internet is already up. Fixes the reboot and
  wake-with-no-network cases.
- **recovery respawn.** While running, it probes connectivity every `CLAUDE_RC_NET_CHECK_SECS`. A down→up
  transition after an outage longer than `CLAUDE_RC_OUTAGE_RESPAWN_SECS` (default 10 min, matching
  remote control's own timeout) respawns. Short blips stay under the threshold (remote control self-heals
  on brief drops) and are ignored; the threshold also debounces a single flaky probe. Fixes travel and
  captive-portal / dead-WAN wifi (once real internet returns).
- **suspend/wake respawn.** The guard can't probe while the machine is asleep, so it also watches for a
  time jump: a loop that took far longer than its interval means the machine was suspended that long.
  Past the same threshold, it respawns. Fixes "closed the laptop for an hour, remote control is dead on
  wake", the case a live probe can't see (it was frozen too).
- **poll backstop.** If the launch-gate ever gives up (its ~1h cap) and launches into no-internet, the
  recovery probe respawns it once internet returns.

Set `CLAUDE_RC_OUTAGE_RESPAWN_SECS=0` to respawn on **any** connectivity blip (trades churn for
immediacy). Known limit: this is polling, so recovery is within `CLAUDE_RC_NET_CHECK_SECS` of internet
returning, not instant (macOS fires an event on network *config* changes but not on "internet came back
on the same wifi", so a poll is required for the captive-portal case). A hang with no connectivity change
at all (an internal client wedge, not network-caused) has no signal and isn't auto-caught, use the
deliberate-restart procedure below.

## recovery: when to deliberately restart

Waterbear is crash-resilience, but the more common real-world need is a **deliberate restart** of a
wedged-but-alive session. Some failures can't be fixed from inside the session because the thing that
broke was acquired at process start and can't be re-acquired in-process:

- **remote control dropped** (the network cases above; also just a long sleep).
- **an MCP connector dropped** (a `... MCP server disconnected` notice mid-session; the account-level
  connector is still fine, but this process's client is gone and nothing re-attaches it).
- **the session is wedged** (frozen client, stuck at a login prompt after a network blip).
- **the CLI is stale** (a respawn comes up on the newer installed version, so restart doubles as the
  upgrade path).

The fix in all of these is the same: kill the session and let the guard resume it. A respawn is ~15s
and comes back mid-thread as the same session. Before you pull the pin:

1. **Confirm the id file points at THIS session.** `~/.claude/rc-session-<name>` should hold the
   current session id and the tmux pane's pid should be your own `claude` process. A wrong id resumes
   a different conversation and loses yours.
2. **Flush first.** A respawn is a fresh context load, not a guarantee: commit and push anything you
   care about (a clean `git status` in every repo you touched), because resume replays the transcript
   but a fresh-fallback does not.
3. **Kill the tmux session, not just the pid:** `tmux kill-session -t <name>`. That's the exact
   condition the guard's loop watches, so there's no window where the pane is dead but the guard is
   still looping.
4. Then launchd re-runs the guard, which resumes the pinned id and types the wake.

Two safety properties make this safe to do on purpose: the resume id is **consumed before use** (a bad
id falls through to a fresh start instead of crashlooping), and the crashloop backoff needs **4
launches in 120s** before it trips, so a single deliberate kill never does.

## the wake re-sends queued input

On a respawn, the wake sequence **submits whatever message was queued in the input box** (a resume can
restore a message you'd typed but not sent before the session died), then types the wake prompt. This
is intentional: the queued text is something you already chose to send, so running it on the way back
is usually what you want, and it keeps the wake from concatenating onto (and garbling) that text.

Know the edge, though: it will **re-send** that queued message. If your workflow queues an input that
you would NOT want auto-run on an unattended restart (a one-off destructive command, say), the respawn
will run it. For most setups the wake is just "resume the conversation, re-enable remote control, and
re-establish who you are", so this is a non-issue, but if a restart in your setup needs to be inert, be
aware the queued line runs. To opt out, leave `CLAUDE_RC_RESUME_WAKE` empty and don't queue input you
don't want replayed.

## commands remote control can't drive

Remote control drives the *conversation*, not the *terminal*. Commands that open a modal TUI
(`/hooks`, `/config`, `/login`, `/mcp`, ...) render in the terminal and wait for keystrokes, so from a
phone or a desktop client they are dead ends. The usual outcome is the agent saying "please run
/hooks" and the human having to walk to the machine and remember the tmux incantation.

A waterbear body lives in tmux, and tmux can both type into a pane and render that pane back as text.
So the body can just do it itself:

```sh
scripts/waterbear-selfcmd --where          # the exact attach command, for when a human IS needed
scripts/waterbear-selfcmd '/hooks'         # type it into my own input and submit
scripts/waterbear-selfcmd --screen         # what is on my screen right now?
scripts/waterbear-selfcmd --keys Down Enter   # drive the modal that just opened
```

Every driving form leads with the way back in, before it touches anything:

```
attach: tmux attach -t theo
  (if this goes wrong, that command puts you in the terminal. Ctrl-b d detaches.)
screen: /Users/you/.claude/waterbear-screen-theo.txt
```

That is deliberate. Self-driving is the one thing an agent does that can lock you out of your own
terminal: a modal opens under you, or the driver wedges, and talking to the session no longer helps
because it isn't reading the conversation. So the escape hatch goes out first, while the terminal is
still in a known state, and the skill tells the agent to relay it to you in the same breath as "I'm
driving."

The `screen:` file holds the rendered screen. **Read it on your NEXT turn, not
this one**: keystrokes sent to your own pane are buffered until the current turn ends, and once the
modal opens the model is not running, so a single turn can never both drive and watch. The script
forks a driver that outlives the turn to handle this. Tell the human you did it, so a modal opening
under them isn't a surprise.

It refuses to type when the input box already has text in it, because submitting would send that text
too (`--force` overrides once you've looked with `--screen`). It refuses outright, with no override,
when a modal is already open, because free text typed at a modal is not text: every character becomes
a keystroke picking and confirming whatever that widget is showing. Not in tmux, so nothing to drive?
It exits 3 and says so, which is your cue to fall back to asking the human.

**Escape and C-c are refused.** They abort rather than navigate. This TUI hands them to the interrupt
path before any open modal sees them, so from a background driver they cancel whatever turn is
running, leave the modal up, and strand you at a terminal you now have to walk to. Finishing a modal
by navigating it works fine; abandoning one is a human action, which is the other reason every drive
leads with the attach command.

### it also shows you what remote control can't

Errors that render in the terminal never reach the remote-control transcript. A body can be running
with every project hook broken (relative hook paths that stopped resolving, say) and still report
clean from your phone, for weeks. `waterbear-selfcmd --screen` is the cheapest way to look at what
your session is actually staring at.

## taking a body down

`waterbear uninstall <name>` (or `scripts/waterbear-uninstall`). Teardown is three operations, and
the difference between them is whether a conversation survives: `--stop` pauses (it returns at next
login), the default removes the body but KEEPS `~/.claude/rc-session-<name>` so a reinstall resumes
the same conversation mid-thought, and `--forget` also deletes that pointer, which is the
destructive one. The pointer file holds a session id, not a name; nothing regenerates it, so
deleting it during cleanup looks like tidying and is data loss. The script refuses to tear down the
session it is running inside (`--self` overrides) and does launchd before tmux, because launchd is
the thing that respawns.

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

## the resume caveat

Resume replays the full transcript into context every time, so context grows with each respawn. Use
resume for continuity across crashes, and periodically start a clean session to shed weight. Resume is
for recovery, not infinite accumulation.

Running several bodies for one name over time? The id file names ONE session, and a wrong id resumes
the wrong body silently. Keep using the body you want and let its capture hook keep the id current;
don't hand-set the id from a session you're not sure is the right one. See
[`SKILL.md`](SKILL.md) → Common mistakes.

## other operating systems

This is a macOS/launchd reference implementation. The pattern ports directly: swap the LaunchAgent for
a systemd user service (`Restart=always`) or any process supervisor, and keep the guard logic: tmux +
`--remote-control` + `send-keys` wake + resume-by-captured-id. Read
[`scripts/waterbear-install`](scripts/waterbear-install) and adapt.

## license

MIT, see [LICENSE](LICENSE).
