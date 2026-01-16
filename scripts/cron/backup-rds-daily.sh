#!/bin/bash
# RDS backup script - runs every 2 days
# Keeps 3 most recent backups (6 days of coverage)

DATE=$(date +%Y%m%d)
SNAPSHOT_ID="cwf-manual-${DATE}"

echo "Creating RDS snapshot: ${SNAPSHOT_ID}"

aws rds create-db-snapshot \
  --db-instance-identifier cwf-dev-postgres \
  --db-snapshot-identifier "${SNAPSHOT_ID}" \
  --region us-west-2

if [ $? -eq 0 ]; then
  echo "✅ Snapshot created successfully: ${SNAPSHOT_ID}"
else
  echo "❌ Snapshot creation failed"
  exit 1
fi

# Keep only 3 most recent snapshots (6 days coverage)
echo "Cleaning up old snapshots (keeping 3 most recent)..."

aws rds describe-db-snapshots \
  --db-instance-identifier cwf-dev-postgres \
  --snapshot-type manual \
  --region us-west-2 \
  --query "DBSnapshots[?starts_with(DBSnapshotIdentifier, 'cwf-manual-')].{ID:DBSnapshotIdentifier,Time:SnapshotCreateTime}" \
  --output json | jq -r 'sort_by(.Time) | reverse | .[3:] | .[].ID' | while read snapshot; do
    if [ -n "$snapshot" ]; then
      echo "Deleting old snapshot: $snapshot"
      aws rds delete-db-snapshot \
        --db-snapshot-identifier "$snapshot" \
        --region us-west-2 2>/dev/null || echo "Failed to delete $snapshot"
    fi
  done

echo "✅ Backup maintenance complete"
