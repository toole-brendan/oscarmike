import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';

// Connection pool configuration for better scalability
const connectionOptions = {
  max: 10, // Maximum number of connections in pool
  idle_timeout: 30, // Max seconds a connection can be idle before being removed
  connect_timeout: 15, // Max seconds to wait for a connection
  prepare: false, // For better performance with Neon serverless
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  onnotice: () => {}, // Silence notices for cleaner logs
};

// Use environment variable for database connection with connection pooling
const client = postgres(process.env.DATABASE_URL!, connectionOptions);
export const db = drizzle(client, { schema });