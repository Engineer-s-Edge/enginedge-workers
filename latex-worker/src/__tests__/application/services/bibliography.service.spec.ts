import { BibliographyService } from '../../../application/services/bibliography.service';
import { IFileSystem } from '../../../domain/ports';

describe('BibliographyService', () => {
  let service: BibliographyService;
  let mockFileSystem: jest.Mocked<IFileSystem>;

  beforeEach(() => {
    mockFileSystem = {
      writeFile: jest.fn(),
      readFile: jest.fn(),
      exists: jest.fn(),
      delete: jest.fn(),
      mkdir: jest.fn(),
      rmdir: jest.fn(),
      readdir: jest.fn(),
    };

    service = new BibliographyService(mockFileSystem);
  });

  describe('validateBibFile', () => {
    it('should validate a correct .bib file', async () => {
      const bibContent = `
@article{einstein1905,
  author = {Albert Einstein},
  title = {On the Electrodynamics of Moving Bodies},
  journal = {Annalen der Physik},
  year = {1905}
}

@book{knuth1984,
  author = {Donald E. Knuth},
  title = {The TeXbook},
  publisher = {Addison-Wesley},
  year = {1984}
}`;

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(bibContent));

      const result = await service.validateBibFile('test.bib');

      expect(result.valid).toBe(true);
      expect(result.entryCount).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].key).toBe('einstein1905');
      expect(result.entries[1].key).toBe('knuth1984');
    });

    it('should detect missing required fields', async () => {
      const bibContent = `
@article{incomplete2023,
  author = {John Doe},
  year = {2023}
}`;

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(bibContent));

      const result = await service.validateBibFile('test.bib');

      expect(result.valid).toBe(true); // Still valid, just warnings
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('missing required fields');
      expect(result.warnings[0]).toContain('title');
      expect(result.warnings[0]).toContain('journal');
    });

    it('should detect duplicate citation keys', async () => {
      const bibContent = `
@article{duplicate2023,
  author = {First Author},
  title = {First Paper},
  journal = {Journal A},
  year = {2023}
}

@book{duplicate2023,
  author = {Second Author},
  title = {A Book},
  publisher = {Publisher},
  year = {2023}
}`;

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(bibContent));

      const result = await service.validateBibFile('test.bib');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Duplicate citation keys');
      expect(result.errors[0]).toContain('duplicate2023');
    });

    it('should handle file not found', async () => {
      mockFileSystem.exists.mockResolvedValue(false);

      const result = await service.validateBibFile('missing.bib');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File not found: missing.bib');
      expect(result.entryCount).toBe(0);
    });

    it('should warn about empty .bib file', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(''));

      const result = await service.validateBibFile('empty.bib');

      expect(result.warnings).toContain('No bibliography entries found');
      expect(result.entryCount).toBe(0);
    });

    it('should parse different entry types', async () => {
      const bibContent = `
@article{a1, author={A}, title={T}, journal={J}, year={2023}}
@book{b1, author={B}, title={T}, publisher={P}, year={2023}}
@inproceedings{c1, author={C}, title={T}, booktitle={B}, year={2023}}
@phdthesis{d1, author={D}, title={T}, school={S}, year={2023}}
@misc{e1, title={T}}`;

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(bibContent));

      const result = await service.validateBibFile('test.bib');

      expect(result.entryCount).toBe(5);
      expect(result.entries.map((e) => e.type)).toEqual([
        'article',
        'book',
        'inproceedings',
        'phdthesis',
        'misc',
      ]);
    });

    it('should parse fields with quotes', async () => {
      const bibContent = `
@article{test2023,
  author = "John Doe",
  title = {Test Article},
  journal = "Test Journal",
  year = {2023}
}`;

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(bibContent));

      const result = await service.validateBibFile('test.bib');

      expect(result.valid).toBe(true);
      expect(result.entries[0].fields.author).toBe('John Doe');
      expect(result.entries[0].fields.title).toBe('Test Article');
    });
  });

  describe('getCitationStyle', () => {
    it('should return known citation styles', () => {
      expect(service.getCitationStyle('plain')).toMatchObject({
        name: 'plain',
        compiler: 'bibtex',
      });

      expect(service.getCitationStyle('apa')).toMatchObject({
        name: 'apa',
        compiler: 'biber',
        package: 'biblatex',
      });

      expect(service.getCitationStyle('ieeetr')).toMatchObject({
        name: 'ieeetr',
        compiler: 'bibtex',
      });
    });

    it('should return null for unknown styles', () => {
      expect(service.getCitationStyle('unknown')).toBeNull();
    });

    it('should be case-insensitive', () => {
      expect(service.getCitationStyle('PLAIN')).not.toBeNull();
      expect(service.getCitationStyle('APA')).not.toBeNull();
    });
  });

  describe('getSupportedStyles', () => {
    it('should return all supported styles', () => {
      const styles = service.getSupportedStyles();

      expect(styles.length).toBeGreaterThan(0);
      expect(styles).toContainEqual(
        expect.objectContaining({ name: 'plain' }),
      );
      expect(styles).toContainEqual(
        expect.objectContaining({ name: 'apa' }),
      );
    });
  });

  describe('detectCitationStyle', () => {
    it('should detect \\bibliographystyle', async () => {
      const texContent = `
\\documentclass{article}
\\bibliographystyle{ieeetr}
\\begin{document}
Content
\\end{document}`;

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(texContent));

      const style = await service.detectCitationStyle('test.tex');

      expect(style).toBe('ieeetr');
    });

    it('should detect biblatex style', async () => {
      const texContent = `
\\documentclass{article}
\\usepackage[style=apa,backend=biber]{biblatex}
\\begin{document}
Content
\\end{document}`;

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(texContent));

      const style = await service.detectCitationStyle('test.tex');

      expect(style).toBe('apa');
    });

    it('should return null if no style found', async () => {
      const texContent = `
\\documentclass{article}
\\begin{document}
Content
\\end{document}`;

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(texContent));

      const style = await service.detectCitationStyle('test.tex');

      expect(style).toBeNull();
    });
  });

  describe('extractCitationKeys', () => {
    it('should extract \\cite keys', async () => {
      const texContent = `
\\documentclass{article}
\\begin{document}
This is cited \\cite{einstein1905}.
Multiple citations \\cite{knuth1984,lamport1994}.
\\end{document}`;

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(texContent));

      const keys = await service.extractCitationKeys('test.tex');

      expect(keys).toContain('einstein1905');
      expect(keys).toContain('knuth1984');
      expect(keys).toContain('lamport1994');
      expect(keys).toHaveLength(3);
    });

    it('should extract natbib \\citep and \\citet', async () => {
      const texContent = `
\\documentclass{article}
\\begin{document}
Textual citation \\citet{author2023}.
Parenthetical \\citep{other2023}.
\\end{document}`;

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(texContent));

      const keys = await service.extractCitationKeys('test.tex');

      expect(keys).toContain('author2023');
      expect(keys).toContain('other2023');
    });

    it('should handle citations with optional arguments', async () => {
      const texContent = `
\\cite[p.~10]{ref1}
\\citep[see][chapter 2]{ref2}`;

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(texContent));

      const keys = await service.extractCitationKeys('test.tex');

      expect(keys).toContain('ref1');
      expect(keys).toContain('ref2');
    });

    it('should return empty array if no citations', async () => {
      mockFileSystem.readFile.mockResolvedValue(
        Buffer.from('No citations here'),
      );

      const keys = await service.extractCitationKeys('test.tex');

      expect(keys).toHaveLength(0);
    });
  });

  describe('checkMissingCitations', () => {
    it('should detect missing citations', async () => {
      // .tex file cites 3 keys
      const texContent = `\\cite{key1,key2,key3}`;
      mockFileSystem.readFile
        .mockResolvedValueOnce(Buffer.from(texContent));

      // .bib file only has 2 of them
      const bibContent = `
@article{key1, author={A}, title={T}, journal={J}, year={2023}}
@article{key2, author={B}, title={T}, journal={J}, year={2023}}`;

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValueOnce(Buffer.from(bibContent));

      const missing = await service.checkMissingCitations(
        'test.tex',
        ['refs.bib'],
      );

      expect(missing).toContain('key3');
      expect(missing).toHaveLength(1);
    });

    it('should return empty if all citations present', async () => {
      const texContent = `\\cite{key1}`;
      mockFileSystem.readFile.mockResolvedValueOnce(Buffer.from(texContent));

      const bibContent = `@article{key1, author={A}, title={T}, journal={J}, year={2023}}`;
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValueOnce(Buffer.from(bibContent));

      const missing = await service.checkMissingCitations(
        'test.tex',
        ['refs.bib'],
      );

      expect(missing).toHaveLength(0);
    });

    it('should check multiple .bib files', async () => {
      const texContent = `\\cite{key1,key2}`;
      mockFileSystem.readFile.mockResolvedValueOnce(Buffer.from(texContent));

      const bib1 = `@article{key1, author={A}, title={T}, journal={J}, year={2023}}`;
      const bib2 = `@article{key2, author={B}, title={T}, journal={J}, year={2023}}`;

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile
        .mockResolvedValueOnce(Buffer.from(bib1))
        .mockResolvedValueOnce(Buffer.from(bib2));

      const missing = await service.checkMissingCitations(
        'test.tex',
        ['refs1.bib', 'refs2.bib'],
      );

      expect(missing).toHaveLength(0);
    });
  });

  describe('mergeBibFiles', () => {
    it('should merge multiple .bib files', async () => {
      const bib1 = `@article{key1, author={A}, title={T1}, journal={J}, year={2023}}`;
      const bib2 = `@article{key2, author={B}, title={T2}, journal={J}, year={2023}}`;

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile
        .mockResolvedValueOnce(Buffer.from(bib1))
        .mockResolvedValueOnce(Buffer.from(bib2));

      await service.mergeBibFiles(
        ['bib1.bib', 'bib2.bib'],
        'merged.bib',
      );

      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        'merged.bib',
        expect.stringContaining('key1'),
      );
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        'merged.bib',
        expect.stringContaining('key2'),
      );
    });

    it('should remove duplicate keys (keep first)', async () => {
      const bib1 = `@article{dup, author={First}, title={T1}, journal={J}, year={2023}}`;
      const bib2 = `@article{dup, author={Second}, title={T2}, journal={J}, year={2023}}`;

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile
        .mockResolvedValueOnce(Buffer.from(bib1))
        .mockResolvedValueOnce(Buffer.from(bib2));

      await service.mergeBibFiles(
        ['bib1.bib', 'bib2.bib'],
        'merged.bib',
      );

      const writtenContent = (mockFileSystem.writeFile as jest.Mock).mock
        .calls[0][1];
      expect(writtenContent).toContain('First');
      expect(writtenContent).not.toContain('Second');
    });
  });

  describe('formatBibFile', () => {
    it('should format a .bib file with consistent style', async () => {
      const messyBib = `@article{test,author={John Doe},title={Test},journal={J},year={2023}}`;

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(messyBib));

      await service.formatBibFile('test.bib', 'formatted.bib');

      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        'formatted.bib',
        expect.stringMatching(/@article\{test,/),
      );
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        'formatted.bib',
        expect.stringMatching(/author = \{John Doe\}/),
      );
    });

    it('should throw error for invalid .bib file', async () => {
      mockFileSystem.exists.mockResolvedValue(false);

      await expect(
        service.formatBibFile('invalid.bib'),
      ).rejects.toThrow('Cannot format invalid .bib file');
    });
  });

  describe('compileBibliography', () => {
    it('should compile bibliography successfully', async () => {
      const bibContent = `@article{test, author={A}, title={T}, journal={J}, year={2023}}`;

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(bibContent));

      const result = await service.compileBibliography(
        'main.tex',
        ['refs.bib'],
        'plain',
        '/project',
      );

      expect(result.success).toBe(true);
      expect(result.compiler).toBe('bibtex');
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for unknown citation style', async () => {
      const result = await service.compileBibliography(
        'main.tex',
        ['refs.bib'],
        'unknownstyle',
        '/project',
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unknown citation style: unknownstyle');
    });

    it('should fail for invalid .bib files', async () => {
      mockFileSystem.exists.mockResolvedValue(false);

      const result = await service.compileBibliography(
        'main.tex',
        ['missing.bib'],
        'plain',
        '/project',
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should use biber for biblatex styles', async () => {
      const bibContent = `@article{test, author={A}, title={T}, journal={J}, year={2023}}`;

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(bibContent));

      const result = await service.compileBibliography(
        'main.tex',
        ['refs.bib'],
        'apa',
        '/project',
      );

      expect(result.success).toBe(true);
      expect(result.compiler).toBe('biber');
    });

    it('should include validation warnings', async () => {
      const incompleteBib = `@article{incomplete, author={A}, year={2023}}`; // Missing title, journal

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(incompleteBib));

      const result = await service.compileBibliography(
        'main.tex',
        ['refs.bib'],
        'plain',
        '/project',
      );

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
