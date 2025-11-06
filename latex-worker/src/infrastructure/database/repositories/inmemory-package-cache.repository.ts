import { Injectable } from '@nestjs/common';
import { IPackageCacheRepository } from '../../../domain/ports';
import { LaTeXPackage } from '../../../domain/entities';

@Injectable()
export class InMemoryPackageCacheRepository implements IPackageCacheRepository {
  private readonly store = new Map<
    string,
    LaTeXPackage & { lastUsedAt?: Date }
  >();

  async save(pkg: LaTeXPackage): Promise<void> {
    const existing = this.store.get(pkg.name);
    const toSave = Object.assign(existing || {}, pkg, {
      lastUsedAt: new Date(),
    });
    this.store.set(pkg.name, toSave);
  }

  async findByName(name: string): Promise<LaTeXPackage | null> {
    return this.store.get(name) || null;
  }

  async touch(name: string): Promise<void> {
    const pkg = this.store.get(name);
    if (pkg) {
      pkg.lastUsedAt = new Date();
      this.store.set(name, pkg);
    }
  }

  async deleteStale(days: number): Promise<number> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for (const [key, value] of this.store.entries()) {
      const last = value.lastUsedAt?.getTime() || 0;
      if (last < cutoff) {
        this.store.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  async list(): Promise<LaTeXPackage[]> {
    return Array.from(this.store.values());
  }
}
