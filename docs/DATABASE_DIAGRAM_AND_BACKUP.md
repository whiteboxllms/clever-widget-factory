# Database Schema Diagram & Backup Guide

## Generate Database Diagram

### Kiro Hook (Recommended)

The schema diagram is automatically updated by Kiro agent when:
- Migration files change
- User requests schema update during PR prep
- Agent detects schema-related changes

See `.kiro/hooks/update-schema-diagram.md` for details.

### Manual Generation

Generate fresh schema from AWS RDS:

```bash
python3 scripts/generate-db-diagram.py > docs/DATABASE_SCHEMA.md
```

View the generated Mermaid diagram:
- In GitHub (renders automatically in .md files)
- [Mermaid Live Editor](https://mermaid.live)
- VS Code with Mermaid extension

### Generate PDF

Open HTML in browser and print to PDF:

```bash
bash scripts/generate-db-pdf.sh
# Opens browser, then Cmd+P → Save as PDF
```

## Database Backup Options

### Current Setup: GitHub Actions (Every 2 Days)
Your backup runs automatically via `.github/workflows/rds-backup.yml`:
- **Schedule**: Every 2 days at 2 AM UTC
- **Retention**: Keeps 3 most recent snapshots (6 days coverage)
- **Location**: AWS RDS snapshots in us-west-2
- **Manual trigger**: Available via GitHub Actions UI

**Check backup status:**
```bash
aws rds describe-db-snapshots \
  --db-instance-identifier cwf-dev-postgres \
  --snapshot-type manual \
  --region us-west-2 \
  --query "DBSnapshots[?starts_with(DBSnapshotIdentifier, 'cwf-manual-')].{ID:DBSnapshotIdentifier,Time:SnapshotCreateTime,Status:Status}" \
  --output table
```

### Backup Options Comparison

#### 1. AWS RDS Automated Backups (Recommended for Production)
**Pros:**
- Automatic daily backups
- Point-in-time recovery (up to 35 days)
- No manual intervention needed
- Integrated with AWS

**Setup:**
```bash
aws rds modify-db-instance \
  --db-instance-identifier cwf-dev-postgres \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --region us-west-2
```

**Cost:** ~$0.095/GB-month for backup storage

#### 2. Manual Snapshots (Current Setup)
**Pros:**
- Full control over timing
- Can keep indefinitely
- Good for pre-deployment backups

**Cons:**
- Requires manual/scheduled execution
- No point-in-time recovery

**Manual backup:**
```bash
./scripts/cron/backup-rds-daily.sh
```

#### 3. pg_dump to S3 (Logical Backups)
**Pros:**
- Portable across PostgreSQL versions
- Can restore to any PostgreSQL instance
- Smaller file sizes (compressed)

**Cons:**
- Slower for large databases
- Requires more setup

**Example script:**
```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
PGPASSWORD=$DB_PASSWORD pg_dump \
  -h your-rds-endpoint.rds.amazonaws.com \
  -U postgres \
  -d cwf_db \
  -F c \
  -f /tmp/backup-${DATE}.dump

aws s3 cp /tmp/backup-${DATE}.dump s3://cwf-backups/db/backup-${DATE}.dump
```

#### 4. AWS Backup Service
**Pros:**
- Centralized backup management
- Cross-region backup copies
- Compliance reporting
- Lifecycle policies

**Setup:** Configure via AWS Backup console or CloudFormation

**Cost:** $0.05/GB-month + restore costs

### Recommended Setup

For production, use **multiple backup strategies**:

1. **AWS RDS Automated Backups** (7-day retention)
   - Daily automatic backups
   - Point-in-time recovery

2. **Manual Snapshots** (keep 3 most recent)
   - Pre-deployment snapshots
   - Major milestone backups

3. **Monthly pg_dump to S3** (keep 12 months)
   - Long-term archival
   - Disaster recovery

### Restore from Backup

**From RDS snapshot:**
```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier cwf-restored \
  --db-snapshot-identifier cwf-manual-20240115 \
  --region us-west-2
```

**From pg_dump:**
```bash
aws s3 cp s3://cwf-backups/db/backup-20240115.dump /tmp/
pg_restore -h localhost -U postgres -d cwf_db /tmp/backup-20240115.dump
```

### Monitoring Backups

Add to your monitoring dashboard:
```bash
# Check last backup time
aws rds describe-db-instances \
  --db-instance-identifier cwf-dev-postgres \
  --query "DBInstances[0].LatestRestorableTime" \
  --region us-west-2

# List all snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier cwf-dev-postgres \
  --region us-west-2 \
  --output table
```

### Testing Backups

**Test restore quarterly:**
1. Create test RDS instance from snapshot
2. Verify data integrity
3. Test application connectivity
4. Delete test instance

```bash
# Quick restore test
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier cwf-test-restore \
  --db-snapshot-identifier cwf-manual-20240115 \
  --db-instance-class db.t3.micro \
  --region us-west-2

# Verify and cleanup
# ... test connection ...

aws rds delete-db-instance \
  --db-instance-identifier cwf-test-restore \
  --skip-final-snapshot \
  --region us-west-2
```
