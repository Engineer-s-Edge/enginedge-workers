import { Module, DynamicModule, Provider } from '@nestjs/common';
import { OpenAILLMAdapter } from './openai-llm.adapter';
import { AnthropicLLMAdapter } from './anthropic-llm.adapter';
import { GoogleLLMAdapter } from './google-llm.adapter';
import { GroqLLMAdapter } from './groq-llm.adapter';
import { NvidiaNIMLLMAdapter } from './nvidia-nim-llm.adapter';
import { XAILLMAdapter } from './xai-llm.adapter';
import { ILLMProvider } from '@application/ports/llm-provider.port';

export interface LLMModuleOptions {
  defaultProvider?:
    | 'openai'
    | 'anthropic'
    | 'google'
    | 'groq'
    | 'nvidia'
    | 'xai';
  enableAll?: boolean;
}

/**
 * LLM Provider Module
 *
 * Provides all LLM provider adapters with dependency injection.
 * Supports dynamic provider selection and optional multi-provider setup.
 *
 * Usage:
 * - Static: `imports: [LLMProviderModule.register()]` - Registers default provider
 * - Dynamic: `imports: [LLMProviderModule.register({ defaultProvider: 'anthropic' })]`
 * - All: `imports: [LLMProviderModule.register({ enableAll: true })]` - All providers available
 *
 * Injection:
 * - Single: `@Inject('ILLMProvider') llmProvider: ILLMProvider`
 * - Specific: `@Inject('OpenAI_ILLMProvider') openaiProvider: ILLMProvider`
 * - All: `@Inject('AllLLMProviders') providers: ILLMProvider[]`
 */
@Module({})
export class LLMProviderModule {
  static register(options: LLMModuleOptions = {}): DynamicModule {
    const defaultProvider = options.defaultProvider || 'openai';
    const enableAll = options.enableAll || false;

    // All available adapters
    const allAdapters = [
      OpenAILLMAdapter,
      AnthropicLLMAdapter,
      GoogleLLMAdapter,
      GroqLLMAdapter,
      NvidiaNIMLLMAdapter,
      XAILLMAdapter,
    ];

    // Providers to instantiate (all if enableAll, else just the adapters)
    const providers: Provider[] = [...allAdapters];

    // Provider mapping for named access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const providerMap = new Map<string, any>([
      ['openai', OpenAILLMAdapter],
      ['anthropic', AnthropicLLMAdapter],
      ['google', GoogleLLMAdapter],
      ['groq', GroqLLMAdapter],
      ['nvidia', NvidiaNIMLLMAdapter],
      ['xai', XAILLMAdapter],
    ]);

    // Default provider binding
    const defaultProviderClass =
      providerMap.get(defaultProvider) || OpenAILLMAdapter;
    providers.push({
      provide: 'ILLMProvider',
      useClass: defaultProviderClass,
    });

    // Named provider bindings (e.g., 'OpenAI_ILLMProvider')
    if (enableAll) {
      providers.push({
        provide: 'OpenAI_ILLMProvider',
        useClass: OpenAILLMAdapter,
      });
      providers.push({
        provide: 'Anthropic_ILLMProvider',
        useClass: AnthropicLLMAdapter,
      });
      providers.push({
        provide: 'Google_ILLMProvider',
        useClass: GoogleLLMAdapter,
      });
      providers.push({
        provide: 'Groq_ILLMProvider',
        useClass: GroqLLMAdapter,
      });
      providers.push({
        provide: 'Nvidia_ILLMProvider',
        useClass: NvidiaNIMLLMAdapter,
      });
      providers.push({
        provide: 'XAI_ILLMProvider',
        useClass: XAILLMAdapter,
      });

      // All providers array
      providers.push({
        provide: 'AllLLMProviders',
        useFactory: (
          openai: ILLMProvider,
          anthropic: ILLMProvider,
          google: ILLMProvider,
          groq: ILLMProvider,
          nvidia: ILLMProvider,
          xai: ILLMProvider,
        ) => [openai, anthropic, google, groq, nvidia, xai],
        inject: [
          'OpenAI_ILLMProvider',
          'Anthropic_ILLMProvider',
          'Google_ILLMProvider',
          'Groq_ILLMProvider',
          'Nvidia_ILLMProvider',
          'XAI_ILLMProvider',
        ],
      });
    }

    return {
      module: LLMProviderModule,
      providers,
      exports: enableAll
        ? [
            'ILLMProvider',
            'OpenAI_ILLMProvider',
            'Anthropic_ILLMProvider',
            'Google_ILLMProvider',
            'Groq_ILLMProvider',
            'Nvidia_ILLMProvider',
            'XAI_ILLMProvider',
            'AllLLMProviders',
          ]
        : ['ILLMProvider'],
    };
  }

  /**
   * Register all providers
   *
   * Usage: `imports: [LLMProviderModule.registerAll()]`
   *
   * Provides:
   * - 'ILLMProvider': Default provider (OpenAI)
   * - 'AllLLMProviders': Array of all providers
   * - Named providers: 'OpenAI_ILLMProvider', 'Anthropic_ILLMProvider', etc.
   */
  static registerAll(): DynamicModule {
    return this.register({ enableAll: true });
  }
}
