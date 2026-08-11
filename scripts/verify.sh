#!/usr/bin/env bash
# Verify one folder of the v3 batch against what is actually on GitHub.
#
# Compares byte for byte, not "does the URL return 200". Checking existence is
# what let two scrambled files through last time: both were present, both held
# the wrong content.
#
# Usage: scripts/verify.sh src/services

set -u
REPO="ehjaylorenzo2-byte/Better-Me"
BASE="https://raw.githubusercontent.com/${REPO}/refs/heads/main"
STAGE="${STAGE:-/tmp/v4}"
DIR="${1:?usage: verify.sh <folder>}"
DIR="${DIR%/}"

fail=0
pass=0

while IFS= read -r local; do
  rel="${local#${STAGE}/}"
  tmp="$(mktemp)"

  # Two separate problems, both of which produced false alarms:
  #
  #  1. The CDN served a stale copy, fixed by a unique query string per request.
  #  2. A fresh commit takes up to about a minute to reach raw.githubusercontent
  #     even with the cache defeated, so the first read of a just-pushed file can
  #     legitimately still be the old one.
  #
  # So a mismatch is retried a few times before it is believed. Reporting a
  # failure that is really just propagation costs the user a pointless re-upload,
  # which is exactly what happened.
  for attempt in 1 2 3 4 5; do
    bust="$(date +%s%N)-$$-$RANDOM"
    curl -sS -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' \
      "${BASE}/${rel}?cb=${bust}" -o "$tmp"
    cmp -s "$tmp" "$local" && break
    [ "$attempt" -lt 5 ] && sleep 8
  done

  if cmp -s "$tmp" "$local"; then
    printf 'OK        %s\n' "$rel"
    pass=$((pass + 1))
  else
    printf 'MISMATCH  %s   (repo %sB vs local %sB)\n' \
      "$rel" "$(stat -c%s "$tmp")" "$(stat -c%s "$local")"
    fail=$((fail + 1))
  fi
  rm -f "$tmp"
done < <(find "${STAGE}/${DIR}" -maxdepth 1 -type f | sort)

echo "---"
echo "${pass} ok, ${fail} to fix"
exit $((fail > 0))
