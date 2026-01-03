#!/bin/bash
# Seed challenges to production database
# Uploads challenges.json to production and runs seed script

set -e

APP="vibe-proteins-api"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Seeding production database..."

# Create temp file with the seed script
cat > /tmp/seed-prod.js << 'SEEDEOF'
const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('/data/vibeproteins.db');
const challenges = JSON.parse(fs.readFileSync('/tmp/challenges.json', 'utf8'));

console.log('Seeding challenges...');

const upsert = db.prepare(`
  INSERT INTO challenges (
    id, name, description, mission, difficulty, level, task_type,
    target_pdb_id, target_uniprot_id, target_structure_url, target_sequence,
    target_chain_id, pdb_start_residue, pdb_description, chain_annotations,
    suggested_hotspots, educational_content, created_at
  ) VALUES (
    @id, @name, @description, @mission, @difficulty, @level, @taskType,
    @targetPdbId, @targetUniprotId, @targetStructureUrl, @targetSequence,
    @targetChainId, @pdbStartResidue, @pdbDescription, @chainAnnotations,
    @suggestedHotspots, @educationalContent, datetime('now')
  )
  ON CONFLICT(id) DO UPDATE SET
    name = @name,
    description = @description,
    mission = @mission,
    difficulty = @difficulty,
    level = @level,
    task_type = @taskType,
    target_pdb_id = @targetPdbId,
    target_uniprot_id = @targetUniprotId,
    target_structure_url = @targetStructureUrl,
    target_sequence = @targetSequence,
    target_chain_id = @targetChainId,
    pdb_start_residue = @pdbStartResidue,
    pdb_description = @pdbDescription,
    chain_annotations = @chainAnnotations,
    suggested_hotspots = @suggestedHotspots,
    educational_content = @educationalContent
`);

for (const c of challenges) {
  upsert.run({
    ...c,
    chainAnnotations: JSON.stringify(c.chainAnnotations),
    suggestedHotspots: c.suggestedHotspots ? JSON.stringify(c.suggestedHotspots) : null
  });
  console.log('  -', c.name);
}

console.log('Done! Seeded', challenges.length, 'challenges.');

// Seed GPU pricing (Modal rates as of Dec 2024, +30% markup)
console.log('\nSeeding GPU pricing...');

const gpuRates = [
  { id: 'T4', name: 'NVIDIA T4', modalRatePerSec: 0.000164 },
  { id: 'L4', name: 'NVIDIA L4', modalRatePerSec: 0.000222 },
  { id: 'A10G', name: 'NVIDIA A10G', modalRatePerSec: 0.000306 },
  { id: 'L40S', name: 'NVIDIA L40S', modalRatePerSec: 0.000542 },
  { id: 'A100_40GB', name: 'NVIDIA A100 40GB', modalRatePerSec: 0.000583 },
  { id: 'A100_80GB', name: 'NVIDIA A100 80GB', modalRatePerSec: 0.000694 },
  { id: 'H100', name: 'NVIDIA H100', modalRatePerSec: 0.001097 },
  { id: 'H200', name: 'NVIDIA H200', modalRatePerSec: 0.001261 },
  { id: 'B200', name: 'NVIDIA B200', modalRatePerSec: 0.001736 },
];

const upsertGpu = db.prepare(`
  INSERT INTO gpu_pricing (
    id, name, modal_rate_per_sec, markup_percent, is_active, created_at
  ) VALUES (
    @id, @name, @modalRatePerSec, 30, 1, datetime('now')
  )
  ON CONFLICT(id) DO UPDATE SET
    name = @name,
    modal_rate_per_sec = @modalRatePerSec,
    markup_percent = 30,
    is_active = 1
`);

for (const gpu of gpuRates) {
  upsertGpu.run(gpu);
  const ourRate = gpu.modalRatePerSec * 1.3;
  console.log('  -', gpu.name + ': $' + gpu.modalRatePerSec.toFixed(6) + '/sec (ours: $' + ourRate.toFixed(6) + '/sec)');
}

console.log('Done! Seeded', gpuRates.length, 'GPU pricing entries.');

// Seed deposit presets
console.log('\nSeeding deposit presets...');

const presets = [
  { id: '5', amountCents: 500, label: '$5', sortOrder: 1 },
  { id: '10', amountCents: 1000, label: '$10', sortOrder: 2 },
  { id: '25', amountCents: 2500, label: '$25', sortOrder: 3 },
  { id: '50', amountCents: 5000, label: '$50', sortOrder: 4 },
];

const upsertPreset = db.prepare(`
  INSERT INTO deposit_presets (
    id, amount_cents, label, is_active, sort_order, created_at
  ) VALUES (
    @id, @amountCents, @label, 1, @sortOrder, datetime('now')
  )
  ON CONFLICT(id) DO UPDATE SET
    amount_cents = @amountCents,
    label = @label,
    sort_order = @sortOrder,
    is_active = 1
`);

for (const preset of presets) {
  upsertPreset.run(preset);
  console.log('  -', preset.label);
}

console.log('Done! Seeded', presets.length, 'deposit presets.');

db.close();
SEEDEOF

# Upload files to production using SFTP
echo "==> Uploading files to production..."
flyctl ssh sftp shell --app "$APP" << EOF
put $PROJECT_DIR/api/src/db/challenges.json /tmp/challenges.json
put /tmp/seed-prod.js /tmp/seed-prod.js
EOF

# Run the seed script (from /app where node_modules exists)
echo "==> Running seed script..."
flyctl ssh console --app "$APP" --command "sh -c 'NODE_PATH=/app/node_modules node /tmp/seed-prod.js'"

# Cleanup
echo "==> Cleaning up..."
flyctl ssh console --app "$APP" --command "rm -f /tmp/challenges.json /tmp/seed-prod.js"
rm /tmp/seed-prod.js

echo "==> Production seed complete!"
