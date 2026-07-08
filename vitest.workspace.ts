import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*',
  'apps/*',
  {
    test: {
      name: 'unit',
      include: ['packages/*/src/**/*.{test,spec}.ts'],
      environment: 'node',
      globals: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov'],
        include: ['packages/*/src/**'],
        exclude: ['**/*.{test,spec}.ts', '**/types/**'],
      },
      typecheck: {
        enabled: false,
      },
    },
  },
]);
