import NodeCache from 'node-cache';
import { logger } from '../logger/Logger';

export interface CacheOptions {
  ttl?: number; // seconds, 0 = never expire
  checkPeriod?: number;
}

export class CacheManager {
  private cache: NodeCache;
  private hits = 0;
  private misses = 0;

  constructor(options: CacheOptions = {}) {
    this.cache = new NodeCache({
      stdTTL: options.ttl ?? 300,
      checkperiod: options.checkPeriod ?? 120,
      useClones: false,
    });
  }

  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);
    if (value !== undefined) this.hits++;
    else this.misses++;
    return value;
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    if (ttl !== undefined) return this.cache.set(key, value, ttl);
    return this.cache.set(key, value);
  }

  del(key: string | string[]): number {
    return this.cache.del(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  flush(): void {
    this.cache.flushAll();
  }

  // Namespace-based key helpers
  guildKey(guildId: string, suffix: string): string {
    return `guild:${guildId}:${suffix}`;
  }

  userKey(userId: string, suffix: string): string {
    return `user:${userId}:${suffix}`;
  }

  memberKey(guildId: string, userId: string, suffix: string): string {
    return `member:${guildId}:${userId}:${suffix}`;
  }

  moduleKey(module: string, guildId: string, suffix: string): string {
    return `mod:${module}:${guildId}:${suffix}`;
  }

  invalidateGuild(guildId: string): void {
    const keys = this.cache.keys().filter(k => k.includes(guildId));
    this.cache.del(keys);
  }

  // Get or set pattern
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / (this.hits + this.misses) || 0,
      keys: this.cache.keys().length,
    };
  }
}

// Singleton for core use
export const cache = new CacheManager({ ttl: 300 });
