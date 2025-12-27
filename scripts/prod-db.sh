#!/bin/bash
# Connect to production SQLite database via Fly.io SSH
# Opens an interactive sqlite3 shell

APP="vibe-proteins-api"

echo "Connecting to production database..."
echo "Use .tables, .schema, SELECT etc."
echo "Type .quit to exit"
echo ""

flyctl ssh console --app "$APP" --command "sqlite3 /data/vibeproteins.db"
