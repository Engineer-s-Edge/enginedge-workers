export interface CacheSetOptions {
  ttl?: number;
}

export interface ICachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>;
  del(key: string): Promise<void>;
}
