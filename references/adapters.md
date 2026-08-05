# Adapter contract and support matrix

Waterbear is a behavior contract, not a particular command line. An adapter is complete only when
it proves the outcomes below with the host's native mechanisms.

## Contract

1. **Supervise:** restart the local agent body after process death and at user login or reboot where
   the operating system permits it.
2. **Own a terminal:** give the body one durable, inspectable interactive terminal.
3. **Resume identity:** persist an exact conversation identifier and resume that conversation,
   never an unspecified "most recent" session.
4. **Wake:** submit a fresh-start or post-resume cue without assuming a positional CLI argument
   executes interactively.
5. **Reachability:** distinguish "process exists" from "the human can reach and use it." Report
   authentication, transport, and blocked-input failures separately.
6. **Deliver doorbells:** keep the watcher outside the disposable agent process, preserve an offset,
   and deliver complete lines at least once without typing into a busy composer.
7. **Diagnose:** inspect supervisor, body, resume pointer, transcript, reachability, authentication,
   and doorbell state independently. Unknown is a valid result; healthy-by-process alone is not.
8. **Teardown safely:** preserve the resume pointer by default and make destructive forgetting
   explicit.

The contract is behavioral. Do not add a runtime plugin API until a second working adapter proves
which code boundary is actually shared.

## Adapter evidence

Every adapter must record:

- agent and operating-system versions tested;
- native supervisor, terminal, resume, wake, reachability, and doorbell mechanisms;
- automated checks and the last end-to-end proof date;
- unsupported states and the exact proof needed to close each gap.

Use these statuses:

- **shipped:** implemented and end-to-end proven;
- **bridge candidate:** plausible native or compatibility bridge, not yet proven;
- **gap:** no reliable implementation has been demonstrated.

## Shipped adapter: Claude Code on macOS

| Contract part | Current mechanism |
|---|---|
| supervise | per-user launchd LaunchAgent with \`RunAtLoad\` and \`KeepAlive\` |
| terminal | named tmux session |
| resume identity | \`CLAUDE_CODE_SESSION_ID\`, SessionStart capture hook, exact \`--resume <id>\` |
| wake | \`tmux send-keys\` after the interactive UI settles |
| reachability | Claude \`--remote-control\`; guard respawns after sustained network loss or long sleep |
| doorbell | guard-owned signal-file watcher with persistent byte offset and at-least-once delivery |
| diagnose | \`waterbear doctor\` plus tmux/launchd inspection; auth and remote reachability remain gaps |
| teardown | \`waterbear uninstall\`; \`--forget\` is the destructive variant |

The public \`CLAUDE_RC_*\` configuration remains supported. Those names belong to this adapter, not
the neutral contract.

## Support matrix

Version snapshot: 2026-08-05. Versions are evidence from one machine, not compatibility floors.

| Agent / OS | Status | Tested evidence | Gap or next proof |
|---|---|---|---|
| Claude Code / macOS | shipped | macOS 26.5.2, Claude Code 2.1.222, tmux 3.7b, Node 26.5.1; repository checks passed 2026-08-05; exact-resume proof is commit `4a3f309`; live reboot/resume/doorbell proof recorded 2026-07-25 | automate reboot/resume, auth-loss, remote-reachability, and doorbell end-to-end checks |
| Claude Code / Linux | bridge candidate | none | implement a systemd user-service adapter and prove exact resume, wake, reachability, and teardown |
| Claude Code / Windows | gap | none | identify native supervisor and durable terminal, then prove the full contract |
| Codex desktop or CLI / macOS or Linux | gap | skill discovery only; no Waterbear runtime proof | prove exact-session capture/resume and a human-reachable surface before selecting a supervisor |
| Grok / local agent hosts | gap | none | identify native resume, wake, and reachability mechanisms |
| agy / local agent hosts | gap | none | identify native resume, wake, and reachability mechanisms |

Do not translate the Claude command line by analogy and call it an adapter. Until a row is shipped,
report its status and stop before installing host-specific runtime wiring.

## Adding an adapter

1. Map every contract outcome to a native mechanism.
2. Implement the smallest host-specific wrapper without changing the neutral contract.
3. Add diagnostics that can return healthy, unhealthy, and unknown for each outcome.
4. Prove process death, restart/login, exact resume, wake, reachability, doorbell delivery, and safe
   teardown end to end.
5. Record versions, proof date, and remaining gaps in the matrix.
