/**
 * Infrastructure Module - Data Processing Worker
 *
 * Configures adapters, controllers, and external integrations for document processing.
 */

import { Module, Global, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApplicationModule } from '../application/application.module';
import { RedisCacheAdapter } from './adapters/cache/redis-cache.adapter';

// Database Schemas
import {
  DocumentModel,
  DocumentSchema,
} from './database/schemas/document.schema';

// Controllers
import { DocumentController } from './controllers/document.controller';
import { VectorStoreController } from './controllers/vectorstore.controller';
import { EmbedderController } from './controllers/embedder.controller';

// Loaders - Filesystem
import { PdfLoaderAdapter } from './adapters/loaders/fs/pdf.loader';
import { DocxLoaderAdapter } from './adapters/loaders/fs/docx.loader';
import { CsvLoaderAdapter } from './adapters/loaders/fs/csv.loader';
import { EpubLoaderAdapter } from './adapters/loaders/fs/epub.loader';
import { PptxLoaderAdapter } from './adapters/loaders/fs/pptx.loader';
import { SrtLoaderAdapter } from './adapters/loaders/fs/srt.loader';
import { NotionLoaderAdapter } from './adapters/loaders/fs/notion.loader';
import { ObsidianLoaderAdapter } from './adapters/loaders/fs/obsidian.loader';
import { WhisperAudioLoaderAdapter } from './adapters/loaders/fs/whisper-audio.loader';
import { UnstructuredLoaderAdapter } from './adapters/loaders/fs/unstructured.loader';

// Loaders - Web
import { CheerioWebLoaderAdapter } from './adapters/loaders/web/cheerio.loader';
import { PlaywrightWebLoaderAdapter } from './adapters/loaders/web/playwright.loader';
import { CurlWebLoaderAdapter } from './adapters/loaders/web/curl.loader';
import { PuppeteerWebLoaderAdapter } from './adapters/loaders/web/puppeteer.loader';
import { RecursiveUrlLoaderAdapter } from './adapters/loaders/web/recursive-url.loader';
import { GithubLoaderAdapter } from './adapters/loaders/web/github.loader';
import { SitemapLoaderAdapter } from './adapters/loaders/web/sitemap.loader';
import { S3LoaderAdapter } from './adapters/loaders/web/s3.loader';
import { SerpApiLoaderAdapter } from './adapters/loaders/web/serpapi.loader';
import { TavilySearchLoaderAdapter } from './adapters/loaders/web/tavily.loader';
import { YoutubeLoaderAdapter } from './adapters/loaders/web/youtube.loader';
import { HtmlLoaderAdapter } from './adapters/loaders/web/html.loader';
import { NotionApiLoaderAdapter } from './adapters/loaders/web/notion-api.loader';

// Text Splitters
import { RecursiveCharacterSplitterAdapter } from './adapters/splitters/recursive-character.splitter';
import { CharacterSplitterAdapter } from './adapters/splitters/character.splitter';
import { TokenSplitterAdapter } from './adapters/splitters/token.splitter';
import { SemanticSplitterAdapter } from './adapters/splitters/semantic.splitter';
import { PythonSplitterAdapter } from './adapters/splitters/python.splitter';
import { JavaScriptSplitterAdapter } from './adapters/splitters/javascript.splitter';
import { TypeScriptSplitterAdapter } from './adapters/splitters/typescript.splitter';
import { JavaSplitterAdapter } from './adapters/splitters/java.splitter';
import { CppSplitterAdapter } from './adapters/splitters/cpp.splitter';
import { GoSplitterAdapter } from './adapters/splitters/go.splitter';
import { LatexSplitterAdapter } from './adapters/splitters/latex.splitter';
import { MarkdownSplitterAdapter } from './adapters/splitters/markdown.splitter';
import { HtmlSplitterAdapter } from './adapters/splitters/html.splitter';

// Embedders
import { OpenAIEmbedderAdapter } from './adapters/embedders/openai.embedder';
import { GoogleEmbedderAdapter } from './adapters/embedders/google.embedder';
import { CohereEmbedderAdapter } from './adapters/embedders/cohere.embedder';
import { HuggingFaceEmbedderAdapter } from './adapters/embedders/huggingface.embedder';
import { LocalEmbedderAdapter } from './adapters/embedders/local.embedder';

// Vector Stores
import { MongoDBVectorStoreAdapter } from './adapters/vectorstores/mongodb.vectorstore';
import { PineconeVectorStoreAdapter } from './adapters/vectorstores/pinecone.vectorstore';
import { WeaviateVectorStoreAdapter } from './adapters/vectorstores/weaviate.vectorstore';
import { PgVectorStoreAdapter } from './adapters/vectorstores/pgvector.vectorstore';
import { QdrantVectorStoreAdapter } from './adapters/vectorstores/qdrant.vectorstore';
import { ChromaDBVectorStoreAdapter } from './adapters/vectorstores/chromadb.vectorstore';

// Messaging
import { KafkaDataProcessingAdapter } from './adapters/messaging/kafka-data-processing.adapter';
import { KafkaLoggerAdapter } from '../common/logging/kafka-logger.adapter';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

