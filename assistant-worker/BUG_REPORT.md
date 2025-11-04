# Bug Report: assistant-worker

This document outlines the bugs and issues found in the `assistant-worker` module.

## High Severity Bugs

### 1. Use of Mock and In-Memory Adapters

- **File:** `src/infrastructure/infrastructure.module.ts`
- **Severity:** High
- **Description:** The `InfrastructureModule` is configured to use `MockLLMAdapter` for the `ILLMProvider` and `InMemoryAgentRepository` for the `IAgentRepository`.
- **Impact:** The application is not connected to a real LLM and does not persist any data. This is not suitable for a production environment.

### 2. Missing Global `ValidationPipe`

- **File:** `src/main.ts`
- **Severity:** High
- **Description:** The `main.ts` file does not configure a global `ValidationPipe`.
- **Impact:** Incoming requests are not being validated, which can lead to data corruption and security vulnerabilities.

## Medium Severity Bugs

### 1. Circular Dependency Workaround

- **File:** `src/infrastructure/infrastructure.module.ts`
- **Severity:** Medium
- **Description:** The `MemoryService` and `KnowledgeGraphService` have been moved from the `ApplicationModule` to the `InfrastructureModule` to avoid a circular dependency.
- **Impact:** This workaround suggests a flaw in the application's architecture. Services should not be moved from the application layer to the infrastructure layer to resolve dependencies.

### 2. Missing Global Filters and Interceptors

- **File:** `src/main.ts`
- **Severity:** Medium
- **Description:** The `main.ts` file does not configure global filters or interceptors.
- **Impact:** The application is missing centralized error handling and logging, which will make it difficult to debug and monitor.
