/**
 * Application Module
 *
 * Configures and provides all application-layer services and use cases.
 * Bridges domain logic with infrastructure adapters.
 */

import { Module } from '@nestjs/common';
import { DomainModule } from '@domain/domain.module';
import { NewsService } from './services/news.service';

/**
 * Application module - use cases and application services
 *
 * Note: InfrastructureModule is @Global(), so its providers (ILogger, INewsRepository, RedisCacheAdapter)
 * are automatically available to all modules. No need to import it here.
 */
@Module({
  imports: [
    DomainModule, // Domain entities and value objects
  ],
  providers: [
    NewsService,
  ],
  exports: [
    // Export domain module so infrastructure can access it
    DomainModule,

    // Export services for controllers
    NewsService,
  ],
})
export class ApplicationModule {}
