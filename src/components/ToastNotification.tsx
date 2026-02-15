import { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning', duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, message, type, duration };

    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {mounted &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              right: '16px',
              bottom: '16px',
              zIndex: 99999,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxWidth: '420px',
            }}
          >
            {toasts.map((toast) => (
              <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
};

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const colorMap = {
    success: { bg: '#ecfdf5', border: '#34d399', text: '#065f46' },
    error: { bg: '#fef2f2', border: '#f87171', text: '#991b1b' },
    info: { bg: '#eff6ff', border: '#60a5fa', text: '#1e3a8a' },
    warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
  }[toast.type];

  return (
    <div
      style={{
        transform: isVisible ? 'translateX(0)' : 'translateX(16px)',
        opacity: isVisible ? 1 : 0,
        transition: 'transform 220ms ease, opacity 220ms ease',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        borderRadius: '10px',
        border: `1px solid ${colorMap.border}`,
        background: colorMap.bg,
        color: colorMap.text,
        padding: '12px 14px',
        boxShadow: '0 10px 20px rgba(0,0,0,0.18)',
        width: '100%',
      }}
    >
      <div style={{ flex: 1 }}>{toast.message}</div>
      <button
        onClick={onClose}
        style={{
          flexShrink: 0,
          borderRadius: '999px',
          padding: '4px',
          cursor: 'pointer',
          border: 'none',
        }}
        aria-label="Закрыть уведомление"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
