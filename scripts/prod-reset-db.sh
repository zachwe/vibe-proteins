#!/bin/bash
# Reset the production database schema
# WARNING: This will delete all data!

set -e

APP="vibe-proteins-api"

echo "==> WARNING: This will delete ALL data in the production database!"
echo "    App: $APP"
echo ""
read -p "Type 'yes' to confirm: " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "==> Stopping the app..."
flyctl scale count 0 --app "$APP" --yes

echo "==> Deleting the database file..."
flyctl ssh console --app "$APP" --command "rm -f /data/vibeproteins.db"

echo "==> Restarting the app (migrations will run on startup)..."
flyctl scale count 1 --app "$APP" --yes

echo "==> Waiting for app to be healthy..."
sleep 5

echo ""
echo "==> Database reset complete!"
echo "    Run './scripts/prod-seed.sh' to seed challenge data."
