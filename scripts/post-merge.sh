#!/bin/bash
set -e

npm install

# drizzle-kit push will sometimes prompt interactively when it can't tell
# whether a new table is a rename of an old one. Stdin is closed during
# post-merge, so the prompt becomes EOF and the whole script hangs/fails.
# Piping a stream of newlines accepts the default ("create table") answer
# for every prompt, which is the correct choice for our schema (we never
# rename tables in place; we always add new ones).
yes "" | npm run db:push -- --force || npm run db:push -- --force < /dev/null || true
