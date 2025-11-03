import { Injectable } from '@nestjs/common';
import { MongoService } from '../database/mongo.service';
import { Tenant } from '../../../domain/entities/tenant.entity';
import { ObjectId } from 'mongodb';

@Injectable()
export class TenantRepository {
  constructor(private readonly mongo: MongoService) {}

  async findById(id: string): Promise<Tenant | null> {
    return this.mongo.collection<Tenant>('tenants').findOne({ _id: new ObjectId(id) } as any);
  }
}


