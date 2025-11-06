/**
 * Infrastructure Module
 *
 * Configures adapters, controllers, and external integrations.
 */

import { Module, Global, forwardRef } from '@nestjs/common';
import { ApplicationModule } from '@application/application.module';
import { AuthController } from './controllers/auth.controller';
import { OauthController } from './controllers/oauth.controller';
import { UsersController } from './controllers/users.controller';
import { JwksController } from './controllers/jwks.controller';
import { MetricsAdapter } from './adapters/monitoring';
import { MongoModule } from './adapters/database/mongo.module';
import { UserRepository } from './adapters/repositories/user.repository';
import { USER_REPOSITORY } from '@application/ports/user-repository.port';
import { JwtIssuerService } from './adapters/security/jwt-issuer.service';
import { RoleRepository } from './adapters/repositories/role.repository';
import { TenantRepository } from './adapters/repositories/tenant.repository';
import { KeyRepository } from './adapters/repositories/key.repository';
import { RefreshTokenRepository } from './adapters/repositories/refresh-token.repository';
import { RedisCacheAdapter } from './adapters/cache/redis-cache.adapter';
import { KafkaLoggerAdapter } from '../common/logging/kafka-logger.adapter';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

/**
 * Infrastructure module - adapters, controllers, and wiring
 *
 * Phase 1: Core agent infrastructure ✅
 * Phase 2: Specialized agent controllers ✅
 * Phase 3: Memory systems ✅
 * Phase 4: Knowledge graph ✅
 * Phase 5: Advanced features ⏳
 *
 * Made global to ensure DI providers are available across all modules
 */
@Global()
@Module({
  imports: [
    forwardRef(() => ApplicationModule), // Use forwardRef to resolve circular dependency
    // ThreadingModule moved to AppModule to avoid circular dependency
    MongoModule,
  ],
  controllers: [
    // HealthController is registered in HealthModule
    AuthController,
    OauthController,
    UsersController,
    JwksController,
  ],
  providers: [
    // Logger
    {
      provide: 'ILogger',
      useClass: KafkaLoggerAdapter,
    },
    { provide: USER_REPOSITORY, useClass: UserRepository },
    RoleRepository,
    TenantRepository,
    KeyRepository,
    RefreshTokenRepository,
    JwtIssuerService,
    MetricsAdapter,

    // Cache adapter
    RedisCacheAdapter,

    // Global filter/interceptor providers for DI resolution
    GlobalExceptionFilter,
    LoggingInterceptor,
  ],
  exports: [
    'ILogger', // Export ILogger so it can be used by other modules
    USER_REPOSITORY, // Export USER_REPOSITORY for ApplicationModule
    JwtIssuerService, // Export JwtIssuerService for ApplicationModule
    RoleRepository, // Export RoleRepository for ApplicationModule
    TenantRepository, // Export TenantRepository for ApplicationModule
    RefreshTokenRepository, // Export RefreshTokenRepository for ApplicationModule
    MongoModule, // Export MongoModule so ApplicationModule can access MongoService
    RedisCacheAdapter,
  ],
})
export class InfrastructureModule {}
