---
inclusion: manual
---

# PR Prep Skill

When the user invokes this skill, run through each step below in order. Report results as you go. Stop and flag any blockers.

## Step 1: Run Tests

```bash
npm run test:run
```

If tests fail, report which tests failed and stop. Do not proceed until the user acknowledges.

## Step 2: Security Scan

Search the codebase for hardcoded secrets. Check all staged and modified files for:
- Hardcoded passwords: `password=`, `PASSWORD=`, `DB_PASSWORD=`, `PGPASSWORD=`
- AWS credentials: `AKIA[0-9A-Z]{16}`, `AWS_SECRET`
- JWT tokens: `eyJraWQiOiJ`, `Bearer eyJ`
- Any string that looks like a real secret (not a placeholder or env var reference)

Verify `.env.local` and `.env.production` are in `.gitignore` and not staged.

Report: ✅ Clean or ⚠️ list each finding with file and line number.

## Step 3: Flag Temporary/WIP Files

Check for files that shouldn't be in a PR:
- Root directory: `*_FEATURE.md`, `*_WORKING.md`, `*_WIP.md`, `*_TEMP.md`, `*_DRAFT.md`
- Root directory: `test-*.sh`, `temp-*.sh`, `wip-*.sh`, `draft-*.sh`
- Any `TASK_*` or `FIX_*` markdown files in root (these are working docs)
- Untracked large markdown files in root that aren't permanent docs

Permanent docs to ignore: `README.md`, `QUICKSTART.md`, `ENGINEERING_GUIDE.md`, `ENVIRONMENT_SETUP.md`, `ARCHITECTURE_DIAGRAM.md`, `CURRENT_ARCHITECTURE.md`, `INTEGRATION_TEST_SETUP.md`, `PARTNER_AGENCY_RBAC_DESIGN.md`

Report: ✅ Clean or ⚠️ list files that should be removed or added to `.gitignore`.

## Step 4: Console Log Cleanup

Search `src/` and `lambda/` for debug logging:
- `console.log` (flag these)
- `console.debug` (flag these)
- Ignore: `console.error`, `console.warn` (intentional)

Report: ✅ Clean or ⚠️ list files with debug logs.

## Step 5: RDS Backup

Always run the backup script before any PR:

```bash
bash scripts/cron/backup-rds-daily.sh
```

Wait for the "Snapshot created successfully" confirmation before proceeding. If it fails, stop and report the error.

Report: ✅ Snapshot `cwf-manual-{DATE}` created or ❌ Backup failed.

## Step 6: Check for Database Changes

Check if any migration files were added or modified in this branch:

```bash
git diff main --name-only -- 'migrations/'
```

If migrations were detected:

### 6a: Update Schema Diagram

```bash
python3 scripts/generate-db-diagram.py > docs/DATABASE_SCHEMA.md
```

Verify the file was generated and report what tables/relationships changed.

If no migrations detected, skip this step and report: ✅ No DB changes.

## Step 7: Build Check

```bash
npm run build
```

If the build fails, report the errors and stop. Do not proceed until the user acknowledges.

Report: ✅ Build succeeded or ❌ Build failed with errors.

## Step 8: Summary

Provide a final checklist:

```
PR Prep Summary
───────────────
Tests:          ✅ / ❌
Build:          ✅ / ❌
Security:       ✅ / ⚠️
Temp Files:     ✅ / ⚠️
Console Logs:   ✅ / ⚠️
DB Backup:      ✅ / ❌
Schema Diagram: ✅ / ⏭️ (skipped - no migrations)
```

If all checks pass, say "Ready for PR." If any issues, list what needs to be fixed before opening the PR.
