#!/usr/bin/env bash
# One-off cleanup: soft-delete duplicate Tabs projects (same workspace_root)
# created by older builds before the per-workspace-root uniqueness invariant.
#
# It is event-sourced-correct: it appends a `project.deleted` event to the
# append-only log for each duplicate (exactly what a real `project.delete`
# command emits — single event, no cascade), then mirrors the projection row
# (deleted_at) and bumps every projector checkpoint, so the result is identical
# to the app having dispatched the deletes itself.
#
# SAFE BY DESIGN:
#   - refuses to run while Tabs is running (avoids DB corruption)
#   - backs up state.sqlite first
#   - only deletes the explicitly listed ids, and asserts each has 0 live threads
#   - runs as a single transaction
set -euo pipefail

DB="$HOME/.tabs/userdata/state.sqlite"

# Duplicates to remove (kept counterparts: ThrottleClan=195abd46 [has threads],
# tabs=966f5a84, Intern-batch-08=9fdce017 [single, untouched]).
DELETE_IDS=(
  "036ec165-bea8-49d1-9d54-4172afd14419"  # ThrottleClan dup (0 threads)
  "c39665f7-01a6-4dd0-9bb9-344ebf353414"  # ThrottleClan dup (0 threads)
  "4e9cfb43-bb32-47ed-be7e-a1ece9776541"  # tabs dup (0 threads)
)

if [ ! -f "$DB" ]; then
  echo "ERROR: DB not found at $DB" >&2
  exit 1
fi

# Guard: Tabs must be closed.
if pgrep -f "/Applications/Tabs.app/Contents/MacOS/Tabs" >/dev/null 2>&1; then
  echo "ERROR: Tabs is still running. Quit it (Cmd+Q) and re-run." >&2
  exit 1
fi

# Backup.
BACKUP="$DB.bak.$(date +%Y%m%d-%H%M%S)"
cp "$DB" "$BACKUP"
echo "Backup written: $BACKUP"

NOW="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"

echo "=== BEFORE (live projects) ==="
sqlite3 -header -column "$DB" \
  "SELECT project_id, title, workspace_root FROM projection_projects WHERE deleted_at IS NULL ORDER BY workspace_root;"

# Safety assertion + per-id event append, all in one transaction.
{
  echo "BEGIN;"
  for id in "${DELETE_IDS[@]}"; do
    # Abort the whole transaction if this project has any live thread.
    echo "SELECT CASE WHEN (SELECT COUNT(*) FROM projection_threads WHERE project_id='$id' AND deleted_at IS NULL) > 0
                       THEN RAISE(ABORT, 'refusing: project $id has live threads') END;"
    evid="$(uuidgen | tr '[:upper:]' '[:lower:]')"
    cmdid="$(uuidgen | tr '[:upper:]' '[:lower:]')"
    # Append the project.deleted event (sequence auto-assigned; stream_version = next for this stream).
    echo "INSERT INTO orchestration_events
            (event_id, aggregate_kind, stream_id, stream_version, event_type, occurred_at,
             command_id, causation_event_id, correlation_id, actor_kind, payload_json, metadata_json)
          VALUES
            ('$evid', 'project', '$id',
             (SELECT COALESCE(MAX(stream_version)+1, 0) FROM orchestration_events WHERE aggregate_kind='project' AND stream_id='$id'),
             'project.deleted', '$NOW', '$cmdid', NULL, '$cmdid', 'client',
             json_object('projectId','$id','deletedAt','$NOW'), '{}');"
    # Mirror the projection row.
    echo "UPDATE projection_projects SET deleted_at='$NOW', updated_at='$NOW' WHERE project_id='$id';"
  done
  # Bump every projector checkpoint to the new max sequence (project.deleted is a
  # no-op for non-project projectors, so this matches normal catch-up).
  echo "UPDATE projection_state SET last_applied_sequence=(SELECT MAX(sequence) FROM orchestration_events), updated_at='$NOW';"
  echo "COMMIT;"
} | sqlite3 "$DB"

echo "=== AFTER (live projects) ==="
sqlite3 -header -column "$DB" \
  "SELECT project_id, title, workspace_root FROM projection_projects WHERE deleted_at IS NULL ORDER BY workspace_root;"

echo "Integrity check: $(sqlite3 "$DB" 'PRAGMA integrity_check;')"
echo "Done. If anything looks wrong, restore with: cp '$BACKUP' '$DB'"
