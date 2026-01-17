/**
 * MongoDB Package Cache Repository Implementation
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IPackageCacheRepository } from '../../../domain/ports';
import { LaTeXPackage, PackageStatus } from '../../../domain/entities';
import {
  PackageCacheSchema,
  PackageCacheDocument,
} from '../schemas/package-cache.schema';

@Injectable()
export class MongoDBPackageCacheRepository implements IPackageCacheRepository {
  constructor(
    @InjectModel(PackageCacheSchema.name)
    private readonly packageModel: Model<PackageCacheDocument>,
  ) {}

  async save(pkg: LaTeXPackage): Promise<void> {
    const packageDoc = {
      packageName: pkg.name,
      version: pkg.metadata.version,
      installedAt: pkg.installedAt || new Date(),
      lastUsedAt: pkg.lastUsedAt || new Date(),
      usageCount: 1,
      isAvailable: pkg.status === PackageStatus.INSTALLED,
      metadata: {
        description: pkg.metadata.description,
        dependencies: pkg.metadata.dependencies,
        size: pkg.metadata.size,
      },
    };

    await this.packageModel.updateOne(
      { packageName: pkg.name },
      {
        $set: packageDoc,
        $inc: { usageCount: 1 },
        $setOnInsert: { installedAt: new Date() },
      },
      { upsert: true },
    );
  }

  async findByName(name: string): Promise<LaTeXPackage | null> {
    const pkg = await this.packageModel.findOne({ packageName: name }).exec();

    if (!pkg) {
      return null;
    }

    const latexPkg = LaTeXPackage.create(pkg.packageName);
    return latexPkg.markInstalled({
      version: pkg.version,
      description: pkg.metadata?.description,
      dependencies: pkg.metadata?.dependencies,
      size: pkg.metadata?.size,
    });
  }

  async touch(name: string): Promise<void> {
    await this.packageModel
      .updateOne(
        { packageName: name },
        {
          $set: { lastUsedAt: new Date() },
          $inc: { usageCount: 1 },
        },
      )
      .exec();
  }

  async deleteStale(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.packageModel
      .deleteMany({
        lastUsedAt: { $lt: cutoffDate },
      })
      .exec();

    return result.deletedCount || 0;
  }

  async list(): Promise<LaTeXPackage[]> {
    const packages = await this.packageModel
      .find()
      .sort({ usageCount: -1 })
      .exec();

    return packages.map((pkg) => {
      const latexPkg = LaTeXPackage.create(pkg.packageName);
      return latexPkg.markInstalled({
        version: pkg.version,
        description: pkg.metadata?.description,
        dependencies: pkg.metadata?.dependencies,
        size: pkg.metadata?.size,
      });
    });
  }
}
