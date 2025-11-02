/**
 * Candidate Profile Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CandidateProfileService } from '../../../application/services/candidate-profile.service';
import { CandidateProfile } from '../../../domain/entities';
import { mock } from 'jest-mock-extended';
import { ICandidateProfileRepository } from '../../../application/ports/repositories.port';

describe('CandidateProfileService', () => {
  let service: CandidateProfileService;
  const mockProfileRepository = mock<ICandidateProfileRepository>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateProfileService,
        { provide: 'ICandidateProfileRepository', useValue: mockProfileRepository },
      ],
    }).compile();

    service = module.get<CandidateProfileService>(CandidateProfileService);
    mockProfileRepository.findBySessionId.mockReset();
    mockProfileRepository.save.mockReset();
  });

  it('should get profile by session ID', async () => {
    const mockProfile = new CandidateProfile({
      profileId: 'p1',
      sessionId: 's1',
      observations: {
        strengths: ['Good communication'],
        concerns: [],
        resumeFindings: {
          verified: [],
          questioned: [],
          deepDived: [],
        },
        adaptability: '',
        communicationStyle: '',
        interviewFlow: {
          pausedAt: [],
          skippedQuestions: 0,
          pauseDuration: 0,
        },
        keyInsights: '',
      },
    });

    mockProfileRepository.findBySessionId.mockResolvedValue(mockProfile);

    const result = await service.getProfile('s1');

    expect(result?.profileId).toBe('p1');
    expect(mockProfileRepository.findBySessionId).toHaveBeenCalledWith('s1');
  });

  it('should recall profile summary', async () => {
    const mockProfile = new CandidateProfile({
      profileId: 'p1',
      sessionId: 's1',
      observations: {
        strengths: ['Strong problem-solving'],
        concerns: ['Lacks depth in algorithms'],
        resumeFindings: {
          verified: ['React experience'],
          questioned: [],
          deepDived: [],
        },
        adaptability: '',
        communicationStyle: '',
        interviewFlow: {
          pausedAt: [],
          skippedQuestions: 1,
          pauseDuration: 0,
        },
        keyInsights: 'Quick learner',
      },
    });

    mockProfileRepository.findBySessionId.mockResolvedValue(mockProfile);

    const result = await service.recallProfile('s1');

    expect(result.strengths).toContain('Strong problem-solving');
    expect(result.concerns).toContain('Lacks depth in algorithms');
    expect(result.interviewFlow.skippedQuestions).toBe(1);
  });

  it('should append observation', async () => {
    const mockProfile = new CandidateProfile({
      profileId: 'p1',
      sessionId: 's1',
      observations: {
        strengths: [],
        concerns: [],
        resumeFindings: {
          verified: [],
          questioned: [],
          deepDived: [],
        },
        adaptability: '',
        communicationStyle: '',
        interviewFlow: {
          pausedAt: [],
          skippedQuestions: 0,
          pauseDuration: 0,
        },
        keyInsights: '',
      },
    });

    mockProfileRepository.findBySessionId.mockResolvedValue(mockProfile);
    mockProfileRepository.save.mockImplementation(async (p: any) => p);

    const result = await service.appendObservation('s1', 'strengths', 'New strength');

    expect(result.observations.strengths).toContain('New strength');
    expect(mockProfileRepository.save).toHaveBeenCalled();
  });

  it('should update resume findings', async () => {
    const mockProfile = new CandidateProfile({
      profileId: 'p1',
      sessionId: 's1',
      observations: {
        strengths: [],
        concerns: [],
        resumeFindings: {
          verified: [],
          questioned: [],
          deepDived: [],
        },
        adaptability: '',
        communicationStyle: '',
        interviewFlow: {
          pausedAt: [],
          skippedQuestions: 0,
          pauseDuration: 0,
        },
        keyInsights: '',
      },
    });

    mockProfileRepository.findBySessionId.mockResolvedValue(mockProfile);
    mockProfileRepository.save.mockImplementation(async (p: any) => p);

    const result = await service.updateResumeFindings('s1', 'verified', 'Node.js proficiency');

    expect(result.observations.resumeFindings.verified).toContain('Node.js proficiency');
    expect(mockProfileRepository.save).toHaveBeenCalled();
  });
});

