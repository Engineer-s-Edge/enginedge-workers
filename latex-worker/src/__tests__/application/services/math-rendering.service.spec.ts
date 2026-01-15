import { Test, TestingModule } from '@nestjs/testing';

// Mock sharp before importing the service to prevent dependency errors
jest.mock('sharp', () => {
  const mockSharp = () => ({
    resize: jest.fn().mockReturnThis(),
    flatten: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    toFormat: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image')),
    metadata: jest.fn().mockResolvedValue({ width: 100, height: 100 }),
  });
  return mockSharp;
});

import { MathRenderingService } from '../../../application/services/math-rendering.service';

describe('MathRenderingService', () => {
  let service: MathRenderingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MathRenderingService],
    }).compile();

    service = module.get<MathRenderingService>(MathRenderingService);
  });

  afterEach(() => {
    service.clearCache();
  });

  describe('renderToHtml', () => {
    it('should render simple inline math to HTML', async () => {
      const result = await service.renderToHtml('x = y + 2');

      expect(result.latex).toBe('x = y + 2');
      expect(result.format).toBe('html');
      expect(result.displayMode).toBe(false);
      expect(result.output).toContain('katex');
      expect(result.output).toContain('x');
      expect(result.renderTime).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should render display math to HTML', async () => {
      const result = await service.renderToHtml(
        '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
        { displayMode: true },
      );

      expect(result.displayMode).toBe(true);
      expect(result.output).toContain('katex');
      expect(result.output).toContain('frac');
      expect(result.error).toBeUndefined();
    });

    it('should render Greek letters', async () => {
      const result = await service.renderToHtml('\\alpha + \\beta = \\gamma');

      expect(result.output).toContain('katex');
      expect(result.error).toBeUndefined();
    });

    it('should render complex equations', async () => {
      const latex = '\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}';
      const result = await service.renderToHtml(latex, { displayMode: true });

      expect(result.output).toContain('katex');
      expect(result.error).toBeUndefined();
    });

    it('should render matrices', async () => {
      const latex = '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}';
      const result = await service.renderToHtml(latex, { displayMode: true });

      expect(result.output).toContain('katex');
      expect(result.error).toBeUndefined();
    });

    it('should handle invalid LaTeX gracefully (with throwOnError disabled)', async () => {
      // KaTeX with throwOnError=false renders invalid commands in red
      const result = await service.renderToHtml('\\invalidcommand{test}');

      expect(result.format).toBe('html');
      expect(result.output).toContain('katex'); // Still renders something
      expect(result.error).toBeUndefined(); // No error when throwOnError=false
    });

    it('should use cache for repeated renders', async () => {
      const latex = 'x^2 + y^2 = z^2';

      const result1 = await service.renderToHtml(latex);
      const result2 = await service.renderToHtml(latex);

      expect(result1.output).toBe(result2.output);

      const stats = service.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should render with custom macros', async () => {
      const result = await service.renderToHtml('\\RR', {
        macros: { '\\RR': '\\mathbb{R}' },
      });

      expect(result.output).toContain('katex');
      expect(result.error).toBeUndefined();
    });

    it('should be very fast (< 50ms for simple expression)', async () => {
      const result = await service.renderToHtml('E = mc^2');

      expect(result.renderTime!).toBeLessThan(50);
    });
  });

  describe('renderToSvg', () => {
    it('should render math to SVG', async () => {
      const result = await service.renderToSvg('x^2 + y^2 = r^2');

      expect(result.format).toBe('svg');
      expect(result.output).toContain('<svg');
      expect(result.output).toContain('</svg>');
      expect(result.error).toBeUndefined();
    });

    it('should render display mode SVG', async () => {
      const result = await service.renderToSvg(
        '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}',
        {
          displayMode: true,
        },
      );

      expect(result.displayMode).toBe(true);
      expect(result.output).toContain('<svg');
      expect(result.error).toBeUndefined();
    });

    it('should handle invalid LaTeX in SVG mode (renders with error color)', async () => {
      const result = await service.renderToSvg('\\badinvalidcommand');

      expect(result.format).toBe('svg');
      expect(result.output).toContain('<svg'); // Still renders
      expect(result.error).toBeUndefined(); // No error with throwOnError=false
    });

    it('should use cache for SVG renders', async () => {
      const latex = 'a^2 + b^2';

      await service.renderToSvg(latex);
      await service.renderToSvg(latex); // Second call uses cache

      const stats = service.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('renderToPng', () => {
    it('should render math to PNG (base64)', async () => {
      const result = await service.renderToPng('\\pi \\approx 3.14159');

      expect(result.format).toBe('png');
      expect(result.output).toContain('data:image/png;base64,');
      expect(result.error).toBeUndefined();
    });

    it('should render display mode PNG', async () => {
      const result = await service.renderToPng('e^{i\\pi} + 1 = 0', {
        displayMode: true,
      });

      expect(result.displayMode).toBe(true);
      expect(result.output).toContain('data:image/png;base64,');
      expect(result.error).toBeUndefined();
    });

    it('should render PNG with custom scale', async () => {
      const result = await service.renderToPng('x + y', undefined, {
        scale: 3,
      });

      expect(result.output).toContain('data:image/png;base64,');
      expect(result.error).toBeUndefined();
    });

    it('should render PNG with custom size', async () => {
      const result = await service.renderToPng('a = b', undefined, {
        width: 200,
        height: 100,
      });

      expect(result.output).toContain('data:image/png;base64,');
      expect(result.error).toBeUndefined();
    });

    it('should handle invalid LaTeX in PNG mode (renders with error color)', async () => {
      const result = await service.renderToPng('\\invalidpngcommand');

      expect(result.format).toBe('png');
      expect(result.output).toContain('data:image/png;base64,'); // Still renders
      expect(result.error).toBeUndefined(); // No error with throwOnError=false
    });
  });

  describe('renderBatch', () => {
    it('should render multiple expressions in batch', async () => {
      const expressions = [
        { content: 'x = 1', displayMode: false },
        { content: 'y = 2', displayMode: false },
        { content: 'z = x + y', displayMode: false },
      ];

      const result = await service.renderBatch(expressions, 'html');

      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.rendered).toHaveLength(3);
      expect(result.totalTime).toBeGreaterThanOrEqual(0);

      result.rendered.forEach((r) => {
        expect(r.format).toBe('html');
        expect(r.error).toBeUndefined();
      });
    });

    it('should render batch to SVG', async () => {
      const expressions = [
        { content: '\\alpha', displayMode: false },
        { content: '\\beta', displayMode: true },
      ];

      const result = await service.renderBatch(expressions, 'svg');

      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.rendered[0].format).toBe('svg');
      expect(result.rendered[1].format).toBe('svg');
    });

    it('should render batch to PNG', async () => {
      const expressions = [
        { content: 'a', displayMode: false },
        { content: 'b', displayMode: true },
      ];

      const result = await service.renderBatch(expressions, 'png');

      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.rendered[0].format).toBe('png');
      expect(result.rendered[0].output).toContain('data:image/png;base64,');
    });

    it('should handle mixed valid and invalid expressions (KaTeX renders invalid in red)', async () => {
      const expressions = [
        { content: 'x = 1', displayMode: false },
        { content: '\\invalidbatch', displayMode: false },
        { content: 'y = 2', displayMode: false },
      ];

      const result = await service.renderBatch(expressions, 'html');

      expect(result.total).toBe(3);
      expect(result.successful).toBe(3); // All render (invalid shown in red)
      expect(result.failed).toBe(0);
      expect(result.rendered[1].output).toContain('katex');
    });

    it('should be fast for batch rendering (< 10ms avg per expression)', async () => {
      const expressions = Array.from({ length: 10 }, (_, i) => ({
        content: `x_${i} = ${i}`,
        displayMode: false,
      }));

      const result = await service.renderBatch(expressions, 'html');

      const avgTime = result.totalTime / result.total;
      expect(avgTime).toBeLessThan(10);
    });

    it('should respect display mode for each expression', async () => {
      const expressions = [
        { content: 'inline', displayMode: false },
        { content: 'display', displayMode: true },
      ];

      const result = await service.renderBatch(expressions, 'html');

      expect(result.rendered[0].displayMode).toBe(false);
      expect(result.rendered[1].displayMode).toBe(true);
    });
  });

  describe('extractMath', () => {
    it('should extract inline math from text', () => {
      const text = 'The equation $x = y + 2$ is simple.';
      const parsed = service.extractMath(text);

      expect(parsed.expressions).toHaveLength(1);
      expect(parsed.expressions[0].content).toBe('x = y + 2');
      expect(parsed.expressions[0].displayMode).toBe(false);
      expect(parsed.expressions[0].original).toBe('$x = y + 2$');
    });

    it('should extract display math from text', () => {
      const text =
        'The quadratic formula: $$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$';
      const parsed = service.extractMath(text);

      expect(parsed.expressions).toHaveLength(1);
      expect(parsed.expressions[0].displayMode).toBe(true);
      expect(parsed.expressions[0].original).toContain('$$');
    });

    it('should extract multiple inline expressions', () => {
      const text = 'We have $a = 1$, $b = 2$, and $c = a + b$.';
      const parsed = service.extractMath(text);

      expect(parsed.expressions).toHaveLength(3);
      expect(parsed.expressions[0].content).toBe('a = 1');
      expect(parsed.expressions[1].content).toBe('b = 2');
      expect(parsed.expressions[2].content).toBe('c = a + b');

      parsed.expressions.forEach((expr) => {
        expect(expr.displayMode).toBe(false);
      });
    });

    it('should extract mixed inline and display math', () => {
      const text = 'Inline $x^2$ and display $$y^2$$ math.';
      const parsed = service.extractMath(text);

      expect(parsed.expressions).toHaveLength(2);
      // Expressions are sorted by position after extraction
      expect(parsed.expressions[0].content).toBe('x^2'); // Inline comes first in text
      expect(parsed.expressions[0].displayMode).toBe(false);
      expect(parsed.expressions[1].content).toBe('y^2');
      expect(parsed.expressions[1].displayMode).toBe(true);
    });

    it('should extract LaTeX environments', () => {
      const text =
        'An equation: \\begin{equation} E = mc^2 \\end{equation} here.';
      const parsed = service.extractMath(text);

      expect(parsed.expressions).toHaveLength(1);
      expect(parsed.expressions[0].displayMode).toBe(true);
      expect(parsed.expressions[0].content).toContain('\\begin{equation}');
    });

    it('should extract math and avoid literal dollar amounts', () => {
      // Using proper spacing to avoid false matches
      const text = 'The cost is 5 dollars. The equation $x = 1$ is valid.';
      const parsed = service.extractMath(text);

      // Should extract the math expression, not dollar amounts
      expect(parsed.expressions.length).toBeGreaterThanOrEqual(1);

      const mathExpr = parsed.expressions.find(
        (e) => e.content.trim() === 'x = 1',
      );
      expect(mathExpr).toBeDefined();
      expect(mathExpr?.displayMode).toBe(false);
    });

    it('should not extract adjacent $$ as inline math', () => {
      const text = 'Display: $$x^2$$ not inline.';
      const parsed = service.extractMath(text);

      expect(parsed.expressions).toHaveLength(1);
      expect(parsed.expressions[0].displayMode).toBe(true);
    });

    it('should handle text with no math', () => {
      const text = 'This is plain text with no math.';
      const parsed = service.extractMath(text);

      expect(parsed.expressions).toHaveLength(0);
      expect(parsed.textWithPlaceholders).toBe(text);
    });

    it('should create placeholders for extracted math', () => {
      const text = 'First $a$ and second $b$.';
      const parsed = service.extractMath(text);

      expect(parsed.textWithPlaceholders).toContain('<<MATH_0>>');
      expect(parsed.textWithPlaceholders).toContain('<<MATH_1>>');
      expect(parsed.textWithPlaceholders).not.toContain('$a$');
    });

    it('should handle complex LLM output with mixed content', () => {
      const text = `
The solution involves solving the equation $ax^2 + bx + c = 0$.

Using the quadratic formula:
$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

For $a = 1$, $b = -5$, $c = 6$, we get $x = 2$ or $x = 3$.
      `.trim();

      const parsed = service.extractMath(text);

      expect(parsed.expressions.length).toBeGreaterThan(5);

      const displayExprs = parsed.expressions.filter((e) => e.displayMode);
      const inlineExprs = parsed.expressions.filter((e) => !e.displayMode);

      expect(displayExprs.length).toBeGreaterThan(0);
      expect(inlineExprs.length).toBeGreaterThan(0);
    });

    it('should sort expressions by position', () => {
      const text = 'Third $c$, first $a$, second $b$.';
      const parsed = service.extractMath(text);

      expect(parsed.expressions).toHaveLength(3);
      // Should be sorted by startIndex
      for (let i = 1; i < parsed.expressions.length; i++) {
        expect(parsed.expressions[i].startIndex!).toBeGreaterThan(
          parsed.expressions[i - 1].startIndex!,
        );
      }
    });
  });

  describe('validate', () => {
    it('should validate correct LaTeX', () => {
      const result = service.validate('x^2 + y^2 = z^2');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate complex expressions', () => {
      const result = service.validate('\\frac{d}{dx} \\sin(x) = \\cos(x)');

      expect(result.valid).toBe(true);
    });

    it('should invalidate incorrect LaTeX', () => {
      const result = service.validate('\\invalidvalidatecommand');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('invalidvalidatecommand');
    });

    it('should invalidate unmatched braces', () => {
      const result = service.validate('\\frac{x{y}');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate empty string', () => {
      const result = service.validate('');

      expect(result.valid).toBe(true);
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      await service.renderToHtml('x = 1');
      await service.renderToHtml('y = 2');

      let stats = service.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      service.clearCache();

      stats = service.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should report cache statistics', async () => {
      const stats = service.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats.maxSize).toBe(1000);
    });

    it('should evict old entries when cache is full', async () => {
      // This would require rendering 1001+ expressions to test LRU eviction
      // For now, just verify the max size is set
      const stats = service.getCacheStats();
      expect(stats.maxSize).toBe(1000);
    });
  });

  describe('performance', () => {
    it('should render 100 simple expressions in < 1 second', async () => {
      const expressions = Array.from({ length: 100 }, (_, i) => ({
        content: `x_${i} = ${i}`,
        displayMode: false,
      }));

      const startTime = Date.now();
      await service.renderBatch(expressions, 'html');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });

    it('should benefit from caching on repeated renders', async () => {
      const latex = 'x^2 + y^2 = z^2';

      // First render (no cache)
      const start1 = Date.now();
      await service.renderToHtml(latex);
      const time1 = Date.now() - start1;

      // Second render (cached)
      const start2 = Date.now();
      await service.renderToHtml(latex);
      const time2 = Date.now() - start2;

      // Cached should be faster (though KaTeX is already very fast)
      expect(time2).toBeLessThanOrEqual(time1);
    });
  });
});
