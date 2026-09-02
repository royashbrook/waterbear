---
name: waterbear
description: Use when you want a Claude Code (or terminal AI) session to survive crashes, patches, quits, and reboots and come back on its own, when an agent is told to "waterbear yourself" / "make yourself always-on / unkillable / permanent", or when you want a respawn to RESUME the same conversation instead of starting blank. Most often an agent runs it on ITSELF to persist the current conversation. macOS/launchd reference implementation, adaptable to other OSes.
metadata:
  version: 1.1.0
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

- **macOS only** (launchd). the pattern ports to linux/systemd (see
  [references/architecture.md](references/architecture.md)), but
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

1. Pick a short internal name (no spaces), usually your own (`max`, `sam`). For `CLAUDE_RC_TITLE`,
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
3. Make sure the capture hook is wired as a SessionStart hook (see "The capture hook" in
   [references/architecture.md](references/architecture.md)) so that id self-heals on every future
   restart. If your project already wires it, skip this.
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
   conversation underneath is one transcript on disk and it is whole, and a shorter-than-expected
   scrollback is a render artifact, not lost memory
3. they can reach it from anywhere: their phone, the desktop app, or `tmux attach -t <name>`

**One addition for desktop-born conversations (the installer detects this and says so).** The
desktop keeps its NATIVE chat for the conversation alongside the new remote-control entry. That
native chat is not a stale view: it is a live second copy of this agent and will answer if typed
into. Mobile dedupes the two surfaces; desktop shows both. So the handoff message (the installer
emits it, relay it) tells the human this window is the RETIRED surface: talk to the agent at its
named entry from now on, leave this one to sink. Archiving the retired chat is optional cosmetics,
offered only "if the extra entry bothers you": it removes a surface, never data. What keeps the
agent converged is the human knowing which door is real, not the archive click.

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

**If you discover you ARE the desktop twin of your own body** (waterbear or doctor tells you so),
do not hand the human homework: run the CONVERGE repair in
[references/operations.md](references/operations.md) yourself, from the window you are in.

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
CLI-born one, and for each likely twin it prints the fingerprint a human needs to find the right chat
in the desktop UI: birth date and opening message, which survive renames when titles do not. It also
reports whether the fossil is still writing. Relay that card to the human verbatim, the fix is one
archive click per twin and the card tells them which chat and why it is safe.

If the installer output says the body will start FRESH instead of resuming, STOP and fix that before
saying anything else (see the pin section above). And `--defer` exists if a human explicitly wants to
start the body themselves later; it is not the default because every operator who met the deferred
handoff read a correct install as an incomplete one.

## The first wake must be prompt-free

A session blocked on a permission prompt is not running, cannot check its own screen, and never
times out, and in the fresh post-resume window a prompt can fail to forward to remote control, so an
unattended body can sit blocked forever while looking busy from every remote surface. Before ending
your install turn: make sure the wake path (your scripts, your git shapes) is covered by allow rules
the body's directory inherits, or tell the human the FIRST wake should be watched in tmux so they can
answer "don't ask again" once. Steady-state prompts forward normally; it is only the wake window that
needs this care.

The same rule extends past the wake. If the install wires a ring transport (`CLAUDE_RC_DOORBELL` or
any wake adapter), a ring's RECEIVE path also runs unattended: open the payload the ring references,
run any pull that makes it current, write any offset/receipt state. Any of those hitting a fresh
permission prompt stalls the session just as invisibly as a blocked wake. The
[doorbell skill](https://github.com/royashbrook/doorbell) specifies the first-use permission
preflight for that path (map the receive steps, request narrow persistent approvals, finish with a
cold no-prompt proof: go idle, send a realistic ring, watch it complete with no human prompt);
follow it rather than a re-derivation here. Re-run that proof when paths, task identity, or the
permission profile change.

## Quick reference

| env | meaning |
|---|---|
| `CLAUDE_RC_NAME` | internal id, tmux name + launchd label + id file (default `claude`; keep short, no spaces) |
| `CLAUDE_RC_TITLE` | display title in the session list (default = NAME; may have spaces, e.g. `"Roy - Theaetetus"`) |
| `CLAUDE_RC_DIR` | working dir (default `$HOME`) |
| `CLAUDE_RC_WAKE` | prompt typed on a FRESH respawn (identity/bootstrap) |
| `CLAUDE_RC_RESUME` | `1` = resume the prior conversation by id instead of fresh |
| `CLAUDE_RC_RESUME_WAKE` | prompt typed AFTER a resume (re-arm rails) |

## The resume caveat (important)

Resume replays the FULL transcript into context every time, so context grows with each respawn.
Use resume for continuity across crashes, and periodically start a clean session to shed weight.
Resume is for recovery, not infinite accumulation.


## Going deeper (references/)

The operating core is above; the rest moved to references, read on demand:

- [references/architecture.md](references/architecture.md): how the 4 pieces fit (guard, tmux,
  launchd, wake), standing up a fresh named session, the capture hook, plist reload vs kickstart,
  the nested-session hazard and `waterbear-doctor`, porting off Claude or off macOS.
- [references/operations.md](references/operations.md): the CONVERGE desktop-twin repair, driving
  your own terminal for modal commands (`waterbear-selfcmd`), renaming, common mistakes, and
  parking (`waterbear-park`, reboot-stable down-on-purpose), rolling bodies onto a new binary
  after `claude update` (`waterbear-restart`, with `--list` as the drift report), and taking a body down
  (`waterbear-uninstall`, and which teardown preserves the conversation).
