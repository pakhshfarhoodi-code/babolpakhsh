import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = window.location.pathname;
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center shadow-inner">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-100">
                سامانه با یک خطای غیرمنتظره مواجه شد
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                ممکن است داده‌های قبلی حافظه مرورگر با ساختار جدید همگام نبوده باشد. می‌توانید با دکمه‌های زیر صفحه را تازه‌سازی کنید.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-left dir-ltr text-xs font-mono text-rose-300 overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-blue-600/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span>بارگذاری مجدد صفحه</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetCache}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>پاکسازی حافظه محلی و ورود مجدد</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800 text-xs text-slate-500">
              بارفروش | شبکه پخش عمده فرهودی
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
