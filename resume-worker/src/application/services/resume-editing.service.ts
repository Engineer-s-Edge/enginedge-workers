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

  /**
   * Apply template to resume
   */
  async applyTemplate(
    resumeId: string,
    templateId: string,
    preserveBullets: boolean,
    userData: any,
    options: any,
  ): Promise<{
    resumeId: string;
    templateId: string;
    updatedLatex: string;
    changes: any;
    warnings: string[];
  }> {
    const resume = await this.resumeModel.findById(resumeId).exec();
    if (!resume) {
      throw new Error('Resume not found');
    }

    // Extract bullet references from current resume
    const bulletRefs = this.extractBulletReferences(resume.latexContent);

    // Load template (simplified - in production, load from template service)
    const templateLatex = this.loadTemplate(templateId);

    // Map user data to template variables
    let updatedLatex = this.mapUserDataToTemplate(templateLatex, userData);

    // Preserve bullet references if requested
    if (preserveBullets) {
      updatedLatex = this.preserveBulletReferences(updatedLatex, bulletRefs);
    }

    // Update resume
    resume.latexContent = updatedLatex;
    await resume.save();

    return {
      resumeId,
      templateId,
      updatedLatex,
      changes: {
        formattingUpdated: options.updateFormatting || false,
        sectionOrderUpdated: options.updateSectionOrder || false,
        userDataMapped: true,
        bulletReferencesPreserved: bulletRefs.length,
        customSectionsRemoved: 0,
      },
      warnings: [],
    };
  }

  /**
   * Reorder sections in resume
   */
  async reorderSections(
    resumeId: string,
    sectionOrder: string[],
  ): Promise<{
    resumeId: string;
    updatedLatex: string;
    sectionOrder: string[];
  }> {
    const resume = await this.resumeModel.findById(resumeId).exec();
    if (!resume) {
      throw new Error('Resume not found');
    }

    // Parse sections from LaTeX
    const sections = this.parseSections(resume.latexContent);

    // Reorder sections
    const reorderedSections = sectionOrder.map(sectionName => {
      const section = sections.find(s => s.name === sectionName);
      if (!section) {
        throw new Error(`Section ${sectionName} not found`);
      }
      return section;
    });

    // Rebuild LaTeX with new order
    const updatedLatex = this.rebuildLatexWithSections(
      resume.latexContent,
      reorderedSections,
    );

    resume.latexContent = updatedLatex;
    await resume.save();

    return {
      resumeId,
      updatedLatex,
      sectionOrder,
    };
  }

  /**
   * Update formatting
   */
  async updateFormatting(
    resumeId: string,
    formatting: any,
  ): Promise<{
    resumeId: string;
    updatedLatex: string;
    formatting: any;
  }> {
    const resume = await this.resumeModel.findById(resumeId).exec();
    if (!resume) {
      throw new Error('Resume not found');
    }

    // Apply formatting changes to LaTeX
    let updatedLatex = resume.latexContent;

    // Update font family
    if (formatting.fonts?.family) {
      updatedLatex = this.updateFontFamily(updatedLatex, formatting.fonts.family);
    }

    // Update font size
    if (formatting.fonts?.size) {
      updatedLatex = this.updateFontSize(updatedLatex, formatting.fonts.size);
    }

    // Update colors
    if (formatting.colors) {
      updatedLatex = this.updateColors(updatedLatex, formatting.colors);
    }

    // Update spacing
    if (formatting.spacing) {
      updatedLatex = this.updateSpacing(updatedLatex, formatting.spacing);
    }

    resume.latexContent = updatedLatex;
    await resume.save();

    return {
      resumeId,
      updatedLatex,
      formatting,
    };
  }

  /**
   * Extract bullet references from LaTeX
   */
  private extractBulletReferences(latexContent: string): string[] {
    const refs: string[] = [];
    const refMatches = latexContent.matchAll(/\\bulletref\{([^}]+)\}/g);
    for (const match of refMatches) {
      refs.push(match[1]);
    }
    return refs;
  }

  /**
   * Load template (simplified - should load from template service)
   */
  private loadTemplate(templateId: string): string {
    // Simplified - return basic template
    return '\\documentclass{article}\n\\begin{document}\n% Template content\n\\end{document}';
  }

  /**
   * Map user data to template variables
   */
  private mapUserDataToTemplate(templateLatex: string, userData: any): string {
    let result = templateLatex;
    if (userData.name) {
      result = result.replace(/\\name\{[^}]+\}/g, `\\name{${userData.name}}`);
    }
    if (userData.email) {
      result = result.replace(/\\email\{[^}]+\}/g, `\\email{${userData.email}}`);
    }
    if (userData.phone) {
      result = result.replace(/\\phone\{[^}]+\}/g, `\\phone{${userData.phone}}`);
    }
    if (userData.address) {
      result = result.replace(/\\address\{[^}]+\}/g, `\\address{${userData.address}}`);
    }
    return result;
  }

  /**
   * Preserve bullet references in new template
   */
  private preserveBulletReferences(latexContent: string, refs: string[]): string {
    // Simple implementation - append bullet references
    const refSection = refs.map(ref => `\\bulletref{${ref}}`).join('\n');
    return latexContent.replace('\\end{document}', `${refSection}\n\\end{document}`);
  }

  /**
   * Parse sections from LaTeX
   */
  private parseSections(latexContent: string): Array<{ name: string; content: string }> {
    const sections: Array<{ name: string; content: string }> = [];
    const sectionMatches = latexContent.matchAll(/\\section\{([^}]+)\}([\s\S]*?)(?=\\section|\\end\{document})/g);
    for (const match of sectionMatches) {
      sections.push({
        name: match[1],
        content: match[2],
      });
    }
    return sections;
  }

  /**
   * Rebuild LaTeX with reordered sections
   */
  private rebuildLatexWithSections(
    originalLatex: string,
    sections: Array<{ name: string; content: string }>,
  ): string {
    const preamble = originalLatex.split('\\begin{document}')[0];
    const sectionsLatex = sections.map(s => `\\section{${s.name}}${s.content}`).join('\n');
    return `${preamble}\\begin{document}\n${sectionsLatex}\n\\end{document}`;
  }

  /**
   * Update font family
   */
  private updateFontFamily(latexContent: string, fontFamily: string): string {
    // Add font package if needed
    if (!latexContent.includes('\\usepackage{fontspec}')) {
      latexContent = latexContent.replace(
        '\\documentclass{article}',
        '\\documentclass{article}\n\\usepackage{fontspec}',
      );
    }
    // Set font family
    latexContent = latexContent.replace(
      '\\begin{document}',
      `\\setmainfont{${fontFamily}}\n\\begin{document}`,
    );
    return latexContent;
  }

  /**
   * Update font size
   */
  private updateFontSize(latexContent: string, fontSize: number): string {
    return latexContent.replace(
      '\\documentclass{article}',
      `\\documentclass[${fontSize}pt]{article}`,
    );
  }

  /**
   * Update colors
   */
  private updateColors(latexContent: string, colors: any): string {
    if (!latexContent.includes('\\usepackage{xcolor}')) {
      latexContent = latexContent.replace(
        '\\documentclass{article}',
        '\\documentclass{article}\n\\usepackage{xcolor}',
      );
    }
    // Define colors
    const colorDefs = Object.entries(colors)
      .map(([name, value]) => `\\definecolor{${name}}{HTML}{${(value as string).replace('#', '')}}`)
      .join('\n');
    latexContent = latexContent.replace('\\begin{document}', `${colorDefs}\n\\begin{document}`);
    return latexContent;
  }

  /**
   * Update spacing
   */
  private updateSpacing(latexContent: string, spacing: any): string {
    let result = latexContent;
    if (spacing.sectionSpacing) {
      result = result.replace(
        '\\begin{document}',
        `\\setlength{\\parskip}{${spacing.sectionSpacing}cm}\n\\begin{document}`,
      );
    }
    if (spacing.lineHeight) {
      result = result.replace(
        '\\documentclass{article}',
        `\\documentclass{article}\n\\usepackage{setspace}\n\\onehalfspacing`,
      );
    }
    return result;
  }
}
