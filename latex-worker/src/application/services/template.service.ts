/**
 * Template Management Service
 * 
 * Application layer service for managing LaTeX templates
 */

import { Injectable } from '@nestjs/common';
import { LaTeXTemplate, TemplateCategory, TemplateVariable, LaTeXProject } from '../../domain/entities';
import { ITemplateRepository } from '../../domain/ports';

@Injectable()
export class TemplateService {
  constructor(
    private readonly templateRepository: ITemplateRepository,
  ) {}

  /**
   * Create a new template
   */
  async createTemplate(
    id: string,
    name: string,
    category: TemplateCategory,
    content: string,
    variables: TemplateVariable[] = [],
    isPublic = false,
    userId?: string,
  ): Promise<LaTeXTemplate> {
    const template = LaTeXTemplate.create(
      id,
      name,
      category,
      content,
      variables,
      isPublic,
      userId,
    );
    await this.templateRepository.save(template);
    return template;
  }

  /**
   * Get a template by ID
   */
  async getTemplate(id: string): Promise<LaTeXTemplate | null> {
    return await this.templateRepository.findById(id);
  }

  /**
   * List templates by category
   */
  async listByCategory(category: TemplateCategory): Promise<LaTeXTemplate[]> {
    return await this.templateRepository.findByCategory(category);
  }

  /**
   * List public templates
   */
  async listPublicTemplates(): Promise<LaTeXTemplate[]> {
    return await this.templateRepository.findPublic();
  }

  /**
   * List user templates
   */
  async listUserTemplates(userId: string): Promise<LaTeXTemplate[]> {
    return await this.templateRepository.findByUser(userId);
  }

  /**
   * Search templates
   */
  async searchTemplates(query: string): Promise<LaTeXTemplate[]> {
    return await this.templateRepository.search(query);
  }

  /**
   * Update template content
   */
  async updateContent(
    templateId: string,
    content: string,
  ): Promise<LaTeXTemplate> {
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const updatedTemplate = template.updateContent(content);
    await this.templateRepository.save(updatedTemplate);
    return updatedTemplate;
  }

  /**
   * Update template variables
   */
  async updateVariables(
    templateId: string,
    variables: TemplateVariable[],
  ): Promise<LaTeXTemplate> {
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const updatedTemplate = template.updateVariables(variables);
    await this.templateRepository.save(updatedTemplate);
    return updatedTemplate;
  }

  /**
   * Toggle template visibility
   */
  async toggleVisibility(templateId: string): Promise<LaTeXTemplate> {
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const updatedTemplate = new LaTeXTemplate(
      template.id,
      template.name,
      template.category,
      template.content,
      template.variables,
      template.metadata,
      !template.isPublic,
      template.userId,
      template.createdAt,
      new Date(),
    );

    await this.templateRepository.save(updatedTemplate);
    return updatedTemplate;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    await this.templateRepository.delete(templateId);
  }

  /**
   * Substitute variables in template content
   */
  substituteVariables(
    content: string,
    values: Record<string, string>,
  ): string {
    let result = content;
    
    // Replace {{variable}} with actual values
    for (const [key, value] of Object.entries(values)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(regex, value);
    }
    
    return result;
  }

  /**
   * Clone template to a new project
   */
  async cloneToProject(
    templateId: string,
    projectId: string,
    projectName: string,
    variableValues: Record<string, string> = {},
    userId?: string,
  ): Promise<LaTeXProject> {
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validate all required variables are provided
    const missingVars = template.variables
      .filter(v => v.required && !variableValues[v.name])
      .map(v => v.name);

    if (missingVars.length > 0) {
      throw new Error(`Missing required variables: ${missingVars.join(', ')}`);
    }

    // Use default values for missing optional variables
    const allValues: Record<string, string> = {};
    for (const variable of template.variables) {
      if (variableValues[variable.name]) {
        allValues[variable.name] = variableValues[variable.name];
      } else if (variable.defaultValue) {
        allValues[variable.name] = variable.defaultValue;
      }
    }

    // Substitute variables
    const content = this.substituteVariables(template.content, allValues);

    // Create project from template
    const project = LaTeXProject.create(
      projectId,
      projectName,
      'main.tex',
      content,
      userId,
    );

    return project;
  }

  /**
   * Extract variables from template content
   */
  extractVariables(content: string): string[] {
    const regex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  /**
   * Validate template content
   */
  validateTemplate(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for unmatched braces
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push('Unmatched braces in template');
    }

    // Check for documentclass
    if (!content.includes('\\documentclass')) {
      errors.push('Template must include \\documentclass');
    }

    // Check for begin{document}
    if (!content.includes('\\begin{document}')) {
      errors.push('Template must include \\begin{document}');
    }

    // Check for end{document}
    if (!content.includes('\\end{document}')) {
      errors.push('Template must include \\end{document}');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(templateId: string): Promise<{
    variableCount: number;
    requiredVariableCount: number;
    lineCount: number;
    characterCount: number;
  }> {
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    return {
      variableCount: template.variables.length,
      requiredVariableCount: template.variables.filter(v => v.required).length,
      lineCount: template.content.split('\n').length,
      characterCount: template.content.length,
    };
  }
}
