/**
 * Azure Speech Adapter Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AzureSpeechAdapter } from '../../../../infrastructure/adapters/voice/azure-speech.adapter';
import { ConfigService } from '@nestjs/config';

describe('AzureSpeechAdapter', () => {
  let adapter: AzureSpeechAdapter;
  let mockConfigService: any;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AzureSpeechAdapter,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    adapter = module.get<AzureSpeechAdapter>(AzureSpeechAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should throw error for speechToText when subscription key not configured', async () => {
    mockConfigService.get.mockReturnValue(undefined);
    const newAdapter = new AzureSpeechAdapter(mockConfigService);
    const audioBuffer = Buffer.from('test audio');

    await expect(newAdapter.speechToText(audioBuffer)).rejects.toThrow(
      'Azure Speech subscription key not configured',
    );
  });

  it('should return mock transcription when subscription key is configured', async () => {
    mockConfigService.get.mockReturnValue('test-key');
    const newAdapter = new AzureSpeechAdapter(mockConfigService);
    const audioBuffer = Buffer.from('test audio');

    const result = await newAdapter.speechToText(audioBuffer);

    expect(result).toContain('Mock transcription');
  });

  it('should throw error for textToSpeech when subscription key not configured', async () => {
    mockConfigService.get.mockReturnValue(undefined);
    const newAdapter = new AzureSpeechAdapter(mockConfigService);

    await expect(newAdapter.textToSpeech('test text')).rejects.toThrow(
      'Azure Speech subscription key not configured',
    );
  });

  it('should return mock audio when subscription key is configured', async () => {
    mockConfigService.get.mockReturnValue('test-key');
    const newAdapter = new AzureSpeechAdapter(mockConfigService);

    const result = await newAdapter.textToSpeech('test text');

    expect(Buffer.isBuffer(result)).toBe(true);
  });
});

