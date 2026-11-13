import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Trash2, WifiOff, FileCode2, ChevronDown, ChevronUp } from 'lucide-react';
import { isChunkLoadError, reloadOnceForNewDeploy } from '../lib/chunkReload';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** true وقتی خطا از نوع «فایل قدیمی بعد از دیپلوی» است و صفحه در حال تازه‌سازی خودکار است */
  updating: boolean;
  showDetails: boolean;
}

function isNetworkOrSupabaseError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /Failed to fetch|NetworkError|net::ERR_|supabase|status 0|timeout|AbortError|Load failed/i.test(msg);
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
    updating: false,
    showDetails: false,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      updating: isChunkLoadError(error),
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // نسخه‌ی جدید منتشر شده و این تب هنوز فایل‌های قدیمی را می‌خواهد → خودکار تازه‌سازی
    if (isChunkLoadError(error)) {
      if (!reloadOnceForNewDeploy()) {
        this.setState({ updating: false });
      }
    }
  }

  handleReload = () => {
    // Add cache-busting timestamp to reload
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleResetCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.location.href = window.location.pathname;
    }
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  override render() {
    if (this.state.hasError && this.state.updating) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4" dir="rtl">
          <div className="text-center space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-blue-400" />
            <p className="text-sm font-semibold text-slate-200">نسخه جدید برنامه منتشر شده است.</p>
            <p className="text-xs text-slate-400">در حال دریافت فایل‌های به‌روز و تازه‌سازی صفحه…</p>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      const err = this.state.error;
      const isChunk = isChunkLoadError(err);
      const isNetwork = isNetworkOrSupabaseError(err);

      // Customized title and description based on failure type
      let title = 'سامانه با یک خطای غیرمنتظره مواجه شد';
      let description = 'ممکن است داده‌های قبلی حافظه مرورگر با ساختار جدید همگام نبوده باشد یا پردازش متوقف شده باشد.';
      let badgeLabel = 'خطای برنامه';
      let IconComponent = AlertCircle;
      let iconColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';

      if (isChunk) {
        title = 'ارتباط با سرور برقرار نشد، اینترنت را بررسی کنید و دوباره تلاش کنید';
        description = 'دریافت فایل‌های برنامه با اختلال یا کندی شبکه متوقف شد. لطفاً اتصال اینترنت خود را بررسی کرده و دوباره تلاش کنید.';
        badgeLabel = 'خطای دریافت فایل‌ها';
        IconComponent = FileCode2;
        iconColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      } else if (isNetwork) {
        title = 'ارتباط با سرور برقرار نشد، اینترنت را بررسی کنید و دوباره تلاش کنید';
        description = 'برقراری ارتباط با سرور بیش از حد طول کشید یا قطع شد. لطفاً وضعیت اینترنت را بررسی کرده و دوباره تلاش کنید.';
        badgeLabel = 'خطای اتصال شبکه';
        IconComponent = WifiOff;
        iconColor = 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className={`w-16 h-16 rounded-2xl border ${iconColor} mx-auto flex items-center justify-center shadow-inner`}>
              <IconComponent className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="inline-block text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                {badgeLabel}
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-100">
                {title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {description}
              </p>
            </div>

            {err?.message && (
              <div className="text-left space-y-1.5">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition cursor-pointer"
                >
                  <span>جزئیات فنی خطا</span>
                  {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {this.state.showDetails && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 dir-ltr text-xs font-mono text-rose-300 overflow-x-auto max-h-36">
                    {err.message}
                    {err.stack && (
                      <pre className="text-[10px] text-slate-500 mt-2 whitespace-pre-wrap">
                        {err.stack.slice(0, 400)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-blue-600/20 active:scale-98"
              >
                <RefreshCw className="w-4 h-4" />
                <span>تلاش مجدد</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetCache}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
              >
                <Trash2 className="w-4 h-4" />
                <span>پاکسازی حافظه و تلاش دوباره</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800 text-xs text-slate-500">
              بارفروش | سامانه پخش عمده فرهودی
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

