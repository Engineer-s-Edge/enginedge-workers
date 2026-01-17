// ESLint v9 flat config for workers monorepo
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    files: ['**/*.ts'],
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: false,
      },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-undef': 'off',
    },
  },
  // Domain layers must be framework-agnostic and not depend on application/infra
  {
    files: [
      'assistant-worker/src/domain/**/*.ts',
      'agent-tool-worker/src/domain/**/*.ts',
      'data-processing-worker/src/domain/**/*.ts',
      'identity-worker/src/domain/**/*.ts',
      'interview-worker/src/domain/**/*.ts',
      'latex-worker/src/domain/**/*.ts',
      'news-worker/src/domain/**/*.ts',
      'resume-worker/src/domain/**/*.ts',
      'scheduling-worker/src/domain/**/*.ts',
      'worker-template/src/domain/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@application/*', message: 'Domain cannot import application layer' },
            { name: '@infrastructure/*', message: 'Domain cannot import infrastructure layer' },
            { name: '@nestjs/common', message: 'No NestJS in domain' },
            { name: '@nestjs/core', message: 'No NestJS in domain' },
            { name: '@nestjs/platform-express', message: 'No NestJS in domain' },
            { name: '@nestjs/platform-fastify', message: 'No NestJS in domain' },
            { name: '@nestjs/swagger', message: 'No Swagger in domain' },
            { name: 'rxjs', message: 'No RxJS in domain' },
            { name: 'prom-client', message: 'No Prometheus in domain' },
          ],
          patterns: [
            { group: ['@application/**', '@infrastructure/**', '@nestjs/**', '@fastify/**'], message: 'Invalid import in domain' },
          ],
        },
      ],
    },
  },
  // Application layers must not import infrastructure
  {
    files: [
      'assistant-worker/src/application/**/*.ts',
      'agent-tool-worker/src/application/**/*.ts',
      'data-processing-worker/src/application/**/*.ts',
      'identity-worker/src/application/**/*.ts',
      'interview-worker/src/application/**/*.ts',
      'latex-worker/src/application/**/*.ts',
      'news-worker/src/application/**/*.ts',
      'resume-worker/src/application/**/*.ts',
      'scheduling-worker/src/application/**/*.ts',
      'worker-template/src/application/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@infrastructure/*', message: 'Application cannot import infrastructure layer' },
          ],
          patterns: [{ group: ['@infrastructure/**'], message: 'Application cannot import infrastructure' }],
        },
      ],
    },
  },
];
