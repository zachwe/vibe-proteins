# QA Directory

Quality assurance documentation and testing resources for ProteinDojo.

## Contents

| File | Purpose |
|------|---------|
| `QA-PLAN.md` | Comprehensive QA plan covering all features |
| `TEAMS-CHECKLIST.md` | Detailed checklist for the teams feature |
| `smoke-test.sh` | Quick automated smoke test script |

## Quick Start

### Run Smoke Test

```bash
# Ensure local dev server is running (pnpm dev)
./qa/smoke-test.sh
```

### Manual Testing

1. Open `QA-PLAN.md` for full testing procedures
2. Use `TEAMS-CHECKLIST.md` for new teams feature testing
3. Log bugs using the template in `QA-PLAN.md`

## Testing Philosophy

Given the AI-assisted development approach:

1. **Test early, test often** - Run smoke tests after every significant change
2. **Edge cases matter** - AI may miss boundary conditions
3. **Integration points** - Pay extra attention to where features connect
4. **User flows** - Test complete workflows, not just individual features
5. **Security** - Verify authorization on every protected endpoint

## When to QA

| Event | Testing Level |
|-------|---------------|
| Every code change | Quick manual verification |
| Before PR merge | Smoke test + affected features |
| Before deploy | Full smoke test |
| After deploy | Production smoke test |
| New feature complete | Full feature checklist |
| Weekly | Comprehensive regression |
