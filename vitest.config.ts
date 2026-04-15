/// <reference types="vitest" />
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig({ mode: 'test', command: 'serve' }),
  defineConfig({
    test: {
      environment: 'happy-dom',
      globals: true,
      setupFiles: ['./test/setup.ts'],
      include: ['**/*.test.{ts,tsx}'],
      exclude: ['node_modules', 'dist', '.worktrees', 'supabase/functions'],
    },
  }),
);
