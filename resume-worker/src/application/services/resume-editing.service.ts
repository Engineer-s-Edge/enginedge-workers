import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Resume } from '../../domain/entities/resume.entity';
import { ResumeVersioningService } from './resume-versioning.service';

interface EditOperation {
  type: 'bold' | 'italic' | 'replace' | 'insert' | 'delete';
  location: {
    line?: number;
    start?: number;
    end?: number;
  };
  content?: string;
}

@Injectable()
export class ResumeEditingService {
  private readonly logger = new Logger(ResumeEditingService.name);

  // Undo/redo stacks per resume
  private undoStacks = new Map<string, string[]>();
  private redoStacks = new Map<string, string[]>();

  constructor(
    @InjectModel('Resume')
    private readonly resumeModel: Model<Resume>,
    private readonly versioningService: ResumeVersioningService,
  ) {}

  /**
   * Apply an edit operation to a resume.
   */
  async applyEdit(
    resumeId: string,
    operation: EditOperation,
    createVersion: boolean = false,
  ): Promise<Resume> {
    this.logger.log(`Applying ${operation.type} edit to resume ${resumeId}`);

    const resume = await this.resumeModel.findById(resumeId).exec();
    if (!resume) {
      throw new Error(`Resume ${resumeId} not found`);
    }

    // Save current state to undo stack
    this.pushToUndoStack(resumeId, resume.latexContent);

    // Apply the operation
    let newContent: string;
    switch (operation.type) {
      case 'bold':
        newContent = this.applyBold(resume.latexContent, operation);
        break;
      case 'italic':
        newContent = this.applyItalic(resume.latexContent, operation);
        break;
      case 'replace':
        newContent = this.applyReplace(resume.latexContent, operation);
        break;
      case 'insert':
        newContent = this.applyInsert(resume.latexContent, operation);
        break;
      case 'delete':
        newContent = this.applyDelete(resume.latexContent, operation);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }

    // Update resume
    if (createVersion) {
      return this.versioningService.createVersion(resumeId, {
        content: newContent,
        changes: `Applied ${operation.type} edit`,
        createdBy: 'user',
      });
    } else {
      resume.latexContent = newContent;
      resume.updatedAt = new Date();
      return resume.save();
    }
  }

  /**
   * Undo last edit.
   */
  async undo(resumeId: string): Promise<Resume> {
    this.logger.log(`Undoing last edit for resume ${resumeId}`);

    const undoStack = this.undoStacks.get(resumeId);
    if (!undoStack || undoStack.length === 0) {
      throw new Error('Nothing to undo');
    }

    const resume = await this.resumeModel.findById(resumeId).exec();
    if (!resume) {
      throw new Error(`Resume ${resumeId} not found`);
    }

    // Push current state to redo stack
    this.pushToRedoStack(resumeId, resume.latexContent);

    // Pop from undo stack
    const previousContent = undoStack.pop()!;

    // Update resume
    resume.latexContent = previousContent;
    resume.updatedAt = new Date();
    return resume.save();
  }

  /**
   * Redo last undone edit.
   */
  async redo(resumeId: string): Promise<Resume> {
    this.logger.log(`Redoing last undone edit for resume ${resumeId}`);

    const redoStack = this.redoStacks.get(resumeId);
    if (!redoStack || redoStack.length === 0) {
      throw new Error('Nothing to redo');
    }

    const resume = await this.resumeModel.findById(resumeId).exec();
    if (!resume) {
      throw new Error(`Resume ${resumeId} not found`);
    }

    // Push current state to undo stack
    this.pushToUndoStack(resumeId, resume.latexContent);

    // Pop from redo stack
    const nextContent = redoStack.pop()!;

    // Update resume
    resume.latexContent = nextContent;
    resume.updatedAt = new Date();
    return resume.save();
  }

  /**
   * Apply bold formatting to text.
   */
  private applyBold(content: string, operation: EditOperation): string {
    if (!operation.location.start || !operation.location.end) {
      throw new Error('Start and end positions required for bold operation');
    }

    const before = content.substring(0, operation.location.start);
    const text = content.substring(
      operation.location.start,
      operation.location.end,
    );
    const after = content.substring(operation.location.end);

    return `${before}\\textbf{${text}}${after}`;
  }

  /**
   * Apply italic formatting to text.
   */
  private applyItalic(content: string, operation: EditOperation): string {
    if (!operation.location.start || !operation.location.end) {
      throw new Error('Start and end positions required for italic operation');
    }

    const before = content.substring(0, operation.location.start);
    const text = content.substring(
      operation.location.start,
      operation.location.end,
    );
    const after = content.substring(operation.location.end);

    return `${before}\\textit{${text}}${after}`;
  }

  /**
   * Replace text.
   */
  private applyReplace(content: string, operation: EditOperation): string {
    if (
      !operation.location.start ||
      !operation.location.end ||
      !operation.content
    ) {
      throw new Error('Start, end, and content required for replace operation');
    }

    const before = content.substring(0, operation.location.start);
    const after = content.substring(operation.location.end);

    return `${before}${operation.content}${after}`;
  }

  /**
   * Insert text.
   */
  private applyInsert(content: string, operation: EditOperation): string {
    if (!operation.location.start || !operation.content) {
      throw new Error(
        'Start position and content required for insert operation',
      );
    }

    const before = content.substring(0, operation.location.start);
    const after = content.substring(operation.location.start);

    return `${before}${operation.content}${after}`;
  }

  /**
   * Delete text.
   */
  private applyDelete(content: string, operation: EditOperation): string {
    if (!operation.location.start || !operation.location.end) {
      throw new Error('Start and end positions required for delete operation');
    }

    const before = content.substring(0, operation.location.start);
    const after = content.substring(operation.location.end);

    return `${before}${after}`;
  }

  /**
   * Push content to undo stack.
   */
  private pushToUndoStack(resumeId: string, content: string): void {
    if (!this.undoStacks.has(resumeId)) {
      this.undoStacks.set(resumeId, []);
    }
    this.undoStacks.get(resumeId)!.push(content);

    // Limit stack size
    const stack = this.undoStacks.get(resumeId)!;
    if (stack.length > 50) {
      stack.shift();
    }

    // Clear redo stack when new edit is made
    this.redoStacks.set(resumeId, []);
  }

  /**
   * Push content to redo stack.
   */
  private pushToRedoStack(resumeId: string, content: string): void {
    if (!this.redoStacks.has(resumeId)) {
      this.redoStacks.set(resumeId, []);
    }
    this.redoStacks.get(resumeId)!.push(content);

    // Limit stack size
    const stack = this.redoStacks.get(resumeId)!;
    if (stack.length > 50) {
      stack.shift();
    }
  }

  /**
   * Clear undo/redo stacks for a resume.
   */
  clearStacks(resumeId: string): void {
    this.undoStacks.delete(resumeId);
    this.redoStacks.delete(resumeId);
  }

  /**
   * Get undo/redo stack sizes.
   */
  getStackSizes(resumeId: string): { undoSize: number; redoSize: number } {
    return {
      undoSize: this.undoStacks.get(resumeId)?.length || 0,
      redoSize: this.redoStacks.get(resumeId)?.length || 0,
    };
  }
}
