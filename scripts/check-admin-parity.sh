#!/usr/bin/env bash
# Fails if any admin screen shared between meridian and admin-portal has drifted.
# The two apps must keep identical copies of every mirrored admin file.
set -u
MERIDIAN=artifacts/meridian/src
PORTAL=artifacts/admin-portal/src
status=0
count=0

check() {
  local rel=$1
  if [ -f "$MERIDIAN/$rel" ] && [ -f "$PORTAL/$rel" ]; then
    count=$((count + 1))
    if ! diff -q "$MERIDIAN/$rel" "$PORTAL/$rel" >/dev/null; then
      echo "DRIFT: $rel differs between meridian and admin-portal"
      status=1
    fi
  fi
}

# Build the union of relative paths and check each
for rel in $( { ls "$MERIDIAN"/pages/admin/*.tsx "$MERIDIAN"/components/admin/*.tsx 2>/dev/null | sed "s|^$MERIDIAN/||"; ls "$PORTAL"/pages/admin/*.tsx "$PORTAL"/components/admin/*.tsx 2>/dev/null | sed "s|^$PORTAL/||"; } | sort -u ); do
  check "$rel"
done
check "pages/admin-users.tsx"

if [ $status -ne 0 ]; then
  echo ""
  echo "Admin screens are out of sync. Copy the newer version to the other app so both stay identical."
  exit 1
fi
echo "Admin parity OK ($count mirrored files identical)"
