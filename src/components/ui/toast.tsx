import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, Info, XCircle } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'error';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

export interface ToastContextValue {
  success: (message: string) => void;
  info: (message: string) => void;
  error: (message: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const success = useCallback((message: string) => addToast('success', message), [addToast]);
  const info = useCallback((message: string) => addToast('info', message), [addToast]);
  const error = useCallback((message: string) => addToast('error', message), [addToast]);

  return (
    <ToastContext.Provider value={{ success, info, error }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts }: { toasts: ToastMessage[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

const TOAST_CONFIG: Record<ToastType, { bgClass: string; icon: React.ReactNode }> = {
  success: {
    bgClass: 'bg-green-600 text-white',
    icon: <CheckCircle className="h-4 w-4 flex-shrink-0" />,
  },
  info: {
    bgClass: 'bg-blue-600 text-white',
    icon: <Info className="h-4 w-4 flex-shrink-0" />,
  },
  error: {
    bgClass: 'bg-destructive text-destructive-foreground',
    icon: <XCircle className="h-4 w-4 flex-shrink-0" />,
  },
};

function ToastItem({ toast }: { toast: ToastMessage }) {
  const [visible, setVisible] = useState(false);
  const { bgClass, icon } = TOAST_CONFIG[toast.type];

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-md shadow-lg text-sm max-w-xs transition-all duration-300 ${bgClass} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {icon}
      <span>{toast.message}</span>
    </div>
  );
}
