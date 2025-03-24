import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Explicitly load .env file from project root
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment from ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.log(`No .env file found at ${envPath}`);
  dotenv.config(); // Try default location
}

// Print DATABASE_URL for debugging (don't include in production)
const dbUrlExists = !!process.env.DATABASE_URL;
console.log(`DATABASE_URL ${dbUrlExists ? 'exists' : 'does not exist'}`);
if (dbUrlExists && process.env.NODE_ENV !== 'production') {
  // Don't log the actual URL for security reasons
  console.log(`DATABASE_URL starts with: ${process.env.DATABASE_URL!.substring(0, 15)}...`);
}

// Connection pool configuration for AWS RDS PostgreSQL
const connectionOptions = {
  max: 25, // Increased from 10 to 25 for better scaling
  idle_timeout: 30, // Max seconds a connection can be idle before being removed
  connect_timeout: 15, // Max seconds to wait for a connection
  prepare: false, // For better performance
  max_retries: 5, // Max retries for failed connections
  retry_interval: 1000, // Milliseconds between retries
  
  // AWS RDS requires SSL in most configurations
  ssl: process.env.NODE_ENV === 'production' || 
       (process.env.DATABASE_URL ? process.env.DATABASE_URL.includes('.rds.amazonaws.com') : false)
         ? { rejectUnauthorized: false } // Allow self-signed certificates
         : false,
  
  onnotice: () => {}, // Silence notices for cleaner logs
};

// Development mode with mock database
const isDev = process.env.NODE_ENV !== 'production';

// Define a proper type for the in-memory store
type InMemoryStore = {
  users: any[];
  exercises: any[];
  formIssues: any[];
  keyPoints: any[];
  userIdCounter: number;
  exerciseIdCounter: number;
  formIssueIdCounter: number;
  keyPointsIdCounter: number;
};

// In-memory store for development
const inMemoryStore: InMemoryStore = {
  users: [] as any[],
  exercises: [] as any[],
  formIssues: [] as any[],
  keyPoints: [] as any[],
  userIdCounter: 1,
  exerciseIdCounter: 1,
  formIssueIdCounter: 1,
  keyPointsIdCounter: 1
};

let db: any;

// Function to ensure array type for in-memory store
const getStoreArray = (storeName: keyof InMemoryStore): any[] => {
  // Only return the array properties, not the counter properties
  const store = inMemoryStore[storeName];
  return Array.isArray(store) ? store : [];
};

