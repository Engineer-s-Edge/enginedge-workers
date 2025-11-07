/**
 * Infrastructure Module
 *
 * Configures adapters, controllers, and external integrations.
 */

import { Module, Global } from '@nestjs/common';
import { ApplicationModule } from '@application/application.module';
import { HealthController } from 'health/health.controller';
import { ThreadingModule } from './threading/threading.module';
import { MetricsAdapter } from './adapters/monitoring';
import { MongoDbModule } from './adapters/memory/mongodb.module';


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
    ApplicationModule,
    ThreadingModule, // Provides WorkerThreadPool, RequestQueue, etc.
    MongoDbModule, // Provides MongoDB client and database connection
  ],
  controllers: [
    HealthController,
  ],
  providers: [


    MetricsAdapter,
  ],
  exports: [

  ],
})
export class InfrastructureModule {}
