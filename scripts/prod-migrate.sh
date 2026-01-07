#!/bin/bash
# Run migrations on production database
# Use this after deploying new migrations

set -e

APP="vibe-proteins-api"

echo "==> Checking current migration status..."
flyctl ssh console --app "$APP" --command "sqlite3 /data/vibeproteins.db 'SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5'"

echo ""
echo "==> Running migrations on production..."
flyctl ssh console --app "$APP" --command "sh -c 'cd /app && node dist/db/migrate.js'"

echo ""
echo "==> Verifying migrations after run..."
flyctl ssh console --app "$APP" --command "sqlite3 /data/vibeproteins.db 'SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5'"

echo ""
echo "==> Migrations complete!"
echo ""
echo "NOTE: If migrations say 'completed' but weren't applied, you may need to"
echo "run them manually. Use 'pnpm prod:db' to access the production database"
echo "and run the SQL from api/drizzle/XXXX_migration_name.sql manually."
