/**
 * Google Speech Adapter Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GoogleSpeechAdapter } from '../../../../infrastructure/adapters/voice/google-speech.adapter';
import { ConfigService } from '@nestjs/config';

describe('GoogleSpeechAdapter', () => {
  let adapter: GoogleSpeechAdapter;
  let mockConfigService: any;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleSpeechAdapter,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    adapter = module.get<GoogleSpeechAdapter>(GoogleSpeechAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should throw error for speechToText when API key not configured', async () => {
    mockConfigService.get.mockReturnValue(undefined);
    const newAdapter = new GoogleSpeechAdapter(mockConfigService);
    const audioBuffer = Buffer.from('test audio');

    await expect(newAdapter.speechToText(audioBuffer)).rejects.toThrow(
      'Google Cloud API key not configured',
    );
  });

  it('should return mock transcription when API key is configured', async () => {
    mockConfigService.get.mockReturnValue('test-api-key');
    const newAdapter = new GoogleSpeechAdapter(mockConfigService);
    const audioBuffer = Buffer.from('test audio');

    const result = await newAdapter.speechToText(audioBuffer);

    expect(result).toContain('Mock transcription');
  });

  it('should throw error for textToSpeech when API key not configured', async () => {
    mockConfigService.get.mockReturnValue(undefined);
    const newAdapter = new GoogleSpeechAdapter(mockConfigService);

    await expect(newAdapter.textToSpeech('test text')).rejects.toThrow(
      'Google Cloud API key not configured',
    );
  });

  it('should return mock audio when API key is configured', async () => {
    mockConfigService.get.mockReturnValue('test-api-key');
    const newAdapter = new GoogleSpeechAdapter(mockConfigService);

    const result = await newAdapter.textToSpeech('test text');

    expect(Buffer.isBuffer(result)).toBe(true);
  });
});
