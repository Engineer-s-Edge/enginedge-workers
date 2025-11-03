import { Injectable } from '@nestjs/common';
import { IUserRepository } from '../../../application/ports/user-repository.port';
import { MongoService } from '../database/mongo.service';
import { User } from '../../../domain/entities/user.entity';
import { ObjectId } from 'mongodb';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly mongo: MongoService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.mongo.collection<User>('users').findOne({ email });
  }

  async findById(id: string): Promise<User | null> {
    return this.mongo.collection<User>('users').findOne({ _id: new ObjectId(id) } as any);
  }

  async create(user: Omit<User, '_id' | 'createdAt' | 'updatedAt'> & Partial<User>): Promise<User> {
    const doc: User = {
      email: user.email,
      hashedPassword: user.hashedPassword,
      name: user.name,
      tenantId: user.tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const res = await this.mongo.collection<User>('users').insertOne(doc as any);
    return { ...doc, _id: res.insertedId.toHexString() };
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    updates.updatedAt = new Date();
    const res = await this.mongo
      .collection<User>('users')
      .findOneAndUpdate({ _id: new ObjectId(id) } as any, { $set: updates }, { returnDocument: 'after' });
    return res.value ?? null;
  }

  async delete(id: string): Promise<void> {
    await this.mongo.collection<User>('users').deleteOne({ _id: new ObjectId(id) } as any);
  }
}


