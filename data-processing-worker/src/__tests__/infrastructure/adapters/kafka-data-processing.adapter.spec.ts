import { KafkaDataProcessingAdapter } from '@infrastructure/adapters/messaging/kafka-data-processing.adapter';

describe('KafkaDataProcessingAdapter (unit)', () => {
  it('publishes result via producer.send', async () => {
    // Minimal mocks
    const config: any = { get: (key: string, def?: string) => 'localhost:9092' };
    const docService: any = {
      processDocument: async () => ({ documentIds: ['d1'], chunks: 1 }),
      searchSimilar: async () => [],
      deleteDocuments: async () => {},
    };

    const adapter = new KafkaDataProcessingAdapter(config as any, docService as any);

    // Override producer with mock
    const mockSend = jest.fn().mockResolvedValue(undefined);
    (adapter as any).producer = { send: mockSend };

    // Call private publishResult
    await (adapter as any).publishResult('document.processed', { taskId: 't1', status: 'SUCCESS' });

    expect(mockSend).toHaveBeenCalled();
  });
});
