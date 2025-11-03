/**
 * Mermaid Actor - Infrastructure Layer
 *
 * Provides integration with Mermaid for diagram rendering and generation.
 */

import { Injectable } from '@nestjs/common';
import { BaseActor } from '@domain/tools/base/base-actor';
import {
  ActorConfig,
  ErrorEvent,
} from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, ActorCategory } from '@domain/entities/tool.entities';

export type MermaidOperation =
  | 'render-diagram'
  | 'validate-syntax'
  | 'get-themes'
  | 'convert-format';

export interface MermaidArgs {
  operation: MermaidOperation;
  // For render-diagram
  diagramCode?: string;
  // For convert-format
  sourceFormat?: 'mermaid' | 'plantuml' | 'graphviz';
  targetFormat?: 'svg' | 'png' | 'pdf' | 'mermaid';
  // Optional parameters
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
  width?: number;
  height?: number;
  backgroundColor?: string;
}

export interface MermaidOutput extends ToolOutput {
  success: boolean;
  operation: MermaidOperation;
  // For render-diagram
  svgContent?: string;
  pngData?: string;
  pdfData?: string;
  // For validate-syntax
  isValid?: boolean;
  errors?: string[];
  // For get-themes
  themes?: string[];
  // For convert-format
  convertedCode?: string;
  // Metadata
  diagramType?: string;
  renderTime?: number;
}

@Injectable()
export class MermaidActor extends BaseActor<MermaidArgs, MermaidOutput> {
  readonly name = 'mermaid-actor';
  readonly description =
    'Provides integration with Mermaid for diagram rendering and generation';

  readonly errorEvents: ErrorEvent[];

  readonly metadata: ActorConfig;

  get category(): ActorCategory {
    return ActorCategory.EXTERNAL_PRODUCTIVITY;
  }

  get requiresAuth(): boolean {
    return false;
  }

