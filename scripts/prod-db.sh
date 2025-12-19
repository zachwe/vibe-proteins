#!/bin/bash
# Connect to production SQLite database via Fly.io SSH

flyctl ssh console --app vibe-proteins-api --command "sqlite3 /data/vibeproteins.db"
