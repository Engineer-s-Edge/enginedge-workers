/**
 * Question Repository Unit Tests (with MongoDB Memory Server)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { MongoInterviewQuestionRepository } from '../../../../infrastructure/adapters/database/question.repository';
import { InterviewQuestion } from '../../../../domain/entities';

describe('MongoInterviewQuestionRepository', () => {
  let repository: MongoInterviewQuestionRepository;
  let mongoServer: MongoMemoryServer;
  let mongoClient: MongoClient;
  let db: Db;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    db = mongoClient.db('test_db');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MongoInterviewQuestionRepository,
        {
          provide: 'MONGODB_DB',
          useValue: db,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<MongoInterviewQuestionRepository>(
      MongoInterviewQuestionRepository,
    );

    await repository.onModuleInit();
  });

  afterAll(async () => {
    await mongoClient.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await db.collection('questions').deleteMany({});
  });

  it('should save and retrieve question', async () => {
    const question = new InterviewQuestion({
      questionId: 'q1',
      category: 'tech-trivia',
      difficulty: 'easy',
      question: 'What is an array?',
      tags: ['data-structures'],
    });

    await repository.save(question);
    const retrieved = await repository.findById('q1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.questionId).toBe('q1');
    expect(retrieved?.category).toBe('tech-trivia');
  });

  it('should find questions by category', async () => {
    const q1 = new InterviewQuestion({
      questionId: 'q1',
      category: 'tech-trivia',
      difficulty: 'easy',
      question: 'Question 1',
    });

    const q2 = new InterviewQuestion({
      questionId: 'q2',
      category: 'behavioral',
      difficulty: 'medium',
      question: 'Question 2',
    });

    await repository.save(q1);
    await repository.save(q2);

    const techQuestions = await repository.findByCategory('tech-trivia');

    expect(techQuestions.length).toBeGreaterThan(0);
    expect(techQuestions.every((q) => q.category === 'tech-trivia')).toBe(true);
  });

  it('should find questions by category and difficulty', async () => {
    const q1 = new InterviewQuestion({
      questionId: 'q1',
      category: 'tech-trivia',
      difficulty: 'easy',
      question: 'Question 1',
    });

    const q2 = new InterviewQuestion({
      questionId: 'q2',
      category: 'tech-trivia',
      difficulty: 'medium',
      question: 'Question 2',
    });

    await repository.save(q1);
    await repository.save(q2);

    const easyQuestions = await repository.findByCategory(
      'tech-trivia',
      'easy',
    );

    expect(easyQuestions.length).toBeGreaterThan(0);
    expect(easyQuestions.every((q) => q.difficulty === 'easy')).toBe(true);
  });

  it('should find questions by tags', async () => {
    const q1 = new InterviewQuestion({
      questionId: 'q1',
      category: 'tech-trivia',
      difficulty: 'medium',
      question: 'Question 1',
      tags: ['sorting', 'algorithms'],
    });

    await repository.save(q1);

    const taggedQuestions = await repository.findByTags(['sorting']);

    expect(taggedQuestions.length).toBeGreaterThan(0);
    expect(taggedQuestions[0].tags).toContain('sorting');
  });

  it('should return null for non-existent question', async () => {
    const retrieved = await repository.findById('non-existent');
    expect(retrieved).toBeNull();
  });

  it('should update existing question', async () => {
    const question = new InterviewQuestion({
      questionId: 'q1',
      category: 'tech-trivia',
      difficulty: 'easy',
      question: 'Original question',
    });

    await repository.save(question);

    const updated = await repository.update('q1', {
      question: 'Updated question',
      difficulty: 'medium',
    });

    expect(updated?.question).toBe('Updated question');
    expect(updated?.difficulty).toBe('medium');
  });
});
