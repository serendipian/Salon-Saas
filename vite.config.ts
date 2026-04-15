import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN;

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    build: {
      sourcemap: true,
    },
    plugins: [
      tailwindcss(),
      react(),
      sentryAuthToken
        ? sentryVitePlugin({
            org: 'saas-factory-x9',
            project: 'salon_saas',
            authToken: sentryAuthToken,
            release: { name: env.VITE_SENTRY_RELEASE || undefined },
            sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
          })
        : null,
    ].filter(Boolean),
    define: {},
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
