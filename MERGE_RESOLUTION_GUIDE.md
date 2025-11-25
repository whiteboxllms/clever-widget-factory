# Merge Conflict Resolution Guide

## Situation
Merging `origin/main` (Supabase-based) into `feature/aws-migration` (AWS-based)

## Strategy
Since you're happy with the AWS migration, use `--ours` strategy to keep your AWS changes.

## Quick Resolution Commands

### Option 1: Accept ALL your AWS changes (Recommended)
```bash
# For all conflicted files, keep your AWS migration version
git checkout --ours .
git add .
git commit -m "Merge main into aws-migration: keep AWS infrastructure"
```

### Option 2: Selective resolution (if you want some main changes)
```bash
# Keep your version for specific files
git checkout --ours README.md
git checkout --ours package.json
git checkout --ours package-lock.json
git checkout --ours .gitignore
git checkout --ours .env.example

# For source files, keep yours (AWS version)
git checkout --ours src/

# Add resolved files
git add .
git commit -m "Merge main into aws-migration: keep AWS infrastructure"
```

### Option 3: Manual review of each conflict
```bash
# Check each conflicted file
git status | grep "both modified"

# For each file, decide:
git checkout --ours <file>   # Keep AWS version
# OR
git checkout --theirs <file> # Keep main version
# OR manually edit the file

git add <file>
```

## Files with Conflicts

### Critical Files (Keep --ours / AWS version):
- `README.md` - Your AWS docs vs Supabase docs
- `package.json` - Your test scripts and AWS dependencies
- `.env.example` - AWS config vs Supabase config
- All `src/` files - AWS API calls vs Supabase calls

### Safe to review:
- `.gitignore` - Likely safe to merge both
- New files from main that don't conflict with AWS

## After Resolution

```bash
# Verify no conflicts remain
git status

# Run tests to ensure everything works
npm test

# Push the merge
git push origin feature/aws-migration
```

## Cleanup After Merge

Remove these files that were deleted in your branch:
```bash
git rm MIGRATION_AUDIT.md PASSWORD_CHANGE_VERIFICATION.md ROTATE_DB_PASSWORD.md SECURITY_INCIDENT_RESPONSE.md SUPABASE_TO_AWS_MIGRATION_PLAN.md
git rm *.sh *.sql
git add .
git commit --amend --no-edit
```
