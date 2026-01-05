#!/bin/bash
set -e

echo "Restoring database from R2..."
litestream restore -if-replica-exists -o /data/vibeproteins.db /data/vibeproteins.db

if [ ! -f /data/vibeproteins.db ]; then
    echo "ERROR: Database restore failed - no replica found"
    exit 1
fi

echo "Database restored successfully"
echo "Starting Datasette..."

exec datasette /data/vibeproteins.db \
    --host 0.0.0.0 \
    --port 8080 \
    --metadata /app/metadata.json \
    --setting sql_time_limit_ms 30000 \
    --setting max_returned_rows 1000
