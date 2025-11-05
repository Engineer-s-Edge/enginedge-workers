import { Injectable } from '@nestjs/common';
import { DocumentModel } from '../entities/document.entity';

export interface ProcessingStep<T = unknown> {
  name: string;
  run(input: T): Promise<T>;
}

@Injectable()
export class ProcessingPipelineFactory {
  createDefaultPipeline(): ProcessingStep<DocumentModel>[] {
    return [
      {
        name: 'normalize',
        async run(doc) {
          return doc;
        },
      },
      {
        name: 'dedupe',
        async run(doc) {
          return doc;
        },
      },
    ];
  }
}