/**
 * Infrastructure module - All adapters and implementations
 *
 * Phase 1: Document Loaders (10 filesystem loaders) ✅
 * Phase 2: Web Loaders (2+ web loaders) ✅
 * Phase 3: Text Splitters ✅
 * Phase 4: Embedders (OpenAI, Google) ✅
 * Phase 5: Vector Stores (MongoDB) ✅
 * Phase 6: Kafka Integration ✅
 * Phase 7: REST API Controllers ✅
 *
 * Made global to ensure DI providers are available across all modules
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DocumentModel.name, schema: DocumentSchema },
    ]),
    forwardRef(() => ApplicationModule),
  ],
  controllers: [DocumentController, VectorStoreController, EmbedderController],
  providers: [
    // Logger
    {
      provide: 'ILogger',
      useClass: KafkaLoggerAdapter,
    },
    // Filesystem Loaders
    PdfLoaderAdapter,
    DocxLoaderAdapter,
    CsvLoaderAdapter,
    EpubLoaderAdapter,
    PptxLoaderAdapter,
    SrtLoaderAdapter,
    NotionLoaderAdapter,
    ObsidianLoaderAdapter,
    WhisperAudioLoaderAdapter,
    UnstructuredLoaderAdapter,

    // Web Loaders (13 total)
    CheerioWebLoaderAdapter,
    PlaywrightWebLoaderAdapter,
    CurlWebLoaderAdapter,
    PuppeteerWebLoaderAdapter,
    RecursiveUrlLoaderAdapter,
    GithubLoaderAdapter,
    SitemapLoaderAdapter,
    S3LoaderAdapter,
    SerpApiLoaderAdapter,
    TavilySearchLoaderAdapter,
    YoutubeLoaderAdapter,
    HtmlLoaderAdapter,
    NotionApiLoaderAdapter,

    // Text Splitters (13 total)
    RecursiveCharacterSplitterAdapter,
    CharacterSplitterAdapter,
    TokenSplitterAdapter,
    SemanticSplitterAdapter,
    PythonSplitterAdapter,
    JavaScriptSplitterAdapter,
    TypeScriptSplitterAdapter,
    JavaSplitterAdapter,
    CppSplitterAdapter,
    GoSplitterAdapter,
    LatexSplitterAdapter,
    MarkdownSplitterAdapter,
    HtmlSplitterAdapter,
    // Text Splitter tokens for application layer
    {
      provide: 'TextSplitter.recursive',
      useExisting: RecursiveCharacterSplitterAdapter,
    },
    {
      provide: 'TextSplitter.character',
      useExisting: CharacterSplitterAdapter,
    },
    { provide: 'TextSplitter.token', useExisting: TokenSplitterAdapter },
    { provide: 'TextSplitter.semantic', useExisting: SemanticSplitterAdapter },
    { provide: 'TextSplitter.python', useExisting: PythonSplitterAdapter },
    {
      provide: 'TextSplitter.javascript',
      useExisting: JavaScriptSplitterAdapter,
    },
    {
      provide: 'TextSplitter.typescript',
      useExisting: TypeScriptSplitterAdapter,
    },
    { provide: 'TextSplitter.java', useExisting: JavaSplitterAdapter },
    { provide: 'TextSplitter.cpp', useExisting: CppSplitterAdapter },
    { provide: 'TextSplitter.go', useExisting: GoSplitterAdapter },
    { provide: 'TextSplitter.latex', useExisting: LatexSplitterAdapter },
    { provide: 'TextSplitter.markdown', useExisting: MarkdownSplitterAdapter },
    { provide: 'TextSplitter.html', useExisting: HtmlSplitterAdapter },

    // Embedders
    OpenAIEmbedderAdapter,
    GoogleEmbedderAdapter,
    CohereEmbedderAdapter,
    HuggingFaceEmbedderAdapter,
    LocalEmbedderAdapter,
    // Embedder tokens for application layer
    { provide: 'Embedder.openai', useExisting: OpenAIEmbedderAdapter },
    { provide: 'Embedder.google', useExisting: GoogleEmbedderAdapter },
    { provide: 'Embedder.cohere', useExisting: CohereEmbedderAdapter },
    {
      provide: 'Embedder.huggingface',
      useExisting: HuggingFaceEmbedderAdapter,
    },
    { provide: 'Embedder.local', useExisting: LocalEmbedderAdapter },

    // Vector Stores (6 total - MongoDB ENABLED, others disabled)
    MongoDBVectorStoreAdapter,
    PineconeVectorStoreAdapter,
    WeaviateVectorStoreAdapter,
    PgVectorStoreAdapter,
    QdrantVectorStoreAdapter,
    ChromaDBVectorStoreAdapter,

    // Messaging
    KafkaDataProcessingAdapter,

    // Cache adapter
    RedisCacheAdapter,

    // Provide VectorStorePort alias for dependency injection
    {
      provide: 'VectorStorePort',
      useExisting: MongoDBVectorStoreAdapter,
    },

    // Global filter/interceptor providers for DI resolution
    GlobalExceptionFilter,
    LoggingInterceptor,
  ],
  exports: [
    // Export all loaders and infrastructure
    PdfLoaderAdapter,
    DocxLoaderAdapter,
    CsvLoaderAdapter,
    RecursiveCharacterSplitterAdapter,
    OpenAIEmbedderAdapter,
    GoogleEmbedderAdapter,
    MongoDBVectorStoreAdapter,
    KafkaDataProcessingAdapter,
    RedisCacheAdapter,
    // Export TextSplitter tokens for ApplicationModule
    'TextSplitter.recursive',
    'TextSplitter.character',
    'TextSplitter.token',
    'TextSplitter.semantic',
    'TextSplitter.python',
    'TextSplitter.javascript',
    'TextSplitter.typescript',
    'TextSplitter.java',
    'TextSplitter.cpp',
    'TextSplitter.go',
    'TextSplitter.latex',
    'TextSplitter.markdown',
    'TextSplitter.html',
    // Export Embedder tokens for ApplicationModule
    'Embedder.openai',
    'Embedder.google',
    'Embedder.cohere',
    'Embedder.huggingface',
    'Embedder.local',
    // Export VectorStorePort for ApplicationModule
    'VectorStorePort',
  ],
})
export class InfrastructureModule {}
