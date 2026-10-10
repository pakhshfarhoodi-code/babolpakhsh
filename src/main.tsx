import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getMessengerScope } from './lib/messengerScope';
import './index.css';

// Unregister service worker in development to prevent stale assets / blank iframe screens
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  }
}

const eitaaApp = (window as any).Eitaa?.WebApp;
if (eitaaApp) {
  eitaaApp.ready();
  eitaaApp.expand();
}

async function bootstrap() {
  const scope = getMessengerScope();
  if (scope.startsWith('tg-')) {
    try {
      const mod = await import('@twa-dev/sdk');
      const WebApp = mod.default;
      try {
        WebApp.ready();
        WebApp.expand();
      } catch (err) {
        console.warn('Telegram WebApp ready/expand error:', err);
      }
    } catch (e) {
      console.warn('Telegram SDK dynamic import failed:', e);
    }
  }

  const telegramApp = (window as any).Telegram?.WebApp;
  if (telegramApp && telegramApp.initData) {
    try {
      telegramApp.ready();
      telegramApp.expand();
    } catch {}
  }

  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <ErrorBoundary>
          <AppProvider>
            <App />
          </AppProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  }
}

bootstrap();
