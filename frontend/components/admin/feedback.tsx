'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icon } from '../icon';

type ToastType = 'success' | 'error' | 'info' | 'warning';
type Toast = { id: number; type: ToastType; title?: string; message: string };
type ConfirmOptions = {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  icon?: string;
};
type ConfirmState = ConfirmOptions & { resolve: (value: boolean) => void };

type ToastApi = {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);
const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

const TOAST_ICON: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
  warning: 'warning',
};
const TOAST_DURATION = 5000;

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const counter = useRef(0);

  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((t) => t.id !== id)),
    [],
  );
  const push = useCallback(
    (type: ToastType, message: string, title?: string) => {
      const id = ++counter.current;
      setToasts((all) => [...all.slice(-3), { id, type, message, title }]);
      setTimeout(() => dismiss(id), type === 'error' ? TOAST_DURATION * 1.6 : TOAST_DURATION);
    },
    [dismiss],
  );
  const [toastApi] = useState<ToastApi>(() => ({
    success: (m, t) => push('success', m, t),
    error: (m, t) => push('error', m, t),
    info: (m, t) => push('info', m, t),
    warning: (m, t) => push('warning', m, t),
  }));

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setConfirmState({ ...options, resolve })),
    [],
  );
  function close(result: boolean) {
    confirmState?.resolve(result);
    setConfirmState(null);
  }

  return (
    <ToastContext.Provider value={toastApi}>
      <ConfirmContext.Provider value={confirm}>
        {children}
        <div className="toast-region" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`toast toast-${t.type}`}
              role={t.type === 'error' ? 'alert' : 'status'}
            >
              <Icon name={TOAST_ICON[t.type]} className="toast-icon" />
              <div>
                {t.title && <strong>{t.title}</strong>}
                <p>{t.message}</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => dismiss(t.id)}>
                <Icon name="close" />
              </button>
            </div>
          ))}
        </div>
        {confirmState && <ConfirmDialog state={confirmState} onClose={close} />}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}

function ConfirmDialog({
  state,
  onClose,
}: {
  state: ConfirmState;
  onClose: (ok: boolean) => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const danger = state.tone !== 'primary';
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop modal-center" onClick={() => onClose(false)}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={`confirm-icon ${danger ? 'is-danger' : ''}`}>
          <Icon name={state.icon ?? (danger ? 'warning' : 'help')} />
        </span>
        <h2 id="confirm-title">{state.title}</h2>
        {state.message && <div className="confirm-message">{state.message}</div>}
        <div className="confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={() => onClose(false)}>
            {state.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => onClose(true)}
          >
            {state.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside FeedbackProvider');
  return ctx;
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside FeedbackProvider');
  return ctx;
}
