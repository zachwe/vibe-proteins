#!/bin/bash
# Seed reference binders to production database
# Uploads reference-binders.json and runs seed script

set -e

APP="vibe-proteins-api"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Seeding reference binders to production..."

# Create temp file with the seed script
cat > /tmp/seed-reference-binders.js << 'SEEDEOF'
const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('/data/vibeproteins.db');
const binders = JSON.parse(fs.readFileSync('/tmp/reference-binders.json', 'utf8'));

console.log('Seeding reference binders...');

const upsert = db.prepare(`
  INSERT INTO reference_binders (
    id, challenge_id, name, slug, binder_type, pdb_id, pdb_url,
    binder_chain_id, composite_score, ip_sae_score, plddt, ptm,
    iptm, pdockq, pdockq2, lis, interface_area, shape_complementarity,
    help_article_slug, short_description, scoring_note, discovery_year,
    approval_status, is_active, sort_order, created_at
  ) VALUES (
    @id, @challengeId, @name, @slug, @binderType, @pdbId, @pdbUrl,
    @binderChainId, @compositeScore, @ipSaeScore, @plddt, @ptm,
    @iptm, @pdockq, @pdockq2, @lis, @interfaceArea, @shapeComplementarity,
    @helpArticleSlug, @shortDescription, @scoringNote, @discoveryYear,
    @approvalStatus, 1, @sortOrder, unixepoch()
  )
  ON CONFLICT(id) DO UPDATE SET
    challenge_id = @challengeId,
    name = @name,
    slug = @slug,
    binder_type = @binderType,
    pdb_id = @pdbId,
    pdb_url = @pdbUrl,
    binder_chain_id = @binderChainId,
    composite_score = @compositeScore,
    ip_sae_score = @ipSaeScore,
    plddt = @plddt,
    ptm = @ptm,
    iptm = @iptm,
    pdockq = @pdockq,
    pdockq2 = @pdockq2,
    lis = @lis,
    interface_area = @interfaceArea,
    shape_complementarity = @shapeComplementarity,
    help_article_slug = @helpArticleSlug,
    short_description = @shortDescription,
    scoring_note = @scoringNote,
    discovery_year = @discoveryYear,
    approval_status = @approvalStatus,
    sort_order = @sortOrder,
    is_active = 1
`);

function nullish(v) { return v !== undefined && v !== null ? v : null; }

for (const b of binders) {
  const scores = b.scores || {};
  upsert.run({
    id: b.id,
    challengeId: b.challengeId,
    name: b.name,
    slug: b.slug,
    binderType: b.binderType,
    pdbId: nullish(b.pdbId),
    pdbUrl: nullish(b.pdbUrl),
    binderChainId: nullish(b.binderChainId),
    compositeScore: nullish(b.compositeScore),
    ipSaeScore: nullish(scores.ipSaeScore),
    plddt: nullish(scores.plddt),
    ptm: nullish(scores.ptm),
    iptm: nullish(scores.iptm),
    pdockq: nullish(scores.pdockq),
    pdockq2: nullish(scores.pdockq2),
    lis: nullish(scores.lis),
    interfaceArea: nullish(scores.interfaceArea),
    shapeComplementarity: nullish(scores.shapeComplementarity),
    helpArticleSlug: nullish(b.helpArticleSlug),
    shortDescription: nullish(b.shortDescription),
    scoringNote: nullish(b.scoringNote),
    discoveryYear: nullish(b.discoveryYear),
    approvalStatus: nullish(b.approvalStatus),
    sortOrder: b.sortOrder || 0,
  });
  const pdockq = scores.pdockq;
  const scoreInfo = pdockq !== undefined ? ' [pDockQ: ' + pdockq.toFixed(3) + ']' : '';
  console.log('  -', b.name + scoreInfo);
}

console.log('Done! Seeded', binders.length, 'reference binders.');
db.close();
SEEDEOF

# Upload files to production using SFTP
echo "==> Uploading files to production..."
flyctl ssh sftp shell --app "$APP" << EOF
put $PROJECT_DIR/api/src/db/reference-binders.json /tmp/reference-binders.json
put /tmp/seed-reference-binders.js /tmp/seed-reference-binders.js
EOF

# Run the seed script (from /app where node_modules exists)
echo "==> Running seed script..."
flyctl ssh console --app "$APP" --command "sh -c 'NODE_PATH=/app/node_modules node /tmp/seed-reference-binders.js'"

# Cleanup
echo "==> Cleaning up..."
flyctl ssh console --app "$APP" --command "rm -f /tmp/reference-binders.json /tmp/seed-reference-binders.js"
rm /tmp/seed-reference-binders.js

echo "==> Reference binders seed complete!"
