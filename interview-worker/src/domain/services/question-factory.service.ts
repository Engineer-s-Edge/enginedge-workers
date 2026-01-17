import { Injectable } from '@nestjs/common';

export interface QuestionDefinition {
  id: string;
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
}

@Injectable()
export class QuestionFactoryService {
  create(
    text: string,
    difficulty: QuestionDefinition['difficulty'],
    tags: string[] = [],
  ): QuestionDefinition {
    return {
      id: Math.random().toString(36).slice(2),
      text,
      difficulty,
      tags,
    };
  }
}
