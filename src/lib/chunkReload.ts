import React, { lazy, ComponentType, LazyExoticComponent } from 'react';

const KEY = 'chunk-reload-at';
const COOLDOWN_MS = 30_000;

export const CHUNK_LOAD_ERROR_MESSAGE =
  'ارتباط با سرور برقرار نشد، اینترنت را بررسی کنید و دوباره تلاش کنید';

export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|Loading chunk|ChunkLoadError|NS_ERROR_NET_PARTIAL_TRANSFER|net::ERR_INCOMPLETE_CHUNKED_ENCODING|net::ERR_CONTENT_LENGTH_MISMATCH|Failed to fetch|timed out/i.test(
    msg,
  );
}

/** true یعنی صفحه در حال ریلود است. */
export function reloadOnceForNewDeploy(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < COOLDOWN_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // ignore
  }
  window.location.reload();
  return true;
}

function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Chunk download timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * تلاش مجدد برای اجرای یک تابع ایمپورت پرومیس‌محور تا ۳ بار با backoff تصاعدی و سقف زمانی کلی ۱۵ ثانیه
 */
export async function retryImport<T>(
  importer: () => Promise<T>,
  retries = 3,
  delays: number[] = [1000, 2000, 3500],
  totalTimeoutMs = 15_000
): Promise<T> {
  const deadline = Date.now() + totalTimeoutMs;
  let attempt = 0;

  while (true) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error('Chunk download timed out after 15s');
    }

    try {
      return await runWithTimeout(importer(), remaining);
    } catch (err) {
      attempt++;
      const timeLeftAfterAttempt = deadline - Date.now();
      if (attempt >= retries || timeLeftAfterAttempt <= 300) {
        throw err;
      }
      const rawDelay = delays[attempt - 1] ?? delays[delays.length - 1];
      const delay = Math.min(rawDelay, Math.max(0, timeLeftAfterAttempt - 200));
      console.warn(`[retryImport] Attempt ${attempt}/${retries} failed. Retrying in ${delay}ms...`, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

interface ChunkRetryErrorBoundaryProps<T extends ComponentType<any>> {
  initialLazy: LazyExoticComponent<T>;
  createLazy: () => LazyExoticComponent<T>;
  componentProps: Record<string, any>;
}

interface ChunkRetryErrorBoundaryState<T extends ComponentType<any>> {
  hasError: boolean;
  LazyComponent: LazyExoticComponent<T>;
}

class ChunkRetryErrorBoundary<T extends ComponentType<any>> extends React.Component<
  ChunkRetryErrorBoundaryProps<T>,
  ChunkRetryErrorBoundaryState<T>
> {
  constructor(props: ChunkRetryErrorBoundaryProps<T>) {
    super(props);
    this.state = {
      hasError: false,
      LazyComponent: props.initialLazy,
    };
  }

  static getDerivedStateFromError(): Partial<ChunkRetryErrorBoundaryState<any>> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[lazyWithRetry] ErrorBoundary caught chunk error:', error, info);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      LazyComponent: this.props.createLazy(),
    });
  };

  render(): React.ReactNode {
    const onClose = this.props.componentProps?.onClose;

    if (this.state.hasError) {
      const card = React.createElement(
        'div',
        {
          className:
            'p-6 my-6 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 max-w-md w-full mx-auto shadow-2xl',
          dir: 'rtl',
        },
        React.createElement(
          'div',
          {
            className:
              'w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center text-xl',
          },
          '⚠️'
        ),
        React.createElement(
          'div',
          { className: 'space-y-1.5' },
          React.createElement(
            'h3',
            { className: 'text-sm font-bold text-slate-100 leading-relaxed' },
            CHUNK_LOAD_ERROR_MESSAGE
          )
        ),
        React.createElement(
          'div',
          { className: 'flex items-center justify-center gap-2 pt-1' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: this.handleRetry,
              className:
                'px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/20 transition cursor-pointer active:scale-95',
            },
            'تلاش مجدد'
          ),
          typeof onClose === 'function'
            ? React.createElement(
                'button',
                {
                  type: 'button',
                  onClick: onClose,
                  className:
                    'px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer',
                },
                'بستن'
              )
            : null
        )
      );

      return typeof onClose === 'function'
        ? React.createElement(
            'div',
            {
              className:
                'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm',
            },
            card
          )
        : card;
    }

    const ActiveLazy = this.state.LazyComponent as ComponentType<any>;
    return React.createElement(ActiveLazy, this.props.componentProps);
  }
}

/**
 * بارگذاری lazy کامپوننت با ۳ بار تلاش مجدد خودکار و سقف زمانی ۱۵ ثانیه
 * در صورت شکست یا تایم‌اوت، پیام فارسی واضح و دکمه «تلاش مجدد» نشان می‌دهد.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  const createLazy = (): LazyExoticComponent<T> =>
    lazy(() =>
      retryImport(factory, 3, [1000, 2000, 3500], 15_000).catch((err) => {
        console.error('[lazyWithRetry] Chunk load failed or timed out:', err);
        throw err;
      })
    );

  const initialLazy = createLazy();

  const WithChunkErrorBoundary: React.FC<any> = (props) =>
    React.createElement(ChunkRetryErrorBoundary, {
      initialLazy,
      createLazy,
      componentProps: props,
    });

  return WithChunkErrorBoundary as unknown as LazyExoticComponent<T>;
}

export const ModalSuspenseFallback: React.FC = () =>
  React.createElement(
    'div',
    {
      className:
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs',
      dir: 'rtl',
    },
    React.createElement(
      'div',
      {
        className:
          'px-6 py-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex items-center gap-3 text-xs font-bold text-slate-200',
      },
      React.createElement('span', {
        className:
          'w-5 h-5 rounded-full border-2 border-blue-400/30 border-t-blue-400 animate-spin inline-block',
      }),
      'در حال بارگذاری...'
    )
  );
