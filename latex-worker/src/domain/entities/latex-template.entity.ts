/**
 * LaTeXTemplate Entity
 *
 * Represents a reusable LaTeX template with variable substitution.
 * Used for resumes, articles, reports, letters, etc.
 */

export enum TemplateCategory {
  RESUME = 'resume',
  CV = 'cv',
  ARTICLE = 'article',
  REPORT = 'report',
  LETTER = 'letter',
  PRESENTATION = 'presentation',
  BOOK = 'book',
  THESIS = 'thesis',
  CUSTOM = 'custom',
}

export interface TemplateVariable {
  name: string;
  description: string;
  defaultValue?: string;
  required: boolean;
  type: 'string' | 'text' | 'date' | 'boolean' | 'list';
}

export interface TemplateMetadata {
  description?: string;
  author?: string;
  version?: string;
  tags?: string[];
  preview?: string; // URL or base64 of preview image
}

export class LaTeXTemplate {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly category: TemplateCategory,
    public readonly content: string,
    public readonly variables: TemplateVariable[],
    public readonly metadata: TemplateMetadata,
    public readonly isPublic: boolean,
    public readonly userId?: string,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {}

  /**
   * Create a new template
   */
  static create(
    id: string,
    name: string,
    category: TemplateCategory,
    content: string,
    variables: TemplateVariable[] = [],
    isPublic: boolean = false,
    userId?: string,
  ): LaTeXTemplate {
    const now = new Date();
    return new LaTeXTemplate(
      id,
      name,
      category,
      content,
      variables,
      {},
      isPublic,
      userId,
      now,
      now,
    );
  }

  /**
   * Update template content
   */
  updateContent(content: string): LaTeXTemplate {
    return new LaTeXTemplate(
      this.id,
      this.name,
      this.category,
      content,
      this.variables,
      this.metadata,
      this.isPublic,
      this.userId,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Update template variables
   */
  updateVariables(variables: TemplateVariable[]): LaTeXTemplate {
    return new LaTeXTemplate(
      this.id,
      this.name,
      this.category,
      this.content,
      variables,
      this.metadata,
      this.isPublic,
      this.userId,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Update template metadata
   */
  updateMetadata(metadata: Partial<TemplateMetadata>): LaTeXTemplate {
    return new LaTeXTemplate(
      this.id,
      this.name,
      this.category,
      this.content,
      this.variables,
      { ...this.metadata, ...metadata },
      this.isPublic,
      this.userId,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Make template public
   */
  makePublic(): LaTeXTemplate {
    return new LaTeXTemplate(
      this.id,
      this.name,
      this.category,
      this.content,
      this.variables,
      this.metadata,
      true,
      this.userId,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Make template private
   */
  makePrivate(): LaTeXTemplate {
    return new LaTeXTemplate(
      this.id,
      this.name,
      this.category,
      this.content,
      this.variables,
      this.metadata,
      false,
      this.userId,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Substitute variables in template content
   */
  substitute(values: Record<string, any>): string {
    let result = this.content;

    // Check required variables
    const missingRequired = this.variables
      .filter((v) => v.required && !(v.name in values))
      .map((v) => v.name);

    if (missingRequired.length > 0) {
      throw new Error(
        `Missing required variables: ${missingRequired.join(', ')}`,
      );
    }

    // Substitute each variable
    for (const variable of this.variables) {
      const value = values[variable.name] ?? variable.defaultValue ?? '';
      const placeholder = new RegExp(`{{\\s*${variable.name}\\s*}}`, 'g');

      // Handle different types
      let substitutionValue: string;
      switch (variable.type) {
        case 'list':
          substitutionValue = Array.isArray(value)
            ? value.join(', ')
            : String(value);
          break;
        case 'boolean':
          substitutionValue = value ? 'true' : 'false';
          break;
        case 'date':
          substitutionValue =
            value instanceof Date
              ? value.toISOString().split('T')[0]
              : String(value);
          break;
        default:
          substitutionValue = String(value);
      }

      result = result.replace(placeholder, substitutionValue);
    }

    return result;
  }

  /**
   * Extract all variable placeholders from content
   */
  extractVariablePlaceholders(): string[] {
    const regex = /{{\\s*([a-zA-Z0-9_]+)\\s*}}/g;
    const placeholders: string[] = [];
    let match;

    while ((match = regex.exec(this.content)) !== null) {
      placeholders.push(match[1]);
    }

    return [...new Set(placeholders)];
  }

  /**
   * Validate that all placeholders have corresponding variables defined
   */
  validateVariables(): { valid: boolean; undefinedPlaceholders: string[] } {
    const placeholders = this.extractVariablePlaceholders();
    const definedVariables = new Set(this.variables.map((v) => v.name));
    const undefinedPlaceholders = placeholders.filter(
      (p) => !definedVariables.has(p),
    );

    return {
      valid: undefinedPlaceholders.length === 0,
      undefinedPlaceholders,
    };
  }

  /**
   * Clone template with new ID
   */
  clone(newId: string, newName: string, userId?: string): LaTeXTemplate {
    const now = new Date();
    return new LaTeXTemplate(
      newId,
      newName,
      this.category,
      this.content,
      this.variables,
      this.metadata,
      false, // Cloned templates are private by default
      userId,
      now,
      now,
    );
  }
}
