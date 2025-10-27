import { DocumentController } from '@infrastructure/controllers/document.controller';
import { DocumentProcessingService } from '@application/services/document-processing.service';
import { LoaderRegistryService } from '@application/services/loader-registry.service';
import { Document } from '@domain/entities/document.entity';
import { mock, MockProxy } from 'jest-mock-extended';

describe('DocumentController', () => {
  let controller: DocumentController;
  let docService: MockProxy<DocumentProcessingService>;
  let loaderRegistry: LoaderRegistryService;

  beforeEach(() => {
    docService = mock<DocumentProcessingService>();
    docService.processDocument.mockResolvedValue({ documentIds: ['d1'], chunks: 1 });
    docService.searchSimilar.mockResolvedValue([]);
    docService.getDocument.mockResolvedValue(new Document('d1', 'hello', { source: 's', sourceType: 'file' }));
    docService.deleteDocuments.mockResolvedValue(undefined);
    docService.getSupportedTypes.mockReturnValue(['.pdf']);

    loaderRegistry = new LoaderRegistryService();
  controller = new DocumentController(docService, loaderRegistry);
  });

  it('processUrl calls service and returns success', async () => {
    const res = await controller.processUrl('http://example.com', true, true, true, {});
    expect(res.success).toBe(true);
    expect(res.url).toBe('http://example.com');
  });

  it('getDocument returns document when found', async () => {
    const res = await controller.getDocument('d1');
  expect(res.success).toBe(true);
  expect(res.document!.id).toBe('d1');
  });

  it('getSupportedTypes returns types', () => {
    const res = controller.getSupportedTypes();
    expect(res.success).toBe(true);
    expect(Array.isArray(res.supportedTypes)).toBe(true);
  });
});
