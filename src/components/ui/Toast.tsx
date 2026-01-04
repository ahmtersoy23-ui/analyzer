import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X, Loader } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, duration?: number) => string;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  loading: (message: string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Singleton for use outside React components
let toastFunctions: ToastContextType | null = null;

export const toast = {
  success: (message: string, duration?: number) => toastFunctions?.success(message, duration) || '',
  error: (message: string, duration?: number) => toastFunctions?.error(message, duration) || '',
  warning: (message: string, duration?: number) => toastFunctions?.warning(message, duration) || '',
  info: (message: string, duration?: number) => toastFunctions?.info(message, duration) || '',
  loading: (message: string) => toastFunctions?.loading(message) || '',
  dismiss: (id: string) => toastFunctions?.dismiss(id),
};

const ToastIcon: React.FC<{ type: ToastType }> = ({ type }) => {
  const iconClass = 'w-5 h-5 flex-shrink-0';
  switch (type) {
    case 'success':
      return <CheckCircle className={`${iconClass} text-green-500`} />;
    case 'error':
      return <XCircle className={`${iconClass} text-red-500`} />;
    case 'warning':
      return <AlertTriangle className={`${iconClass} text-amber-500`} />;
    case 'info':
      return <Info className={`${iconClass} text-blue-500`} />;
    case 'loading':
      return <Loader className={`${iconClass} text-blue-500 animate-spin`} />;
  }
};

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const bgColors: Record<ToastType, string> = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
    loading: 'bg-blue-50 border-blue-200',
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${bgColors[toast.type]} animate-slide-in`}
      role="alert"
      aria-live="polite"
    >
      <ToastIcon type={toast.type} />
      <p className="text-sm font-medium text-slate-700 flex-1">{toast.message}</p>
      {toast.type !== 'loading' && (
        <button
          onClick={() => onDismiss(toast.id)}
          className="p-1 hover:bg-slate-200 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      )}
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType, duration?: number): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { id, message, type, duration };

    setToasts(prev => [...prev, newToast]);

    // Auto-dismiss (except loading toasts)
    if (type !== 'loading') {
      const dismissTime = duration || (type === 'error' ? 5000 : 3000);
      setTimeout(() => removeToast(id), dismissTime);
    }

    return id;
  }, [removeToast]);

  const success = useCallback((message: string, duration?: number) => addToast(message, 'success', duration), [addToast]);
  const error = useCallback((message: string, duration?: number) => addToast(message, 'error', duration), [addToast]);
  const warning = useCallback((message: string, duration?: number) => addToast(message, 'warning', duration), [addToast]);
  const info = useCallback((message: string, duration?: number) => addToast(message, 'info', duration), [addToast]);
  const loading = useCallback((message: string) => addToast(message, 'loading'), [addToast]);

  const contextValue: ToastContextType = React.useMemo(() => ({
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    loading,
    dismiss: removeToast,
  }), [toasts, addToast, removeToast, success, error, warning, info, loading]);

  // Update singleton reference
  useEffect(() => {
    toastFunctions = contextValue;
    return () => { toastFunctions = null; };
  }, [contextValue]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
