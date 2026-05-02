# Bugfix Requirements Document

## Introduction

Maxwell AI assistant fails on every query from the dashboard with "an error occurred communicating with Maxwell". The root cause is a type mismatch in the `unified_embeddings` table: the `entity_id` column is typed as `text`, while all entity tables (`parts`, `tools`, `actions`, `issues`, `policy`, `financial_records`, `states`, `state_space_models`) use `uuid` primary keys. The `cwf-maxwell-unified-search` Lambda builds a `UNION ALL` SQL query that JOINs `unified_embeddings.entity_id` (text) to entity table primary keys (uuid), causing PostgreSQL to throw `operator does not exist: text = uuid`.

A temporary workaround (`::uuid` casts in the JOIN conditions) was applied locally but not deployed. The proper fix is to migrate the column type to `uuid` and remove the now-unnecessary casts.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user submits any query to the Maxwell AI assistant from the dashboard THEN the system returns "an error occurred communicating with Maxwell" and no results are shown

1.2 WHEN the `cwf-maxwell-unified-search` Lambda executes its `UNION ALL` SQL query THEN the system throws `operator does not exist: text = uuid` because `unified_embeddings.entity_id` (text) is JOINed to entity table primary keys (uuid)

1.3 WHEN the `::uuid` cast workaround is present in the Lambda JOIN conditions THEN the system executes successfully but PostgreSQL cannot use indexes on `entity_id`, degrading query performance

### Expected Behavior (Correct)

2.1 WHEN a user submits any query to the Maxwell AI assistant from the dashboard THEN the system SHALL return relevant search results without error

2.2 WHEN the `cwf-maxwell-unified-search` Lambda executes its `UNION ALL` SQL query THEN the system SHALL JOIN `unified_embeddings.entity_id` (uuid) to entity table primary keys (uuid) without type casting, allowing PostgreSQL to use indexes normally

2.3 WHEN the `entity_id` column is migrated to `uuid` type THEN the system SHALL allow PostgreSQL to use indexes on `entity_id` in JOIN conditions, restoring expected query performance

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a valid UUID value is stored in `unified_embeddings.entity_id` THEN the system SHALL CONTINUE TO store and retrieve that value correctly after the column type migration

3.2 WHEN the `cwf-maxwell-unified-search` Lambda queries embeddings filtered by `organization_id` and `entity_type` THEN the system SHALL CONTINUE TO return correctly scoped results per organization

3.3 WHEN new embeddings are written to `unified_embeddings` by the embeddings-processor Lambda THEN the system SHALL CONTINUE TO insert records successfully with `entity_id` values that are valid UUIDs

3.4 WHEN the unique constraint on `(entity_type, entity_id, model_version)` is evaluated THEN the system SHALL CONTINUE TO enforce uniqueness correctly after the column type change

3.5 WHEN the migration SQL runs and any non-UUID value exists in `entity_id` THEN the system SHALL surface a data integrity error and halt the migration rather than silently corrupting data

---

## Bug Condition

**Bug Condition Function:**

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SearchQuery
  OUTPUT: boolean

  // Returns true when the bug condition is met
  RETURN unified_embeddings.entity_id column type = 'text'
         AND entity table primary key type = 'uuid'
END FUNCTION
```

**Property: Fix Checking**

```pascal
FOR ALL X WHERE isBugCondition(X) DO
  result ← cwfMaxwellUnifiedSearch'(X)
  ASSERT result.httpStatusCode = 200
         AND no PostgreSQL type error raised
         AND result.results is array
END FOR
```

**Property: Preservation Checking**

```pascal
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT cwfMaxwellUnifiedSearch(X) = cwfMaxwellUnifiedSearch'(X)
END FOR
```

Where `F` is the Lambda before the fix (with `::uuid` cast workaround) and `F'` is the Lambda after the proper fix (column migrated to `uuid`, casts removed).
