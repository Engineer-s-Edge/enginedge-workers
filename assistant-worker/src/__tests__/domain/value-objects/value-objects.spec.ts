import {
  AgentCapability,
  ExecutionModel,
  MemoryType,
} from '../../../domain/value-objects/agent-capability.vo';
import { AgentConfig } from '../../../domain/value-objects/agent-config.vo';
import { Message } from '../../../domain/value-objects/message.vo';

describe('Value Objects', () => {
  describe('AgentCapability', () => {
    const validProps = {
      executionModel: 'chain-of-thought' as ExecutionModel,
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: true,
      canCoordinate: false,
      supportsParallelExecution: true,
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedMemoryTypes: ['buffer', 'token_buffer'] as readonly MemoryType[],
      timeoutMs: 30000,
    };

    describe('Creation and Validation', () => {
      it('should create valid capability', () => {
        const capability = AgentCapability.create(validProps);
        expect(capability).toBeDefined();
        expect(capability.executionModel).toBe('chain-of-thought');
        expect(capability.maxInputTokens).toBe(4096);
      });

      it('should throw on invalid maxInputTokens (zero)', () => {
        expect(() =>
          AgentCapability.create({
            ...validProps,
            maxInputTokens: 0,
          }),
        ).toThrow('maxInputTokens must be positive');
      });

      it('should throw on invalid maxInputTokens (negative)', () => {
        expect(() =>
          AgentCapability.create({
            ...validProps,
            maxInputTokens: -1,
          }),
        ).toThrow('maxInputTokens must be positive');
      });

      it('should throw on invalid maxOutputTokens (zero)', () => {
        expect(() =>
          AgentCapability.create({
            ...validProps,
            maxOutputTokens: 0,
          }),
        ).toThrow('maxOutputTokens must be positive');
      });

      it('should throw on invalid maxOutputTokens (negative)', () => {
        expect(() =>
          AgentCapability.create({
            ...validProps,
            maxOutputTokens: -1,
          }),
        ).toThrow('maxOutputTokens must be positive');
      });

      it('should throw on invalid timeoutMs (less than 100)', () => {
        expect(() =>
          AgentCapability.create({
            ...validProps,
            timeoutMs: 99,
          }),
        ).toThrow('timeoutMs must be at least 100ms');
      });

      it('should throw on empty supportedMemoryTypes', () => {
        expect(() =>
          AgentCapability.create({
            ...validProps,
            supportedMemoryTypes: [],
          }),
        ).toThrow('At least one memory type must be supported');
      });

      it('should throw on canCoordinate: true', () => {
        expect(() =>
          AgentCapability.create({
            ...validProps,
            canCoordinate: true,
          }),
        ).toThrow(
          'Individual agent types cannot coordinate. Coordination is only for Collective orchestration.',
        );
      });
    });

    describe('Immutability', () => {
      it('should have readonly properties', () => {
        const capability = AgentCapability.create(validProps);
        expect(capability.maxInputTokens).toBe(4096);
        expect(capability.executionModel).toBe('chain-of-thought');
        expect(capability.supportedMemoryTypes).toBeDefined();
      });

      it('should preserve array as readonly', () => {
        const capability = AgentCapability.create(validProps);
        expect(Array.isArray(capability.supportedMemoryTypes)).toBe(true);
        expect(capability.supportedMemoryTypes.length).toBeGreaterThan(0);
      });
    });

    describe('Various ExecutionModels', () => {
      const models: ExecutionModel[] = [
        'chain-of-thought',
        'dag',
        'research',
        'learning',
      ];

      models.forEach((model) => {
        it(`should support ${model} execution model`, () => {
          const capability = AgentCapability.create({
            ...validProps,
            executionModel: model,
          });
          expect(capability.executionModel).toBe(model);
        });
      });
    });

    describe('Memory Type Support', () => {
      const memoryTypes: MemoryType[] = [
        'buffer',
        'buffer_window',
        'token_buffer',
        'summary',
        'summary_buffer',
        'entity',
        'knowledge_graph',
        'vector_store',
      ];

      memoryTypes.forEach((type) => {
        it(`should support ${type} memory type`, () => {
          const capability = AgentCapability.create({
            ...validProps,
            supportedMemoryTypes: [type] as readonly MemoryType[],
          });
          expect(capability.supportedMemoryTypes).toContain(type);
        });
      });

      it('should support multiple memory types', () => {
        const types = ['buffer', 'vector_store', 'knowledge_graph'] as const;
        const capability = AgentCapability.create({
          ...validProps,
          supportedMemoryTypes: types,
        });
        expect(capability.supportedMemoryTypes).toHaveLength(3);
        expect(capability.supportedMemoryTypes).toContain('buffer');
        expect(capability.supportedMemoryTypes).toContain('vector_store');
        expect(capability.supportedMemoryTypes).toContain('knowledge_graph');
      });
    });

    describe('Edge Cases', () => {
      it('should handle minimum valid timeoutMs (100)', () => {
        const capability = AgentCapability.create({
          ...validProps,
          timeoutMs: 100,
        });
        expect(capability.timeoutMs).toBe(100);
      });

      it('should handle large token values', () => {
        const capability = AgentCapability.create({
          ...validProps,
          maxInputTokens: 1000000,
          maxOutputTokens: 500000,
        });
        expect(capability.maxInputTokens).toBe(1000000);
        expect(capability.maxOutputTokens).toBe(500000);
      });

      it('should handle all capability flags', () => {
        const capability = AgentCapability.create({
          ...validProps,
          canUseTools: false,
          canStreamResults: false,
          canPauseResume: false,
          supportsParallelExecution: false,
        });
        expect(capability.canUseTools).toBe(false);
        expect(capability.canStreamResults).toBe(false);
        expect(capability.canPauseResume).toBe(false);
        expect(capability.supportsParallelExecution).toBe(false);
      });
    });
  });

  describe('AgentConfig', () => {
    const validProps = {
      model: 'gpt-4',
      provider: 'openai',
      temperature: 0.7,
      maxTokens: 2000,
      systemPrompt: 'You are a helpful assistant.',
      enableTools: true,
      toolNames: ['tool1', 'tool2'],
      streamingEnabled: true,
      timeout: 30000,
    };

    describe('Creation and Validation', () => {
      it('should create valid config', () => {
        const config = AgentConfig.create(validProps);
        expect(config).toBeDefined();
        expect(config.model).toBe('gpt-4');
        expect(config.temperature).toBe(0.7);
      });

      it('should throw on missing model', () => {
        expect(() =>
          AgentConfig.create({
            ...validProps,
            model: '',
          }),
        ).toThrow('Model name is required');
      });

      it('should throw on whitespace-only model', () => {
        expect(() =>
          AgentConfig.create({
            ...validProps,
            model: '   ',
          }),
        ).toThrow('Model name is required');
      });

      it('should throw on invalid temperature (too low)', () => {
        expect(() =>
          AgentConfig.create({
            ...validProps,
            temperature: -0.1,
          }),
        ).toThrow('Temperature must be between 0 and 2');
      });

      it('should throw on invalid temperature (too high)', () => {
        expect(() =>
          AgentConfig.create({
            ...validProps,
            temperature: 2.1,
          }),
        ).toThrow('Temperature must be between 0 and 2');
      });

      it('should throw on invalid maxTokens', () => {
        expect(() =>
          AgentConfig.create({
            ...validProps,
            maxTokens: 0,
          }),
        ).toThrow('Max tokens must be positive');
      });

      it('should throw on invalid timeout', () => {
        expect(() =>
          AgentConfig.create({
            ...validProps,
            timeout: 999,
          }),
        ).toThrow('Timeout must be at least 1000ms');
      });
    });

    describe('Defaults', () => {
      it('should apply default provider', () => {
        const config = AgentConfig.create({
          model: 'gpt-4',
        });
        expect(config.provider).toBe('openai');
      });

      it('should apply default temperature', () => {
        const config = AgentConfig.create({
          model: 'gpt-4',
        });
        expect(config.temperature).toBe(0.7);
      });

      it('should apply default maxTokens', () => {
        const config = AgentConfig.create({
          model: 'gpt-4',
        });
        expect(config.maxTokens).toBe(2000);
      });

      it('should apply default systemPrompt', () => {
        const config = AgentConfig.create({
          model: 'gpt-4',
        });
        expect(config.systemPrompt).toBe('You are a helpful AI assistant.');
      });

      it('should apply default enableTools', () => {
        const config = AgentConfig.create({
          model: 'gpt-4',
        });
        expect(config.enableTools).toBe(false);
      });

      it('should apply default streamingEnabled', () => {
        const config = AgentConfig.create({
          model: 'gpt-4',
        });
        expect(config.streamingEnabled).toBe(false);
      });

      it('should apply default timeout', () => {
        const config = AgentConfig.create({
          model: 'gpt-4',
        });
        expect(config.timeout).toBe(30000);
      });

      it('should create full default config', () => {
        const config = AgentConfig.default();
        expect(config.model).toBe('gpt-4');
        expect(config.provider).toBe('openai');
        expect(config.temperature).toBe(0.7);
        expect(config.maxTokens).toBe(2000);
      });
    });

    describe('Trimming', () => {
      it('should trim model name', () => {
        const config = AgentConfig.create({
          model: '  gpt-4  ',
        });
        expect(config.model).toBe('gpt-4');
      });
    });

    describe('Update', () => {
      it('should update model', () => {
        const config1 = AgentConfig.create(validProps);
        const config2 = config1.update({ model: 'gpt-3.5-turbo' });
        expect(config2.model).toBe('gpt-3.5-turbo');
        expect(config1.model).toBe('gpt-4'); // Original unchanged
      });

      it('should update temperature', () => {
        const config1 = AgentConfig.create(validProps);
        const config2 = config1.update({ temperature: 0.3 });
        expect(config2.temperature).toBe(0.3);
        expect(config1.temperature).toBe(0.7);
      });

      it('should update multiple properties', () => {
        const config1 = AgentConfig.create(validProps);
        const config2 = config1.update({
          temperature: 0.5,
          maxTokens: 4000,
          streamingEnabled: false,
        });
        expect(config2.temperature).toBe(0.5);
        expect(config2.maxTokens).toBe(4000);
        expect(config2.streamingEnabled).toBe(false);
        expect(config1.temperature).toBe(0.7); // Original unchanged
      });

      it('should validate on update', () => {
        const config = AgentConfig.create(validProps);
        expect(() => config.update({ temperature: 3 })).toThrow();
      });
    });

    describe('Immutability', () => {
      it('should have readonly properties', () => {
        const config = AgentConfig.create(validProps);
        expect(config.temperature).toBe(0.7);
        expect(config.model).toBe('gpt-4');
        expect(config.maxTokens).toBe(2000);
      });

      it('should preserve array as readonly', () => {
        const config = AgentConfig.create(validProps);
        expect(Array.isArray(config.toolNames)).toBe(true);
        expect(config.toolNames).toContain('tool1');
      });
    });

    describe('Temperature Edge Cases', () => {
      it('should accept temperature 0', () => {
        const config = AgentConfig.create({
          ...validProps,
          temperature: 0,
        });
        expect(config.temperature).toBe(0);
      });

      it('should accept temperature 2', () => {
        const config = AgentConfig.create({
          ...validProps,
          temperature: 2,
        });
        expect(config.temperature).toBe(2);
      });

      it('should accept temperature 1', () => {
        const config = AgentConfig.create({
          ...validProps,
          temperature: 1,
        });
        expect(config.temperature).toBe(1);
      });
    });
  });

  describe('Message', () => {
    describe('Factory Methods', () => {
      it('should create user message', () => {
        const msg = Message.user('Hello');
        expect(msg.role).toBe('user');
        expect(msg.content).toBe('Hello');
      });

      it('should create assistant message', () => {
        const msg = Message.assistant('Response');
        expect(msg.role).toBe('assistant');
        expect(msg.content).toBe('Response');
      });

      it('should create system message', () => {
        const msg = Message.system('System instruction');
        expect(msg.role).toBe('system');
        expect(msg.content).toBe('System instruction');
      });

      it('should create user message with metadata', () => {
        const msg = Message.user('Hello', { source: 'api' });
        expect(msg.role).toBe('user');
        expect(msg.content).toBe('Hello');
        expect(msg.metadata?.source).toBe('api');
      });

      it('should create assistant message with metadata', () => {
        const msg = Message.assistant('Response', { model: 'gpt-4' });
        expect(msg.role).toBe('assistant');
        expect(msg.metadata?.model).toBe('gpt-4');
      });
    });

    describe('Message Properties', () => {
      it('should have timestamp property', () => {
        const before = new Date();
        const msg = Message.user('Hello');
        const after = new Date();
        expect(msg.timestamp).toBeDefined();
        expect(msg.timestamp.getTime()).toBeGreaterThanOrEqual(
          before.getTime(),
        );
        expect(msg.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
      });

      it('should have unique IDs', () => {
        const msg1 = Message.user('Hello');
        const msg2 = Message.user('Hello');
        expect(msg1.id).not.toBe(msg2.id);
      });

      it('should preserve content exactly', () => {
        const content =
          'This is a long message with special characters: @#$%^&*()';
        const msg = Message.user(content);
        expect(msg.content).toBe(content);
      });

      it('should trim content on creation', () => {
        const msg = Message.user('  Hello  ');
        expect(msg.content).toBe('Hello');
      });

      it('should throw on empty content', () => {
        expect(() => Message.user('')).toThrow(
          'Message content cannot be empty',
        );
      });

      it('should throw on whitespace-only content', () => {
        expect(() => Message.user('   ')).toThrow(
          'Message content cannot be empty',
        );
      });

      it('should handle very long content', () => {
        const longContent = 'x'.repeat(10000);
        const msg = Message.user(longContent);
        expect(msg.content.length).toBe(10000);
      });

      it('should preserve content with newlines', () => {
        const content = 'Line 1\nLine 2\nLine 3';
        const msg = Message.user(content);
        expect(msg.content).toContain('\n');
      });

      it('should have correct role after creation', () => {
        const userMsg = Message.user('text');
        const assistantMsg = Message.assistant('text');
        const systemMsg = Message.system('text');

        expect(userMsg.role).toBe('user');
        expect(assistantMsg.role).toBe('assistant');
        expect(systemMsg.role).toBe('system');
      });
    });

    describe('Immutability', () => {
      it('should have readonly properties', () => {
        const msg = Message.user('Hello');
        expect(msg.id).toBeDefined();
        expect(msg.role).toBe('user');
        expect(msg.content).toBe('Hello');
      });
    });

    describe('Metadata Handling', () => {
      it('should handle no metadata', () => {
        const msg = Message.user('Hello');
        expect(msg.metadata).toBeUndefined();
      });

      it('should handle complex metadata', () => {
        const metadata = {
          source: 'api',
          model: 'gpt-4',
          tokens: 150,
          nested: { key: 'value' },
        };
        const msg = Message.user('Hello', metadata);
        expect(msg.metadata).toEqual(metadata);
        expect(msg.metadata?.['source']).toBe('api');
        expect(msg.metadata?.['tokens']).toBe(150);
      });

      it('should preserve metadata structure', () => {
        const metadata = { a: 1, b: { c: 2 } };
        const msg = Message.user('Hello', metadata);
        expect(msg.metadata?.['a']).toBe(1);
        expect(msg.metadata?.['b']).toEqual({ c: 2 });
      });
    });

    describe('Multiple Roles', () => {
      it('should support all roles', () => {
        const roles = [
          { factory: () => Message.user('msg'), role: 'user' },
          { factory: () => Message.assistant('msg'), role: 'assistant' },
          { factory: () => Message.system('msg'), role: 'system' },
        ];

        roles.forEach(({ factory, role }) => {
          const msg = factory();
          expect(msg.role).toBe(role);
        });
      });
    });

    describe('Sequential Message Creation', () => {
      it('should create sequence of messages with unique IDs', () => {
        const messages = [
          Message.user('First'),
          Message.assistant('Second'),
          Message.user('Third'),
          Message.system('Fourth'),
        ];

        expect(messages).toHaveLength(4);
        const ids = messages.map((m) => m.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(4); // All unique
      });

      it('should maintain chronological order of timestamps', () => {
        const messages = [
          Message.user('First'),
          Message.assistant('Second'),
          Message.user('Third'),
        ];

        for (let i = 1; i < messages.length; i++) {
          expect(messages[i].timestamp.getTime()).toBeGreaterThanOrEqual(
            messages[i - 1].timestamp.getTime(),
          );
        }
      });
    });

    describe('Content Variations', () => {
      const testCases = [
        'Simple message',
        'Message with\nnewlines\n\nincluded',
        'Message with "quotes"',
        "Message with 'single quotes'",
        'Message with {json: "like"} content',
        'Message with markdown **bold** and _italic_',
        'Message with emoji 🚀 and unicode ñ',
        '{"json": "message"}',
        '<html><body>html content</body></html>',
      ];

      testCases.forEach((content) => {
        it(`should preserve content: "${content.substring(0, 30)}..."`, () => {
          const msg = Message.user(content);
          expect(msg.content).toBe(content);
        });
      });
    });
  });
});
