import { createClient, type RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Default to localhost if REDIS_URL is not provided
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
// Cache TTL in seconds (default: 5 minutes)
const DEFAULT_CACHE_TTL = parseInt(process.env.CACHE_TTL || '300');

class RedisCache {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private isEnabled = true;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      // Only try to connect if Redis is enabled
      if (process.env.DISABLE_CACHE === 'true') {
        this.isEnabled = false;
        console.log('Redis cache is disabled by configuration');
        return;
      }

      this.client = createClient({
        url: REDIS_URL
      });

      this.client.on('error', (err) => {
        console.error('Redis error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Connected to Redis');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Set a value in the cache
   */
  public async set(key: string, value: any, expireInSeconds = DEFAULT_CACHE_TTL): Promise<void> {
    if (!this.isEnabled || !this.isConnected || !this.client) {
      return;
    }

    try {
      const stringValue = JSON.stringify(value);
      await this.client.set(key, stringValue, { EX: expireInSeconds });
    } catch (error) {
      console.error(`Error setting cache key ${key}:`, error);
    }
  }

  /**
   * Get a value from the cache
   */
  public async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled || !this.isConnected || !this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Error getting cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete a value from the cache
   */
  public async del(key: string): Promise<void> {
    if (!this.isEnabled || !this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      console.error(`Error deleting cache key ${key}:`, error);
    }
  }

  /**
   * Check if the cache has a value
   */
  public async has(key: string): Promise<boolean> {
    if (!this.isEnabled || !this.isConnected || !this.client) {
      return false;
    }

    try {
      return await this.client.exists(key) > 0;
    } catch (error) {
      console.error(`Error checking cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys with a pattern
   */
  public async delByPattern(pattern: string): Promise<void> {
    if (!this.isEnabled || !this.isConnected || !this.client) {
      return;
    }

    try {
      // Find all keys matching the pattern
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        // Delete all matching keys
        await this.client.del(keys);
      }
    } catch (error) {
      console.error(`Error deleting cache keys with pattern ${pattern}:`, error);
    }
  }

  /**
   * Disconnect from Redis
   */
  public async close(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

// Export a singleton instance
export const cache = new RedisCache(); 