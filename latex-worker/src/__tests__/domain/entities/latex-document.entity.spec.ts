/**
 * Unit Tests for LaTeXDocument Entity
 */

import { LaTeXDocument } from '../../../domain/entities';

describe('LaTeXDocument Entity', () => {
  describe('create', () => {
    it('should create a new LaTeX document with default settings', () => {
      const content = '\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}';
      const doc = LaTeXDocument.create('doc-001', content);

      expect(doc.id).toBe('doc-001');
      expect(doc.content).toBe(content);
      expect(doc.metadata.documentClass).toBe('article');
      expect(doc.settings.engine).toBe('xelatex');
      expect(doc.settings.maxPasses).toBe(3);
      expect(doc.settings.timeout).toBe(60000);
      expect(doc.settings.shell).toBe(false);
      expect(doc.settings.draft).toBe(false);
    });

    it('should create document with custom metadata', () => {
      const content = '\\documentclass{book}\n\\begin{document}\n\\end{document}';
      const metadata = {
        title: 'My Book',
        author: 'John Doe',
        documentClass: 'book',
      };

      const doc = LaTeXDocument.create('doc-002', content, metadata);

      expect(doc.metadata.title).toBe('My Book');
      expect(doc.metadata.author).toBe('John Doe');
      expect(doc.metadata.documentClass).toBe('book');
    });

    it('should initialize empty packages array', () => {
      const doc = LaTeXDocument.create('doc-003', '\\documentclass{article}');
      expect(doc.metadata.packages).toEqual([]);
    });

    it('should set creation and update timestamps', () => {
      const before = new Date();
      const doc = LaTeXDocument.create('doc-004', 'content');
      const after = new Date();

      expect(doc.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(doc.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(doc.updatedAt).toEqual(doc.createdAt);
    });
  });

  describe('updateContent', () => {
    it('should update document content', async () => {
      const doc = LaTeXDocument.create('doc-005', 'old content');
      // Wait 1ms to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1));
      const updated = doc.updateContent('new content');

      expect(updated.content).toBe('new content');
      expect(updated.id).toBe(doc.id);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(doc.updatedAt.getTime());
    });

    it('should preserve other properties when updating content', () => {
      const doc = LaTeXDocument.create('doc-006', 'content', { title: 'Original' });
      const updated = doc.updateContent('new content');

      expect(updated.metadata.title).toBe('Original');
      expect(updated.settings.engine).toBe('xelatex');
    });
  });

  describe('updateSettings', () => {
    it('should update compilation settings', () => {
      const doc = LaTeXDocument.create('doc-007', 'content');
      const updated = doc.updateSettings({ maxPasses: 5, timeout: 120000 });

      expect(updated.settings.maxPasses).toBe(5);
      expect(updated.settings.timeout).toBe(120000);
      expect(updated.settings.engine).toBe('xelatex'); // Unchanged
    });

    it('should update draft mode', () => {
      const doc = LaTeXDocument.create('doc-008', 'content');
      const updated = doc.updateSettings({ draft: true });

      expect(updated.settings.draft).toBe(true);
    });

    it('should enable shell escape', () => {
      const doc = LaTeXDocument.create('doc-009', 'content');
      const updated = doc.updateSettings({ shell: true });

      expect(updated.settings.shell).toBe(true);
    });
  });

  describe('extractPackages', () => {
    it('should extract single package', () => {
      const content = '\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\\end{document}';
      const doc = LaTeXDocument.create('doc-010', content);

      const packages = doc.extractPackages();
      expect(packages).toEqual(['graphicx']);
    });

    it('should extract multiple packages from single usepackage', () => {
      const content = '\\usepackage{amsmath,amssymb,amsthm}';
      const doc = LaTeXDocument.create('doc-011', content);

      const packages = doc.extractPackages();
      expect(packages).toEqual(['amsmath', 'amssymb', 'amsthm']);
    });

    it('should extract packages with options', () => {
      const content = '\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}';
      const doc = LaTeXDocument.create('doc-012', content);

      const packages = doc.extractPackages();
      expect(packages).toContain('inputenc');
      expect(packages).toContain('fontenc');
    });

    it('should remove duplicate packages', () => {
      const content = '\\usepackage{graphicx}\n\\usepackage{graphicx}';
      const doc = LaTeXDocument.create('doc-013', content);

      const packages = doc.extractPackages();
      expect(packages).toEqual(['graphicx']);
    });

    it('should return empty array when no packages', () => {
      const content = '\\documentclass{article}\n\\begin{document}\\end{document}';
      const doc = LaTeXDocument.create('doc-014', content);

      const packages = doc.extractPackages();
      expect(packages).toEqual([]);
    });
  });

  describe('extractDocumentClass', () => {
    it('should extract document class', () => {
      const content = '\\documentclass{article}';
      const doc = LaTeXDocument.create('doc-015', content);

      expect(doc.extractDocumentClass()).toBe('article');
    });

    it('should extract document class with options', () => {
      const content = '\\documentclass[12pt,a4paper]{report}';
      const doc = LaTeXDocument.create('doc-016', content);

      expect(doc.extractDocumentClass()).toBe('report');
    });

    it('should return null when no document class', () => {
      const content = '\\begin{document}\\end{document}';
      const doc = LaTeXDocument.create('doc-017', content);

      expect(doc.extractDocumentClass()).toBeNull();
    });
  });

  describe('requiresBibliography', () => {
    it('should detect \\bibliography command', () => {
      const content = '\\bibliography{references}';
      const doc = LaTeXDocument.create('doc-018', content);

      expect(doc.requiresBibliography()).toBe(true);
    });

    it('should detect \\addbibresource command (biblatex)', () => {
      const content = '\\addbibresource{refs.bib}';
      const doc = LaTeXDocument.create('doc-019', content);

      expect(doc.requiresBibliography()).toBe(true);
    });

    it('should detect \\cite command', () => {
      const content = 'As shown in \\cite{smith2020}';
      const doc = LaTeXDocument.create('doc-020', content);

      expect(doc.requiresBibliography()).toBe(true);
    });

    it('should detect \\citep and \\citet (natbib)', () => {
      const content = 'According to \\citep{jones2021} and \\citet{brown2019}';
      const doc = LaTeXDocument.create('doc-021', content);

      expect(doc.requiresBibliography()).toBe(true);
    });

    it('should return false when no bibliography needed', () => {
      const content = '\\documentclass{article}\n\\begin{document}\nNo citations\n\\end{document}';
      const doc = LaTeXDocument.create('doc-022', content);

      expect(doc.requiresBibliography()).toBe(false);
    });
  });

  describe('requiresMultiplePasses', () => {
    it('should detect \\ref command', () => {
      const content = 'See section \\ref{sec:intro}';
      const doc = LaTeXDocument.create('doc-023', content);

      expect(doc.requiresMultiplePasses()).toBe(true);
    });

    it('should detect \\pageref command', () => {
      const content = 'On page \\pageref{fig:example}';
      const doc = LaTeXDocument.create('doc-024', content);

      expect(doc.requiresMultiplePasses()).toBe(true);
    });

    it('should detect \\label command', () => {
      const content = '\\section{Introduction}\\label{sec:intro}';
      const doc = LaTeXDocument.create('doc-025', content);

      expect(doc.requiresMultiplePasses()).toBe(true);
    });

    it('should detect \\tableofcontents', () => {
      const content = '\\tableofcontents';
      const doc = LaTeXDocument.create('doc-026', content);

      expect(doc.requiresMultiplePasses()).toBe(true);
    });

    it('should return true if bibliography is required', () => {
      const content = '\\cite{smith2020}';
      const doc = LaTeXDocument.create('doc-027', content);

      expect(doc.requiresMultiplePasses()).toBe(true);
    });

    it('should return false for simple documents', () => {
      const content = '\\documentclass{article}\n\\begin{document}\nSimple text\n\\end{document}';
      const doc = LaTeXDocument.create('doc-028', content);

      expect(doc.requiresMultiplePasses()).toBe(false);
    });
  });

  describe('validate', () => {
    it('should validate correct document', () => {
      const content = '\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}';
      const doc = LaTeXDocument.create('doc-029', content);

      const result = doc.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing documentclass', () => {
      const content = '\\begin{document}\nContent\n\\end{document}';
      const doc = LaTeXDocument.create('doc-030', content);

      const result = doc.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing \\documentclass declaration');
    });

    it('should detect missing begin document', () => {
      const content = '\\documentclass{article}\n\\end{document}';
      const doc = LaTeXDocument.create('doc-031', content);

      const result = doc.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing \\begin{document}');
    });

    it('should detect missing end document', () => {
      const content = '\\documentclass{article}\n\\begin{document}';
      const doc = LaTeXDocument.create('doc-032', content);

      const result = doc.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing \\end{document}');
    });

    it('should detect unbalanced braces', () => {
      const content = '\\documentclass{article}\n\\begin{document}\n\\section{Test\n\\end{document}';
      const doc = LaTeXDocument.create('doc-033', content);

      const result = doc.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Unbalanced braces'))).toBe(true);
    });

    it('should detect unbalanced environments', () => {
      const content = '\\documentclass{article}\n\\begin{document}\n\\begin{itemize}\n\\end{document}';
      const doc = LaTeXDocument.create('doc-034', content);

      const result = doc.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Unbalanced environments'))).toBe(true);
    });

    it('should handle complex valid document', () => {
      const content = `
        \\documentclass[12pt]{article}
        \\usepackage{amsmath}
        \\begin{document}
        \\section{Introduction}
        \\begin{equation}
          E = mc^2
        \\end{equation}
        \\end{document}
      `;
      const doc = LaTeXDocument.create('doc-035', content);

      const result = doc.validate();
      expect(result.valid).toBe(true);
    });
  });
});
