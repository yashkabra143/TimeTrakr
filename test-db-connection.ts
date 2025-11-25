import { neon } from '@neondatabase/serverless';

// Test database connection
async function testConnection() {
  console.log('Testing database connection...');
  console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }
  
  try {
    console.log('Creating Neon HTTP client...');
    const sql = neon(process.env.DATABASE_URL);
    
    console.log('Executing test query...');
    const startTime = Date.now();
    const result = await sql`SELECT NOW() as current_time, version() as pg_version`;
    const duration = Date.now() - startTime;
    
    console.log('✅ Connection successful!');
    console.log(`⏱️  Query took ${duration}ms`);
    console.log('Current time:', result[0].current_time);
    console.log('PostgreSQL version:', result[0].pg_version);
    
    // Test table access
    console.log('\nTesting table access...');
    const tableTest = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log('✅ Tables found:', tableTest.map(t => t.table_name).join(', '));
    
  } catch (error) {
    console.error('❌ Connection failed:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

testConnection();
