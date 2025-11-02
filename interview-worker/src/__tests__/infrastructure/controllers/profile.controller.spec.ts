/**
 * Profile Controller Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from '../../../infrastructure/controllers/profile.controller';
import { CandidateProfileService } from '../../../application/services/candidate-profile.service';
import { CandidateProfile } from '../../../domain/entities';

describe('ProfileController', () => {
  let controller: ProfileController;
  let mockProfileService: any;

  beforeEach(async () => {
    mockProfileService = {
      getProfile: jest.fn(),
      recallProfile: jest.fn(),
      appendObservation: jest.fn(),
      updateResumeFindings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        {
          provide: CandidateProfileService,
          useValue: mockProfileService,
        },
      ],
    }).compile();

    controller = module.get<ProfileController>(ProfileController);
  });

  it('should get profile by session ID', async () => {
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

    mockProfileService.getProfile.mockResolvedValue(mockProfile);

    const result = await controller.getProfile('s1');

    expect(result?.profileId).toBe('p1');
    expect(mockProfileService.getProfile).toHaveBeenCalledWith('s1');
  });

  it('should recall profile summary', async () => {
    const mockSummary = {
      strengths: ['Strong problem-solving'],
      concerns: [],
      resumeFindings: {
        verified: [],
        questioned: [],
        deepDived: [],
      },
      keyInsights: 'Quick learner',
      interviewFlow: {
        pausedAt: [],
        skippedQuestions: 0,
        pauseDuration: 0,
      },
    };

    mockProfileService.recallProfile.mockResolvedValue(mockSummary);

    const result = await controller.recallProfile('s1');

    expect(result.strengths).toContain('Strong problem-solving');
    expect(mockProfileService.recallProfile).toHaveBeenCalledWith('s1');
  });

  it('should append observation', async () => {
    const updatedProfile = new CandidateProfile({
      profileId: 'p1',
      sessionId: 's1',
      observations: {
        strengths: ['New strength'],
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

    mockProfileService.appendObservation.mockResolvedValue(updatedProfile);

    const result = await controller.appendObservation('s1', {
      category: 'strengths',
      text: 'New strength',
    });

    expect(result.observations.strengths).toContain('New strength');
    expect(mockProfileService.appendObservation).toHaveBeenCalledWith(
      's1',
      'strengths',
      'New strength',
    );
  });

  it('should update resume findings', async () => {
    const updatedProfile = new CandidateProfile({
      profileId: 'p1',
      sessionId: 's1',
      observations: {
        strengths: [],
        concerns: [],
        resumeFindings: {
          verified: ['Node.js proficiency'],
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

    mockProfileService.updateResumeFindings.mockResolvedValue(updatedProfile);

    const result = await controller.updateResumeFindings('s1', {
      type: 'verified',
      finding: 'Node.js proficiency',
    });

    expect(result.observations.resumeFindings.verified).toContain('Node.js proficiency');
    expect(mockProfileService.updateResumeFindings).toHaveBeenCalledWith(
      's1',
      'verified',
      'Node.js proficiency',
    );
  });
});

