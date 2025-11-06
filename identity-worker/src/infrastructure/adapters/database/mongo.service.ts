import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import {
  MongoClient,
  Db,
  Collection,
  IndexDescription,
  Document,
} from 'mongodb';

// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private client!: MongoClient;
  private db!: Db;

  constructor(@Inject('ILogger') private readonly logger: Logger) {}

  async onModuleInit() {
    try {
      const uri =
        process.env.MONGODB_URI || 'mongodb://localhost:27017/identity-service';
      const dbName = process.env.MONGODB_DB || 'identity-service';
      this.client = new MongoClient(uri);
      await this.client.connect();
      this.db = this.client.db(dbName);

      // Ensure indexes
      await this.ensureIndexes();

      // Log successful connection
      this.logger.info('MongoDB connected successfully', {
        database: dbName,
        uri: uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), // Hide credentials in log
      });
    } catch (error) {
      // Silently handle MongoDB connection failures - allow service to start without MongoDB
      // This prevents the entire application from failing if MongoDB is unavailable
      // No logging to prevent spam (similar to Redis handling)
      // Set db to undefined to trigger the error check in collection()
      this.db = undefined as any;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close();
    }
  }

  collection<T extends Document = Document>(name: string): Collection<T> {
    if (!this.db) {
      throw new Error(
        'MongoService: Database not initialized. Ensure onModuleInit has completed.',
      );
    }
    return this.db.collection<T>(name);
  }

  private async ensureIndexes() {
    await this.collection('users').createIndexes([
      { key: { email: 1 }, name: 'users_email_unique', unique: true },
      { key: { tenantId: 1 }, name: 'users_tenant_idx' },
    ] as IndexDescription[]);
    await this.collection('oauth_accounts').createIndexes([
      {
        key: { provider: 1, providerUserId: 1 },
        name: 'oauth_provider_user_unique',
        unique: true,
      },
      { key: { userId: 1 }, name: 'oauth_user_idx' },
    ] as IndexDescription[]);
    await this.collection('keys').createIndexes([
      { key: { kid: 1 }, name: 'keys_kid_unique', unique: true },
    ] as IndexDescription[]);
  }
}
