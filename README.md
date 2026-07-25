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

**Auth expiry:** the CLI runs on your subscription login (OAuth), which expires now and then. When it
does, the session stays alive and shows an auth error on each request, so it announces itself (you
see it via remote-control), it does not silently die. Run `claude` + `/login` at the machine to clear
it. waterbear cannot drive a browser re-login, so this one stays a manual step. Expected with a
subscription backbone. (The guard also has a crashloop net that notifies and backs off if a session
genuinely dies in a loop, e.g. a bad resume id; an expired login does not trigger that.)

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
| `CLAUDE_RC_NET_PROBE` | IP the guard checks for reachability (default `1.1.1.1`; a numeric IP avoids a DNS dependency) |
| `CLAUDE_RC_OUTAGE_RESPAWN_SECS` | a network outage longer than this, once it recovers, triggers a respawn (default `600`) |

## network recovery

Remote control registers when the process starts and rides a persistent connection. A **sustained**
network outage kills that connection and it does **not** reconnect on its own: the process stays alive
but is reachable only from the local tmux, which defeats the whole point. This is the failure you hit
after travel (offline in transit, online at the destination) or a reboot where the network hadn't
settled yet.

There's no external signal for "is remote control up" (a live remote-control session can show zero
persistent connections), so the guard keys off the thing that IS observable and IS the cause: network
reachability, via `scutil -r` (a local, instant route check that works while offline). Two behaviors:

- **launch-gate.** The guard won't start `claude --remote-control` into a dead network. If the network
  is down at launch it waits (up to ~15 min) for it to come back, then a short settle, so remote
  control always registers into a live network. This is the reboot case.
- **recovery respawn.** While running, the guard watches reachability. A down→up transition after an
  outage longer than `CLAUDE_RC_OUTAGE_RESPAWN_SECS` (default 10 min, matching remote control's own
  timeout) respawns the session, which re-registers remote control. Short blips stay under the
  threshold (remote control self-heals on sleep/wake) and are ignored. This is the travel case.

`scutil -r` reflects route/interface state, which is exactly the travel and reboot failures. It does
not catch a captive portal or a router that's up with no internet (the route exists), those are out of
scope.

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
