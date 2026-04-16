import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/index.css';
import App from './App';
import { initSentry } from './lib/sentry';

initSentry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: (failureCount, error) => {
        if (failureCount >= 1) return false;
        const msg = error instanceof Error ? error.message : String(error);
        return (
          msg.includes('401') ||
          msg.includes('JWTExpired') ||
          msg.includes('JWT expired') ||
          msg.includes('network') ||
          msg.includes('fetch') ||
          msg.includes('Failed to fetch')
        );
      },
      retryDelay: 1000,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
