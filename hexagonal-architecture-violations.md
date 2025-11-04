# Hexagonal Architecture Violations

This document lists all the violations of the hexagonal architecture found in the NestJS workers.

## assistant-worker

### Domain Layer imports from Application Layer

The `domain` layer incorrectly imports from the `application` layer, violating the dependency rule. The following files in the `domain` layer import from the `application` layer:

- `assistant-worker/src/domain/services/agent-factory.service.ts`: imports `ILogger` and `ILLMProvider` from `@application/ports`.
- `assistant-worker/src/domain/services/expert-pool-manager.service.ts`: imports `ILLMProvider` and `ILogger` from `@application/ports`.
- `assistant-worker/src/domain/agents/graph-agent/graph-agent.ts`: imports `ILogger` and `ILLMProvider` from `@application/ports`.
- `assistant-worker/src/domain/agents/genius-agent/genius-agent.ts`: imports `ILogger` and `ILLMProvider` from `@application/ports`.
- `assistant-worker/src/domain/agents/collective-agent/collective-agent.ts`: imports `ILogger` and `ILLMProvider` from `@application/ports`.
- `assistant-worker/src/domain/agents/react-agent/react-agent.ts`: imports `ILogger` and `ILLMProvider` from `@application/ports`.
- `assistant-worker/src/domain/agents/interview-agent/interview-agent.ts`: imports `ILogger` and `ILLMProvider` from `@application/ports`.
- `assistant-worker/src/domain/agents/agent.base.ts`: imports `ILogger` and `ILLMProvider` from `@application/ports`.
- `assistant-worker/src/domain/agents/expert-agent/expert-agent.ts`: imports `ILogger` and `ILLMProvider` from `@application/ports`.
- `assistant-worker/src/domain/agents/manager-agent/manager-agent.ts`: imports `ILogger` and `ILLMProvider` from `@application/ports`.

### Domain Layer imports from Infrastructure Layer

The `domain` layer incorrectly imports from the `infrastructure` layer, violating the dependency rule. The following files in the `domain` layer import from the `infrastructure` layer:

- `assistant-worker/src/domain/agents/expert-agent/expert-agent.ts`: imports `IRAGServiceAdapter` from `@infrastructure/adapters/interfaces`.

### Application Layer imports from Infrastructure Layer

The `application` layer incorrectly imports from the `infrastructure` layer, violating the dependency rule. The following files in the `application` layer import from the `infrastructure` layer:

- `assistant-worker/src/application/services/memory.service.ts`: imports from `@infrastructure/adapters/memory`.
- `assistant-worker/src/application/services/knowledge-graph.service.ts`: imports from `@infrastructure/adapters/knowledge-graph/neo4j.adapter`.

## data-processing-worker

### Application Layer imports from Infrastructure Layer

The `application` layer incorrectly imports from the `infrastructure` layer, violating the dependency rule. The following files in the `application` layer import from the `infrastructure` layer:

- `data-processing-worker/src/application/services/embedder-factory.service.ts`: imports `OpenAIEmbedderAdapter`, `GoogleEmbedderAdapter`, `CohereEmbedderAdapter`, `LocalEmbedderAdapter`, `HuggingFaceEmbedderAdapter` from `@infrastructure/adapters/embedders`.
- `data-processing-worker/src/application/services/text-splitter-factory.service.ts`: imports `RecursiveCharacterSplitterAdapter`, `CharacterSplitterAdapter`, `TokenSplitterAdapter`, `SemanticSplitterAdapter`, `PythonSplitterAdapter`, `JavaScriptSplitterAdapter`, `TypeScriptSplitterAdapter`, `JavaSplitterAdapter`, `CppSplitterAdapter`, `GoSplitterAdapter`, `LatexSplitterAdapter`, `MarkdownSplitterAdapter`, `HtmlSplitterAdapter` from `@infrastructure/adapters/splitters`.

## latex-worker

### Presentation Layer (Infrastructure) imports from Application and Domain Layers

The `presentation` layer (which should be considered part of the `infrastructure` layer) incorrectly imports from the `application` and `domain` layers, violating the dependency rule. The following files in the `presentation` layer import from the `application` and `domain` layers:

- `latex-worker/src/presentation/latex.controller.ts`: imports `CompileCommandUseCase`, `CompileCommand`, `CompileResult`, `ProjectService`, `TemplateService`, `MessageBrokerPort` from the `application` layer and `LaTeXProject`, `LaTeXTemplate` from the `domain` layer.

## news-worker

### Application Layer imports from Infrastructure Layer

The `application` layer incorrectly imports from the `infrastructure` layer, violating the dependency rule. The following files in the `application` layer import from the `infrastructure` layer:

- `news-worker/src/application/services/news.service.ts`: imports `RedisCacheAdapter` from `@infrastructure/adapters/cache/redis-cache.adapter`.
