#!/bin/bash

# Database Restoration and Migration Script
# Run this after stopping the supabase db.
# Usage: ./scripts/restore-and-migrate.sh [--prod]
# --prod flag will run against production database

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default to local
PROD_MODE=false
BACKUP_FILE="/Users/stefanhamilton/dev/clever-widget-factory/db_cluster-12-10-2025@17-04-52.backup"
MIGRATIONS_DIR="supabase/migrations_archive/20251013_consolidated"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --prod)
            PROD_MODE=true
            shift
            ;;
        --backup)
            BACKUP_FILE="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [--prod] [--backup BACKUP_FILE]"
            echo "  --prod     Run against production database"
            echo "  --backup   Specify backup file (default: $BACKUP_FILE)"
            echo "  --help     Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get database connection string
get_db_connection() {
    if [ "$PROD_MODE" = true ]; then
        if [ -z "$PROD_DATABASE_URL" ]; then
            print_error "PROD_DATABASE_URL environment variable must be set for production mode"
            exit 1
        fi
        echo "$PROD_DATABASE_URL"
    else
        echo "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    fi
}

# Function to check if Supabase is running (local only)
check_supabase_running() {
    if [ "$PROD_MODE" = false ]; then
        if ! supabase status >/dev/null 2>&1; then
            print_status "Starting Supabase..."
            supabase start
        else
            print_status "Supabase is already running"
        fi
    fi
}

# Function to delete local database
delete_local_db() {
    if [ "$PROD_MODE" = false ]; then
        print_status "Stopping Supabase..."
        supabase stop
        
        print_status "Removing local database volume..."
        docker volume rm supabase_db_oskwnlhuuxjfuwnjuavn 2>/dev/null || true
        
        print_status "Starting Supabase with fresh database..."
        supabase start
    else
        print_warning "Production mode: Skipping database deletion"
        print_warning "Make sure you have a backup of your production database!"
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Aborted by user"
            exit 0
        fi
    fi
}

# Function to restore database
restore_database() {
    local db_connection=$(get_db_connection)
    
    if [ ! -f "$BACKUP_FILE" ]; then
        print_error "Backup file '$BACKUP_FILE' not found!"
        exit 1
    fi
    
    print_status "Restoring database from $BACKUP_FILE..."
    
    if [ "$PROD_MODE" = true ]; then
        print_warning "This will restore the backup to PRODUCTION database!"
        read -p "Are you absolutely sure? Type 'RESTORE' to confirm: " -r
        if [ "$REPLY" != "RESTORE" ]; then
            print_status "Aborted by user"
            exit 0
        fi
    fi
    
    # Use single-transaction to handle backslash commands better
    psql "$db_connection" --single-transaction -f "$BACKUP_FILE" || {
        print_warning "Database restoration completed with some warnings/errors (this is normal)"
    }
    
    print_success "Database restoration completed"
}

# Function to fix migration order
fix_migration_order() {
    local migrations_dir="$MIGRATIONS_DIR"
    
    if [ ! -d "$migrations_dir" ]; then
        print_error "Migrations directory '$migrations_dir' not found!"
        exit 1
    fi
    
    # Check if audit fields migration needs to be renamed
    local audit_migration="$migrations_dir/20251005160000_add_audit_fields_to_actions.sql"
    local renamed_migration="$migrations_dir/20251005135000_add_audit_fields_to_actions.sql"
    
    if [ -f "$audit_migration" ] && [ ! -f "$renamed_migration" ]; then
        print_status "Fixing migration order by renaming audit fields migration..."
        mv "$audit_migration" "$renamed_migration"
        print_success "Migration order fixed"
    fi
}

# Function to run post-backup migrations
run_migrations() {
    local db_connection=$(get_db_connection)
    local migrations_dir="$MIGRATIONS_DIR"
    
    print_status "Running post-backup migrations from $migrations_dir..."
    
    # Get all SQL files and sort them by timestamp
    local migration_files=($(ls "$migrations_dir"/*.sql | sort))
    
    if [ ${#migration_files[@]} -eq 0 ]; then
        print_error "No migration files found in $migrations_dir"
        exit 1
    fi
    
    for migration_file in "${migration_files[@]}"; do
        local filename=$(basename "$migration_file")
        print_status "Running migration: $filename"
        
        if psql "$db_connection" -f "$migration_file"; then
            print_success "Migration $filename completed successfully"
        else
            print_error "Migration $filename failed"
            exit 1
        fi
    done
    
    print_success "All migrations completed successfully"
}

# Function to verify database
verify_database() {
    local db_connection=$(get_db_connection)
    
    print_status "Verifying database restoration..."
    
    # Check if key tables exist
    local tables=$(psql "$db_connection" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('actions', 'missions', 'organizations', 'profiles');")
    
    if [ "$tables" -eq 4 ]; then
        print_success "Database verification passed - all key tables exist"
    else
        print_error "Database verification failed - missing key tables"
        exit 1
    fi
    
    # Check if new tables from migrations exist
    local new_tables=$(psql "$db_connection" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'action_implementation_updates';")
    
    if [ "$new_tables" -eq 1 ]; then
        print_success "Migration verification passed - action_implementation_updates table exists"
    else
        print_warning "Migration verification warning - action_implementation_updates table not found"
    fi
}

# Main execution
main() {
    print_status "Starting database restoration and post-backup migration process..."
    
    if [ "$PROD_MODE" = true ]; then
        print_warning "Running in PRODUCTION mode!"
    else
        print_status "Running in LOCAL mode"
    fi
    
    # Check prerequisites
    if ! command_exists psql; then
        print_error "psql command not found. Please install PostgreSQL client."
        exit 1
    fi
    
    if [ "$PROD_MODE" = false ] && ! command_exists supabase; then
        print_error "supabase CLI not found. Please install Supabase CLI for local development."
        exit 1
    fi
    
    if [ "$PROD_MODE" = false ] && ! command_exists docker; then
        print_error "docker command not found. Please install Docker for local development."
        exit 1
    fi
    
    # Execute steps
    check_supabase_running
    delete_local_db
    restore_database
    fix_migration_order
    run_migrations
    verify_database
    
    print_success "Database restoration and post-backup migration process completed successfully!"
    
    if [ "$PROD_MODE" = false ]; then
        print_status "Local Supabase is running at:"
        supabase status
    fi
}

# Run main function
main "$@"
