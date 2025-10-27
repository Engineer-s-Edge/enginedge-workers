/**
 * Domain Ports (Interfaces)
 * 
 * These define the contracts between domain and infrastructure layers.
 */

import {
  LaTeXDocument,
  LaTeXProject,
  LaTeXPackage,
  LaTeXTemplate,
  CompilationJob,
  CompilationResult,
  TemplateCategory,
} from '../entities';

/**
 * Logger Port
 */
export interface ILogger {
  log(message: string, context?: string): void;
  error(message: string, trace?: string, context?: string): void;
  warn(message: string, context?: string): void;
  debug(message: string, context?: string): void;
  verbose(message: string, context?: string): void;
}

/**
 * LaTeX Compiler Port
 */
export interface ILaTeXCompiler {
  /**
   * Compile a LaTeX document to PDF
   */
  compile(
    document: LaTeXDocument,
    workingDir: string,
  ): Promise<CompilationResult>;

  /**
   * Compile a LaTeX project to PDF
   */
  compileProject(
    project: LaTeXProject,
    workingDir: string,
  ): Promise<CompilationResult>;

  /**
   * Abort a running compilation
   */
  abort(jobId: string): Promise<void>;

  /**
   * Check if compiler is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get compiler version
   */
  getVersion(): Promise<string>;
}

/**
 * Package Manager Port
 */
export interface IPackageManager {
  /**
   * Install a LaTeX package
   */
  install(packageName: string): Promise<LaTeXPackage>;

  /**
   * Check if a package is installed
   */
  isInstalled(packageName: string): Promise<boolean>;

  /**
   * Get package information
   */
  getPackageInfo(packageName: string): Promise<LaTeXPackage | null>;

  /**
   * Search for packages
   */
  search(query: string): Promise<string[]>;

  /**
   * Update package cache
   */
  updateCache(): Promise<void>;
}

/**
 * Document Repository Port
 */
export interface IDocumentRepository {
  /**
   * Save a LaTeX document
   */
  save(document: LaTeXDocument): Promise<void>;

  /**
   * Find a document by ID
   */
  findById(id: string): Promise<LaTeXDocument | null>;

  /**
   * Find documents by user
   */
  findByUser(userId: string): Promise<LaTeXDocument[]>;

  /**
   * Delete a document
   */
  delete(id: string): Promise<void>;
}

/**
 * Project Repository Port
 */
export interface IProjectRepository {
  /**
   * Save a LaTeX project
   */
  save(project: LaTeXProject): Promise<void>;

  /**
   * Find a project by ID
   */
  findById(id: string): Promise<LaTeXProject | null>;

  /**
   * Find projects by user
   */
  findByUser(userId: string): Promise<LaTeXProject[]>;

  /**
   * Delete a project
   */
  delete(id: string): Promise<void>;

  /**
   * List all projects (with pagination)
   */
  list(skip: number, limit: number): Promise<LaTeXProject[]>;
}

/**
 * Template Repository Port
 */
export interface ITemplateRepository {
  /**
   * Save a template
   */
  save(template: LaTeXTemplate): Promise<void>;

  /**
   * Find a template by ID
   */
  findById(id: string): Promise<LaTeXTemplate | null>;

  /**
   * Find templates by category
   */
  findByCategory(category: TemplateCategory): Promise<LaTeXTemplate[]>;

  /**
   * Find templates by user
   */
  findByUser(userId: string): Promise<LaTeXTemplate[]>;

  /**
   * Find public templates
   */
  findPublic(): Promise<LaTeXTemplate[]>;

  /**
   * Delete a template
   */
  delete(id: string): Promise<void>;

  /**
   * Search templates
   */
  search(query: string): Promise<LaTeXTemplate[]>;
}

/**
 * Compilation Job Repository Port
 */
export interface ICompilationJobRepository {
  /**
   * Save a compilation job
   */
  save(job: CompilationJob): Promise<void>;

  /**
   * Find a job by ID
   */
  findById(jobId: string): Promise<CompilationJob | null>;

  /**
   * Find jobs by user
   */
  findByUser(userId: string): Promise<CompilationJob[]>;

  /**
   * Find jobs by status
   */
  findByStatus(status: string): Promise<CompilationJob[]>;

  /**
   * Delete old jobs
   */
  deleteOlderThan(date: Date): Promise<number>;
}

/**
 * Package Cache Repository Port
 */
export interface IPackageCacheRepository {
  /**
   * Save package to cache
   */
  save(pkg: LaTeXPackage): Promise<void>;

  /**
   * Find package in cache
   */
  findByName(name: string): Promise<LaTeXPackage | null>;

  /**
   * Update package last used timestamp
   */
  touch(name: string): Promise<void>;

  /**
   * Delete stale packages
   */
  deleteStale(days: number): Promise<number>;

  /**
   * List all cached packages
   */
  list(): Promise<LaTeXPackage[]>;
}

/**
 * PDF Storage Port (GridFS or S3)
 */
export interface IPDFStorage {
  /**
   * Store a PDF file
   */
  store(filename: string, buffer: Buffer, metadata?: any): Promise<string>;

  /**
   * Retrieve a PDF file
   */
  retrieve(id: string): Promise<Buffer>;

  /**
   * Delete a PDF file
   */
  delete(id: string): Promise<void>;

  /**
   * Check if PDF exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Get PDF URL (if applicable)
   */
  getUrl(id: string): Promise<string | null>;
}

/**
 * Message Broker Port (Kafka)
 */
export interface IMessageBroker {
  /**
   * Publish a message to a topic
   */
  publish(topic: string, message: any): Promise<void>;

  /**
   * Subscribe to a topic
   */
  subscribe(topic: string, handler: (message: any) => Promise<void>): void;

  /**
   * Disconnect from broker
   */
  disconnect(): Promise<void>;
}

/**
 * File System Port
 */
export interface IFileSystem {
  /**
   * Write file to disk
   */
  writeFile(path: string, content: string | Buffer): Promise<void>;

  /**
   * Read file from disk
   */
  readFile(path: string): Promise<Buffer>;

  /**
   * Check if file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Delete file
   */
  delete(path: string): Promise<void>;

  /**
   * Create directory
   */
  mkdir(path: string): Promise<void>;

  /**
   * Remove directory
   */
  rmdir(path: string): Promise<void>;

  /**
   * List files in directory
   */
  readdir(path: string): Promise<string[]>;
}
