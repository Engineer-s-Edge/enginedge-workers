/**
 * Mermaid Actor - Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  MermaidActor,
  MermaidArgs,
} from '../../../../infrastructure/tools/actors/mermaid.actor';

describe('MermaidActor', () => {
  let actor: MermaidActor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MermaidActor],
    }).compile();

    actor = module.get<MermaidActor>(MermaidActor);
  });

  it('should be defined', () => {
    expect(actor).toBeDefined();
  });

  describe('Metadata', () => {
    it('should have correct name', () => {
      expect(actor.name).toBe('mermaid-actor');
    });

    it('should have correct description', () => {
      expect(actor.description).toBe(
        'Provides integration with Mermaid for diagram rendering and generation',
      );
    });

    it('should have correct category', () => {
      expect(actor.category).toBe('EXTERNAL_PRODUCTIVITY');
    });

    it('should not require authentication', () => {
      expect(actor.requiresAuth).toBe(false);
    });
  });

  describe('Error Events', () => {
    it('should define all required error events', () => {
      const errorNames = actor.errorEvents.map((e) => e.name);
      expect(errorNames).toContain('SyntaxError');
      expect(errorNames).toContain('RenderError');
      expect(errorNames).toContain('ValidationError');
      expect(errorNames).toContain('ConversionError');
      expect(errorNames).toContain('NetworkError');
    });
  });

  describe('render-diagram operation', () => {
    const validArgs: MermaidArgs = {
      operation: 'render-diagram',
      diagramCode: 'graph TD\nA --> B\nB --> C',
    };

    it('should successfully render a flowchart diagram', async () => {
      const result = await actor.execute({
        name: 'mermaid-actor',
        args: validArgs as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('render-diagram');
      expect(result.output?.svgContent).toBeDefined();
      expect(result.output?.diagramType).toBe('flowchart');
      expect(result.output?.renderTime).toBeDefined();
      expect(typeof result.output?.renderTime).toBe('number');
    });

    it('should render with custom theme', async () => {
      const args: MermaidArgs = {
        operation: 'render-diagram',
        diagramCode: 'graph TD\nA --> B',
        theme: 'dark',
      };

      const result = await actor.execute({
        name: 'mermaid-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect(result.output?.svgContent).toContain('dark');
    });

    it('should render with custom dimensions', async () => {
      const args: MermaidArgs = {
        operation: 'render-diagram',
        diagramCode: 'graph TD\nA --> B',
        width: 1200,
        height: 800,
      };

      const result = await actor.execute({
        name: 'mermaid-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect(result.output?.svgContent).toContain('width="1200"');
      expect(result.output?.svgContent).toContain('height="800"');
    });

    it('should throw ValidationError when diagram code is missing', async () => {
      const args: MermaidArgs = {
        operation: 'render-diagram',
      };

      const result = await actor.execute({
        name: 'mermaid-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Diagram code is required for rendering',
      );
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('validate-syntax operation', () => {
    it('should validate correct flowchart syntax', async () => {
      const args: MermaidArgs = {
        operation: 'validate-syntax',
        diagramCode: 'graph TD\nA --> B\nB --> C',
      };

      const result = await actor.execute({
        name: 'mermaid-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('validate-syntax');
      expect(result.output?.isValid).toBe(true);
      expect(result.output?.diagramType).toBe('flowchart');
      expect(result.output?.errors).toBeUndefined();
    });

    it('should detect syntax errors', async () => {
      const args: MermaidArgs = {
        operation: 'validate-syntax',
        diagramCode: 'invalid syntax {{{',
      };

      const result = await actor.execute({
        name: 'mermaid-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('validate-syntax');
      expect(result.output?.isValid).toBe(false);
      expect(result.output?.errors).toBeDefined();
      expect(result.output?.errors?.length).toBeGreaterThan(0);
    });

    it('should detect unbalanced brackets', async () => {
      const args: MermaidArgs = {
        operation: 'validate-syntax',
        diagramCode: 'graph TD\nA --> B[',
      };

      const result = await actor.execute({
        name: 'mermaid-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect(result.output?.isValid).toBe(false);
      expect(result.output?.errors).toContain('Unbalanced square brackets');
    });

    it('should throw ValidationError when diagram code is missing', async () => {
      const args: MermaidArgs = {
        operation: 'validate-syntax',
      };

      const result = await actor.execute({
        name: 'mermaid-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Diagram code is required for validation',
      );
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('get-themes operation', () => {
    it('should return available themes', async () => {
      const args: MermaidArgs = {
        operation: 'get-themes',
      };

      const result = await actor.execute({
        name: 'mermaid-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('get-themes');
      expect(result.output?.themes).toBeDefined();
      expect(result.output?.themes).toContain('default');
      expect(result.output?.themes).toContain('dark');
      expect(result.output?.themes).toContain('forest');
      expect(result.output?.themes).toContain('neutral');
    });
  });

  describe('convert-format operation', () => {
    it('should convert PlantUML to Mermaid', async () => {
      const args: MermaidArgs = {
        operation: 'convert-format',
        diagramCode: '@startuml\nA -> B\n@enduml',
        sourceFormat: 'plantuml',
        targetFormat: 'mermaid',
      };

      const result = await actor.execute({
        name: 'mermaid-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('convert-format');
      expect(result.output?.convertedCode).toBeDefined();
      expect(result.output?.convertedCode).toContain('graph TD');
    });

    it('should convert Graphviz to Mermaid', async () => {
      const args: MermaidArgs = {
        operation: 'convert-format',
        diagramCode: 'digraph G {\nA -> B\n}',
        sourceFormat: 'graphviz',
        targetFormat: 'mermaid',
      };

      const result = await actor.execute({
        name: 'mermaid-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect(result.output?.operation).toBe('convert-format');
      expect(result.output?.convertedCode).toBeDefined();
      expect(result.output?.convertedCode).toContain('graph TD');
    });

    it('should throw ValidationError when diagram code is missing', async () => {
      const args: MermaidArgs = {
        operation: 'convert-format',
        sourceFormat: 'plantuml',
        targetFormat: 'mermaid',
      };

      const result = await actor.execute({
        name: 'mermaid-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Diagram code is required for conversion',
      );
      expect(result.error?.name).toBe('ValidationError');
    });

    it('should throw ValidationError when formats are missing', async () => {
      const args: MermaidArgs = {
        operation: 'convert-format',
        diagramCode: 'some code',
      };

      const result = await actor.execute({
        name: 'mermaid-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Source and target formats are required',
      );
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Diagram type detection', () => {
    const testCases = [
      { code: 'graph TD\nA --> B', expected: 'flowchart' },
      { code: 'flowchart TD\nA --> B', expected: 'flowchart' },
      { code: 'sequenceDiagram\nA->>B: msg', expected: 'sequence' },
      { code: 'classDiagram\nclass A', expected: 'class' },
      { code: 'stateDiagram\n[*] --> A', expected: 'state' },
      { code: 'erDiagram\nA ||--o{ B', expected: 'entity-relationship' },
      { code: 'journey\ntitle My journey', expected: 'user-journey' },
      { code: 'gantt\ntitle A Gantt Diagram', expected: 'gantt' },
      { code: 'pie title\n"A" : 10', expected: 'pie' },
      { code: 'gitgraph:\ncommit', expected: 'gitgraph' },
      { code: 'mindmap\nroot((mindmap))', expected: 'mindmap' },
      { code: 'timeline\ntitle Timeline', expected: 'timeline' },
      { code: 'sankey-beta\nA [10] B', expected: 'sankey' },
    ];

    testCases.forEach(({ code, expected }) => {
      it(`should detect ${expected} diagram type`, async () => {
        const args: MermaidArgs = {
          operation: 'render-diagram',
          diagramCode: code,
        };

        const result = await actor.execute({
          name: 'mermaid-actor',
          args: args as unknown as Record<string, unknown>,
        });

        expect(result.success).toBe(true);
        expect(result.output?.diagramType).toBe(expected);
      });
    });
  });

  describe('Unsupported operations', () => {
    it('should throw ValidationError for unsupported operation', async () => {
      const args = {
        operation: 'unsupported-op',
      };

      const result = await actor.execute({ name: 'mermaid-actor', args });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Unsupported operation: unsupported-op',
      );
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Error handling', () => {
    it('should handle syntax errors', () => {
      const error = new Error('Parse error: invalid syntax');
      const handledError = (
        actor as unknown as { handleRenderError: (error: unknown) => Error }
      ).handleRenderError(error);

      expect(handledError.name).toBe('SyntaxError');
      expect(handledError.message).toContain('Syntax error');
    });

    it('should handle render errors', () => {
      const error = new Error('SVG rendering failed');
      const handledError = (
        actor as unknown as { handleRenderError: (error: unknown) => Error }
      ).handleRenderError(error);

      expect(handledError.name).toBe('RenderError');
      expect(handledError.message).toContain('Rendering failed');
    });

    it('should handle network errors', () => {
      const error = new Error('Network timeout');
      const handledError = (
        actor as unknown as { handleRenderError: (error: unknown) => Error }
      ).handleRenderError(error);

      expect(handledError.name).toBe('NetworkError');
      expect(handledError.message).toContain('Network connectivity issue');
    });

    it('should handle unknown errors', () => {
      const error = new Error('Unknown error');
      const handledError = (
        actor as unknown as { handleRenderError: (error: unknown) => Error }
      ).handleRenderError(error);

      expect(handledError.name).toBe('RenderError');
      expect(handledError.message).toContain('Mermaid operation failed');
    });
  });
});
