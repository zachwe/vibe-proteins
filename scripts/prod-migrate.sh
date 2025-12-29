#!/bin/bash
# Run migrations on production database
# Use this after deploying new migrations

set -e

APP="vibe-proteins-api"

echo "==> Running migrations on production..."

flyctl ssh console --app "$APP" --command "sh -c 'cd /app && node dist/db/migrate.js'"

echo "==> Migrations complete!"
