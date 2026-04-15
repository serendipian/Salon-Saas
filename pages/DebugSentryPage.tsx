import { useState } from 'react';
import { Sentry } from '../lib/sentry';

export default function DebugSentryPage() {
  const [throwInRender, setThrowInRender] = useState(false);

  if (throwInRender) {
    throw new Error('Sentry test: render error');
  }

  const dsnConfigured = Boolean(import.meta.env.VITE_SENTRY_DSN);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 max-w-md w-full">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Sentry Debug</h1>
        <p className="text-sm text-slate-500 mb-6">
          Environnement: <code>{import.meta.env.MODE}</code>
          <br />
          DSN configuré: <strong>{dsnConfigured ? 'oui' : 'non'}</strong>
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              Sentry.captureException(new Error('Sentry test: captureException'));
              alert('Évènement envoyé via captureException');
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium text-sm"
          >
            captureException (manuel)
          </button>
          <button
            type="button"
            onClick={() => {
              throw new Error('Sentry test: handler error');
            }}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-sm"
          >
            Throw dans un handler
          </button>
          <button
            type="button"
            onClick={() => setThrowInRender(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm"
          >
            Throw pendant le render (ErrorBoundary)
          </button>
        </div>
        <p className="mt-6 text-xs text-slate-400">
          Page temporaire — supprimer après vérification.
        </p>
      </div>
    </div>
  );
}
