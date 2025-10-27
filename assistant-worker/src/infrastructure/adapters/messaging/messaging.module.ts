import { Module } from '@nestjs/common';
import { KafkaMessageBrokerAdapter } from './kafka-message-broker.adapter';
import { WorkerKafkaService } from './worker-kafka.service';
import { MESSAGE_BROKER_PORT } from '../../../application/ports/message-broker.port';
import { ProcessCommandUseCase } from '../../../application/use-cases/process-command.use-case';

/**
 * Messaging Module (Infrastructure Layer)
 * 
 * Provides message broker implementations (Kafka) as infrastructure adapters.
 */
@Module({
  providers: [
    KafkaMessageBrokerAdapter,
    {
      provide: MESSAGE_BROKER_PORT,
      useClass: KafkaMessageBrokerAdapter,
    },
    WorkerKafkaService,
    ProcessCommandUseCase,
  ],
  exports: [
    MESSAGE_BROKER_PORT,
    KafkaMessageBrokerAdapter,
    WorkerKafkaService,
  ],
})
export class MessagingModule {}

