import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getMessengerScope } from './lib/messengerScope';
import { reloadOnceForNewDeploy } from './lib/chunkReload';
import './index.css';

// اگر بعد از دیپلوی جدید، فایل chunk قدیمی پیدا نشد، یک‌بار صفحه را تازه کن.
// عمداً preventDefault() صدا زده نمی‌شود: Vite خطا را به ErrorBoundary می‌رساند
// که در این حالت پیام «در حال به‌روزرسانی» نشان می‌دهد (نه خطای ترسناک).
window.addEventListener('vite:preloadError', () => {
  reloadOnceForNewDeploy();
});

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

function loadEitaaSdkIfInsideEitaa(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).Eitaa?.WebApp) {
    try {
      (window as any).Eitaa.WebApp.ready();
      (window as any).Eitaa.WebApp.expand();
    } catch {}
    return Promise.resolve();
  }

  const ua = navigator.userAgent || '';
  const search = window.location.search || '';
  const hash = window.location.hash || '';
  const isEitaa = /eitaa/i.test(ua) || /eitaa/i.test(search) || /eitaa/i.test(hash);

  if (!isEitaa) return Promise.resolve();

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://developer.eitaa.com/eitaa-web-app.js';
    script.async = true;
    script.onload = () => {
      try {
        const app = (window as any).Eitaa?.WebApp;
        if (app) {
          app.ready();
          app.expand();
        }
      } catch {}
      resolve();
    };
    script.onerror = () => {
      resolve();
    };
    document.head.appendChild(script);
  });
}

async function bootstrap() {
  loadEitaaSdkIfInsideEitaa().catch(() => {});

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
    rootElement.dataset.mounted = 'true';
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
