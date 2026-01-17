/**
 * Application Module - Phase 5 In Progress
 *
 * Configures and provides all application-layer services and use cases.
 * Bridges domain logic with infrastructure adapters.
 *
 * Phase 1: Core agent infrastructure ✅
 * Phase 2: Specialized agent controllers ✅
 * Phase 3: Memory systems ✅
 * Phase 4: Knowledge graph ✅
 * Phase 5: Advanced features ⏳
 */

import { Module } from '@nestjs/common';
import { DomainModule } from '@domain/domain.module';
import { IdentityService } from './services/identity.service';
import { OAuthService } from './services/oauth.service';

/**
 * Application module - use cases and application services
 *
 * Note: InfrastructureModule is @Global(), so its providers (ILogger, ILLMProvider, IAgentRepository)
 * are automatically available to all modules. No need to import it here.
 */
@Module({
  imports: [
    DomainModule, // Domain services (AgentFactory, MemoryManager, etc.)
  ],
  providers: [IdentityService, OAuthService],
  exports: [
    // Export domain module so infrastructure can access it
    DomainModule,
    // Export services for other modules
    IdentityService,
    OAuthService,
  ],
})
export class ApplicationModule {}
