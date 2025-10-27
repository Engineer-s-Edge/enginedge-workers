/**
 * Application Module - LaTeX Worker
 *
 * Configures and provides all application-layer services.
 * Bridges domain logic with infrastructure adapters.
 * 
 * Phase 1: Core compilation infrastructure ⏳
 */

import { Module } from '@nestjs/common';
import { DomainModule } from '../domain/domain.module';
import { LaTeXCompilerService } from './services/latex-compiler.service';
import { PackageManagerService } from './services/package-manager.service';
import { MultiFileService } from './services/multi-file.service';
import { MathRenderingService } from './services/math-rendering.service';
import { ErrorRecoveryService } from './services/error-recovery.service';
import { BibliographyService } from './services/bibliography.service';
import { FontService } from './services/font.service';

/**
 * Application module - use cases and application services
 * 
 * Note: InfrastructureModule is @Global(), so its providers are
 * automatically available to all modules.
 */
@Module({
  imports: [
    DomainModule, // Domain entities and ports
  ],
  providers: [
    LaTeXCompilerService,
    PackageManagerService,
    MultiFileService,
    MathRenderingService,
    ErrorRecoveryService,
    BibliographyService,
    FontService,
  ],
  exports: [
    DomainModule,
    LaTeXCompilerService,
    PackageManagerService,
    MultiFileService,
    MathRenderingService,
    ErrorRecoveryService,
    BibliographyService,
    FontService,
  ],
})
export class ApplicationModule {}
