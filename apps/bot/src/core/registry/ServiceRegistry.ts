import { logger } from '../logger/Logger';

type Constructor<T> = new (...args: any[]) => T;

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services = new Map<string, unknown>();
  private singletons = new Map<string | Constructor<unknown>, unknown>();

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) ServiceRegistry.instance = new ServiceRegistry();
    return ServiceRegistry.instance;
  }

  register<T>(key: string, instance: T): void {
    this.services.set(key, instance);
    logger.debug(`Service registered: ${key}`);
  }

  get<T>(key: string): T {
    const service = this.services.get(key);
    if (!service) throw new Error(`Service not found: ${key}`);
    return service as T;
  }

  has(key: string): boolean {
    return this.services.has(key);
  }

  unregister(key: string): boolean {
    return this.services.delete(key);
  }

  singleton<T>(key: Constructor<T>, factory: () => T): T {
    if (!this.singletons.has(key)) {
      this.singletons.set(key, factory());
    }
    return this.singletons.get(key) as T;
  }

  listServices(): string[] {
    return Array.from(this.services.keys());
  }

  clear(): void {
    this.services.clear();
    this.singletons.clear();
  }
}

export const registry = ServiceRegistry.getInstance();
