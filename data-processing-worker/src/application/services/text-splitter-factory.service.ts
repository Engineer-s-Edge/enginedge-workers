import { Injectable, Logger } from '@nestjs/common';
import { TextSplitterPort } from '@domain/ports/processing.port';
import { RecursiveCharacterSplitterAdapter } from '@infrastructure/adapters/splitters/recursive-character.splitter';
import { CharacterSplitterAdapter } from '@infrastructure/adapters/splitters/character.splitter';
import { TokenSplitterAdapter } from '@infrastructure/adapters/splitters/token.splitter';
import { SemanticSplitterAdapter } from '@infrastructure/adapters/splitters/semantic.splitter';
import { PythonSplitterAdapter } from '@infrastructure/adapters/splitters/python.splitter';
import { JavaScriptSplitterAdapter } from '@infrastructure/adapters/splitters/javascript.splitter';
import { TypeScriptSplitterAdapter } from '@infrastructure/adapters/splitters/typescript.splitter';
import { JavaSplitterAdapter } from '@infrastructure/adapters/splitters/java.splitter';
import { CppSplitterAdapter } from '@infrastructure/adapters/splitters/cpp.splitter';
import { GoSplitterAdapter } from '@infrastructure/adapters/splitters/go.splitter';
import { LatexSplitterAdapter } from '@infrastructure/adapters/splitters/latex.splitter';
import { MarkdownSplitterAdapter } from '@infrastructure/adapters/splitters/markdown.splitter';
import { HtmlSplitterAdapter } from '@infrastructure/adapters/splitters/html.splitter';

/**
 * Text Splitter Factory Service
 * 
 * Factory for creating appropriate text splitter instances based on content type,
 * file extension, or explicitly requested splitter type.
 */
@Injectable()
export class TextSplitterFactoryService {
  private readonly logger = new Logger(TextSplitterFactoryService.name);

  constructor(
    private readonly recursiveCharacterSplitter: RecursiveCharacterSplitterAdapter,
    private readonly characterSplitter: CharacterSplitterAdapter,
    private readonly tokenSplitter: TokenSplitterAdapter,
    private readonly semanticSplitter: SemanticSplitterAdapter,
    private readonly pythonSplitter: PythonSplitterAdapter,
    private readonly javaScriptSplitter: JavaScriptSplitterAdapter,
    private readonly typeScriptSplitter: TypeScriptSplitterAdapter,
    private readonly javaSplitter: JavaSplitterAdapter,
    private readonly cppSplitter: CppSplitterAdapter,
    private readonly goSplitter: GoSplitterAdapter,
    private readonly latexSplitter: LatexSplitterAdapter,
    private readonly markdownSplitter: MarkdownSplitterAdapter,
    private readonly htmlSplitter: HtmlSplitterAdapter,
  ) {
    this.logger.log('TextSplitterFactory initialized with 13 splitters');
  }

  /**
   * Get splitter by name/type
   */
  getSplitterByType(type: string): TextSplitterPort {
    const normalizedType = type.toLowerCase().trim();

    switch (normalizedType) {
      case 'recursive-character':
      case 'recursive':
        return this.recursiveCharacterSplitter;
      case 'character':
        return this.characterSplitter;
      case 'token':
        return this.tokenSplitter;
      case 'semantic':
        return this.semanticSplitter;
      case 'python':
        return this.pythonSplitter;
      case 'javascript':
      case 'js':
        return this.javaScriptSplitter;
      case 'typescript':
      case 'ts':
        return this.typeScriptSplitter;
      case 'java':
        return this.javaSplitter;
      case 'cpp':
      case 'c++':
        return this.cppSplitter;
      case 'go':
        return this.goSplitter;
      case 'latex':
        return this.latexSplitter;
      case 'markdown':
      case 'md':
        return this.markdownSplitter;
      case 'html':
        return this.htmlSplitter;
      default:
        this.logger.warn(`Unknown splitter type: ${type}, using recursive-character`);
        return this.recursiveCharacterSplitter;
    }
  }