try {
  // Use environment variable for database connection with connection pooling
  if (process.env.DATABASE_URL) {
    console.log('Attempting to connect to PostgreSQL database...');
    // Check if it's an AWS RDS URL
    const isAwsRds = process.env.DATABASE_URL.includes('.rds.amazonaws.com');
    if (isAwsRds) {
      console.log('Detected AWS RDS PostgreSQL connection');
    }
    
    const client = postgres(process.env.DATABASE_URL, connectionOptions);
    db = drizzle(client, { schema });
    console.log('Connected to PostgreSQL database');
  } else if (isDev) {
    // In development without DATABASE_URL, use mock DB
    console.log('No DATABASE_URL provided. Using mock database for development');
    db = {
      select: () => ({
        from: (table: any) => {
          // Determine which store to use based on table name
          const storeName = table.name || 'users';
          return {
            where: (condition: any) => {
              // Simplified where condition handling for basic equality
              if (condition && condition.value && condition.column) {
                const column = condition.column.name;
                const value = condition.value;
                const storeArray = getStoreArray(storeName as keyof InMemoryStore);
                return storeArray.filter((item: any) => item[column] === value);
              }
              return getStoreArray(storeName as keyof InMemoryStore);
            },
            orderBy: () => getStoreArray(storeName as keyof InMemoryStore),
            limit: () => ({
              offset: () => getStoreArray(storeName as keyof InMemoryStore)
            })
          };
        }
      }),
      insert: (table: any) => ({
        values: (data: any) => ({
          returning: () => {
            const storeName = table.name || 'users';
            const idCounter = `${storeName}IdCounter` as keyof InMemoryStore;
            
            // Clone the data and add an ID
            const newItem = { ...data, id: inMemoryStore[idCounter] };
            
            // For users, set creation timestamp
            if (storeName === 'users') {
              newItem.createdAt = new Date();
            }
            
            // Add to store and increment counter
            const storeArrayName = storeName as keyof InMemoryStore;
            if (Array.isArray(inMemoryStore[storeArrayName])) {
              (inMemoryStore[storeArrayName] as any[]).push(newItem);
            }
            inMemoryStore[idCounter] = (inMemoryStore[idCounter] as number) + 1;
            
            return [newItem];
          }
        })
      }),
      update: (table: any) => ({
        set: (data: any) => ({
          where: (condition: any) => ({
            returning: () => {
              const storeName = table.name || 'users';
              if (condition && condition.value && condition.column) {
                const column = condition.column.name;
                const value = condition.value;
                const storeArray = getStoreArray(storeName as keyof InMemoryStore);
                const index = storeArray.findIndex((item: any) => item[column] === value);
                
                if (index !== -1) {
                  storeArray[index] = { ...storeArray[index], ...data };
                  return [storeArray[index]];
                }
              }
              return [];
            }
          })
        })
      }),
      delete: (table: any) => ({
        where: (condition: any) => ({
          returning: () => {
            const storeName = table.name || 'users';
            if (condition && condition.value && condition.column) {
              const column = condition.column.name;
              const value = condition.value;
              const storeArray = getStoreArray(storeName as keyof InMemoryStore);
              const index = storeArray.findIndex((item: any) => item[column] === value);
              
              if (index !== -1) {
                const deleted = storeArray[index];
                storeArray.splice(index, 1);
                return [deleted];
              }
            }
            return [];
          }
        })
      }),
      query: async () => {
        console.log('Using mock database in development mode');
        return [];
      },
    };
  } else {
    throw new Error('DATABASE_URL is required in production mode');
  }
} catch (error) {
  console.error('Database connection error:', error);
  if (isDev) {
    console.log('Falling back to mock database');
    // Same mock implementation as above
    db = {
      select: () => ({
        from: (table: any) => {
          const storeName = table.name || 'users';
          return {
            where: (condition: any) => {
              if (condition && condition.value && condition.column) {
                const column = condition.column.name;
                const value = condition.value;
                const storeArray = getStoreArray(storeName as keyof InMemoryStore);
                return storeArray.filter((item: any) => item[column] === value);
              }
              return getStoreArray(storeName as keyof InMemoryStore);
            },
            orderBy: () => getStoreArray(storeName as keyof InMemoryStore),
            limit: () => ({
              offset: () => getStoreArray(storeName as keyof InMemoryStore)
            })
          };
        }
      }),
      insert: (table: any) => ({
        values: (data: any) => ({
          returning: () => {
            const storeName = table.name || 'users';
            const idCounter = `${storeName}IdCounter` as keyof InMemoryStore;
            const newItem = { ...data, id: inMemoryStore[idCounter] };
            const storeArray = getStoreArray(storeName as keyof InMemoryStore);
            storeArray.push(newItem);
            inMemoryStore[idCounter] = (inMemoryStore[idCounter] as number) + 1;
            return [newItem];
          }
        })
      }),
      update: (table: any) => ({
        set: (data: any) => ({
          where: (condition: any) => ({
            returning: () => {
              const storeName = table.name || 'users';
              if (condition && condition.value && condition.column) {
                const column = condition.column.name;
                const value = condition.value;
                const storeArray = getStoreArray(storeName as keyof InMemoryStore);
                const index = storeArray.findIndex((item: any) => item[column] === value);
                
                if (index !== -1) {
                  storeArray[index] = { ...storeArray[index], ...data };
                  return [storeArray[index]];
                }
              }
              return [];
            }
          })
        })
      }),
      delete: (table: any) => ({
        where: (condition: any) => ({
          returning: () => {
            const storeName = table.name || 'users';
            if (condition && condition.value && condition.column) {
              const column = condition.column.name;
              const value = condition.value;
              const storeArray = getStoreArray(storeName as keyof InMemoryStore);
              const index = storeArray.findIndex((item: any) => item[column] === value);
              
              if (index !== -1) {
                const deleted = storeArray[index];
                storeArray.splice(index, 1);
                return [deleted];
              }
            }
            return [];
          }
        })
      }),
      query: async () => {
        console.log('Using mock database in development mode');
        return [];
      },
    };
  } else {
    throw error;
  }
}

export { db };