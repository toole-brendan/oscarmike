import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }
  
  console.log('Running migration...');
  
  // For migrations, use a separate connection
  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);
  
  try {
    // Add location columns directly
    await migrationClient`
      ALTER TABLE IF EXISTS users 
      ADD COLUMN IF NOT EXISTS latitude REAL,
      ADD COLUMN IF NOT EXISTS longitude REAL
    `;
    
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigration().catch(console.error);