import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, AlertTriangle, Info, X, XCircle } from 'lucide-react';
import './Toast.css';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};

let uid = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++uid;
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => remove(id), duration);
    }
    return id;
  }, []);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg, d) => add(msg, 'success', d),
    error:   (msg, d) => add(msg, 'error',   d),
    warning: (msg, d) => add(msg, 'warning', d),
    info:    (msg, d) => add(msg, 'info',    d),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" role="log" aria-live="polite" aria-label="Notifications">
        {toasts.map(t => {
          const Icon = ICONS[t.type];
          return (
            <div key={t.id} className={`toast-item toast-${t.type}`} role="alert">
              <Icon size={18} className="toast-icon" aria-hidden="true" />
              <span className="toast-message">{t.message}</span>
              <button onClick={() => remove(t.id)} className="toast-close" aria-label="Dismiss notification">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
