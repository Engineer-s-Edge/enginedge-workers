import { FontService } from './font.service';
import { IFileSystem } from '../../domain/ports';

describe('FontService', () => {
  let service: FontService;
  let mockFileSystem: jest.Mocked<IFileSystem>;

  beforeEach(() => {
    mockFileSystem = {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      exists: jest.fn(),
      readdir: jest.fn(),
      delete: jest.fn(),
      rmdir: jest.fn(),
    };

    service = new FontService(mockFileSystem);
  });

  describe('detectFonts', () => {
    it('should detect fonts from fontspec commands', async () => {
      const texContent = `
        \\documentclass{article}
        \\usepackage{fontspec}
        \\setmainfont{TeX Gyre Termes}
        \\setsansfont{TeX Gyre Heros}
        \\setmonofont{TeX Gyre Cursor}
        \\begin{document}
        Hello World
        \\end{document}
      `;

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(texContent));

      const result = await service.detectFonts('/test/document.tex');

      expect(result.fonts).toContain('TeX Gyre Termes');
      expect(result.fonts).toContain('TeX Gyre Heros');
      expect(result.fonts).toContain('TeX Gyre Cursor');
      expect(result.mainFont).toBe('TeX Gyre Termes');
      expect(result.sansFont).toBe('TeX Gyre Heros');
      expect(result.monoFont).toBe('TeX Gyre Cursor');
      expect(result.usesFontspec).toBe(true);
      expect(result.requiresUnicode).toBe(true);
    });

    it('should detect fonts with optional parameters', async () => {
      const texContent = `
        \\setmainfont[Ligatures=TeX]{Times New Roman}
        \\setsansfont[Scale=0.9]{Arial}
      `;

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(texContent));

      const result = await service.detectFonts('/test/document.tex');

      expect(result.fonts).toContain('Times New Roman');
      expect(result.fonts).toContain('Arial');
      expect(result.mainFont).toBe('Times New Roman');
      expect(result.sansFont).toBe('Arial');
    });

    it('should detect newfontfamily commands', async () => {
      const texContent = `
        \\newfontfamily\\arabicfont{Amiri}
        \\newfontfamily\\cyrillicfont[Script=Cyrillic]{DejaVu Sans}
      `;

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(texContent));

      const result = await service.detectFonts('/test/document.tex');

      expect(result.fonts).toContain('Amiri');
      expect(result.fonts).toContain('DejaVu Sans');
      expect(result.requiresUnicode).toBe(true);
    });

    it('should detect fontspec inline commands', async () => {
      const texContent = `
        \\fontspec{Comic Sans MS}
        \\fontspec[Scale=1.2]{Impact}
      `;

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(texContent));

      const result = await service.detectFonts('/test/document.tex');

      expect(result.fonts).toContain('Comic Sans MS');
      expect(result.fonts).toContain('Impact');
    });

    it('should return empty result for documents without custom fonts', async () => {
      const texContent = `
        \\documentclass{article}
        \\begin{document}
        Hello World
        \\end{document}
      `;

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(texContent));

      const result = await service.detectFonts('/test/document.tex');

      expect(result.fonts).toEqual([]);
      expect(result.usesFontspec).toBe(false);
      expect(result.requiresUnicode).toBe(false);
    });

    it('should handle file read errors gracefully', async () => {
      mockFileSystem.readFile.mockRejectedValue(new Error('File not found'));

      const result = await service.detectFonts('/test/missing.tex');

      expect(result.fonts).toEqual([]);
      expect(result.usesFontspec).toBe(false);
      expect(result.requiresUnicode).toBe(false);
    });
  });

  describe('isFontAvailable', () => {
    it('should recognize system fonts', () => {
      expect(service.isFontAvailable('Arial')).toBe(true);
      expect(service.isFontAvailable('Times New Roman')).toBe(true);
      expect(service.isFontAvailable('Courier New')).toBe(true);
    });

    it('should recognize TeX fonts', () => {
      expect(service.isFontAvailable('Latin Modern')).toBe(true);
      expect(service.isFontAvailable('TeX Gyre Termes')).toBe(true);
      expect(service.isFontAvailable('DejaVu Sans')).toBe(true);
    });

    it('should return false for unknown fonts', () => {
      expect(service.isFontAvailable('UnknownFont')).toBe(false);
      expect(service.isFontAvailable('CustomFont123')).toBe(false);
    });
  });

  describe('getFontFormat', () => {
    it('should detect TrueType fonts', () => {
      expect(service.getFontFormat('Arial.ttf')).toBe('ttf');
      expect(service.getFontFormat('font.TTF')).toBe('ttf');
    });

    it('should detect OpenType fonts', () => {
      expect(service.getFontFormat('Times.otf')).toBe('otf');
      expect(service.getFontFormat('font.OTF')).toBe('otf');
    });

    it('should detect PostScript fonts', () => {
      expect(service.getFontFormat('font.pfb')).toBe('pfb');
      expect(service.getFontFormat('font.afm')).toBe('afm');
    });

    it('should return unknown for unsupported formats', () => {
      expect(service.getFontFormat('font.woff')).toBe('unknown');
      expect(service.getFontFormat('font.txt')).toBe('unknown');
    });
  });

  describe('installFonts', () => {
    it('should install fonts to target directory', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from('font data'));
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockFileSystem.mkdir.mockResolvedValue(undefined);

      const result = await service.installFonts(
        ['Arial.ttf', 'Times.otf'],
        '/source',
        '/target',
      );

      expect(result.success).toBe(true);
      expect(result.installedFonts).toEqual(['Arial', 'Times']);
      expect(result.errors).toEqual([]);
      expect(result.installDir?.replace(/\\/g, '/')).toBe('/target/fonts');
      // Normalize path for cross-platform compatibility
      const mkdirCall = mockFileSystem.mkdir.mock.calls[0][0];
      expect(mkdirCall.replace(/\\/g, '/')).toBe('/target/fonts');
    });

    it('should handle missing font files', async () => {
      mockFileSystem.exists.mockResolvedValue(false);
      mockFileSystem.mkdir.mockResolvedValue(undefined);

      const result = await service.installFonts(
        ['missing.ttf'],
        '/source',
        '/target',
      );

      expect(result.success).toBe(false);
      expect(result.installedFonts).toEqual([]);
      expect(result.errors).toContain('Font file not found: missing.ttf');
    });

    it('should continue on individual font errors', async () => {
      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.exists
        .mockResolvedValueOnce(true)  // First font exists
        .mockResolvedValueOnce(false); // Second font missing

      mockFileSystem.readFile.mockResolvedValue(Buffer.from('font data'));
      mockFileSystem.writeFile.mockResolvedValue(undefined);

      const result = await service.installFonts(
        ['good.ttf', 'bad.ttf'],
        '/source',
        '/target',
      );

      expect(result.installedFonts).toContain('good');
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('bad.ttf');
    });

    it('should handle installation errors', async () => {
      mockFileSystem.mkdir.mockRejectedValue(new Error('Permission denied'));

      const result = await service.installFonts(
        ['Arial.ttf'],
        '/source',
        '/target',
      );

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Permission denied');
    });
  });

  describe('generateFontspecConfig', () => {
    it('should generate config for custom fonts', () => {
      const fonts = {
        fonts: ['Times New Roman', 'Arial'],
        mainFont: 'Times New Roman',
        sansFont: 'Arial',
        monoFont: 'Courier New',
        usesFontspec: false,
        requiresUnicode: true,
      };

      const config = service.generateFontspecConfig(fonts);

      expect(config).toContain('\\usepackage{fontspec}');
      expect(config).toContain('\\setmainfont{Times New Roman}');
      expect(config).toContain('\\setsansfont{Arial}');
      expect(config).toContain('\\setmonofont{Courier New}');
    });

    it('should not add usepackage if fontspec already used', () => {
      const fonts = {
        fonts: ['Arial'],
        mainFont: 'Arial',
        usesFontspec: true,
        requiresUnicode: true,
      };

      const config = service.generateFontspecConfig(fonts);

      expect(config).not.toContain('\\usepackage{fontspec}');
      expect(config).toContain('\\setmainfont{Arial}');
    });

    it('should return empty config for no custom fonts', () => {
      const fonts = {
        fonts: [],
        usesFontspec: true,
        requiresUnicode: false,
      };

      const config = service.generateFontspecConfig(fonts);

      expect(config).toBe('');
    });
  });

  describe('validateFonts', () => {
    it('should validate all fonts are available', async () => {
      const texContent = `
        \\setmainfont{Latin Modern}
        \\setsansfont{DejaVu Sans}
      `;

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(texContent));

      const result = await service.validateFonts('/test/document.tex');

      expect(result.valid).toBe(true);
      expect(result.missingFonts).toEqual([]);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain('XeLaTeX or LuaLaTeX');
    });

    it('should detect missing fonts', async () => {
      const texContent = `
        \\setmainfont{CustomFont123}
      `;

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(texContent));

      const result = await service.validateFonts('/test/document.tex');

      expect(result.valid).toBe(false);
      expect(result.missingFonts).toContain('CustomFont123');
      expect(result.warnings.some(w => w.includes('Missing fonts'))).toBe(true);
    });

    it('should validate documents without custom fonts', async () => {
      const texContent = `
        \\documentclass{article}
        \\begin{document}
        Hello
        \\end{document}
      `;

      mockFileSystem.readFile.mockResolvedValue(Buffer.from(texContent));

      const result = await service.validateFonts('/test/document.tex');

      expect(result.valid).toBe(true);
      expect(result.missingFonts).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('getSystemFonts', () => {
    it('should return sorted list of system fonts', () => {
      const fonts = service.getSystemFonts();

      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts).toContain('Arial');
      expect(fonts).toContain('Times New Roman');
      expect(fonts).toEqual([...fonts].sort());
    });
  });

  describe('getTexFonts', () => {
    it('should return sorted list of TeX fonts', () => {
      const fonts = service.getTexFonts();

      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts).toContain('Latin Modern');
      expect(fonts).toContain('TeX Gyre Termes');
      expect(fonts).toEqual([...fonts].sort());
    });
  });

  describe('getFontRecommendations', () => {
    it('should recommend fonts for academic documents', () => {
      const rec = service.getFontRecommendations('academic');

      expect(rec.main).toBe('TeX Gyre Termes');
      expect(rec.sans).toBe('TeX Gyre Heros');
      expect(rec.mono).toBe('TeX Gyre Cursor');
    });

    it('should recommend fonts for resumes', () => {
      const rec = service.getFontRecommendations('resume');

      expect(rec.main).toBe('TeX Gyre Pagella');
      expect(rec.sans).toBe('TeX Gyre Heros');
      expect(rec.mono).toBe('DejaVu Sans Mono');
    });

    it('should recommend fonts for presentations', () => {
      const rec = service.getFontRecommendations('presentation');

      expect(rec.main).toBe('DejaVu Sans');
      expect(rec.sans).toBe('DejaVu Sans');
      expect(rec.mono).toBe('DejaVu Sans Mono');
    });
  });

  describe('createFontCacheEntry', () => {
    it('should create cache entry with timestamp', () => {
      const fontInfo = {
        family: 'Arial',
        fileName: 'arial.ttf',
        format: 'ttf' as const,
        installed: true,
      };

      const cacheEntry = service.createFontCacheEntry(fontInfo);

      expect(cacheEntry.family).toBe('Arial');
      expect(cacheEntry.fileName).toBe('arial.ttf');
      expect(cacheEntry.format).toBe('ttf');
      expect(cacheEntry.cachedAt).toBeInstanceOf(Date);
    });
  });

  describe('findFontFiles', () => {
    it('should find font files in fonts directory', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readdir.mockResolvedValue([
        'Arial.ttf',
        'Times.otf',
        'readme.txt',
      ]);

      const fontFiles = await service.findFontFiles('/project');

      const normalized = fontFiles.map(f => f.replace(/\\/g, '/'));
      expect(normalized).toContain('fonts/Arial.ttf');
      expect(normalized).toContain('fonts/Times.otf');
      expect(normalized).not.toContain('fonts/readme.txt');
    });

    it('should return empty array if fonts directory does not exist', async () => {
      mockFileSystem.exists.mockResolvedValue(false);

      const fontFiles = await service.findFontFiles('/project');

      expect(fontFiles).toEqual([]);
    });

    it('should handle readdir errors', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readdir.mockRejectedValue(new Error('Permission denied'));

      const fontFiles = await service.findFontFiles('/project');

      expect(fontFiles).toEqual([]);
    });
  });
});
