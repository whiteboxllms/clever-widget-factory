# Database Restoration and Post-Backup Migration Script

This script automates the process of restoring a database from backup and applying post-backup migrations. It supports both local development and production environments.

## Usage

### Local Development (Default)
```bash
./scripts/restore-and-migrate.sh
```

### Production
```bash
# Set your production database URL
export PROD_DATABASE_URL="postgresql://user:password@host:port/database"

# Run with production flag
./scripts/restore-and-migrate.sh --prod
```

### Custom Backup File
```bash
./scripts/restore-and-migrate.sh --backup "my-backup-file.backup"
```

## What the Script Does

1. **Checks Prerequisites**: Verifies required tools (psql, supabase CLI, docker)
2. **Local Mode**:
   - Stops Supabase if running
   - Deletes local database volume
   - Starts fresh Supabase instance
3. **Production Mode**:
   - Shows warning and requires confirmation
   - Uses PROD_DATABASE_URL environment variable
4. **Restores Database**: Loads backup file using psql (includes schema + data)
5. **Fixes Migration Order**: Automatically renames audit fields migration to run before observations migration
6. **Runs Post-Backup Migrations**: Executes all post-backup migrations in timestamp order
7. **Verifies Database**: Checks that key tables exist and migrations were applied

## Environment Variables

- `PROD_DATABASE_URL`: Required for production mode. Format: `postgresql://user:password@host:port/database`

## Safety Features

- **Production Confirmation**: Requires typing "RESTORE" to confirm production operations
- **Backup Verification**: Checks that backup file exists before attempting restoration
- **Error Handling**: Exits on any error with clear messages
- **Post-Backup Migration Order Fix**: Automatically handles the migration dependency issue we encountered

## Example Output

```
[INFO] Starting database restoration and post-backup migration process...
[INFO] Running in LOCAL mode
[INFO] Supabase is already running
[INFO] Stopping Supabase...
[INFO] Removing local database volume...
[INFO] Starting Supabase with fresh database...
[INFO] Restoring database from backups/db_cluster-10-10-2025@17-03-17.backup...
[SUCCESS] Database restoration completed
[INFO] Fixing migration order by renaming audit fields migration...
[SUCCESS] Migration order fixed
[INFO] Running migrations from supabase/migrations_archive/20251011_pre_cleanup...
[INFO] Running migration: 20251002000000_remove_mission_status_constraints.sql
[SUCCESS] Migration 20251002000000_remove_mission_status_constraints.sql completed successfully
...
[SUCCESS] All migrations completed successfully
[INFO] Verifying database restoration...
[SUCCESS] Database verification passed - all key tables exist
[SUCCESS] Migration verification passed - action_implementation_updates table exists
[SUCCESS] Database restoration and migration process completed successfully!
```
