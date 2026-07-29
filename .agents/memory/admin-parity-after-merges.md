---
name: Admin parity after merges
description: Task-agent merges can silently revert mirrored admin files and delete the parity script
---

Meridian and admin-portal keep verbatim copies of every admin screen (pages/admin/*, components/admin/*, pages/admin-users.tsx). `bash scripts/check-admin-parity.sh` is registered as the `admin-parity` validation step.

**Why:** A task-agent merge once reverted several mirrored files on one side (losing the visibility field and a base-path 404 fix) and deleted scripts/check-admin-parity.sh entirely.

**How to apply:** After any task merge, first confirm the parity script still exists, then run it and diff each drifted file both ways — pick the *newest* side per file (merges can revert either app). Also re-verify the SelectExercise stripBasePath fix survived; without it, exercise selection 404s in the portal (double /admin-portal base).
