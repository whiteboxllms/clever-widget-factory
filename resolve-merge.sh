#!/bin/bash
# Automated merge conflict resolution script
# Keeps AWS migration changes (--ours strategy)

echo "🔧 Resolving merge conflicts - keeping AWS migration version..."

# Keep your AWS version for all conflicted files
git checkout --ours README.md
git checkout --ours package.json
git checkout --ours package-lock.json
git checkout --ours .gitignore
git checkout --ours .env.example
git checkout --ours scripts/README.md

# Keep AWS version for all source files
git checkout --ours src/

# Stage all resolved files
git add .

# Clean up deleted files
echo "🧹 Cleaning up deleted migration files..."
git rm -f MIGRATION_AUDIT.md 2>/dev/null || true
git rm -f PASSWORD_CHANGE_VERIFICATION.md 2>/dev/null || true
git rm -f ROTATE_DB_PASSWORD.md 2>/dev/null || true
git rm -f SECURITY_INCIDENT_RESPONSE.md 2>/dev/null || true
git rm -f SUPABASE_TO_AWS_MIGRATION_PLAN.md 2>/dev/null || true
git rm -f *.sh 2>/dev/null || true
git rm -f *.sql 2>/dev/null || true
git rm -rf supabase/migrations/ 2>/dev/null || true
git rm -rf supabase/migrations_archive/ 2>/dev/null || true

echo "✅ Conflicts resolved! Review with: git status"
echo "📝 To commit: git commit -m 'Merge main into aws-migration: keep AWS infrastructure'"
echo "🧪 To test: npm test"
