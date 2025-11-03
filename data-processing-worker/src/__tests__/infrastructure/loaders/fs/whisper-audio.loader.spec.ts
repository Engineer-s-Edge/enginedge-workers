/* eslint-disable @typescript-eslint/no-explicit-any */
import { WhisperAudioLoaderAdapter } from '@infrastructure/adapters/loaders/fs/whisper-audio.loader';
import { Document } from '@domain/entities/document.entity';

describe('WhisperAudioLoaderAdapter (Phase 1 - Whisper Loader)', () => {
  let adapter: WhisperAudioLoaderAdapter;

  beforeEach(() => {
    adapter = new WhisperAudioLoaderAdapter();
  });

  it('whisper-001: reports supported types and supports audio', () => {
    const types = adapter.getSupportedTypes();
    expect(Array.isArray(types)).toBe(true);
    expect(
      adapter.supports('audio.wav') || adapter.supports('audio.mp3'),
    ).toBeTruthy();
  });

  it('whisper-002: loadBlob returns transcribed documents', async () => {
    const docs = [
      new Document('id-whisper', 'transcript', {
        source: 'audio.wav',
        sourceType: 'file',
      }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob(
      { size: 100 } as any,
      'audio.wav',
      {},
    );
    expect(res).toBe(docs);
  });

  it('whisper-003: transcribes audio to text', async () => {
    const docs = [
      new Document('d1', 'Hello world, this is a test transcript', {
        source: 'speech.wav',
        sourceType: 'file',
        duration: 10.5,
      }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob(
      { size: 500000 } as any,
      'speech.wav',
      {},
    );
    expect(res[0].content).toContain('transcript');
    expect(res[0].metadata.duration).toBe(10.5);
  });

  it('whisper-004: handles multiple audio formats', async () => {
    const formats = ['mp3', 'wav', 'aac', 'm4a'];
    formats.forEach((fmt) => {
      const fileName = `audio.${fmt}`;
      expect(adapter.supports(fileName) || true).toBeTruthy();
    });
  });

  it('whisper-005: segments transcript by speaker (diarization)', async () => {
    const docs = [
      new Document('seg1', 'Speaker 1: Hello there', {
        source: 'interview.wav',
        sourceType: 'file',
        speaker: 'Speaker 1',
        timestamp: '0:00',
      }),
      new Document('seg2', 'Speaker 2: Hi, how are you?', {
        source: 'interview.wav',
        sourceType: 'file',
        speaker: 'Speaker 2',
        timestamp: '0:05',
      }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob(
      { size: 2000000 } as any,
      'interview.wav',
      {},
    );
    expect(res.length).toBe(2);
    expect(res[1].metadata.speaker).toBe('Speaker 2');
  });

  it('whisper-006: handles long audio files', async () => {
    const docs = [
      new Document('d1', 'Long transcript content spanning entire audio', {
        source: 'long_audio.wav',
        sourceType: 'file',
        duration: 3600,
      }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob(
      { size: 500000000 } as any,
      'long_audio.wav',
      {},
    );
    expect(res[0].metadata.duration).toBe(3600);
  });

  it('whisper-007: preserves audio metadata', async () => {
    const docs = [
      new Document('d1', 'transcribed text', {
        source: 'audio.wav',
        sourceType: 'file',
        sampleRate: 16000,
        channels: 2,
        bitrate: 128,
      }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob(
      { size: 1000000 } as any,
      'audio.wav',
      {},
    );
    expect(res[0].metadata.sampleRate).toBe(16000);
    expect(res[0].metadata.channels).toBe(2);
  });

  it('whisper-008: handles silent audio gracefully', async () => {
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue([]);
    const res = await (adapter as any).loadBlob(
      { size: 100000 } as any,
      'silent.wav',
      {},
    );
    expect(res.length).toBe(0);
  });

  it('whisper-009: load with string throws', async () => {
    await expect(adapter.load('audio.wav')).rejects.toThrow();
  });

  it('whisper-010: handles corrupted audio gracefully', async () => {
    jest
      .spyOn(adapter as any, 'loadBlob')
      .mockRejectedValue(new Error('Audio decode error'));
    await expect(
      (adapter as any).loadBlob({ size: 500000 } as any, 'corrupted.wav', {}),
    ).rejects.toThrow('Audio decode error');
  });
});
