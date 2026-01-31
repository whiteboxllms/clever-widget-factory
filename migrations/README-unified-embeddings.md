# Unified Embeddings Migration

## Overview

This migration creates the unified embeddings infrastructure for cross-entity semantic search in the Clever Widget Factory system.

## Files Created

### Migration SQL
- `migrations/create-unified-embeddings-table.sql` - Main migration file

### Deployment Scripts
- `scripts/run-unified-embeddings-migration.sh` - Deploy the migration
- `scripts/verify-unified-embeddings-schema.sh` - Verify table structure

### Test Scripts
- `scripts/test-unified-embeddings-crud.sh` - Test basic CRUD operations
- `scripts/test-cascade-delete-trigger.sh` - Test cascade delete triggers
- `scripts/test-unified-embeddings-comprehensive.sh` - Comprehensive test suite

## What Was Created

### Database Table: `unified_embeddings`

Columns:
- `id` (UUID, primary key)
- `entity_type` (VARCHAR(50), constrained to: part, tool, action, issue, policy)
- `entity_id` (UUID, references entity in source table)
- `embedding_source` (TEXT, the text used to generate embedding)
- `model_version` (VARCHAR(50), default 'titan-v1')
- `embedding` (VECTOR(1536), the embedding vector)
- `organization_id` (UUID, foreign key to organizations)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- `updated_at` (TIMESTAMP WITH TIME ZONE)

### Indexes

- `idx_unified_embeddings_org` - Fast filtering by organization
- `idx_unified_embeddings_entity_type` - Fast filtering by entity type
- `idx_unified_embeddings_composite` - Combined organization + entity type filter

### Constraints

- Unique constraint on (entity_type, entity_id, model_version)
- Foreign key to organizations table with CASCADE DELETE
- Check constraint on entity_type values

### Triggers

Cascade delete triggers for all entity types:
- `parts_delete_embedding` - Deletes embeddings when part is deleted
- `tools_delete_embedding` - Deletes embeddings when tool is deleted
- `actions_delete_embedding` - Deletes embeddings when action is deleted
- `issues_delete_embedding` - Deletes embeddings when issue is deleted
- `policies_delete_embedding` - Deletes embeddings when policy is deleted

## Requirements Validated

✓ Requirement 1.1: Unified table for all entity types
✓ Requirement 1.2: All required fields stored
✓ Requirement 1.3: 1536-dimension vector support
✓ Requirement 1.4: Cascade delete on entity deletion
✓ Requirement 1.5: Timestamps (created_at, updated_at)
✓ Requirement 9.5: Organization foreign key constraint

## Testing

All tests passed successfully:

1. **Schema Verification**: All columns, indexes, and triggers created
2. **CRUD Operations**: Insert, update, query operations work correctly
3. **Cascade Delete**: Embeddings deleted when entities are deleted
4. **Constraints**: Foreign key and check constraints enforced
5. **Timestamps**: Automatic timestamp management working

## Deployment

To deploy this migration to production:

```bash
./scripts/run-unified-embeddings-migration.sh
```

To verify deployment:

```bash
./scripts/verify-unified-embeddings-schema.sh
./scripts/test-unified-embeddings-comprehensive.sh
```

## Next Steps

This migration is Phase 1 of the unified embeddings system. Next tasks:

1. Implement embedding source composition functions
2. Modify embeddings-processor Lambda to write to unified table
3. Update Core and Actions Lambdas to send SQS messages
4. Create unified search Lambda
5. Add API Gateway endpoints

See `.kiro/specs/unified-embeddings-system/tasks.md` for full implementation plan.
