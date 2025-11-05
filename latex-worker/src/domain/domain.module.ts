import { Module } from '@nestjs/common';
import { LatexTemplateFactory } from './services/latex-template.factory';

/**
 * Domain Module - Pure business logic with NO external dependencies
 *
 * All services in this module are pure domain services that:
 * - Have no infrastructure dependencies
 * - Are easily testable in isolation
 * - Contain core business logic
 *
 * Exports:
 * - Factory services for creating domain objects
 * - Validation services for business rules
 * - Transformation services for domain logic
 */
@Module({
  providers: [LatexTemplateFactory],
  exports: [LatexTemplateFactory],
})
export class DomainModule {}
