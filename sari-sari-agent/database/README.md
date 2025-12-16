# Database Safety Procedures

## Overview

This directory contains all database-related operations including migrations, backups, and rollback procedures. All database changes follow strict safety protocols to ensure existing farm applications remain operational.

## Safety Checklist

Before any database modification:

- [ ] **BACKUP**: Create logical backup of affected tables
- [ ] **DOCUMENT**: Record exact rollback steps
- [ ] **TEST**: Verify changes in development environment
- [ ] **VERIFY**: Ensure existing applications still function
- [ ] **APPROVE**: Get human approval before proceeding

## Directory Structure

```
database/
├── migrations/         # Database schema changes
├── backups/           # Logical backups before changes
├── rollback/          # Rollback scripts for each migration
├── seeds/             # Test data for development
└── scripts/           # Utility scripts
```

## Backup Strategy

### Logical Backups
- Structure and data exported as SQL statements
- Stored in `backups/` with timestamp
- Include both schema and data
- Compressed and versioned

### Backup Naming Convention
```
backup_YYYYMMDD_HHMMSS_tablename.sql.gz
backup_20241215_143022_products.sql.gz
```

## Migration Process

1. **Create backup**: `npm run db:backup`
2. **Run migration**: `npm run db:migrate`
3. **Verify functionality**: Test existing applications
4. **Document changes**: Update migration log
5. **Get approval**: Human verification required

## Rollback Process

1. **Stop applications**: Prevent new connections
2. **Run rollback script**: `npm run db:rollback <migration_id>`
3. **Restore from backup**: If needed
4. **Verify restoration**: Test all functionality
5. **Resume operations**: Restart applications

## Emergency Procedures

### If Migration Fails
1. Immediately stop the migration process
2. Run the corresponding rollback script
3. Verify database integrity
4. Check application functionality
5. Report issue and investigate

### If Rollback Fails
1. Stop all database connections
2. Restore from logical backup
3. Verify data integrity
4. Test all applications
5. Document incident

## Human Approval Points

- Before first database modification
- After each major migration
- Before production deployment
- After any rollback operation

## Monitoring

- Database connection health
- Query performance impact
- Application error rates
- Data integrity checks