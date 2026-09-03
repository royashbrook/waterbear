#!/usr/bin/env bash
# check-ring-strip: the guard strips a ring's signature before delivery, and ONLY the signature.
# regression for the three shapes that matter: an unsigned line whose topic contains " sig:" text
# (must survive whole), an inline signature (final field dropped), a sidecar marker `sig:e1`
# (final field dropped). the expression under test is the one in the guard heredoc; this script
# greps the installer for it so the two cannot drift apart silently.
set -u
INSTALL="$(dirname "$0")/waterbear-install"
# shellcheck disable=SC2016  # literal on purpose: this is the guard's source text, grepped verbatim
expr='[[ "$line" =~ ^(.*)\ sig:[^[:space:]]+$ ]] && line="${BASH_REMATCH[1]}"'
grep -qF "$expr" "$INSTALL" || { echo "check-ring-strip: the guard no longer carries the tested strip expression; update this check with it" >&2; exit 1; }
strip() { local line="$1"; [[ "$line" =~ ^(.*)\ sig:[^[:space:]]+$ ]] && line="${BASH_REMATCH[1]}"; printf '%s' "$line"; }
fail=0
check() { # name, input, expected
  local got; got="$(strip "$2")"
  if [ "$got" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: got [$got] want [$3]"; fail=1; fi
}
u='ping id:r6a9aaaa0001 from:max topic:discuss sig:formats at:2026-09-03T08:40:00'
check "unsigned topic text kept" "$u" "$u"
check "inline signature dropped" "$u sig:U1NIU0lHAAAAAQAAADMAAAALc3No" "$u"
check "sidecar marker dropped"   "$u sig:e1" "$u"
check "plain line untouched"     'ping id:r6a9aaaa0002 from:max topic:hello at:2026-09-03T08:40:01' 'ping id:r6a9aaaa0002 from:max topic:hello at:2026-09-03T08:40:01'
[ "$fail" -eq 0 ] && echo "ring-strip ok: signature is the final field only" || exit 1
