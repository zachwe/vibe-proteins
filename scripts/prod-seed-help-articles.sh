#!/bin/bash
# Seed help articles to production database
# Uploads help-articles.json and markdown files, then runs seed script

set -e

APP="vibe-proteins-api"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
HELP_ARTICLES_DIR="$PROJECT_DIR/api/src/db/help-articles"

echo "==> Seeding help articles to production..."

# Create temp file with the seed script
cat > /tmp/seed-help-articles.js << 'SEEDEOF'
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('/data/vibeproteins.db');
const articles = JSON.parse(fs.readFileSync('/tmp/help-articles.json', 'utf8'));

console.log('Seeding help articles...');

const upsert = db.prepare(`
  INSERT INTO help_articles (
    slug, title, content, category, related_challenges, created_at, updated_at
  ) VALUES (
    @slug, @title, @content, @category, @relatedChallenges, unixepoch(), unixepoch()
  )
  ON CONFLICT(slug) DO UPDATE SET
    title = @title,
    content = @content,
    category = @category,
    related_challenges = @relatedChallenges,
    updated_at = unixepoch()
`);

for (const article of articles) {
  // Load content from markdown file
  const contentPath = path.join('/tmp/help-articles', path.basename(article.contentFile));
  const content = fs.readFileSync(contentPath, 'utf8');

  upsert.run({
    slug: article.slug,
    title: article.title,
    content: content,
    category: article.category,
    relatedChallenges: article.relatedChallenges ? JSON.stringify(article.relatedChallenges) : null,
  });
  console.log('  -', article.title);
}

console.log('Done! Seeded', articles.length, 'help articles.');
db.close();
SEEDEOF

# Upload files to production using SFTP
echo "==> Uploading files to production..."

# First upload the JSON and script
flyctl ssh sftp shell --app "$APP" << EOF
put $PROJECT_DIR/api/src/db/help-articles.json /tmp/help-articles.json
put /tmp/seed-help-articles.js /tmp/seed-help-articles.js
EOF

# Create the help-articles directory on remote
flyctl ssh console --app "$APP" --command "mkdir -p /tmp/help-articles"

# Upload each markdown file
echo "==> Uploading markdown files..."
for mdfile in "$HELP_ARTICLES_DIR"/*.md; do
  filename=$(basename "$mdfile")
  echo "  - $filename"
  flyctl ssh sftp shell --app "$APP" << EOF
put $mdfile /tmp/help-articles/$filename
EOF
done

# Run the seed script (from /app where node_modules exists)
echo "==> Running seed script..."
flyctl ssh console --app "$APP" --command "sh -c 'NODE_PATH=/app/node_modules node /tmp/seed-help-articles.js'"

# Cleanup
echo "==> Cleaning up..."
flyctl ssh console --app "$APP" --command "rm -rf /tmp/help-articles.json /tmp/seed-help-articles.js /tmp/help-articles"
rm /tmp/seed-help-articles.js

echo "==> Help articles seed complete!"
