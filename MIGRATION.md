# Migration Guide: Hours to Minutes

This guide explains how to migrate your database from the old `hours` column to the new `minutes` column.

## Quick Fix

Run the migration script:

```bash
npm run migrate:minutes
```

Or manually:

```bash
tsx scripts/migrate-to-minutes.ts
```

## What the Migration Does

1. Adds new columns: `minutes`, `input_format`, `raw_input`
2. Converts existing `hours` data to `minutes` (multiplies by 60)
3. Sets default values for the new columns
4. Makes the columns NOT NULL

## Manual SQL Migration

If you prefer to run SQL directly, use `scripts/migrate-to-minutes.sql`:

```bash
psql $DATABASE_URL -f scripts/migrate-to-minutes.sql
```

## Verification

After migration, verify:

1. All pages load correctly
2. Existing time entries display correctly
3. New entries can be created with H.MM format (e.g., 8.20 = 8h 20m)

## Rollback (if needed)

If you need to rollback, you can:

1. Keep the `hours` column (it won't be deleted automatically)
2. Revert the code changes
3. The old code will continue to work with the `hours` column

## Calculation Example

- Input: `8.20` (H.MM format)
- Parsed as: 8 hours 20 minutes = 500 minutes
- In decimal hours: 500 / 60 = 8.333... hours
- At $8/hour: 8.333... × 8 = $66.67

The new system correctly interprets `8.20` as 8 hours and 20 minutes, not 8.2 hours (which would be 8h 12m).

