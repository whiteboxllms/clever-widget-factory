# Database Safety Workflow

## Overview

This document outlines the mandatory safety procedures for all database changes in the Sari Sari Agent project. These procedures ensure that existing farm applications remain operational throughout the development process.

## Safety Principles

1. **Non-destructive changes**: All modifications preserve existing data and functionality
2. **Backup first**: Always create logical backups before any schema changes
3. **Rollback ready**: Every migration has a tested rollback procedure
4. **Human approval**: Critical checkpoints require explicit human verification
5. **Verify functionality**: Test existing applications after each change

## Workflow Steps

### 1. Pre-Migration Safety Check

Before any database change:

```bash
# 1. Create backup of affected tables
npm run db:backup products

# 2. Verify backup was created successfully
ls -la database/backups/

# 3. Review migration and rollback scripts
cat database/migrations/001_add_sellable_column.sql
cat database/rollback/001_add_sellable_column_rollback.sql
```

### 2. Migration Execution

```bash
# Run migration with safety checks
npm run db:migrate 001_add_sellable_column
```

The migration script will:
- Verify table exists
- Create additional backups
- Execute changes in a transaction
- Verify database integrity
- Log all operations

### 3. Post-Migration Verification

After migration completes:

1. **Test existing applications**
   - Verify farm management system still works
   - Check all existing queries and operations
   - Confirm no performance degradation

2. **Verify new functionality**
   - Test new sellable column
   - Confirm default values are correct
   - Validate indexes are created

3. **Document results**
   - Record verification steps taken
   - Note any issues discovered
   - Update migration log

### 4. Human Approval Checkpoint

**REQUIRED**: Human verification before proceeding:

- [ ] Existing farm applications function normally
- [ ] Database migration completed successfully
- [ ] New agent tables are accessible
- [ ] No performance issues detected
- [ ] Rollback procedure tested (in development)

## Rollback Procedures

If issues are discovered:

```bash
# List applied migrations
npm run db:rollback list

# Rollback specific migration
npm run db:rollback 001_add_sellable_column

# Verify rollback completed
# Test existing applications
```

## Emergency Procedures

### If Migration Fails Mid-Process

1. **Immediate actions**:
   ```bash
   # Stop the migration process (Ctrl+C)
   # Check database state
   mysql -u root -p farm_db -e "SHOW TABLES; DESCRIBE products;"
   ```

2. **Assess damage**:
   - Check if transaction was rolled back automatically
   - Verify existing data integrity
   - Test critical application functions

3. **Recovery**:
   ```bash
   # If needed, restore from backup
   npm run db:rollback 001_add_sellable_column
   
   # Or restore from logical backup
   gunzip database/backups/backup_TIMESTAMP_products.sql.gz
   mysql -u root -p farm_db < database/backups/backup_TIMESTAMP_products.sql
   ```

### If Rollback Fails

1. **Stop all database connections**
2. **Restore from logical backup**:
   ```bash
   # Find latest backup
   ls -la database/backups/
   
   # Restore table structure and data
   mysql -u root -p farm_db < database/backups/backup_TIMESTAMP_products.sql
   ```
3. **Verify restoration**
4. **Test all applications**
5. **Document incident**

## Monitoring and Alerts

### Database Health Checks

- Connection pool status
- Query performance metrics
- Error rate monitoring
- Data integrity checks

### Application Health Checks

- Farm management system response times
- Critical operation success rates
- User-reported issues
- System error logs

## Approval Matrix

| Change Type | Backup Required | Rollback Script | Human Approval | Production Deployment |
|-------------|----------------|-----------------|----------------|----------------------|
| Add Column | ✅ | ✅ | ✅ | ✅ |
| New Table | ✅ | ✅ | ✅ | ✅ |
| Index Addition | ✅ | ✅ | ⚠️ | ✅ |
| Data Migration | ✅ | ✅ | ✅ | ✅ |
| Drop Column | ✅ | ✅ | ✅ | ✅ |

## Contact Information

- **Database Administrator**: [Your contact]
- **Farm System Owner**: [Your contact]
- **Emergency Contact**: [Your contact]

## Revision History

| Date | Version | Changes | Approved By |
|------|---------|---------|-------------|
| 2024-12-15 | 1.0 | Initial safety workflow | [Your name] |