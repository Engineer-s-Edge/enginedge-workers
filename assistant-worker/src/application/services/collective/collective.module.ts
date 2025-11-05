/**
 * Collective Module
 *
 * Wires together all collective infrastructure services.
 */

import { Module } from '@nestjs/common';
import { MessageQueueService } from './message-queue.service';
import { CommunicationService } from './communication.service';
import { ArtifactLockingService } from './artifact-locking.service';
import { ArtifactVersioningService } from './artifact-versioning.service';
import { ArtifactSearchService } from './artifact-search.service';
import { SharedMemoryService } from './shared-memory.service';
import { TaskAssignmentService } from './task-assignment.service';
import { DeadlockDetectionService } from './deadlock-detection.service';
import { IDeadlockDetectionService } from '@domain/ports/deadlock-detection.port';

@Module({
  providers: [
    MessageQueueService,
    CommunicationService,
    ArtifactLockingService,
    ArtifactVersioningService,
    ArtifactSearchService,
    SharedMemoryService,
    TaskAssignmentService,
    DeadlockDetectionService,
    // Provide as port for domain layer
    {
      provide: 'IDeadlockDetectionService',
      useExisting: DeadlockDetectionService,
    },
  ],
  exports: [
    MessageQueueService,
    CommunicationService,
    ArtifactLockingService,
    ArtifactVersioningService,
    ArtifactSearchService,
    SharedMemoryService,
    TaskAssignmentService,
    DeadlockDetectionService,
    // Export port for domain layer
    'IDeadlockDetectionService',
  ],
})
export class CollectiveModule {}
