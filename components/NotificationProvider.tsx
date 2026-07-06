import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';

type NotificationType = 'error' | 'warning' | 'success' | 'info' | 'delete';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  description?: string;
}

interface NotificationContextType {
  showNotification: (type: NotificationType, message: string, description?: string) => void;
  showError: (message: string, description?: string) => void;
  showWarning: (message: string, description?: string) => void;
  showSuccess: (message: string, description?: string) => void;
  showInfo: (message: string, description?: string) => void;
  showDelete: (message: string, description?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showNotification = useCallback((type: NotificationType, message: string, description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, type, message, description }]);

    // Auto-dismiss after 2 seconds
    setTimeout(() => {
      removeNotification(id);
    }, 2000);
  }, [removeNotification]);

  const showError = useCallback((message: string, description?: string) => showNotification('error', message, description), [showNotification]);
  const showWarning = useCallback((message: string, description?: string) => showNotification('warning', message, description), [showNotification]);
  const showSuccess = useCallback((message: string, description?: string) => showNotification('success', message, description), [showNotification]);
  const showInfo = useCallback((message: string, description?: string) => showNotification('info', message, description), [showNotification]);
  const showDelete = useCallback((message: string, description?: string) => showNotification('delete', message, description), [showNotification]);

  // Global Error Listeners
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      showError('Unhandled Error', event.message);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason?.message || 'A promise was rejected without a reason.';
      showError('Unhandled Promise Rejection', message);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [showError]);

  return (
    <NotificationContext.Provider value={{ showNotification, showError, showWarning, showSuccess, showInfo, showDelete }}>
      {children}
      
      {/* Notification UI */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none w-full max-w-sm">
        <AnimatePresence mode="popLayout">
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ 
                opacity: 1, 
                y: 0, 
                scale: 1,
                transition: { duration: 0.05, ease: "easeOut" }
              }}
              exit={{ 
                opacity: 0, 
                y: 4, 
                scale: 0.95,
                transition: { duration: 0.075, ease: "easeIn" }
              }}
              whileHover={{ scale: 1.02, transition: { duration: 0.075 } }}
              className={`
                relative overflow-hidden pointer-events-auto w-full px-5 py-3 rounded-xl shadow-md border flex items-center gap-3 transition-transform duration-75
                ${n.type === 'success' ? 'bg-green-100 border-green-300 text-green-700' : ''}
                ${n.type === 'error' ? 'bg-red-100 border-red-300 text-red-700' : ''}
                ${n.type === 'delete' || n.type === 'warning' ? 'bg-orange-100 border-orange-300 text-orange-700' : ''}
                ${n.type === 'info' ? 'bg-[#EFF6FF] border-[#2563EB]/20 text-[#2563EB]' : ''}
              `}
            >
              <div className="shrink-0">
                {n.type === 'success' && <CheckCircle2 size={20} />}
                {n.type === 'error' && <AlertCircle size={20} />}
                {(n.type === 'delete' || n.type === 'warning') && <AlertTriangle size={20} />}
                {n.type === 'info' && <Info size={20} />}
              </div>
              
              <div className="flex-grow min-w-0">
                <p className="text-sm font-semibold leading-tight">
                  {n.message}
                </p>
                {n.description && (
                  <p className="text-xs mt-0.5 opacity-90">
                    {n.description}
                  </p>
                )}
              </div>
              
              <button 
                onClick={() => removeNotification(n.id)}
                className="shrink-0 p-1 hover:bg-black/5 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>

              {/* Progress Auto-dismiss Bar */}
              <div className={`absolute bottom-0 left-0 h-1 w-full ${
                n.type === 'delete' || n.type === 'warning' ? 'bg-orange-500 animate-[progress_2s_linear]' : 
                n.type === 'success' ? 'bg-green-500 animate-progress' : 
                n.type === 'error' ? 'bg-red-500 animate-progress' :
                'bg-[#2563EB] animate-progress'
              }`} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
};