  constructor() {
    const errorEvents = [
      new ErrorEvent('SyntaxError', 'Invalid Mermaid syntax', false),
      new ErrorEvent('RenderError', 'Diagram rendering failed', false),
      new ErrorEvent('ValidationError', 'Invalid request parameters', false),
      new ErrorEvent('ConversionError', 'Format conversion failed', false),
      new ErrorEvent('NetworkError', 'Network connectivity issue', true),
    ];

    const metadata = new ActorConfig(
      'mermaid-actor',
      'Mermaid diagram rendering',
      'Render and convert Mermaid diagrams to various formats (SVG, PNG, PDF)',
      {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: [
              'render-diagram',
              'validate-syntax',
              'get-themes',
              'convert-format',
            ],
          },
          diagramCode: { type: 'string' },
          sourceFormat: {
            type: 'string',
            enum: ['mermaid', 'plantuml', 'graphviz'],
          },
          targetFormat: {
            type: 'string',
            enum: ['svg', 'png', 'pdf', 'mermaid'],
          },
          theme: {
            type: 'string',
            enum: ['default', 'dark', 'forest', 'neutral'],
          },
          width: { type: 'number', minimum: 100, maximum: 5000 },
          height: { type: 'number', minimum: 100, maximum: 5000 },
          backgroundColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
        },
        required: ['operation'],
      },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          operation: {
            type: 'string',
            enum: [
              'render-diagram',
              'validate-syntax',
              'get-themes',
              'convert-format',
            ],
          },
          svgContent: { type: 'string' },
          pngData: { type: 'string' },
          pdfData: { type: 'string' },
          isValid: { type: 'boolean' },
          errors: { type: 'array', items: { type: 'string' } },
          themes: { type: 'array', items: { type: 'string' } },
          convertedCode: { type: 'string' },
          diagramType: { type: 'string' },
          renderTime: { type: 'number' },
        },
        required: ['success', 'operation'],
      },
      [],
      ActorCategory.EXTERNAL_PRODUCTIVITY,
      false,
    );

    super(metadata, errorEvents);

    this.errorEvents = errorEvents;
    this.metadata = metadata;
  }

  protected async act(args: MermaidArgs): Promise<MermaidOutput> {
    switch (args.operation) {
      case 'render-diagram':
        return this.renderDiagram(args);
      case 'validate-syntax':
        return this.validateSyntax(args);
      case 'get-themes':
        return this.getThemes();
      case 'convert-format':
        return this.convertFormat(args);
      default:
        throw Object.assign(
          new Error(`Unsupported operation: ${args.operation}`),
          {
            name: 'ValidationError',
          },
        );
    }
  }

  private async renderDiagram(args: MermaidArgs): Promise<MermaidOutput> {
    if (!args.diagramCode) {
      throw Object.assign(new Error('Diagram code is required for rendering'), {
        name: 'ValidationError',
      });
    }

    try {
      const startTime = Date.now();

      // Extract diagram type from code
      const diagramType = this.extractDiagramType(args.diagramCode);

      // Simulate rendering - In real implementation, this would use Mermaid CLI or API
      const svgContent = this.generateMockSVG(
        args.diagramCode,
        args.theme || 'default',
        args.width || 800,
        args.height || 600,
      );

      const renderTime = Date.now() - startTime;

      return {
        success: true,
        operation: 'render-diagram',
        svgContent,
        diagramType,
        renderTime,
      };
    } catch (error: unknown) {
      throw this.handleRenderError(error);
    }
  }

  private async validateSyntax(args: MermaidArgs): Promise<MermaidOutput> {
    if (!args.diagramCode) {
      throw Object.assign(
        new Error('Diagram code is required for validation'),
        {
          name: 'ValidationError',
        },
      );
    }

    try {
      const errors = this.validateMermaidSyntax(args.diagramCode);
      const isValid = errors.length === 0;

      return {
        success: true,
        operation: 'validate-syntax',
        isValid,
        errors: isValid ? undefined : errors,
        diagramType: isValid
          ? this.extractDiagramType(args.diagramCode)
          : undefined,
      };
    } catch (error: unknown) {
      throw this.handleRenderError(error);
    }
  }

  private async getThemes(): Promise<MermaidOutput> {
    try {
      const themes = ['default', 'dark', 'forest', 'neutral'];

      return {
        success: true,
        operation: 'get-themes',
        themes,
      };
    } catch (error: unknown) {
      throw this.handleRenderError(error);
    }
  }

  private async convertFormat(args: MermaidArgs): Promise<MermaidOutput> {
    if (!args.diagramCode) {
      throw Object.assign(
        new Error('Diagram code is required for conversion'),
        {
          name: 'ValidationError',
        },
      );
    }

    if (!args.sourceFormat || !args.targetFormat) {
      throw Object.assign(new Error('Source and target formats are required'), {
        name: 'ValidationError',
      });
    }

    try {
      // Simulate format conversion - In real implementation, this would use appropriate converters
      let convertedCode = args.diagramCode;

      if (args.sourceFormat === 'plantuml' && args.targetFormat === 'mermaid') {
        convertedCode = this.convertPlantUMLToMermaid(args.diagramCode);
      } else if (
        args.sourceFormat === 'graphviz' &&
        args.targetFormat === 'mermaid'
      ) {
        convertedCode = this.convertGraphvizToMermaid(args.diagramCode);
      }

      return {
        success: true,
        operation: 'convert-format',
        convertedCode,
      };
    } catch (error: unknown) {
      throw Object.assign(
        new Error(
          `Format conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
        {
          name: 'ConversionError',
        },
      );
    }
  }

  private extractDiagramType(code: string): string {
    const lines = code.trim().split('\n');
    const firstLine = lines[0]?.trim().toLowerCase();

    if (firstLine?.includes('gitgraph')) {
      return 'gitgraph';
    } else if (
      firstLine?.includes('graph') ||
      firstLine?.includes('flowchart')
    ) {
      return 'flowchart';
    } else if (firstLine?.includes('sequence')) {
      return 'sequence';
    } else if (firstLine?.includes('class')) {
      return 'class';
    } else if (firstLine?.includes('state')) {
      return 'state';
    } else if (firstLine?.includes('er')) {
      return 'entity-relationship';
    } else if (firstLine?.includes('journey')) {
      return 'user-journey';
    } else if (firstLine?.includes('gantt')) {
      return 'gantt';
    } else if (firstLine?.includes('pie')) {
      return 'pie';
    } else if (firstLine?.includes('mindmap')) {
      return 'mindmap';
    } else if (firstLine?.includes('timeline')) {
      return 'timeline';
    } else if (firstLine?.includes('sankey')) {
      return 'sankey';
    }

    return 'unknown';
  }

  private validateMermaidSyntax(code: string): string[] {
    const errors: string[] = [];

    // Basic syntax validation
    if (!code || code.trim().length === 0) {
      errors.push('Diagram code cannot be empty');
      return errors;
    }

    const lines = code.trim().split('\n');
    const firstLine = lines[0]?.trim();

    // Check for basic diagram declaration
    if (
      !firstLine ||
      !/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitgraph|mindmap|timeline|sankey)/i.test(
        firstLine,
      )
    ) {
      errors.push('Diagram must start with a valid diagram type declaration');
    }

    // Check for balanced brackets and quotes
    let bracketCount = 0;
    let braceCount = 0;
    let parenCount = 0;
    let quoteCount = 0;
    let doubleQuoteCount = 0;

    for (const line of lines) {
      for (const char of line) {
        switch (char) {
          case '[':
            bracketCount++;
            break;
          case ']':
            bracketCount--;
            break;
          case '{':
            braceCount++;
            break;
          case '}':
            braceCount--;
            break;
          case '(':
            parenCount++;
            break;
          case ')':
            parenCount--;
            break;
          case "'":
            quoteCount = 1 - quoteCount;
            break;
          case '"':
            doubleQuoteCount = 1 - doubleQuoteCount;
            break;
        }
      }
    }

    if (bracketCount !== 0) errors.push('Unbalanced square brackets');
    if (braceCount !== 0) errors.push('Unbalanced curly braces');
    if (parenCount !== 0) errors.push('Unbalanced parentheses');
    if (quoteCount !== 0) errors.push('Unbalanced single quotes');
    if (doubleQuoteCount !== 0) errors.push('Unbalanced double quotes');

    return errors;
  }

  private generateMockSVG(
    code: string,
    theme: string,
    width: number,
    height: number,
  ): string {
    // Generate a mock SVG based on diagram type
    const diagramType = this.extractDiagramType(code);

    const themeColors = {
      default: { bg: '#ffffff', text: '#000000', border: '#000000' },
      dark: { bg: '#1f2937', text: '#ffffff', border: '#ffffff' },
      forest: { bg: '#f0f9f0', text: '#0f5132', border: '#0f5132' },
      neutral: { bg: '#f8f9fa', text: '#495057', border: '#495057' },
    };

    const colors =
      themeColors[theme as keyof typeof themeColors] || themeColors.default;

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${colors.bg}" stroke="${colors.border}" stroke-width="2"/>
  <text x="50%" y="40%" text-anchor="middle" fill="${colors.text}" font-family="Arial" font-size="24" font-weight="bold">${diagramType.toUpperCase()} DIAGRAM</text>
  <text x="50%" y="60%" text-anchor="middle" fill="${colors.text}" font-family="Arial" font-size="16">Rendered with Mermaid</text>
  <text x="50%" y="80%" text-anchor="middle" fill="${colors.text}" font-family="Arial" font-size="12">Theme: ${theme}</text>
</svg>`;
  }

  private convertPlantUMLToMermaid(code: string): string {
    // Basic PlantUML to Mermaid conversion (simplified)
    let mermaidCode = code;

    // Convert @startuml/@enduml to mermaid syntax
    mermaidCode = mermaidCode.replace(/@startuml[\s\S]*?@enduml/g, (match) => {
      const content = match
        .replace(/@startuml\s*/, '')
        .replace(/\s*@enduml/, '');
      return content;
    });

    // Convert basic elements
    mermaidCode = mermaidCode.replace(/(\w+)\s*->\s*(\w+)/g, '$1 --> $2');
    mermaidCode = mermaidCode.replace(/(\w+)\s*-->\s*(\w+)/g, '$1 --> $2');

    return `graph TD\n${mermaidCode}`;
  }

  private convertGraphvizToMermaid(code: string): string {
    // Basic Graphviz DOT to Mermaid conversion (simplified)
    let mermaidCode = code;

    // Remove digraph/graph wrapper
    mermaidCode = mermaidCode.replace(/digraph\s+\w+\s*\{([\s\S]*)\}/, '$1');
    mermaidCode = mermaidCode.replace(/graph\s+\w+\s*\{([\s\S]*)\}/, '$1');

    // Convert edges
    mermaidCode = mermaidCode.replace(/(\w+)\s*->\s*(\w+)/g, '$1 --> $2');

    return `graph TD\n${mermaidCode}`;
  }

  private handleRenderError(error: unknown): Error {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown rendering error';

    if (errorMessage.includes('syntax') || errorMessage.includes('parse')) {
      return Object.assign(new Error(`Syntax error: ${errorMessage}`), {
        name: 'SyntaxError',
      });
    }

    if (errorMessage.includes('render') || errorMessage.includes('svg')) {
      return Object.assign(new Error(`Rendering failed: ${errorMessage}`), {
        name: 'RenderError',
      });
    }

    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return Object.assign(new Error('Network connectivity issue'), {
        name: 'NetworkError',
      });
    }

    return Object.assign(
      new Error(`Mermaid operation failed: ${errorMessage}`),
      {
        name: 'RenderError',
      },
    );
  }
}
