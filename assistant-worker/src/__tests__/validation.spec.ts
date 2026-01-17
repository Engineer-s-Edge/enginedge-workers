/**
 * Validation Tests - Phase 5b Business Logic
 * Tests for input validation, business rules, and edge cases
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

describe('Validation Services', () => {
  // ===== AGENT VALIDATOR TESTS =====
  describe('Agent Validator', () => {
    interface Agent {
      id: string;
      name: string;
      type: 'react' | 'graph' | 'genius' | 'expert';
      status: 'active' | 'inactive' | 'paused';
      capabilities: string[];
      config: Record<string, any>;
    }

    class AgentValidator {
      validateAgent(agent: Partial<Agent>): {
        valid: boolean;
        errors: string[];
      } {
        const errors: string[] = [];

        // Name validation
        if (!agent.name) {
          errors.push('Agent name is required');
        } else if (agent.name.length < 2) {
          errors.push('Agent name must be at least 2 characters');
        } else if (agent.name.length > 100) {
          errors.push('Agent name must not exceed 100 characters');
        }

        // Type validation
        if (!agent.type) {
          errors.push('Agent type is required');
        } else if (
          !['react', 'graph', 'genius', 'expert'].includes(agent.type)
        ) {
          errors.push('Invalid agent type');
        }

        // Status validation
        if (
          agent.status &&
          !['active', 'inactive', 'paused'].includes(agent.status)
        ) {
          errors.push('Invalid agent status');
        }

        // Capabilities validation
        if (agent.capabilities && !Array.isArray(agent.capabilities)) {
          errors.push('Capabilities must be an array');
        } else if (agent.capabilities && agent.capabilities.length > 50) {
          errors.push('Maximum 50 capabilities allowed');
        }

        return {
          valid: errors.length === 0,
          errors,
        };
      }

      validateName(name: string): boolean {
        return name && name.length >= 2 && name.length <= 100 ? true : false;
      }

      validateType(type: string): boolean {
        return ['react', 'graph', 'genius', 'expert'].includes(type);
      }

      validateCapabilities(capabilities: string[]): boolean {
        return (
          Array.isArray(capabilities) &&
          capabilities.length <= 50 &&
          capabilities.every((c) => typeof c === 'string' && c.length > 0)
        );
      }
    }

    let validator: AgentValidator;

    beforeEach(() => {
      validator = new AgentValidator();
    });

    it('should validate complete agent', () => {
      const agent: Partial<Agent> = {
        name: 'TestAgent',
        type: 'react',
        capabilities: ['think', 'act'],
      };

      const result = validator.validateAgent(agent);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty name', () => {
      const agent: Partial<Agent> = {
        name: '',
        type: 'react',
      };

      const result = validator.validateAgent(agent);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent name is required');
    });

    it('should reject name too short', () => {
      const agent: Partial<Agent> = {
        name: 'A',
        type: 'react',
      };

      const result = validator.validateAgent(agent);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Agent name must be at least 2 characters',
      );
    });

    it('should reject name too long', () => {
      const agent: Partial<Agent> = {
        name: 'A'.repeat(101),
        type: 'react',
      };

      const result = validator.validateAgent(agent);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Agent name must not exceed 100 characters',
      );
    });

    it('should reject invalid type', () => {
      const agent: Partial<Agent> = {
        name: 'TestAgent',
        type: 'invalid' as any,
      };

      const result = validator.validateAgent(agent);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid agent type');
    });

    it('should reject invalid status', () => {
      const agent: Partial<Agent> = {
        name: 'TestAgent',
        type: 'react',
        status: 'invalid' as any,
      };

      const result = validator.validateAgent(agent);

      expect(result.valid).toBe(false);
    });

    it('should reject non-array capabilities', () => {
      const agent: Partial<Agent> = {
        name: 'TestAgent',
        type: 'react',
        capabilities: 'not-array' as any,
      };

      const result = validator.validateAgent(agent);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Capabilities must be an array');
    });

    it('should reject too many capabilities', () => {
      const agent: Partial<Agent> = {
        name: 'TestAgent',
        type: 'react',
        capabilities: Array.from({ length: 51 }, (_, i) => `cap-${i}`),
      };

      const result = validator.validateAgent(agent);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Maximum 50 capabilities allowed');
    });

    it('should validate name independently', () => {
      expect(validator.validateName('ValidName')).toBe(true);
      expect(validator.validateName('A')).toBe(false);
      expect(validator.validateName('A'.repeat(101))).toBe(false);
    });

    it('should validate type independently', () => {
      expect(validator.validateType('react')).toBe(true);
      expect(validator.validateType('graph')).toBe(true);
      expect(validator.validateType('genius')).toBe(true);
      expect(validator.validateType('expert')).toBe(true);
      expect(validator.validateType('invalid')).toBe(false);
    });

    it('should validate capabilities independently', () => {
      expect(validator.validateCapabilities(['cap1', 'cap2'])).toBe(true);
      expect(validator.validateCapabilities([])).toBe(true);
      expect(validator.validateCapabilities('not-array' as any)).toBe(false);
      expect(
        validator.validateCapabilities(
          Array.from({ length: 51 }, (_, i) => `c${i}`),
        ),
      ).toBe(false);
    });

    it('should report multiple errors', () => {
      const agent: Partial<Agent> = {
        name: 'A',
        type: 'invalid' as any,
        status: 'invalid' as any,
        capabilities: 'not-array' as any,
      };

      const result = validator.validateAgent(agent);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2);
    });
  });

  // ===== CONFIG VALIDATOR TESTS =====
  describe('Config Validator', () => {
    class ConfigValidator {
      validateConfig(config: Record<string, any>): {
        valid: boolean;
        errors: string[];
      } {
        const errors: string[] = [];

        if (!config || typeof config !== 'object') {
          errors.push('Config must be an object');
          return { valid: false, errors };
        }

        // Max depth validation
        const checkDepth = (
          obj: any,
          depth: number = 0,
          maxDepth: number = 10,
        ): boolean => {
          if (depth > maxDepth) return false;
          if (typeof obj !== 'object' || obj === null) return true;

          for (const value of Object.values(obj)) {
            if (!checkDepth(value, depth + 1, maxDepth)) return false;
          }

          return true;
        };

        if (!checkDepth(config)) {
          errors.push('Config nesting exceeds maximum depth');
        }

        // Max size validation
        const configStr = JSON.stringify(config);
        if (configStr.length > 1000000) {
          // 1MB limit
          errors.push('Config exceeds maximum size (1MB)');
        }

        return {
          valid: errors.length === 0,
          errors,
        };
      }

      validateConfigValue(
        key: string,
        value: any,
      ): { valid: boolean; reason?: string } {
        // Value type validation
        if (typeof value === 'function') {
          return { valid: false, reason: 'Functions not allowed in config' };
        }

        if (typeof value === 'symbol') {
          return { valid: false, reason: 'Symbols not allowed in config' };
        }

        if (typeof value === 'undefined') {
          return {
            valid: false,
            reason: 'Undefined values not allowed in config',
          };
        }

        return { valid: true };
      }
    }

    let validator: ConfigValidator;

    beforeEach(() => {
      validator = new ConfigValidator();
    });

    it('should validate simple config', () => {
      const config = {
        timeout: 5000,
        retries: 3,
        enabled: true,
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate nested config', () => {
      const config = {
        database: {
          host: 'localhost',
          port: 5432,
          credentials: {
            username: 'user',
            password: 'pass',
          },
        },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(true);
    });

    it('should reject non-object config', () => {
      const result = validator.validateConfig('not-object' as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Config must be an object');
    });

    it('should reject deeply nested config', () => {
      const initialConfig: any = { value: 0 };
      let current = initialConfig;

      for (let i = 0; i < 15; i++) {
        current.nested = {};
        current = current.nested;
      }

      const result = validator.validateConfig(initialConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Config nesting exceeds maximum depth');
    });

    it('should validate config values', () => {
      const validResult = validator.validateConfigValue('key', 'value');
      expect(validResult.valid).toBe(true);

      const functionResult = validator.validateConfigValue('fn', () => {});
      expect(functionResult.valid).toBe(false);

      const undefinedResult = validator.validateConfigValue('undef', undefined);
      expect(undefinedResult.valid).toBe(false);
    });

    it('should reject oversized config', () => {
      const largeConfig: Record<string, any> = {};
      for (let i = 0; i < 100000; i++) {
        largeConfig[`key${i}`] = 'x'.repeat(100);
      }

      const result = validator.validateConfig(largeConfig);

      expect(result.valid).toBe(false);
    });

    it('should handle empty config', () => {
      const result = validator.validateConfig({});

      expect(result.valid).toBe(true);
    });

    it('should validate config with mixed types', () => {
      const config = {
        string: 'value',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { key: 'value' },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(true);
    });
  });

  // ===== INPUT VALIDATION TESTS =====
  describe('Input Validator', () => {
    class InputValidator {
      validateString(
        value: string,
        minLength: number = 0,
        maxLength: number = 1000,
      ): boolean {
        return (
          typeof value === 'string' &&
          value.length >= minLength &&
          value.length <= maxLength
        );
      }

      validateNumber(value: number, min?: number, max?: number): boolean {
        if (typeof value !== 'number' || isNaN(value)) return false;
        if (min !== undefined && value < min) return false;
        if (max !== undefined && value > max) return false;
        return true;
      }

      validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      }

      validateURL(url: string): boolean {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      }

      validateArray(
        array: any[],
        itemValidator?: (item: any) => boolean,
      ): boolean {
        if (!Array.isArray(array)) return false;

        if (itemValidator) {
          return array.every(itemValidator);
        }

        return true;
      }

      validateJSON(jsonString: string): boolean {
        try {
          JSON.parse(jsonString);
          return true;
        } catch {
          return false;
        }
      }
    }

    let validator: InputValidator;

    beforeEach(() => {
      validator = new InputValidator();
    });

    it('should validate string', () => {
      expect(validator.validateString('valid')).toBe(true);
      expect(validator.validateString('')).toBe(true);
      expect(validator.validateString('x'.repeat(1001))).toBe(false);
    });

    it('should validate string with length constraints', () => {
      expect(validator.validateString('test', 2, 10)).toBe(true);
      expect(validator.validateString('a', 2, 10)).toBe(false);
      expect(validator.validateString('x'.repeat(11), 2, 10)).toBe(false);
    });

    it('should validate number', () => {
      expect(validator.validateNumber(42)).toBe(true);
      expect(validator.validateNumber(-5)).toBe(true);
      expect(validator.validateNumber(NaN)).toBe(false);
    });

    it('should validate number with bounds', () => {
      expect(validator.validateNumber(50, 0, 100)).toBe(true);
      expect(validator.validateNumber(-1, 0, 100)).toBe(false);
      expect(validator.validateNumber(101, 0, 100)).toBe(false);
    });

    it('should validate email', () => {
      expect(validator.validateEmail('user@example.com')).toBe(true);
      expect(validator.validateEmail('invalid.email')).toBe(false);
      expect(validator.validateEmail('user@domain')).toBe(false);
    });

    it('should validate URL', () => {
      expect(validator.validateURL('https://example.com')).toBe(true);
      expect(validator.validateURL('http://localhost:3000')).toBe(true);
      expect(validator.validateURL('not a url')).toBe(false);
    });

    it('should validate array', () => {
      expect(validator.validateArray([1, 2, 3])).toBe(true);
      expect(validator.validateArray([])).toBe(true);
      expect(validator.validateArray('not-array' as any)).toBe(false);
    });

    it('should validate array with item validator', () => {
      const isNumber = (item: any) => typeof item === 'number';

      expect(validator.validateArray([1, 2, 3], isNumber)).toBe(true);
      expect(validator.validateArray([1, 'two', 3], isNumber)).toBe(false);
    });

    it('should validate JSON', () => {
      expect(validator.validateJSON('{"key": "value"}')).toBe(true);
      expect(validator.validateJSON('["item1", "item2"]')).toBe(true);
      expect(validator.validateJSON('not json')).toBe(false);
    });
  });

  // ===== BUSINESS RULE VALIDATOR TESTS =====
  describe('Business Rule Validator', () => {
    interface Agent {
      id: string;
      name: string;
      type: 'react' | 'graph' | 'genius' | 'expert';
      status: 'active' | 'inactive' | 'paused';
      capabilities: string[];
      config: Record<string, any>;
    }

    class BusinessRuleValidator {
      validateAgentCreation(agent: Partial<Agent>): {
        valid: boolean;
        errors: string[];
      } {
        const errors: string[] = [];

        // Rules for React agents
        if (agent.type === 'react' && !agent.capabilities?.includes('think')) {
          errors.push('React agents must have "think" capability');
        }

        // Rules for Graph agents
        if (
          agent.type === 'graph' &&
          !agent.capabilities?.includes('traverse')
        ) {
          errors.push('Graph agents must have "traverse" capability');
        }

        // Rules for Genius agents
        if (
          agent.type === 'genius' &&
          agent.capabilities &&
          agent.capabilities.length < 2
        ) {
          errors.push('Genius agents must have at least 2 capabilities');
        }

        // Expert agents cannot be inactive on creation
        if (agent.type === 'expert' && agent.status === 'inactive') {
          errors.push('Expert agents cannot be created as inactive');
        }

        return {
          valid: errors.length === 0,
          errors,
        };
      }

      canTransitionStatus(
        currentStatus: string,
        newStatus: string,
      ): { allowed: boolean; reason?: string } {
        const validTransitions: Record<string, string[]> = {
          inactive: ['active', 'paused'],
          active: ['paused', 'inactive'],
          paused: ['active', 'inactive'],
        };

        const allowed =
          validTransitions[currentStatus]?.includes(newStatus) || false;

        if (!allowed) {
          return {
            allowed: false,
            reason: `Cannot transition from ${currentStatus} to ${newStatus}`,
          };
        }

        return { allowed: true };
      }

      validateCapabilityCompatibility(
        type: string,
        capability: string,
      ): boolean {
        const compatibleCapabilities: Record<string, string[]> = {
          react: ['think', 'act', 'observe'],
          graph: ['traverse', 'analyze', 'visualize'],
          genius: ['learn', 'create', 'optimize', 'think'],
          expert: ['analyze', 'recommend', 'explain'],
        };

        const allowed = compatibleCapabilities[type] || [];
        return allowed.includes(capability);
      }
    }

    let validator: BusinessRuleValidator;

    beforeEach(() => {
      validator = new BusinessRuleValidator();
    });

    it('should validate React agent requires think capability', () => {
      const agent: Partial<Agent> = {
        name: 'ReactBot',
        type: 'react',
        capabilities: [],
      };

      const result = validator.validateAgentCreation(agent);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'React agents must have "think" capability',
      );
    });

    it('should accept React agent with think capability', () => {
      const agent: Partial<Agent> = {
        name: 'ReactBot',
        type: 'react',
        capabilities: ['think', 'act'],
      };

      const result = validator.validateAgentCreation(agent);

      expect(result.valid).toBe(true);
    });

    it('should validate Graph agent requires traverse capability', () => {
      const agent: Partial<Agent> = {
        name: 'GraphBot',
        type: 'graph',
        capabilities: ['analyze'],
      };

      const result = validator.validateAgentCreation(agent);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Graph agents must have "traverse" capability',
      );
    });

    it('should validate Genius agent needs multiple capabilities', () => {
      const agent: Partial<Agent> = {
        name: 'GeniusBot',
        type: 'genius',
        capabilities: ['learn'],
      };

      const result = validator.validateAgentCreation(agent);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Genius agents must have at least 2 capabilities',
      );
    });

    it('should validate Expert agent cannot be inactive on creation', () => {
      const agent: Partial<Agent> = {
        name: 'ExpertBot',
        type: 'expert',
        status: 'inactive',
        capabilities: ['analyze'],
      };

      const result = validator.validateAgentCreation(agent);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Expert agents cannot be created as inactive',
      );
    });

    it('should validate status transitions', () => {
      const transition1 = validator.canTransitionStatus('inactive', 'active');
      expect(transition1.allowed).toBe(true);

      const transition2 = validator.canTransitionStatus('active', 'inactive');
      expect(transition2.allowed).toBe(true);

      const transition3 = validator.canTransitionStatus('inactive', 'paused');
      expect(transition3.allowed).toBe(true);

      const invalid = validator.canTransitionStatus('inactive', 'inactive');
      expect(invalid.allowed).toBe(false);
    });

    it('should validate capability compatibility', () => {
      expect(validator.validateCapabilityCompatibility('react', 'think')).toBe(
        true,
      );
      expect(
        validator.validateCapabilityCompatibility('react', 'traverse'),
      ).toBe(false);
      expect(
        validator.validateCapabilityCompatibility('graph', 'traverse'),
      ).toBe(true);
      expect(validator.validateCapabilityCompatibility('genius', 'learn')).toBe(
        true,
      );
      expect(
        validator.validateCapabilityCompatibility('expert', 'explain'),
      ).toBe(true);
    });

    it('should provide reason for failed transitions', () => {
      const result = validator.canTransitionStatus('inactive', 'inactive');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('Cannot transition');
    });
  });

  // ===== EDGE CASE VALIDATOR TESTS =====
  describe('Edge Case Validator', () => {
    class EdgeCaseValidator {
      validateEmptyInput(input: any): boolean {
        if (input === null || input === undefined) return false;
        if (typeof input === 'string' && input.trim().length === 0)
          return false;
        if (Array.isArray(input) && input.length === 0) return false;
        if (typeof input === 'object' && Object.keys(input).length === 0)
          return false;
        return true;
      }

      validateSpecialCharacters(input: string): boolean {
        // Check for potentially dangerous characters
        const dangerousPatterns = /[<>\"'`%]/;
        return !dangerousPatterns.test(input);
      }

      validateUnicodeHandling(input: string): boolean {
        try {
          JSON.stringify({ text: input });
          return true;
        } catch {
          return false;
        }
      }

      validateNumberEdgeCases(num: number): boolean {
        return !isNaN(num) && isFinite(num);
      }

      validateBoundaryConditions(
        value: number,
        min: number,
        max: number,
      ): boolean {
        return value >= min && value <= max;
      }
    }

    let validator: EdgeCaseValidator;

    beforeEach(() => {
      validator = new EdgeCaseValidator();
    });

    it('should detect empty strings', () => {
      expect(validator.validateEmptyInput('text')).toBe(true);
      expect(validator.validateEmptyInput('')).toBe(false);
      expect(validator.validateEmptyInput('   ')).toBe(false);
    });

    it('should detect empty arrays', () => {
      expect(validator.validateEmptyInput([1])).toBe(true);
      expect(validator.validateEmptyInput([])).toBe(false);
    });

    it('should detect empty objects', () => {
      expect(validator.validateEmptyInput({ key: 'value' })).toBe(true);
      expect(validator.validateEmptyInput({})).toBe(false);
    });

    it('should detect null and undefined', () => {
      expect(validator.validateEmptyInput(null)).toBe(false);
      expect(validator.validateEmptyInput(undefined)).toBe(false);
    });

    it('should detect special characters', () => {
      expect(validator.validateSpecialCharacters('normal text')).toBe(true);
      expect(validator.validateSpecialCharacters('text with <html>')).toBe(
        false,
      );
      expect(validator.validateSpecialCharacters("text with 'quote'"));
      expect(validator.validateSpecialCharacters('text with %escape%')).toBe(
        false,
      );
    });

    it('should handle unicode correctly', () => {
      expect(validator.validateUnicodeHandling('hello')).toBe(true);
      expect(validator.validateUnicodeHandling('你好')).toBe(true);
      expect(validator.validateUnicodeHandling('emoji: 🚀')).toBe(true);
    });

    it('should validate number edge cases', () => {
      expect(validator.validateNumberEdgeCases(0)).toBe(true);
      expect(validator.validateNumberEdgeCases(-42)).toBe(true);
      expect(validator.validateNumberEdgeCases(Number.MAX_SAFE_INTEGER)).toBe(
        true,
      );
      expect(validator.validateNumberEdgeCases(NaN)).toBe(false);
      expect(validator.validateNumberEdgeCases(Infinity)).toBe(false);
    });

    it('should validate boundary conditions', () => {
      expect(validator.validateBoundaryConditions(0, 0, 100)).toBe(true);
      expect(validator.validateBoundaryConditions(100, 0, 100)).toBe(true);
      expect(validator.validateBoundaryConditions(50, 0, 100)).toBe(true);
      expect(validator.validateBoundaryConditions(-1, 0, 100)).toBe(false);
      expect(validator.validateBoundaryConditions(101, 0, 100)).toBe(false);
    });

    it('should handle very long strings', () => {
      const longString = 'x'.repeat(10000);
      expect(validator.validateUnicodeHandling(longString)).toBe(true);
    });

    it('should handle special numeric values', () => {
      expect(validator.validateNumberEdgeCases(0)).toBe(true);
      expect(validator.validateNumberEdgeCases(-0)).toBe(true);
      expect(validator.validateNumberEdgeCases(0.000001)).toBe(true);
    });
  });
});
