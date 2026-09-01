#!/usr/bin/env bash
# regression net for waterbear#29: three contradictory policies shipped at once because stale
# guidance survived edits in OTHER files. the installer's start-now behavior + emitted handoff
# are the source of truth; these are the exact stale formulations that contradicted them.
# a hit here means a doc or script has drifted back to a retired policy.
set -u
fail=0
ban() { # ban <phrase> <why>
  hits=$(grep -rn --include='SKILL.md' --include='README.md' --include='waterbear-*' -F "$1" SKILL.md README.md scripts/ 2>/dev/null | grep -v check-stale-guidance)
  if [ -n "$hits" ]; then
    printf 'STALE GUIDANCE: "%s" (%s)\n%s\n' "$1" "$2" "$hits" >&2
    fail=1
  fi
}
ban 'deliberately does NOT start it' 'self-install defaults to start-now; --defer is the opt-in'
ban 'they need to close or end this session' 'the retired two-step handoff; takeover is automatic'
ban 'archive the native desktop chat' 'mandatory-archive is retired; handoff retires the surface, archive is optional cosmetics'
ban 'REQUIRED step of a desktop-origin conversion' 'same, mandatory-archive formulation'
ban 'part of the conversion, not a suggestion' 'same, README formulation'
ban 'fix: ARCHIVE that chat' 'doctor --twins mandatory-archive card'
exit $fail
