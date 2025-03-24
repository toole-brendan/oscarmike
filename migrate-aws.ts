import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from './shared/schema';

dotenv.config();

async function runAwsRdsMigration() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }
  
  if (!connectionString.includes('.rds.amazonaws.com')) {
    console.warn('Warning: This does not appear to be an AWS RDS URL. Continue anyway? (Y/n)');
    // In an actual script you might want to add user input handling here
  }
  
  console.log('Running migration on AWS RDS PostgreSQL...');
  
  // For AWS RDS migrations, ensure we have proper connection settings
  const migrationClient = postgres(connectionString, { 
    max: 1,
    ssl: { rejectUnauthorized: false }, // Allow self-signed certificates for RDS
    idle_timeout: 30,
    connect_timeout: 30
  });
  
  const db = drizzle(migrationClient);
  
  try {
    // Run the migration using Drizzle
    await migrate(db, { migrationsFolder: './migrations' });
    
    // Optional: Add any additional AWS-specific setup here
    // For example, you might want to create database users, set permissions, etc.
    
    console.log('✅ AWS RDS Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

// Run the migration
runAwsRdsMigration().catch(console.error); 