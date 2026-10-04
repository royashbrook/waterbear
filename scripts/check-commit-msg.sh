#!/usr/bin/env bash
# regression checks for .githooks/commit-msg: the issue-ref rule, and the optional
# hooks.leakcheck checker (off when unset, refuses when set but unusable, runs before the
# merge/revert exemption).
set -u
here="$(cd "$(dirname "$0")/.." && pwd)"
hook="$here/.githooks/commit-msg"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
git -C "$tmp" init -q
fails=0

printf '#!/bin/sh\n! grep -qi reviewer\n' > "$tmp/deny-reviewer"; chmod +x "$tmp/deny-reviewer"
printf '#!/bin/sh\nexit 0\n' > "$tmp/notexec"

expect() { # want(0|1) checker-or-empty message
  want=$1 checker=$2 msg=$3
  if [ -n "$checker" ]; then git -C "$tmp" config hooks.leakcheck "$checker"; else git -C "$tmp" config --unset hooks.leakcheck 2>/dev/null; fi
  printf '%s\n' "$msg" > "$tmp/msg"
  (cd "$tmp" && bash "$hook" "$tmp/msg" >/dev/null 2>&1); got=$?
  [ "$got" -ne 0 ] && got=1
  if [ "$got" != "$want" ]; then echo "FAIL: want $want got $got | checker=${checker:-unset} | $msg"; fails=$((fails+1)); fi
}

expect 0 ""                     "fix: thing (refs #12)"
expect 1 ""                     "fix: thing with no ref"
expect 0 ""                     "fix: thing, reviewer said ok (refs #12)"
expect 0 "$tmp/deny-reviewer"   "fix: thing (refs #12)"
expect 1 "$tmp/deny-reviewer"   "fix: thing, reviewer said ok (refs #12)"
expect 1 "$tmp/deny-reviewer"   "Merge branch x, reviewer said ok"
expect 1 "$tmp/deny-reviewer"   "Revert \"y\", reviewer said ok"
expect 0 "$tmp/deny-reviewer"   "Merge branch x"
expect 1 "$tmp/missing"         "fix: thing (refs #12)"
expect 1 "$tmp/notexec"         "fix: thing (refs #12)"

[ "$fails" -eq 0 ] && echo "commit-msg checks ok" || exit 1