  /**
   * Get splitter by file extension
   */
  getSplitterByFileExtension(filename: string): TextSplitterPort {
    const extension = filename.split('.').pop()?.toLowerCase() || '';

    switch (extension) {
      case 'py':
        return this.pythonSplitter;
      case 'js':
      case 'jsx':
        return this.javaScriptSplitter;
      case 'ts':
      case 'tsx':
        return this.typeScriptSplitter;
      case 'java':
        return this.javaSplitter;
      case 'cpp':
      case 'cc':
      case 'cxx':
      case 'c':
      case 'h':
        return this.cppSplitter;
      case 'go':
        return this.goSplitter;
      case 'tex':
      case 'latex':
        return this.latexSplitter;
      case 'md':
      case 'markdown':
        return this.markdownSplitter;
      case 'html':
      case 'htm':
        return this.htmlSplitter;
      default:
        return this.recursiveCharacterSplitter;
    }
  }

  /**
   * Get splitter by MIME type
   */
  getSplitterByMimeType(mimeType: string): TextSplitterPort {
    const normalizedMimeType = mimeType.toLowerCase();

    if (normalizedMimeType.includes('markdown') || normalizedMimeType.includes('text/plain')) {
      return this.markdownSplitter;
    }
    if (normalizedMimeType.includes('html')) {
      return this.htmlSplitter;
    }
    if (normalizedMimeType.includes('json') || normalizedMimeType.includes('javascript')) {
      return this.javaScriptSplitter;
    }
    if (normalizedMimeType.includes('xml')) {
      return this.htmlSplitter;
    }

    return this.recursiveCharacterSplitter;
  }

  /**
   * Detect and get appropriate splitter based on content preview
   */
  getSplitterByContentDetection(content: string): TextSplitterPort {
    // Check for code markers
    if (content.includes('```python') || content.includes('def ') || content.includes('import ')) {
      return this.pythonSplitter;
    }
    if (content.includes('```javascript') || content.includes('function ') || content.includes('const ')) {
      return this.javaScriptSplitter;
    }
    if (content.includes('```typescript') || content.includes('interface ') || content.includes('type ')) {
      return this.typeScriptSplitter;
    }
    if (content.includes('```java') || content.includes('class ') || content.includes('public ')) {
      return this.javaSplitter;
    }

    // Check for markdown
    if (content.includes('# ') && content.includes('##')) {
      return this.markdownSplitter;
    }

    // Check for HTML
    if (content.includes('<html') || content.includes('<div') || content.includes('<body')) {
      return this.htmlSplitter;
    }

    // Check for LaTeX
    if (content.includes('\\documentclass') || content.includes('\\begin{')) {
      return this.latexSplitter;
    }

    return this.recursiveCharacterSplitter;
  }

  /**
   * Get all available splitters
   */
  getAvailableSplitters(): Array<{ name: string; type: string; description: string }> {
    return [
      { name: 'Recursive Character', type: 'recursive-character', description: 'Default recursive splitter' },
      { name: 'Character', type: 'character', description: 'Simple character-based splitting' },
      { name: 'Token', type: 'token', description: 'Token-aware splitting' },
      { name: 'Semantic', type: 'semantic', description: 'Semantic-aware splitting' },
      { name: 'Python', type: 'python', description: 'Python code splitting' },
      { name: 'JavaScript', type: 'javascript', description: 'JavaScript code splitting' },
      { name: 'TypeScript', type: 'typescript', description: 'TypeScript code splitting' },
      { name: 'Java', type: 'java', description: 'Java code splitting' },
      { name: 'C++', type: 'cpp', description: 'C++ code splitting' },
      { name: 'Go', type: 'go', description: 'Go code splitting' },
      { name: 'LaTeX', type: 'latex', description: 'LaTeX document splitting' },
      { name: 'Markdown', type: 'markdown', description: 'Markdown document splitting' },
      { name: 'HTML', type: 'html', description: 'HTML document splitting' },
    ];
  }
}
