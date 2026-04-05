# Requirements Document: Financial Records Schema Refactor & CSV Seed

## Introduction

Refactor the `financial_records` table schema and seed it from the existing CSV at `migrations/data/Petty Cash Tracking - Expense.csv` (~3,275 rows). Key changes: replace `funding_source`/`external_source_note` with `payment_method`, make `created_by` nullable, drop `description`, `photos`, `category_tag`, and `per_unit_price` columns in favor of using the existing `states`/`state_photos`/`state_links` system for descriptions and photos, and import historical data with correct purchaser mapping.

## Glossary

- **Financial_Records_Table**: The PostgreSQL table `financial_records` storing transaction metadata
- **States_System**: The existing `states` + `state_photos` + `state_links` tables used by observations
- **CSV_File**: Source data at `migrations/data/Petty Cash Tracking - Expense.csv`
- **Seed_Script**: Node.js script at `migrations/seed-financial-records.js` that parses CSV and generates INSERT SQL
- **Organization**: Stargazer Farm (`00000000-0000-0000-0000-000000000001`)

## Requirements

### Requirement 1: Make created_by nullable

- ALTER TABLE `financial_records` ALTER COLUMN `created_by` DROP NOT NULL
- Lambda POST still requires `created_by` from auth context for new records
- Lambda GET endpoints handle null `created_by` gracefully (show "Unknown" for name)
- Frontend detail page: no edit/delete buttons for null `created_by` records unless user has `data:write:all`
- Frontend list: show "Unknown" or "—" for records with no creator

### Requirement 2: Purchaser-to-user mapping

Seed script maps CSV purchaser names to Stargazer Farm cognito_user_ids:

| CSV Name | cognito_user_id |
|---|---|
| Mae | `1891f310-c071-705a-2c72-0d0a33c92bf0` |
| Lester | `68d173b0-60f1-70ea-6084-338e74051fcc` |
| Stefan | `08617390-b001-708d-f61e-07a1698282ec` |
| Malone | `989163e0-7011-70ee-6d93-853674acd43c` |
| Jun Jun, Mark, Kuya Juan, Janeth, Dhodie | NULL |
| (empty) | NULL |

Purchaser name is prepended in brackets in the state_text: `[Mae] Nipa 100 pcs — Additional nipa...`

### Requirement 3: Description composition

- Format: `[Purchaser] Transaction — Comment`
- If Comment is empty or same as Transaction: `[Purchaser] Transaction`
- If Purchaser is empty: `Transaction — Comment`
- If both Transaction and Comment empty: fall back to Category, then "Transaction"
- When Category is present, append: `(Category: Food)`
- When Per unit price is present, append: `(₱10.00/unit)`
- When photo URL is present, append: `{{photo:https://...}}`
- Description goes into `states.state_text` (not a column on `financial_records`)
- Full example: `[Mae] Nipa 100 pcs — Additional nipa for vermi protection (Category: Construction, ₱10.00/unit) {{photo:https://photos.app.goo.gl/abc123}}`

### Requirement 4: Replace funding_source/external_source_note with payment_method

Schema migration:
- Add `payment_method VARCHAR(20)` column
- Drop `funding_source` and `external_source_note` columns
- Valid values: Cash, SCash, GCash, Wise
- SCash = "Stefan Cash" (its own payment method, not a typo)
- Running balance = `-SUM(amount) WHERE payment_method = 'Cash'` (only Cash affects petty cash balance)
- Balance is computed server-side, not stored
- Update Lambda, frontend types, service, hooks, pages accordingly

### Requirement 5: Date parsing

- Parse M/D/YYYY format strictly
- Invalid dates have been fixed directly in the CSV (no runtime guessing)
- Seed script should throw an error on any unparseable date

### Requirement 6: Amount parsing

- Strip commas from amounts before parsing
- Preserve negative amounts (income/reload)
- Throw an error (halt the script) on non-numeric amounts — don't silently skip

### Requirement 7: Use states system for descriptions and photos

- Drop `description` and `photos` columns from `financial_records`
- For each financial record, create a linked `states` row via `state_links` (entity_type = 'financial_record')
- `states.state_text` holds the composed description (see Req 3)
- Photos go into `state_photos` linked to that state
- This reuses the existing observation infrastructure: same embedding pipeline, same photo viewer
- For the CSV seed: photo URLs from Google Photos are embedded in the state_text as `{{photo:URL}}` format (extractable later with regex `/\{\{photo:(.*?)\}\}/g`)
- `state_photos` stays empty for seeded records until a future migration downloads and uploads photos to S3

### Requirement 8: Drop category_tag and per_unit_price columns

- Drop `category_tag` and `per_unit_price` columns from `financial_records`
- For the CSV seed, include category and per-unit price in the `state_text` description when present
- Format: `(Category: Construction, ₱10.00/unit)` appended to description
- Future spec will handle a proper tagging/categorization system in a separate table

### Requirement 9: Timestamps

- `created_at` and `updated_at` on `financial_records` set to transaction date at 08:00 UTC
- `captured_at` and `created_at` on the linked `states` row set to the same value

### Requirement 10: Balance column ignored

- CSV "Balance" column is not imported
- Balance is always computed server-side from `payment_method = 'Cash'` transactions

### Requirement 11: SQL output format

- Seed script outputs INSERT statements wrapped in BEGIN/COMMIT
- Organization ID = `00000000-0000-0000-0000-000000000001` (Stargazer Farm)
- Script halts on any parsing error (dates, amounts)
- Properly escapes single quotes in all string values

### Requirement 12: Lambda and frontend updates

- Lambda: replace all `funding_source` references with `payment_method`, remove `external_source_note`
- Lambda: use states system for description/photos instead of columns on `financial_records`
- Lambda: handle null `created_by` on GET endpoints
- Frontend types: update `FinancialRecord` interface (remove dropped fields, add `payment_method`)
- Frontend service/hooks: update for new schema
- Frontend pages: update creation form (payment_method selector instead of funding_source), detail page (read description from linked state), list page (handle null creator)
- Keep `financial_record_edits` audit table for tracking changes to amount, payment_method, transaction_date

### Final financial_records table schema

After all migrations:
- `id` UUID PK
- `organization_id` UUID FK NOT NULL
- `created_by` UUID (nullable)
- `transaction_date` DATE NOT NULL
- `amount` NUMERIC(12,2) NOT NULL
- `payment_method` VARCHAR(20) NOT NULL
- `created_at` TIMESTAMPTZ NOT NULL
- `updated_at` TIMESTAMPTZ NOT NULL

Dropped: `description`, `photos`, `funding_source`, `external_source_note`, `category_tag`, `per_unit_price`
