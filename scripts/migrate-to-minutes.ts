/**
 * Migration script to convert time_entries table from hours to minutes
 * 
 * Usage:
 *   tsx scripts/migrate-to-minutes.ts
 * 
 * Or with DATABASE_URL:
 *   DATABASE_URL=your_url tsx scripts/migrate-to-minutes.ts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Starting migration: hours -> minutes...\n');

  try {
    // Step 1: Check if columns already exist
    const checkColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'time_entries' 
      AND column_name IN ('minutes', 'input_format', 'raw_input')
    `;

    const existingColumns = checkColumns.map((r: any) => r.column_name);
    console.log('Existing columns:', existingColumns);

    // Step 2: Add new columns if they don't exist
    if (!existingColumns.includes('minutes')) {
      console.log('Adding minutes column...');
      await sql`ALTER TABLE time_entries ADD COLUMN minutes integer`;
    }

    if (!existingColumns.includes('input_format')) {
      console.log('Adding input_format column...');
      await sql`ALTER TABLE time_entries ADD COLUMN input_format text DEFAULT 'fractional'`;
    }

    if (!existingColumns.includes('raw_input')) {
      console.log('Adding raw_input column...');
      await sql`ALTER TABLE time_entries ADD COLUMN raw_input text`;
    }

    // Step 3: Check if hours column exists
    const checkHours = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'time_entries' 
      AND column_name = 'hours'
    `;

    const hasHoursColumn = checkHours.length > 0;
    console.log('Has hours column:', hasHoursColumn);

    // Step 4: Migrate existing data
    if (hasHoursColumn) {
      console.log('Migrating data from hours to minutes...');
      // First, count how many rows need migration
      const countResult = await sql`
        SELECT COUNT(*) as count
        FROM time_entries
        WHERE minutes IS NULL
      `;
      const rowsToMigrate = parseInt(countResult[0]?.count || '0', 10);
      
      if (rowsToMigrate > 0) {
        await sql`
          UPDATE time_entries 
          SET 
            minutes = ROUND(COALESCE(hours, 0) * 60),
            input_format = 'fractional',
            raw_input = COALESCE(hours::text, '0')
          WHERE minutes IS NULL
        `;
        console.log(`  ✓ Migrated ${rowsToMigrate} rows`);
      } else {
        console.log('  ✓ No rows to migrate (all already migrated)');
      }
    }

    // Step 5: Set defaults for any NULL values
    console.log('Setting defaults for NULL values...');
    await sql`
      UPDATE time_entries 
      SET 
        minutes = COALESCE(minutes, 0),
        input_format = COALESCE(input_format, 'fractional'),
        raw_input = COALESCE(raw_input, '0')
      WHERE minutes IS NULL OR input_format IS NULL
    `;

    // Step 6: Make columns NOT NULL
    console.log('Making columns NOT NULL...');
    try {
      await sql`ALTER TABLE time_entries ALTER COLUMN minutes SET NOT NULL`;
      console.log('  ✓ minutes set to NOT NULL');
    } catch (e: any) {
      // Check if column is already NOT NULL (PostgreSQL error code 42804 or specific message)
      const errorMsg = e.message?.toLowerCase() || '';
      const errorCode = e.code;
      if (errorCode === '42804' || errorMsg.includes('already') || errorMsg.includes('not null')) {
        console.log('  ✓ minutes already NOT NULL');
      } else {
        throw e;
      }
    }

    try {
      await sql`ALTER TABLE time_entries ALTER COLUMN input_format SET NOT NULL`;
      await sql`ALTER TABLE time_entries ALTER COLUMN input_format SET DEFAULT 'hm'`;
      console.log('  ✓ input_format set to NOT NULL with default "hm"');
    } catch (e: any) {
      const errorMsg = e.message?.toLowerCase() || '';
      const errorCode = e.code;
      if (errorCode === '42804' || errorMsg.includes('already') || errorMsg.includes('not null')) {
        console.log('  ✓ input_format already NOT NULL');
        // Still try to set default if not already set
        try {
          await sql`ALTER TABLE time_entries ALTER COLUMN input_format SET DEFAULT 'hm'`;
        } catch (defaultError: any) {
          // Ignore if default already exists
          console.log('  ✓ default already set');
        }
      } else {
        throw e;
      }
    }

    // Step 7: Verify migration
    const verify = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(minutes) as has_minutes,
        COUNT(input_format) as has_format,
        COUNT(CASE WHEN minutes IS NULL THEN 1 END) as null_minutes,
        COUNT(CASE WHEN input_format IS NULL THEN 1 END) as null_format
      FROM time_entries
    `;

    const stats = verify[0];
    console.log('\n✅ Migration completed successfully!');
    console.log('Verification:');
    console.log(`  Total rows: ${stats.total}`);
    console.log(`  Rows with minutes: ${stats.has_minutes}`);
    console.log(`  Rows with input_format: ${stats.has_format}`);
    
    if (stats.null_minutes > 0 || stats.null_format > 0) {
      console.warn(`\n⚠️  Warning: Found ${stats.null_minutes} rows with NULL minutes and ${stats.null_format} rows with NULL input_format`);
      console.warn('   These should have been set to defaults. Please investigate.');
    }

    if (hasHoursColumn) {
      console.log('\n⚠️  Note: The old "hours" column still exists.');
      console.log('   You can drop it later with: ALTER TABLE time_entries DROP COLUMN hours;');
      console.log('   Only do this after verifying everything works correctly.');
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrate()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

