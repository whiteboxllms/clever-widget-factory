# Security Incident: Exposed Database Password

## ⚠️ CRITICAL SECURITY ISSUE

**Date Identified**: Current  
**Status**: Password exposed in git history

## Summary

The database password `CWF_Dev_2025!` was hardcoded in multiple Lambda functions and committed to git. This means:

1. **Anyone with repository access** can see the password in git history
2. **The password is permanently in git history** even after removal
3. **The database is potentially compromised** if unauthorized access occurred

## Affected Files (Git History)

The password was committed in these files:
- `lambda/core/index.js`
- `lambda/actions/index.js`
- `lambda/authorizer/index.js`
- `lambda/organization/index.js`
- `lambda/db-migration/index.js`
- `lambda/core/build/index.js`
- `lambda/actions/build/index.js`
- `lambda/organization/build/index.js`
- `api/server.js`

## Immediate Actions Required

### 1. Rotate Database Password (URGENT)

**Change the PostgreSQL password immediately:**

```sql
-- Connect to database as admin
ALTER USER postgres WITH PASSWORD 'NEW_SECURE_PASSWORD_HERE';
```

Or via AWS RDS Console:
1. Go to AWS RDS Console
2. Select your database instance
3. Modify → Master password
4. Set new secure password
5. Apply changes immediately

### 2. Update All Environment Variables

After rotating the password, update all Lambda functions:

```bash
# Update core Lambda
aws lambda update-function-configuration \
  --function-name cwf-core-lambda \
  --environment Variables="{DB_PASSWORD=NEW_SECURE_PASSWORD}" \
  --region us-west-2

# Update actions Lambda
aws lambda update-function-configuration \
  --function-name cwf-actions-lambda \
  --environment Variables="{DB_PASSWORD=NEW_SECURE_PASSWORD}" \
  --region us-west-2

# Update authorizer Lambda
aws lambda update-function-configuration \
  --function-name cwf-api-authorizer \
  --environment Variables="{DB_PASSWORD=NEW_SECURE_PASSWORD}" \
  --region us-west-2

# Update organization Lambda
aws lambda update-function-configuration \
  --function-name cwf-organization-lambda \
  --environment Variables="{DB_PASSWORD=NEW_SECURE_PASSWORD}" \
  --region us-west-2

# Update db-migration Lambda
aws lambda update-function-configuration \
  --function-name cwf-db-migration \
  --environment Variables="{DB_PASSWORD=NEW_SECURE_PASSWORD}" \
  --region us-west-2
```

### 3. Audit Database Access

Check for unauthorized access:

```sql
-- Check recent connections
SELECT * FROM pg_stat_activity 
WHERE datname = 'postgres' 
ORDER BY backend_start DESC;

-- Check for suspicious queries (if logging enabled)
-- Review CloudWatch logs for unusual patterns
```

### 4. Review Repository Access

- Audit who has access to the git repository
- Review commit history for any suspicious activity
- Consider if the repository should be private (if it's currently public)

## Git History Cleanup Options

### Option 1: Accept the Risk (If Dev Database)

If this is a **development database** that will be destroyed/recreated:
- Accept that the password is in history
- Ensure production uses different credentials
- Document this as a lesson learned

### Option 2: Remove from Git History (Advanced)

**⚠️ WARNING: This rewrites git history and requires coordination with all team members**

If the repository is:
- Private
- Small team
- Not widely distributed

You can use `git filter-branch` or `git filter-repo`:

```bash
# Install git-filter-repo (recommended tool)
pip install git-filter-repo

# Remove password from all history
git filter-repo --replace-text <(echo "CWF_Dev_2025!==>REMOVED_PASSWORD")

# Force push (coordinate with team first!)
git push origin --force --all
```

**⚠️ All team members must:**
1. Delete their local repository
2. Clone fresh copy
3. Rebase any local branches

### Option 3: Create New Repository

If cleanup is too complex:
1. Create new repository
2. Copy current code (without history)
3. Update all remote references
4. Archive old repository

## Prevention Measures

✅ **Implemented:**
- Removed all hardcoded passwords
- Made passwords required via environment variables
- Added security documentation

📋 **Recommended:**
- Use AWS Secrets Manager for production
- Enable AWS RDS encryption at rest
- Implement database connection logging
- Regular security audits
- Pre-commit hooks to prevent password commits
- Use `.gitignore` for any config files with secrets

## Pre-commit Hook (Recommended)

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Prevent committing passwords
if git diff --cached | grep -E "(password|PASSWORD|secret|SECRET).*=.*['\"].*['\"]"; then
    echo "ERROR: Potential password detected in commit!"
    echo "Please use environment variables instead."
    exit 1
fi
```

## Status

- [x] Removed hardcoded passwords from source code
- [ ] Database password rotated
- [ ] All Lambda environment variables updated
- [ ] Database access audited
- [ ] Repository access reviewed
- [ ] Git history cleanup decision made

## Notes

- The exposed password was for a development database
- Production should use different credentials stored in AWS Secrets Manager
- All future credentials must use environment variables or AWS Secrets Manager

